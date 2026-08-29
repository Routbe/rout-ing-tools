import { createHmac, timingSafeEqual } from "crypto";
import { createFileRoute } from "@tanstack/react-router";

function verifyStripeSignature(body: string, signature: string, secret: string): boolean {
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...value] = part.split("=");
      return [key, value.join("=")];
    }),
  );
  const timestamp = parts["t"];
  const expected = parts["v1"];
  if (!timestamp || !expected) return false;

  const signedPayload = `${timestamp}.${body}`;
  const digest = createHmac("sha256", secret).update(signedPayload).digest("hex");
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(digest, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

export const Route = createFileRoute("/api_/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const signature = request.headers.get("stripe-signature") ?? "";
        const body = await request.text();
        if (!verifyStripeSignature(body, signature, secret)) {
          return new Response("Invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as { id?: string; type?: string };
        const { dbAdmin } = await import("@/lib/db/admin.server");
        if (event.id) {
          const { error } = await dbAdmin.from("webhook_events").insert({
            id: event.id,
            source: "stripe",
            kind: event.type ?? null,
          });
          if (error && error.code === "23505") return new Response("duplicate", { status: 200 });
          if (error) throw error;
        }

        const { applyStripeEvent } = await import("@/lib/stripe-events.server");
        const result = await applyStripeEvent(event);
        return new Response(result, { status: 200 });
      },
    },
  },
});
