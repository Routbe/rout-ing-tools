import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

const handleSchema = (data: unknown) => {
  const handle = String((data as { referrer?: unknown })?.referrer ?? "")
    .replace(/^@/, "")
    .toLowerCase()
    .trim();
  if (!/^[a-z0-9](?:[a-z0-9._-]{0,118}[a-z0-9])?$/.test(handle)) {
    throw new Error("Invalid referrer handle");
  }
  return { referrer: handle };
};

/**
 * Bindt het ingelogde lid aan de handle die hem uitnodigde. Eén inviter per
 * lid, geen zelf-referral — een dubbele claim is een stille no-op.
 */
export const claimReferral = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator(handleSchema)
  .handler(async ({ data, context }) => {
    const { claimReferralForUser } = await import("./referral.server");
    const result = await claimReferralForUser(context.userId, data.referrer);
    return result.ok ? { ok: true as const } : { ok: false as const, reason: result.reason ?? "failed" };
  });

/** Aantal uitnodigingen, geverifieerde vrienden en de vrijgespeelde beloning. */
export const getReferralStats = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { referralStatsFor } = await import("./referral.server");
    return await referralStatsFor(context.userId);
  });
