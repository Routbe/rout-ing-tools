import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 2 of Google / GitHub sign-in — short, Vercel-friendly path.
 *
 * Register these callback URLs with the providers:
 *   https://<domain>/api/auth/google/callback
 *   https://<domain>/api/auth/github/callback
 *
 * The handler exchanges the code, looks the member up (or creates them) in the
 * Neon `users` table, sets the httpOnly `rout_session` cookie and hands the
 * browser to the shared post-login destination.
 */
export const Route = createFileRoute("/api_/auth/$provider/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { isSocialProvider, completeSocialCallback, SocialAuthError } = await import(
          "@/lib/social-oauth.server"
        );
        const provider = String(params.provider ?? "");
        if (!isSocialProvider(provider)) {
          return new Response("Unknown provider", { status: 404 });
        }

        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const providerError = url.searchParams.get("error");

        const fail = (reason: string) =>
          new Response(null, {
            status: 302,
            headers: {
              location: `/auth?error=${encodeURIComponent(reason)}`,
              "cache-control": "no-store",
            },
          });

        if (providerError) return fail(providerError);
        if (!code || !state) return fail("missing_code");

        try {
          const result = await completeSocialCallback({
            code,
            state,
            userAgent: request.headers.get("user-agent"),
          });
          return new Response(null, {
            status: 302,
            headers: {
              location: result.next,
              ...(result.cookie ? { "set-cookie": result.cookie } : {}),
              "cache-control": "no-store",
            },
          });
        } catch (error) {
          const reason = error instanceof SocialAuthError ? error.code : "signin_failed";
          console.error(`[social-auth] callback failed for ${provider}: ${reason}`);
          return fail(reason);
        }
      },
    },
  },
});
