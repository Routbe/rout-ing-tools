import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";

/**
 * Live test of https://<active subdomain>/.well-known/atproto-did — run on the
 * server so the dashboard is not blocked by cross-origin rules.
 */
export const testAtprotoDid = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        handle: z
          .string()
          .trim()
          .min(1)
          .max(253)
          .regex(/^[a-z0-9.-]+$/),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertBlueskyAccess } = await import("./entitlement.server");
    await assertBlueskyAccess(context.userId); // deep-link / direct-RPC protection
    const host = data.handle.includes(".") ? data.handle : `${data.handle}.rout.be`;
    const url = `https://${host}/.well-known/atproto-did`;
    try {
      const res = await fetch(url, { headers: { accept: "text/plain" } });
      const body = (await res.text()).trim().slice(0, 200);
      return {
        url,
        ok: res.ok && body.startsWith("did:"),
        status: res.status,
        body,
      };
    } catch (error) {
      return {
        url,
        ok: false,
        status: 0,
        body: error instanceof Error ? error.message : "Request failed",
      };
    }
  });

/** Current subdomain settings for the signed-in member (Studio panel). */
export const getMySubdomainSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { readSubdomainSettings } = await import("./subdomain.server");
    return readSubdomainSettings(context.userId);
  });

/** Autosaves the subdomain toggle + redirect target + Bluesky DID. */
export const setMySubdomainSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        enabled: z.boolean(),
        target: z.enum(["rout_profile", "bluesky"]),
        did: z.string().trim().max(200).nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { writeSubdomainSettings } = await import("./subdomain.server");
    await writeSubdomainSettings(context.userId, data);
    return { ok: true };
  });

/**
 * Wizard step 1 — resolve a Bluesky handle to its DID through AT Protocol and
 * store both on the profile.
 */
export const linkBlueskyHandle = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data: unknown) =>
    z.object({ handle: z.string().trim().min(3).max(253) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const handle = data.handle.replace(/\s+/g, "").replace(/^@+/, "").toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(handle)) {
      return { ok: false as const, error: "Dat lijkt geen geldige Bluesky-handle." };
    }
    try {
      const res = await fetch(
        `https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`,
        { headers: { accept: "application/json" } },
      );
      if (!res.ok) {
        return { ok: false as const, error: `Bluesky kon @${handle} niet vinden.` };
      }
      const body = (await res.json()) as { did?: string };
      const did = typeof body.did === "string" && body.did.startsWith("did:") ? body.did : null;
      if (!did) return { ok: false as const, error: `Geen DID gevonden voor @${handle}.` };

      const { writeBlueskyIdentity } = await import("./subdomain.server");
      await writeBlueskyIdentity(context.userId, handle, did);
      return { ok: true as const, did, handle };
    } catch {
      return { ok: false as const, error: "Bluesky is niet bereikbaar. Probeer het opnieuw." };
    }
  });

/**
 * Claims the €39,99 root-subdomain add-on: flips the tier to `root_lifetime`,
 * parks DNS on `pending_dns` and mails the admin (Brevo template #2).
 */
export const claimRootSubdomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { claimRootSubdomainFor } = await import("./subdomain.server");
    try {
      return { ok: true as const, ...(await claimRootSubdomainFor(context.userId)) };
    } catch (error) {
      return {
        ok: false as const,
        error: error instanceof Error ? error.message : "Aanvraag mislukt.",
      };
    }
  });
