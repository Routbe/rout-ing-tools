/**
 * Combineert promocode en referral-beloning: het lid betaalt altijd de laagste
 * van de twee. Server-only, zodat een aangepaste client nooit zijn eigen
 * korting kan verzinnen. De basisprijs en de toeslag per betaalmethode komen
 * uit het dynamische prijsbeheer (`pricing_settings`).
 */
import {
  methodFeeCents,
  priceAfterPromo,
  type CheckoutMethod,
  type PromoDiscount,
} from "./checkout-pricing";

export async function bestPriceCents(
  method: CheckoutMethod,
  promo: PromoDiscount | null,
  userId: string,
): Promise<number> {
  const { getPricing } = await import("./pricing-settings.server");
  const pricing = await getPricing();
  const promoPrice = priceAfterPromo(method, promo, pricing);
  try {
    const { referralStatsFor } = await import("./referral.server");
    const { reward } = await referralStatsFor(userId);
    const base = Math.max(0, pricing.baseCents);
    const referralPrice =
      Math.max(0, base - Math.round((base * reward.percentOff) / 100)) +
      methodFeeCents(method, pricing);
    return Math.min(promoPrice, referralPrice);
  } catch {
    return promoPrice;
  }
}
