import { createFileRoute } from "@tanstack/react-router";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";

const claimSchema = z.object({
  userId: z.string().uuid(),
  handle: z.string().min(1).max(64),
  email: z.string().email(),
  userName: z.string().min(1).max(120),
});

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

export const Route = createFileRoute("/api/claim-root")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const cleanHandle = handle.replace(/^@/, "").toLowerCase();
        const requestedSubdomain = `${cleanHandle}.rout.be`;

        const databaseUrl = process.env["DATABASE_URL"];
        const brevoApiKey = process.env["BREVO_API_KEY"];
        if (!databaseUrl || !brevoApiKey) {
          return Response.json({ error: "Serverconfiguratie ontbreekt" }, { status: 500 });
        }

        // 1. Update profile row in Neon Postgres
        const sql = neon(databaseUrl);
        await sql`
          UPDATE profiles
          SET subdomain_tier = 'root_lifetime',
              root_subdomain_status = 'pending_dns',
              subdomain_alias = ${cleanHandle}
          WHERE id = ${userId}
        `;

        // 2. Async Brevo dispatches (fire-and-forget, failures don't block the response)
        const sendBrevo = (payload: Record<string, unknown>) =>
          fetch(BREVO_URL, {
            method: "POST",
            headers: {
              "api-key": brevoApiKey,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(payload),
          }).catch((err) => console.error("[claim-root] Brevo dispatch failed:", err));

        // Mail 1 — Admin (template #2)
        void sendBrevo({
          templateId: 2,
          to: [{ email: "admin@rout.be" }],
          params: {
            requested_subdomain: requestedSubdomain,
            cname_source: cleanHandle,
            user_name: userName,
            user_email: email,
          },
        });

        // Mail 2 — User (template #3)
        void sendBrevo({
          templateId: 3,
          to: [{ email }],
          params: {
            user_name: userName,
            requested_subdomain: requestedSubdomain,
            active_subdomain: requestedSubdomain,
          },
        });

        return Response.json({
          success: true,
          subdomain: requestedSubdomain,
          status: "pending_dns",
        });
      },
    },
  },
});
