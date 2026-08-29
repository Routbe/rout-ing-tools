import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Publieke RPC voor de nieuwsbriefwidget op profielpagina's. */
const schema = z.object({
  handle: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .transform((v) => v.replace(/^@+/, "").toLowerCase()),
  email: z.string().trim().toLowerCase().email().max(200),
  turnstileToken: z.string().max(4000).optional().nullable(),
});

export const subscribeNewsletter = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { assertHuman } = await import("./turnstile.server");
    await assertHuman(data.turnstileToken ?? null);
    const { subscribeToNewsletter } = await import("./newsletter.server");
    return subscribeToNewsletter({ handle: data.handle, email: data.email });
  });
