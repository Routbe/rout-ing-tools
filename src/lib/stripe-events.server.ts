/**
 * Stripe webhook event router (server-only).
 *
 * Card payments confirm synchronously; SEPA Direct Debit does not — the
 * Checkout Session completes while the debit is still clearing, and Stripe
 * follows up days later with an async event. Entitlements therefore only flip
 * on a *confirmed* charge, never on session completion alone.
 */

type StripeObject = Record<string, unknown>;

export interface StripeEvent {
  id?: string;
  type?: string;
  data?: { object?: StripeObject };
}

/** Events we act on. Anything else is acknowledged and ignored. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.succeeded",
  "payment_intent.processing",
  "payment_intent.canceled",
  "payment_intent.payment_failed",
  "payment_intent.requires_action",
  "invoice.paid",
  "invoice.payment_failed",
  "customer.subscription.deleted",
  "charge.refunded",
  "charge.dispute.created",
] as const;

function metadataOf(object: StripeObject | undefined): Record<string, string> {
  const meta = object?.["metadata"];
  return meta && typeof meta === "object" ? (meta as Record<string, string>) : {};
}

/** Finds the payment id wherever this event type carries it. */
function paymentIdOf(event: StripeEvent): string | null {
  const object = event.data?.object;
  const direct = metadataOf(object)["payment_id"];
  if (direct) return direct;

  // Subscription invoices carry it on the subscription's metadata.
  const details = object?.["subscription_details"] as StripeObject | undefined;
  const fromSubscription = metadataOf(details)["payment_id"];
  if (fromSubscription) return fromSubscription;

  const lines = (object?.["lines"] as { data?: StripeObject[] } | undefined)?.data;
  const fromLine = lines?.[0] ? metadataOf(lines[0])["payment_id"] : undefined;
  return fromLine ?? null;
}

function stringOf(object: StripeObject | undefined, key: string): string | null {
  const value = object?.[key];
  return typeof value === "string" ? value : null;
}

/**
 * Applies one verified Stripe event. Returns a short human-readable outcome so
 * the route can answer 200 with a diagnosable body.
 */
export async function applyStripeEvent(event: StripeEvent): Promise<string> {
  const object = event.data?.object ?? {};

  // Makersdonaties lopen buiten de verificatiebetalingen om.
  const meta = metadataOf(object);

  // SecureShield-opwaarderingen: alleen bijschrijven bij een geslaagde betaling.
  if (meta["kind"] === "wallet_topup" && meta["user_id"]) {
    const succeeded =
      event.type === "payment_intent.succeeded" ||
      event.type === "checkout.session.async_payment_succeeded" ||
      (event.type === "checkout.session.completed" &&
        (stringOf(object, "payment_status") ?? "paid") === "paid");
    if (!succeeded) return "wallet topup ignored";
    const { creditWallet } = await import("./wallet.server");
    const amount = Number(meta["amount_cents"] ?? 0);
    const credited = await creditWallet({
      userId: meta["user_id"],
      amountCents: amount,
      kind: "topup",
      description: "SecureShield opwaardering",
      reference: `stripe:${stringOf(object, "id") ?? event.id ?? ""}`,
    });
    return credited ? "wallet credited" : "wallet topup duplicate";
  }

  if (meta["kind"] === "creator_donation" && meta["donation_id"]) {
    const { markDonation } = await import("./donations.server");
    const ref = stringOf(object, "id");
    switch (event.type) {
      case "checkout.session.completed": {
        const status = stringOf(object, "payment_status");
        if (status && status !== "paid" && status !== "no_payment_required") {
          await markDonation(meta["donation_id"], "processing", ref);
          return "donation processing";
        }
        await markDonation(meta["donation_id"], "paid", ref);
        return "donation paid";
      }
      case "checkout.session.async_payment_succeeded":
      case "payment_intent.succeeded":
        await markDonation(meta["donation_id"], "paid", ref);
        return "donation paid";
      case "payment_intent.processing":
        await markDonation(meta["donation_id"], "processing", ref);
        return "donation processing";
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
      case "payment_intent.payment_failed":
      case "payment_intent.canceled":
        await markDonation(meta["donation_id"], "failed", ref);
        return "donation failed";
      default:
        return "donation event ignored";
    }
  }

  const paymentId = paymentIdOf(event);
  if (!paymentId) return "ignored (no payment reference)";

  const {
    activateVerification,
    markPaymentStatus,
    revokeVerification,
    endRecurringDonation,
    confirmRecurringDonation,
  } = await import("./verification.server");

  switch (event.type) {
    case "checkout.session.completed": {
      const status = stringOf(object, "payment_status");
      const ref = stringOf(object, "id");
      // SEPA: `unpaid`/`processing` here means the debit is still clearing.
      if (status && status !== "paid" && status !== "no_payment_required") {
        await markPaymentStatus(paymentId, "processing", ref);
        return "sepa payment processing";
      }
      await activateVerification(paymentId, ref);
      return "activated";
    }

    case "checkout.session.async_payment_succeeded": {
      await activateVerification(paymentId, stringOf(object, "id"));
      return "activated (async)";
    }

    case "checkout.session.async_payment_failed": {
      await markPaymentStatus(paymentId, "failed", stringOf(object, "id"));
      return "async payment failed";
    }

    case "checkout.session.expired": {
      await markPaymentStatus(paymentId, "expired", stringOf(object, "id"));
      return "session expired";
    }

    // Embedded Elements (kaart, Bancontact, iDEAL, Klarna) verlopen zonder
    // Checkout Session: die flow meldt zich uitsluitend via payment_intent.*.
    // Zonder deze takken bleef een geslaagde redirect-betaling onbevestigd —
    // geen activering, geen bevestigingsmail.
    case "payment_intent.succeeded": {
      await activateVerification(paymentId, stringOf(object, "id"));
      return "activated (payment_intent)";
    }

    case "payment_intent.processing": {
      await markPaymentStatus(paymentId, "processing", stringOf(object, "id"));
      return "payment processing";
    }

    case "payment_intent.canceled": {
      await markPaymentStatus(paymentId, "failed", stringOf(object, "id"), "canceled");
      return "payment canceled";
    }

    case "payment_intent.payment_failed": {
      const declineCode = stringOf(object, "last_payment_error[decline_code]") ??
        (object?.["last_payment_error"] as StripeObject | undefined)?.["decline_code"] as string | undefined;
      const message = stringOf(object, "last_payment_error[message]") ??
        (object?.["last_payment_error"] as StripeObject | undefined)?.["message"] as string | undefined;
      const reason = [declineCode, message].filter(Boolean).join(" — ") || "payment_failed";
      await markPaymentStatus(paymentId, "incomplete", stringOf(object, "id"), reason);
      return `payment incomplete (${reason})`;
    }

    case "payment_intent.requires_action": {
      await markPaymentStatus(paymentId, "incomplete", stringOf(object, "id"), "requires_action");
      return "payment requires customer action";
    }

    case "invoice.paid": {
      await confirmRecurringDonation(paymentId);
      return "donation renewed";
    }

    case "invoice.payment_failed": {
      await markPaymentStatus(paymentId, "failed", stringOf(object, "id"));
      return "invoice payment failed";
    }

    case "customer.subscription.deleted": {
      await endRecurringDonation(paymentId);
      return "donation cancelled";
    }

    case "charge.refunded":
    case "charge.dispute.created": {
      await revokeVerification(
        paymentId,
        event.type === "charge.refunded" ? "refund" : "chargeback",
      );
      return "revoked";
    }

    default:
      return "ignored";
  }
}
