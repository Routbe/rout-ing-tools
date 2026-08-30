import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { readCookie, readSession, SESSION_COOKIE } from "@/lib/auth/session.server";
import { clientIp } from "@/lib/api-guard.server";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit.server";

const claimSchema = z.object({
  userId: z.string().uuid(),
  handle: z.string().min(1).max(64),
  email: z.string().email(),
  userName: z.string().min(1).max(120),
});

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
/** Max 3 pogingen per gebruiker/IP per 10 minuten. */
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 10 * 60 * 1000;

type MailStatus = "sent" | "failed" | "failed_brevo_key" | "failed_network";

/** Stuurt één Brevo-template en rapporteert de exacte foutoorzaak terug. */
async function sendBrevo(
  apiKey: string,
  payload: Record<string, unknown>,
): Promise<{ status: MailStatus; error: string | null }> {
  try {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { status: "sent", error: null };
    const body = await res.text().catch(() => "");
    const status: MailStatus =
      res.status === 401 || res.status === 403 ? "failed_brevo_key" : "failed";
    return { status, error: `HTTP ${res.status}: ${body.slice(0, 500)}` };
  } catch (error) {
    return {
      status: "failed_network",
      error: error instanceof Error ? error.message : "network error",
    };
  }
}

export const Route = createFileRoute("/api/claim-root")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Authenticatie — sessiecookie of bearer-token.
        const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
        const cookieToken = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
        const session = await readSession(bearer || cookieToken);
        if (!session) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Ongeldige JSON-body" }, { status: 400 });
        }

        const parsed = claimSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json({ error: "Ongeldige invoer" }, { status: 400 });
        }
        const { userId, handle, email, userName } = parsed.data;

        // Geen impersonatie: het sessie-ID moet exact matchen.
        if (session.id !== userId) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        // 2. Rate limiting per gebruiker én per IP.
        try {
          enforceRateLimit(`claim-root:user:${userId}`, RATE_LIMIT, RATE_WINDOW_MS);
          enforceRateLimit(`claim-root:ip:${clientIp(request)}`, RATE_LIMIT, RATE_WINDOW_MS);
        } catch (error) {
          const retryAfter = error instanceof RateLimitError ? error.retryAfterSeconds : 600;
          return Response.json(
            { error: "Te veel aanvragen. Probeer het later opnieuw." },
            { status: 429, headers: { "retry-after": String(retryAfter) } },
          );
        }

        const cleanHandle = handle.replace(/^@/, "").toLowerCase();
        const requestedSubdomain = `${cleanHandle}.rout.be`;

        const databaseUrl = process.env["DATABASE_URL"];
        const brevoApiKey = process.env["BREVO_API_KEY"];
        if (!databaseUrl) {
          return Response.json({ error: "Serverconfiguratie ontbreekt" }, { status: 500 });
        }

        const sql = neon(databaseUrl);

        // 3. Dubbele claim afvangen.
        const existing = (await sql`
          select subdomain_tier, root_subdomain_status
            from public.profiles
           where id = ${userId}
           limit 1
        `) as Array<Record<string, unknown>>;
        const current = existing[0];
        if (!current) {
          return Response.json({ error: "Profiel niet gevonden" }, { status: 404 });
        }
        const currentStatus = (current["root_subdomain_status"] as string | null) ?? "none";
        const currentTier = (current["subdomain_tier"] as string | null) ?? "free";
        if (currentStatus === "pending_dns" || currentStatus === "active") {
          return Response.json(
            {
              error: "Er loopt al een aanvraag voor dit account.",
              subdomain: requestedSubdomain,
              status: currentStatus,
              tier: currentTier,
            },
            { status: 409 },
          );
        }

        // 4. Profiel bijwerken.
        await sql`
          update public.profiles
             set subdomain_tier = 'root_lifetime',
                 root_subdomain_status = 'pending_dns',
                 subdomain_alias = ${cleanHandle}
           where id = ${userId}
        `;

        // 5. Brevo-verzending met gedetailleerde foutrapportage.
        let adminMail: { status: MailStatus; error: string | null } = {
          status: "failed_brevo_key",
          error: "BREVO_API_KEY ontbreekt",
        };
        let userMail = adminMail;

        if (brevoApiKey) {
          const adminEmail = process.env["ADMIN_EMAIL"] ?? "admin@rout.be";
          [adminMail, userMail] = await Promise.all([
            sendBrevo(brevoApiKey, {
              templateId: 2,
              to: [{ email: adminEmail }],
              params: {
                requested_subdomain: requestedSubdomain,
                cname_source: cleanHandle,
                user_name: userName,
                user_email: email,
              },
            }),
            sendBrevo(brevoApiKey, {
              templateId: 3,
              to: [{ email }],
              params: {
                user_name: userName,
                requested_subdomain: requestedSubdomain,
                active_subdomain: requestedSubdomain,
              },
            }),
          ]);
        }

        // 6. Audit log.
        const errorPayload =
          adminMail.error || userMail.error
            ? JSON.stringify({ admin: adminMail.error, user: userMail.error })
            : null;
        try {
          await sql`
            insert into public.subdomain_root_claims
              (user_id, requested_subdomain, admin_mail_status, user_mail_status, error_payload)
            values (${userId}, ${requestedSubdomain}, ${adminMail.status}, ${userMail.status}, ${errorPayload})
          `;
        } catch (error) {
          console.error("[claim-root] audit log insert failed:", error);
        }

        return Response.json({
          success: true,
          admin_email: adminMail.status,
          user_email: userMail.status,
          admin_mail_error: adminMail.error,
          user_mail_error: userMail.error,
          subdomain: requestedSubdomain,
          status: "pending_dns",
        });
      },
    },
  },
});
