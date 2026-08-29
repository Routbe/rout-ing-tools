import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Neon-native replacement for the old Postgres auth middleware.
 *
 * Reads the httpOnly session cookie, resolves it against `public.user_sessions`
 * and puts `userId` plus the user record on the server-function context.
 */
export const requireAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { readSession, readCookie, SESSION_COOKIE } = await import("./session.server");
  const token = readCookie(getRequestHeader("cookie"), SESSION_COOKIE);
  const user = await readSession(token);
  if (!user) throw new Error("Unauthorized");
  const { createUserDb } = await import("@/lib/db/user-client.server");
  const db = createUserDb(user.id);
  // Legacy `claims` shape (JWT-style) so migrated call sites keep working.
  const claims = {
    sub: user.id,
    email: user.email,
    email_confirmed_at: user.emailConfirmedAt,
    email_verified: Boolean(user.emailConfirmedAt),
  };
  return next({ context: { userId: user.id, user, claims, db } });
});

/** Same lookup, but anonymous callers are allowed through with `userId: null`. */
export const optionalAuth = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { readSession, readCookie, SESSION_COOKIE } = await import("./session.server");
  const token = readCookie(getRequestHeader("cookie"), SESSION_COOKIE);
  const user = await readSession(token).catch(() => null);
  const { createUserDb } = await import("@/lib/db/user-client.server");
  const db = user ? createUserDb(user.id) : null;
  const claims = user
    ? {
        sub: user.id,
        email: user.email,
        email_confirmed_at: user.emailConfirmedAt,
        email_verified: Boolean(user.emailConfirmedAt),
      }
    : null;
  return next({ context: { userId: user?.id ?? null, user, claims, db } });
});
