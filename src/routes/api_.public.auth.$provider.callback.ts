import { createFileRoute } from "@tanstack/react-router";

/**
 * Step 2 of Google / GitHub sign-in: exchange the code, open the ROUT session
 * cookie and hand the browser to the shared post-login screen, which decides
 * between the portal, onboarding and the dashboard.
 */
export const Route = createFileRoute("/api_/public/auth/$provider/callback")({
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
