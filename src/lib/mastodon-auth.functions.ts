/**
 * Public RPC surface for Mastodon / Fediverse sign-in.
 *
 * Both wrappers are intentionally unauthenticated — they are the sign-in path
 * itself. All secrets (per-instance client id/secret, sealed state) stay on the
 * server; the browser only ever sees an authorize URL and a single-use token.
 *
 * Error boundary: handlers log the full failure server-side and rethrow only
 * the safe, code-mapped message from mastodon-auth.errors — raw env/config or
 * instance detail never crosses the wire.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest, getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { throwSafeMastodonError } from "./mastodon-auth.errors";

/** Step 1 — register on the instance (if needed) and hand back its authorize URL. */
export const startMastodonLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        instance: z.string().min(1).max(253),
        next: z.string().max(500).optional(),
        // Correlation id minted in the browser: threads client and server logs.
        cid: z.string().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const request = getRequest();
      const requestUrl = new URL(request.url);
      const forwardedHost = request.headers.get("x-forwarded-host");
      const forwardedProto = request.headers.get("x-forwarded-proto");
      const origin = forwardedHost
        ? `${forwardedProto || requestUrl.protocol.replace(":", "")}://${forwardedHost}`
        : requestUrl.origin;
      const { buildMastodonAuthorizeUrl } = await import("./mastodon-auth.server");
      return await buildMastodonAuthorizeUrl({
        instance: data.instance,
        origin,
        ...(data.next ? { next: data.next } : {}),
        ...(data.cid ? { cid: data.cid } : {}),
      });
    } catch (error) {
      throwSafeMastodonError(error, "start_login_failed", { instance: data.instance });
    }
  });

/** Step 2 — exchange the code, verify the account, and open the ROUT session. */
export const completeMastodonLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        code: z.string().min(1).max(2000),
        state: z.string().min(1).max(8000),
        cid: z.string().max(60).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const { completeMastodonCallback } = await import("./mastodon-auth.server");
      const result = await completeMastodonCallback({
        code: data.code,
        state: data.state,
        ...(data.cid ? { cid: data.cid } : {}),
      });
      // Open the session here: the browser never handles a token, it just gets
      // the same httpOnly cookie as a password sign-in.
      const { createSession, buildSessionCookie } = await import("./auth/session.server");
      const session = await createSession(result.userId, { userAgent: getRequestHeader("user-agent") });
      setResponseHeader("set-cookie", buildSessionCookie(session.token, 60 * 60 * 24 * 30));
      const { userId: _userId, ...safe } = result;
      return safe;
    } catch (error) {
      // Never log `code`/`state` here — they are single-use credentials.
      throwSafeMastodonError(error, "complete_login_failed");
    }
  });
