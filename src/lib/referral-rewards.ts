/**
 * Referral-gamification — isomorf (client en server rekenen identiek).
 *
 * 3 uitnodigingen        -> 50% korting op de verificatie
 * 3 geverifieerde vrienden -> gratis verificatie
 * 10 uitnodigingen       -> gratis verificatie + badge "De Influencer"
 */

export const INVITE_TIERS = {
  halfPrice: 3,
  freeVerified: 3,
  influencer: 10,
} as const;

export interface ReferralStats {
  invited: number;
  verifiedInvites: number;
}

export interface ReferralReward {
  /** 0–100 korting op de verificatieprijs. */
  percentOff: number;
  /** Korte NL-omschrijving voor de UI. */
  label: string | null;
  influencer: boolean;
}

export function referralReward(stats: ReferralStats): ReferralReward {
  const influencer = stats.invited >= INVITE_TIERS.influencer;
  if (influencer) {
    return { percentOff: 100, label: "Gratis verificatie — De Influencer", influencer: true };
  }
  if (stats.verifiedInvites >= INVITE_TIERS.freeVerified) {
    return { percentOff: 100, label: "Gratis verificatie — 3 geverifieerde vrienden", influencer: false };
  }
  if (stats.invited >= INVITE_TIERS.halfPrice) {
    return { percentOff: 50, label: "50% korting — 3 vrienden uitgenodigd", influencer: false };
  }
  return { percentOff: 0, label: null, influencer: false };
}

/** Volgende mijlpaal, voor de voortgangsbalk in het dashboard. */
export function nextMilestone(stats: ReferralStats): { goal: number; remaining: number; label: string } | null {
  if (stats.invited < INVITE_TIERS.halfPrice) {
    return {
      goal: INVITE_TIERS.halfPrice,
      remaining: INVITE_TIERS.halfPrice - stats.invited,
      label: "50% korting op je verificatie",
    };
  }
  if (stats.invited < INVITE_TIERS.influencer) {
    return {
      goal: INVITE_TIERS.influencer,
      remaining: INVITE_TIERS.influencer - stats.invited,
      label: "Gratis verificatie + badge De Influencer",
    };
  }
  return null;
}
