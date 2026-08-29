import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 1 of Google / GitHub sign-in — short, Vercel-friendly path.
 *
 * `/api/auth/google` and `/api/auth/github` redirect the browser to the
 * provider with an encrypted state parameter. The longer
 * `/api/public/auth/:provider` route stays available for older links; both
 * share the same logic in `social-oauth.server.ts`.
 */
export const Route = createFileRoute("/api_/auth/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { isSocialProvider, buildAuthorizeUrl, SocialAuthError } = await import(
          "@/lib/social-oauth.server"
        );
        const provider = String(params.provider ?? "");
        if (!isSocialProvider(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }

        const url = new URL(request.url);
        const forwardedHost = request.headers.get("x-forwarded-host");
        const forwardedProto = request.headers.get("x-forwarded-proto");
        const origin = forwardedHost
          ? `${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost}`
          : url.origin;

        try {
          // `?link=1` on an authenticated request attaches the provider account
          // to the current member instead of opening a new session.
          let linkUserId: string | null = null;
          if (url.searchParams.get("link") === "1") {
            const { readSession, readCookie, SESSION_COOKIE } = await import(
              "@/lib/auth/session.server"
            );
            const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
            const sessionUser = await readSession(token).catch(() => null);
            linkUserId = sessionUser?.id ?? null;
          }

          const authorizeUrl = await buildAuthorizeUrl({
            provider,
            origin,
            next: url.searchParams.get("next"),
            linkUserId,
          });
          return new Response(null, {
            status: 302,
            headers: { location: authorizeUrl, "cache-control": "no-store" },
          });
        } catch (error) {
          const code = error instanceof SocialAuthError ? error.code : "start_failed";
          console.error(`[social-auth] start failed for ${provider}: ${code}`);
          return new Response(null, {
            status: 302,
            headers: { location: `/auth?error=${encodeURIComponent(code)}`, "cache-control": "no-store" },
          });
        }
      },
    },
  },
});
