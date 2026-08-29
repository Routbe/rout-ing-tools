import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, setResponseHeader } from "@tanstack/react-start/server";
import { requireAuth } from "@/lib/auth/middleware";

/**
 * Public RPC surface of the Neon-native auth layer. These functions are what
 * the browser talks to: sign-up, sign-in, magic links, password reset and
 * session lookup. No Postgres, no JWT — an httpOnly cookie backed by
 * `public.user_sessions` in Frankfurt.
 */

export type AuthUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_metadata: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app_metadata: Record<string, any>;
  created_at: string;
  last_sign_in_at: string | null;
};

const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export const getSessionUser = createServerFn({ method: "GET" }).handler(async (): Promise<AuthUser | null> => {
  const { readSession, readCookie, SESSION_COOKIE } = await import("@/lib/auth/session.server");
  const { toAuthUser } = await import("@/lib/auth/serialize.server");
  const user = await readSession(readCookie(getRequestHeader("cookie"), SESSION_COOKIE));
  return user ? toAuthUser(user) : null;
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string; metadata?: Record<string, unknown> }) => input)
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; code: string; message: string }> => {
    const { createUser, requestEmailConfirmation, AuthError } = await import("@/lib/auth/users.server");
    const { createSession, buildSessionCookie } = await import("@/lib/auth/session.server");
    const { toAuthUser } = await import("@/lib/auth/serialize.server");
    const { originFromRequest } = await import("@/lib/auth/serialize.server");
    try {
      const user = await createUser({
        email: data.email,
        password: data.password,
        metadata: data.metadata ?? {},
      });
      const session = await createSession(user.id, { userAgent: getRequestHeader("user-agent") });
      setResponseHeader("set-cookie", buildSessionCookie(session.token, SESSION_MAX_AGE));
      await requestEmailConfirmation(user.id, user.email, originFromRequest()).catch(() => undefined);
      return { ok: true as const, user: toAuthUser(user) };
    } catch (error) {
      if (error instanceof AuthError) return { ok: false as const, code: error.code, message: error.message };
      throw error;
    }
  });

export const signInWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; password: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; code: string; message: string }> => {
    const users = await import("@/lib/auth/users.server");
    const { buildSessionCookie } = await import("@/lib/auth/session.server");
    const { toAuthUser } = await import("@/lib/auth/serialize.server");
    try {
      const { user, session } = await users.signInWithPassword(data.email, data.password, {
        userAgent: getRequestHeader("user-agent"),
      });
      setResponseHeader("set-cookie", buildSessionCookie(session.token, SESSION_MAX_AGE));
      return { ok: true as const, user: toAuthUser(user) };
    } catch (error) {
      if (error instanceof users.AuthError) {
        return { ok: false as const, code: error.code, message: error.message };
      }
      throw error;
    }
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { revokeSession, readCookie, SESSION_COOKIE, buildClearCookie } = await import(
    "@/lib/auth/session.server"
  );
  await revokeSession(readCookie(getRequestHeader("cookie"), SESSION_COOKIE));
  setResponseHeader("set-cookie", buildClearCookie());
  return { ok: true as const };
});

/**
 * E-mail sign-in: one Brevo mail carrying both a magic link and a 6-digit code.
 * The answer is always `ok` so an unknown address stays indistinguishable, but
 * a mail that could not be handed to Brevo is reported as `delivered: false`
 * (and logged server-side) instead of failing silently.
 */
export const requestMagicLink = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { requestEmailCode } = await import("@/lib/auth/users.server");
    const { originFromRequest } = await import("@/lib/auth/serialize.server");
    const result = await requestEmailCode(data.email, originFromRequest()).catch((error) => {
      console.error("[auth] requestEmailCode failed:", error instanceof Error ? error.message : error);
      return { sent: false, known: true as const };
    });
    return { ok: true as const, delivered: result.sent || !result.known };
  });

/** Exchanges a 6-digit e-mail code for a session cookie. */
export const verifyEmailCode = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; code: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> => {
    const users = await import("@/lib/auth/users.server");
    const { buildSessionCookie } = await import("@/lib/auth/session.server");
    const { toAuthUser } = await import("@/lib/auth/serialize.server");
    try {
      const { user, session } = await users.verifyEmailCode(data.email, data.code, {
        userAgent: getRequestHeader("user-agent"),
      });
      setResponseHeader("set-cookie", buildSessionCookie(session.token, SESSION_MAX_AGE));
      return { ok: true as const, user: toAuthUser(user) };
    } catch (error) {
      if (error instanceof users.AuthError) return { ok: false as const, message: error.message };
      throw error;
    }
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const { requestPasswordReset: send } = await import("@/lib/auth/users.server");
    const { originFromRequest } = await import("@/lib/auth/serialize.server");
    await send(data.email, originFromRequest()).catch(() => undefined);
    return { ok: true as const };
  });

/** Consumes a magic-link / reset / confirm token and starts a session. */
export const verifyAuthToken = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; type: "magic_link" | "password_reset" | "email_confirm" }) => input)
  .handler(async ({ data }): Promise<{ ok: true; user: AuthUser } | { ok: false; message: string }> => {
    const users = await import("@/lib/auth/users.server");
    const { createSession, buildSessionCookie } = await import("@/lib/auth/session.server");
    const { toAuthUser } = await import("@/lib/auth/serialize.server");
    try {
      const { user } = await users.consumeToken(data.token, data.type);
      if (data.type === "email_confirm" || data.type === "magic_link") {
        await users.confirmEmail(user.id);
      }
      const session = await createSession(user.id, { userAgent: getRequestHeader("user-agent") });
      setResponseHeader("set-cookie", buildSessionCookie(session.token, SESSION_MAX_AGE));
      return { ok: true as const, user: toAuthUser(user) };
    } catch (error) {
      if (error instanceof users.AuthError) return { ok: false as const, message: error.message };
      throw error;
    }
  });

export const updateAuthUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { metadata?: Record<string, unknown>; password?: string; email?: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; user?: AuthUser; message?: string }> => {
    const users = await import("@/lib/auth/users.server");
    const { toAuthUser } = await import("@/lib/auth/serialize.server");
    try {
      if (data.password) await users.changePassword(context.userId, data.password);
      if (data.email) await users.changeEmail(context.userId, data.email);
      if (data.metadata) await users.updateUserMetadata(context.userId, data.metadata);
      const user = await users.findUserById(context.userId);
      return { ok: true, ...(user ? { user: toAuthUser(user) } : {}) };
    } catch (error) {
      if (error instanceof users.AuthError) return { ok: false, message: error.message };
      throw error;
    }
  });

/** Signs every other device out — used from the security settings panel. */
export const revokeOtherSessions = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { revokeAllSessions, readCookie, SESSION_COOKIE } = await import(
      "@/lib/auth/session.server"
    );
    const current = readCookie(getRequestHeader("cookie"), SESSION_COOKIE);
    await revokeAllSessions(context.userId, current);
    return { ok: true as const };
  });
