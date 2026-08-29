import { createFileRoute } from "@tanstack/react-router";

/**
 * POST /api/public/auth/magic-link  { "email": "member@example.com" }
 *
 * Neon-native e-mail sign-in: issues a magic-link token plus a 6-digit code in
 * Neon and hands the mail to the central Brevo mailer (`sendMail`) with the
 * login template block (base 12: nl #12, en #13, …). The answer never reveals
 * whether the address exists.
 */
export const Route = createFileRoute("/api_/public/auth/magic-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { guardRequest } = await import("@/lib/api-guard.server");
        const limited = guardRequest(request, "magic-link", 10, 600000);
        if (limited) return limited;

        let email = "";
        try {
          const body = (await request.json()) as { email?: unknown };
          email = typeof body.email === "string" ? body.email.trim() : "";
        } catch {
          return Response.json({ ok: false, error: "invalid_body" }, { status: 400 });
        }
        if (email.length < 5 || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
        }

        const { requestEmailCode } = await import("@/lib/auth/users.server");
        const origin = new URL(request.url).origin;
        try {
          const result = await requestEmailCode(email, origin);
          return Response.json({ ok: true, delivered: result.sent || !result.known });
        } catch (error) {
          console.error(
            "[Auth] magic-link request failed:",
            error instanceof Error ? error.message : error,
          );
          return Response.json({ ok: false, error: "send_failed" }, { status: 500 });
        }
      },
    },
  },
});
