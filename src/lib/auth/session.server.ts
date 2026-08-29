import { sql } from "@/lib/neon";
import { generateToken, hashToken } from "./password.server";

/**
 * Session store for the Neon-native auth layer.
 *
 * A session is an opaque random token handed to the browser in an httpOnly
 * cookie; only its SHA-256 digest lives in `public.user_sessions`. No JWTs, no
 * third-party identity provider — everything resolves against Frankfurt.
 */

export const SESSION_COOKIE = "rout_session";
export const SESSION_TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  emailConfirmedAt: string | null;
  userMetadata: Record<string, unknown>;
  appMetadata: Record<string, unknown>;
  createdAt: string;
  lastSignInAt: string | null;
};

type Row = Record<string, unknown>;

export function toSessionUser(row: Row): SessionUser {
  return {
    id: row["id"] as string,
    email: row["email"] as string,
    emailConfirmedAt: (row["email_confirmed_at"] as string | null) ?? null,
    userMetadata: (row["user_metadata"] as Record<string, unknown> | null) ?? {},
    appMetadata: (row["app_metadata"] as Record<string, unknown> | null) ?? {},
    createdAt: row["created_at"] as string,
    lastSignInAt: (row["last_sign_in_at"] as string | null) ?? null,
  };
}

/** Issues a session row and returns the raw token for the cookie. */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipHash?: string | null } = {},
): Promise<{ token: string; expiresAt: string }> {
  const token = generateToken(32);
  const tokenHash = await hashToken(token);
  const rows = (await sql`
    insert into public.user_sessions (user_id, token_hash, user_agent, ip_hash, expires_at)
    values (${userId}, ${tokenHash}, ${meta.userAgent ?? null}, ${meta.ipHash ?? null},
            now() + make_interval(days => ${SESSION_TTL_DAYS}))
    returning expires_at
  `) as Row[];
  await sql`update public.users set last_sign_in_at = now(), updated_at = now() where id = ${userId}`;
  // Signing in always lifts a self-imposed freeze.
  const { reactivateOnSignIn } = await import("@/lib/account-status.server");
  await reactivateOnSignIn(userId);
  return { token, expiresAt: rows[0]?.["expires_at"] as string };
}

/** Resolves a raw cookie token to its user, sliding the last-seen stamp. */
export async function readSession(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const rows = (await sql`
    select u.id, u.email, u.email_confirmed_at, u.user_metadata, u.app_metadata,
           u.created_at, u.last_sign_in_at
      from public.user_sessions s
      join public.users u on u.id = s.user_id
     where s.token_hash = ${tokenHash}
       and s.revoked_at is null
       and s.expires_at > now()
       and u.is_disabled = false
     limit 1
  `) as Row[];
  const row = rows[0];
  if (!row) return null;
  await sql`update public.user_sessions set last_seen_at = now() where token_hash = ${tokenHash}`;
  return toSessionUser(row);
}

export async function revokeSession(token: string | null | undefined) {
  if (!token) return;
  const tokenHash = await hashToken(token);
  await sql`update public.user_sessions set revoked_at = now() where token_hash = ${tokenHash}`;
}

/**
 * Used after a password change: every other device is signed out. Pass the
 * caller's own token to keep the current device signed in.
 */
export async function revokeAllSessions(userId: string, keepToken?: string | null) {
  if (keepToken) {
    const keepHash = await hashToken(keepToken);
    await sql`update public.user_sessions set revoked_at = now()
               where user_id = ${userId} and revoked_at is null and token_hash <> ${keepHash}`;
    return;
  }
  await sql`update public.user_sessions set revoked_at = now()
             where user_id = ${userId} and revoked_at is null`;
}

export function buildSessionCookie(token: string, maxAgeSeconds: number) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
    "Secure",
  ];
  return parts.join("; ");
}

export function buildClearCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Secure`;
}

export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}
