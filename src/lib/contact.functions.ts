import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().min(1).max(150),
  message: z.string().trim().min(1).max(2000),
  locale: z.enum(["nl", "en", "fr", "de"]).default("en"),
  /** Honeypot: bots fill hidden inputs, humans never see it. */
  company: z.string().max(200).optional().default(""),
  /** Proof-of-time: epoch ms of page load, set by the form on mount. */
  formLoadedAt: z.number().int().nonnegative().optional(),
});

export type ContactFormInput = z.input<typeof contactSchema>;

export interface ContactSubmitResult {
  ok: boolean;
  /** Translation-friendly reason when ok === false. */
  reason?: "rate_limited" | "invalid" | "delivery_failed" | "not_configured";
  /** Channels that actually went out (for observability, never shown raw). */
  delivered?: { admin: boolean; autoReply: boolean; kchat: boolean };
  /** Whether the message is safely stored, so the user knows it is not lost. */
  stored?: boolean;
  /** Short, human-readable failure detail, safe to show in a toast. */
  detail?: string;
}


export const submitContactMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => contactSchema.parse(data))
  .handler(async ({ data }): Promise<ContactSubmitResult> => {
    const [{ dbAdmin }, server] = await Promise.all([
      import("@/lib/db/admin.server"),
      import("@/lib/contact.server"),
    ]);

    const senderHash = await server.senderHashFromHeaders(getRequest().headers);

    // Silently swallow honeypot hits: bots get a success shape, nothing is sent.
    if (data.company.trim().length > 0) {
      return { ok: true, delivered: { admin: false, autoReply: false, kchat: false } };
    }

    // Proof-of-time: no human fills this form in under ~2 seconds. Bots do.
    const minFillMs = 2000;
    if (typeof data.formLoadedAt === "number") {
      const elapsed = Date.now() - data.formLoadedAt;
      if (elapsed >= 0 && elapsed < minFillMs) {
        console.warn(`[contact] proof-of-time reject: ${elapsed}ms since page load`);
        return { ok: true, delivered: { admin: false, autoReply: false, kchat: false } };
      }
    }

    // Layer 3 — lightweight in-memory IP throttle, before touching the database.
    if (senderHash) {
      const { enforceRateLimit, RateLimitError } = await import("@/lib/rate-limit.server");
      try {
        enforceRateLimit(`contact:${senderHash}`, 5, 10 * 60 * 1000);
      } catch (error) {
        if (error instanceof RateLimitError) return { ok: false, reason: "rate_limited" };
        throw error;
      }
    }


    const rpc = (
      dbAdmin as unknown as {
        rpc: (
          name: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: number | null; error: { message: string } | null }>;
      }
    ).rpc;

    if (senderHash) {
      const { data: recent, error: rateError } = await rpc.call(dbAdmin, "contact_submissions_recent_count", {
        _sender_hash: senderHash,
        _window_minutes: 10,
      });
      if (rateError) {
        console.error("[contact] rate-limit lookup failed:", rateError.message);
      } else if ((recent ?? 0) >= 5) {
        return { ok: false, reason: "rate_limited" };
      }
    }

    const submittedAt = new Date().toISOString();
    const payload = {
      name: data.name,
      email: data.email,
      subject: data.subject,
      message: data.message,
      locale: data.locale,
      submittedAt,
    };

    console.info(
      `[contact] step 1/3 db insert: name=${data.name.length}ch email=${data.email.split("@")[1] ?? "?"} subject="${data.subject}" message=${data.message.length}ch locale=${data.locale}`,
    );

    const { data: row, error: insertError } = await dbAdmin

      .from("contact_submissions")
      .insert({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
        locale: data.locale,
        status: "pending",
        sender_hash: senderHash,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[contact] db insert failed:", insertError.message);
    } else {
      console.info(`[contact] db insert ok id=${row?.id ?? "unknown"} locale=${data.locale}`);
    }

    const failures: string[] = [];
    const missingConfig: string[] = [];
    const delivered = { admin: false, autoReply: false, kchat: false };

    // ---- Step 2: Brevo transactional e-mail -------------------------------
    if (server.isBrevoConfigured()) {
      console.info("[contact] step 2/3 brevo: sending admin notification");
      try {
        await server.sendAdminNotification(payload);
        delivered.admin = true;
        console.info("[contact] brevo admin notification sent");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[contact] brevo admin notification FAILED:", message);
        failures.push(`admin: ${message}`);
      }
      try {
        await server.sendVisitorAutoReply(payload);
        delivered.autoReply = true;
        console.info(`[contact] brevo auto-reply sent locale=${data.locale}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[contact] brevo auto-reply FAILED:", message);
        failures.push(`auto-reply: ${message}`);
      }
    } else {
      console.warn("[contact] step 2/3 brevo SKIPPED: BREVO_API_KEY missing");
      missingConfig.push("BREVO_API_KEY");
      failures.push("admin: BREVO_API_KEY missing");
    }

    // ---- Step 3: KChat webhook -------------------------------------------
    if (server.isKchatConfigured()) {
      console.info("[contact] step 3/3 kchat: posting webhook");
      try {
        await server.notifyKchat(payload);
        delivered.kchat = true;
        console.info("[contact] kchat notification sent");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[contact] kchat webhook FAILED:", message);
        failures.push(`kchat: ${message}`);
      }
    } else {
      console.warn("[contact] step 3/3 kchat SKIPPED: KCHAT_WEBHOOK_URL missing");
      missingConfig.push("KCHAT_WEBHOOK_URL");
      failures.push("kchat: KCHAT_WEBHOOK_URL missing");
    }

    if (failures.length > 0) {
      console.error("[contact] delivery issues:", failures.join(" | "));
    }

    const status = delivered.admin ? (failures.length > 0 ? "sent_partial" : "sent") : "failed";
    const stored = !insertError && Boolean(row?.id);

    if (row?.id) {
      console.info(`[contact] finalising id=${row.id} status=${status}`);
      const { error: updateError } = await dbAdmin
        .from("contact_submissions")
        .update({
          status,
          error_detail: failures.length > 0 ? failures.join(" | ").slice(0, 1000) : null,
        })
        .eq("id", row.id);
      if (updateError) {
        console.error("[contact] status update failed:", updateError.message);
      }
    }

    console.info(
      `[contact] done stored=${stored} admin=${delivered.admin} autoReply=${delivered.autoReply} kchat=${delivered.kchat}`,
    );

    // Nothing is lost when the row is stored, but we never fake success:
    // the visitor must know when no e-mail actually went out.
    if (!delivered.admin) {
      const detail =
        missingConfig.length > 0
          ? `Server configuration missing: ${missingConfig.join(", ")}`
          : failures.join(" | ").slice(0, 300);
      return {
        ok: false,
        reason: missingConfig.includes("BREVO_API_KEY") ? "not_configured" : "delivery_failed",
        delivered,
        stored,
        detail,
      };
    }

    if (failures.length > 0) {
      return { ok: true, delivered, stored, detail: failures.join(" | ").slice(0, 300) };
    }

    return { ok: true, delivered, stored };
  });

