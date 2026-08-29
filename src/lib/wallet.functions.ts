import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";

/** RPC-laag voor de SecureShield prepaid wallet. Alles vereist een sessie. */

const topupSchema = z.object({
  amountCents: z.number().int().min(300).max(20_000),
  origin: z.string().url().max(300),
});

const autoTopupSchema = z.object({
  enabled: z.boolean(),
  amountCents: z.number().int().min(300).max(20_000),
});

export const getWallet = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { readWallet } = await import("./wallet.server");
    return readWallet(context.userId);
  });

export const startWalletTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => topupSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { getRequest } = await import("@tanstack/react-start/server");
    const { trustedCheckoutOrigin } = await import("./verification.server");
    const { startWalletTopup } = await import("./wallet.server");
    const origin = trustedCheckoutOrigin(getRequest(), data.origin);
    return startWalletTopup({
      userId: context.userId,
      amountCents: data.amountCents,
      origin,
    });
  });

export const updateWalletAutoTopup = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: unknown) => autoTopupSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { setAutoTopup, readWallet } = await import("./wallet.server");
    await setAutoTopup(context.userId, data.enabled, data.amountCents);
    return readWallet(context.userId);
  });
