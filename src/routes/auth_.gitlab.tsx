import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 1 of GitLab sign-in: redirect the browser to
 * https://gitlab.com/oauth/authorize with our client_id, the registered
 * redirect_uri (GITLAB_REDIRECT_URI) and the `read_user` scope.
 *
 * The client secret never leaves the server; `state` is sealed with AES-GCM
 * by the shared social OAuth layer.
 */
export const Route = createFileRoute("/auth_/gitlab")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { buildAuthorizeUrl, SocialAuthError } = await import("@/lib/social-oauth.server");

        const url = new URL(request.url);
        const forwardedHost = request.headers.get("x-forwarded-host");
        const forwardedProto = request.headers.get("x-forwarded-proto");
        const origin = forwardedHost
          ? `${forwardedProto || url.protocol.replace(":", "")}://${forwardedHost}`
          : url.origin;

        try {
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
            provider: "gitlab",
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
          console.error(`[social-auth] start failed for gitlab: ${code}`);
          return new Response(null, {
            status: 302,
            headers: {
              location: `/auth?error=${encodeURIComponent(code)}`,
              "cache-control": "no-store",
            },
          });
        }
      },
    },
  },
});
