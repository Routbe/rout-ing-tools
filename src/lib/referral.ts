/**
 * Referral capture — client-safe.
 *
 * A visitor arriving on `rout.be/r/<handle>` is tagged with the inviter's
 * handle. The tag survives the whole sign-up detour (e-mail confirmation,
 * OAuth round-trip) because it lives in both localStorage and a first-party
 * cookie, and it is only consumed once the new member is actually signed in.
 */

export const REFERRAL_KEY = "rout_ref";
export const REFERRAL_TTL_DAYS = 30;

export function referralPath(username: string): string {
  return `/r/${username.replace(/^@/, "").toLowerCase()}`;
}

export function referralUrl(username: string, origin?: string): string {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "https://rout.be");
  return `${base}${referralPath(username)}`;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

/** Remember the inviter. First tag wins, so an inviter is never overwritten. */
export function storeReferrer(username: string): void {
  const handle = username.replace(/^@/, "").toLowerCase();
  if (!handle) return;
  if (readReferrer()) return;
  try {
    window.localStorage.setItem(REFERRAL_KEY, handle);
  } catch {
    /* storage blocked — the cookie below still carries the tag */
  }
  if (typeof document !== "undefined") {
    const maxAge = REFERRAL_TTL_DAYS * 24 * 60 * 60;
    document.cookie = `${REFERRAL_KEY}=${encodeURIComponent(handle)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  }
}

export function readReferrer(): string | null {
  try {
    const stored = window.localStorage.getItem(REFERRAL_KEY);
    if (stored) return stored;
  } catch {
    /* fall through to the cookie */
  }
  return readCookie(REFERRAL_KEY);
}

export function clearReferrer(): void {
  try {
    window.localStorage.removeItem(REFERRAL_KEY);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.cookie = `${REFERRAL_KEY}=; path=/; max-age=0; SameSite=Lax`;
  }
}
