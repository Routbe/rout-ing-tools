import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

/**
 * Step A — the primary account confirms its password and receives a one-time
 * pin plus a QR payload, valid for five minutes.
 */
export const startAccountMerge = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { password: string }) => {
    if (!input?.password) throw new Error("password_required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { createMergeTicket, verifyOwnPassword } = await import("./account-merge.server");
    if (!(await verifyOwnPassword(context.userId, data.password))) {
      return { ok: false as const, reason: "bad_password" as const };
    }
    const ticket = await createMergeTicket(context.userId);
    return {
      ok: true as const,
      pin: ticket.pin,
      qrPayload: `rout-merge:${ticket.token}`,
      expiresAt: ticket.expiresAt,
    };
  });

/**
 * Steps B–D — the secondary account redeems the pin (or scanned token), proves
 * its identity and hands everything over to the primary account.
 */
export const redeemAccountMerge = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { pin?: string; token?: string; password: string }) => {
    if (!input?.password) throw new Error("password_required");
    if (!input.pin && !input.token) throw new Error("code_required");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { redeemMergeTicket } = await import("./account-merge.server");
    const token = data.token?.replace(/^rout-merge:/, "") ?? null;
    return redeemMergeTicket({
      secondaryUserId: context.userId,
      secondaryPassword: data.password,
      pin: data.pin?.trim() || null,
      token: token?.trim() || null,
    });
  });
