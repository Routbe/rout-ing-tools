import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 2 of GitLab sign-in: exchange the incoming `code` server-side at
 * https://gitlab.com/oauth/token, read the account from
 * https://gitlab.com/api/v4/user, link or create the ROUT member and open our
 * own httpOnly session cookie.
 */
export const Route = createFileRoute("/auth_/gitlab/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { completeSocialCallback, SocialAuthError } = await import(
          "@/lib/social-oauth.server"
        );

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
          console.error(`[social-auth] callback failed for gitlab: ${reason}`);
          return fail(reason);
        }
      },
    },
  },
});
