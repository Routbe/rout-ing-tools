/**
 * Google and GitHub sign-in for the Neon-native auth layer.
 *
 * Standard OAuth 2.0 authorization-code flow, driven entirely by our own
 * server routes (`/api/public/auth/:provider` and
 * `/api/public/auth/:provider/callback`) so it works identically on Vercel,
 * Cloudflare and locally. Client secrets never leave the server, `state` is
 * sealed with AES-GCM, and the result is the same httpOnly `rout_session`
 * cookie a password sign-in produces.
 *
 * Required environment variables (per provider):
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET
 * Optional: OAUTH_STATE_SECRET (falls back to DATABASE_URL).
 */

export type SocialProvider = "google" | "github" | "gitlab" | "oidc";

const STATE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

export class SocialAuthError extends Error {
  constructor(
    readonly code:
      | "unknown_provider"
      | "not_configured"
      | "state_invalid"
      | "state_expired"
      | "code_rejected"
      | "no_email"
      | "provider_unreachable",
    message: string,
  ) {
    super(message);
    this.name = "SocialAuthError";
  }
}

export function isSocialProvider(value: string): value is SocialProvider {
  return value === "google" || value === "github" || value === "gitlab" || value === "oidc";
}

type ProviderConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string | null;
  scope: string;
  clientId: string;
  clientSecret: string;
};

function env(name: string): string | null {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : null;
}

function envPrefix(provider: SocialProvider): string {
  return provider === "google"
    ? "GOOGLE"
    : provider === "github"
      ? "GITHUB"
      : provider === "gitlab"
        ? "GITLAB"
        : "OIDC";
}

function credentials(provider: SocialProvider): { clientId: string; clientSecret: string } {
  const prefix = envPrefix(provider);
  const clientId = env(`${prefix}_CLIENT_ID`);
  const clientSecret = env(`${prefix}_CLIENT_SECRET`);
  // Server-side only: no VITE_ prefixes here, these values never reach the browser.
  if (!clientId) console.error(`[Auth] Missing ${prefix}_CLIENT_ID`);
  if (!clientSecret) console.error(`[Auth] Missing ${prefix}_CLIENT_SECRET`);
  if (provider === "oidc" && !env("OIDC_ISSUER_URL")) {
    console.error("[Auth] Missing OIDC_ISSUER_URL");
    throw new SocialAuthError(
      "not_configured",
      "OIDC sign-in is not configured: set OIDC_ISSUER_URL, OIDC_CLIENT_ID and OIDC_CLIENT_SECRET.",
    );
  }
  if (!clientId || !clientSecret) {
    console.error(
      `[Auth] ${provider} sign-in disabled — set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET in the Vercel project environment.`,
    );
    throw new SocialAuthError(
      "not_configured",
      `${provider} sign-in is not configured: set ${prefix}_CLIENT_ID and ${prefix}_CLIENT_SECRET.`,
    );
  }
  return { clientId, clientSecret };
}

/**
 * OpenID Connect discovery — Keycloak, Authentik, Zitadel, Auth0 and every
 * other standards-compliant provider publishes its endpoints under
 * `<issuer>/.well-known/openid-configuration`. The document rarely changes, so
 * one successful fetch is cached for the lifetime of the serverless instance.
 */
type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
};
let oidcDiscoveryCache: { issuer: string; doc: OidcDiscovery } | null = null;

async function discoverOidc(): Promise<OidcDiscovery> {
  const issuer = (env("OIDC_ISSUER_URL") ?? "").replace(/\/$/, "");
  if (oidcDiscoveryCache?.issuer === issuer) return oidcDiscoveryCache.doc;
  const wellKnown = issuer.includes("/.well-known/")
    ? issuer
    : `${issuer}/.well-known/openid-configuration`;
  const res = await timedFetch(wellKnown, { headers: { accept: "application/json" } });
  const doc = (await res.json().catch(() => null)) as OidcDiscovery | null;
  if (!res.ok || !doc?.authorization_endpoint || !doc.token_endpoint) {
    console.error(`[social-auth] OIDC discovery failed at ${wellKnown} [${res.status}]`);
    throw new SocialAuthError(
      "provider_unreachable",
      "The OIDC provider could not be reached. Try again.",
    );
  }
  oidcDiscoveryCache = { issuer, doc };
  return doc;
}

async function providerConfig(provider: SocialProvider): Promise<ProviderConfig> {
  const { clientId, clientSecret } = credentials(provider);

  if (provider === "oidc") {
    const doc = await discoverOidc();
    return {
      authorizeUrl: doc.authorization_endpoint,
      tokenUrl: doc.token_endpoint,
      userinfoUrl: doc.userinfo_endpoint ?? null,
      scope: env("OIDC_SCOPE") ?? "openid profile email",
      clientId,
      clientSecret,
    };
  }

  if (provider === "gitlab") {
    return {
      authorizeUrl: "https://gitlab.com/oauth/authorize",
      tokenUrl: "https://gitlab.com/oauth/token",
      userinfoUrl: null,
      scope: "read_user",
      clientId,
      clientSecret,
    };
  }

  return provider === "google"
    ? {
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userinfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
        scope: "openid email profile",
        clientId,
        clientSecret,
      }
    : {
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userinfoUrl: null,
        scope: "read:user user:email",
        clientId,
        clientSecret,
      };
}

/** True when the provider has credentials — used to show/hide the buttons. */
export function isProviderConfigured(provider: SocialProvider): boolean {
  try {
    credentials(provider);
    return true;
  } catch {
    return false;
  }
}

/**
 * Redirect URI handed to the provider. Defaults to the short `/api/auth/...`
 * path; set OAUTH_CALLBACK_PREFIX=/api/public/auth when the provider console
 * still holds the older URL.
 */
export function callbackUrl(origin: string, provider: SocialProvider): string {
  // GitLab and OIDC consoles register one fixed callback; honour it verbatim.
  if (provider === "gitlab") {
    const fixed = env("GITLAB_REDIRECT_URI");
    if (fixed) return fixed;
    return `${origin.replace(/\/$/, "")}/api/auth/gitlab/callback`;
  }
  if (provider === "oidc") {
    const fixed = env("OIDC_REDIRECT_URI");
    if (fixed) return fixed;
    return `${origin.replace(/\/$/, "")}/api/auth/oidc/callback`;
  }
  const prefix = (process.env["OAUTH_CALLBACK_PREFIX"] ?? "/api/auth").replace(/\/$/, "");
  return `${origin.replace(/\/$/, "")}${prefix}/${provider}/callback`;
}

/* ------------------------------------------------------------------ state */

async function stateKey(): Promise<CryptoKey> {
  const secret = env("OAUTH_STATE_SECRET") ?? env("DATABASE_URL");
  if (!secret) {
    throw new SocialAuthError(
      "not_configured",
      "Social sign-in is not configured: set OAUTH_STATE_SECRET.",
    );
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret) as BufferSource,
  );
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

type StatePayload = {
  provider: SocialProvider;
  redirectUri: string;
  next: string;
  nonce: string;
  exp: number;
  /** Set when an already signed-in member links an extra provider account. */
  linkUserId?: string | null;
};

async function sealState(payload: StatePayload): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = new TextEncoder().encode(JSON.stringify(payload));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await stateKey(), data as BufferSource),
  );
  const out = new Uint8Array(iv.length + sealed.length);
  out.set(iv);
  out.set(sealed, iv.length);
  return toBase64Url(out);
}

async function openState(state: string): Promise<StatePayload> {
  let payload: StatePayload;
  try {
    const raw = fromBase64Url(state);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: raw.subarray(0, 12) as BufferSource },
      await stateKey(),
      raw.subarray(12) as BufferSource,
    );
    payload = JSON.parse(new TextDecoder().decode(plain)) as StatePayload;
  } catch {
    throw new SocialAuthError("state_invalid", "This sign-in request is not valid. Start again.");
  }
  if (!payload.exp || payload.exp < Date.now()) {
    throw new SocialAuthError("state_expired", "This sign-in request expired. Start again.");
  }
  return payload;
}

/* ------------------------------------------------------------------- flow */

function safePath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/auth/callback";
  return next;
}

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    throw new SocialAuthError(
      "provider_unreachable",
      "The identity provider could not be reached. Try again.",
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Step 1 — the URL the browser is redirected to. */
export async function buildAuthorizeUrl(input: {
  provider: SocialProvider;
  origin: string;
  next?: string | null;
  linkUserId?: string | null;
}): Promise<string> {
  const config = await providerConfig(input.provider);
  const redirectUri = callbackUrl(input.origin, input.provider);
  const state = await sealState({
    provider: input.provider,
    redirectUri,
    next: safePath(input.next),
    linkUserId: input.linkUserId ?? null,
    nonce: toBase64Url(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)))),
    exp: Date.now() + STATE_TTL_MS,
  });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scope,
    state,
  });
  if (input.provider === "google") {
    params.set("access_type", "online");
    params.set("prompt", "select_account");
  }
  return `${config.authorizeUrl}?${params.toString()}`;
}

/** Token response: OIDC providers also hand back a signed `id_token`. */
type TokenSet = { accessToken: string; idToken: string | null };

async function exchangeCode(state: StatePayload, code: string): Promise<TokenSet> {
  const config = await providerConfig(state.provider);
  const res = await timedFetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: state.redirectUri,
      code,
    }),
  });
  const json = (await res.json().catch(() => null)) as
    | { access_token?: string; id_token?: string; error?: string; error_description?: string }
    | null;
  if (!res.ok || !json?.access_token) {
    console.error(
      `[social-auth] token exchange failed for ${state.provider} [${res.status}]: ${json?.error ?? "no token"}`,
    );
    throw new SocialAuthError("code_rejected", "The provider rejected this sign-in. Try again.");
  }
  return { accessToken: json.access_token, idToken: json.id_token ?? null };
}

type SocialAccount = {
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl: string | null;
  providerId: string;
};

async function fetchGoogleAccount(token: string): Promise<SocialAccount> {
  const res = await timedFetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof json?.["email"] === "string" ? (json["email"] as string) : "";
  if (!res.ok || !email) {
    throw new SocialAuthError("no_email", "Google did not share an e-mail address for this account.");
  }
  return {
    email,
    emailVerified: json?.["email_verified"] === true,
    fullName: typeof json?.["name"] === "string" ? (json["name"] as string) : "",
    avatarUrl: typeof json?.["picture"] === "string" ? (json["picture"] as string) : null,
    providerId: typeof json?.["sub"] === "string" ? (json["sub"] as string) : email,
  };
}

async function fetchGitHubAccount(token: string): Promise<SocialAccount> {
  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "user-agent": "ROUT",
  };
  const res = await timedFetch("https://api.github.com/user", { headers });
  const user = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !user) {
    throw new SocialAuthError("code_rejected", "GitHub would not confirm this account.");
  }

  let email = typeof user["email"] === "string" ? (user["email"] as string) : "";
  let verified = false;
  if (!email) {
    const mailRes = await timedFetch("https://api.github.com/user/emails", { headers });
    const list = (await mailRes.json().catch(() => null)) as
      | { email?: string; primary?: boolean; verified?: boolean }[]
      | null;
    const primary = list?.find((e) => e.primary && e.email) ?? list?.find((e) => e.email);
    email = primary?.email ?? "";
    verified = primary?.verified === true;
  }
  if (!email) {
    throw new SocialAuthError(
      "no_email",
      "GitHub did not share an e-mail address. Make one public or grant the e-mail scope.",
    );
  }
  const login = typeof user["login"] === "string" ? (user["login"] as string) : "";
  return {
    email,
    emailVerified: verified,
    fullName: typeof user["name"] === "string" && user["name"] ? (user["name"] as string) : login,
    avatarUrl: typeof user["avatar_url"] === "string" ? (user["avatar_url"] as string) : null,
    providerId: user["id"] != null ? String(user["id"]) : login,
  };
}

async function fetchGitLabAccount(token: string): Promise<SocialAccount> {
  const res = await timedFetch("https://gitlab.com/api/v4/user", {
    headers: { authorization: `Bearer ${token}`, accept: "application/json" },
  });
  const user = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !user) {
    throw new SocialAuthError("code_rejected", "GitLab would not confirm this account.");
  }
  const email = typeof user["email"] === "string" ? (user["email"] as string) : "";
  if (!email) {
    throw new SocialAuthError(
      "no_email",
      "GitLab did not share an e-mail address for this account.",
    );
  }
  const username = typeof user["username"] === "string" ? (user["username"] as string) : "";
  return {
    email,
    // GitLab only exposes confirmed addresses on /user.
    emailVerified: true,
    fullName: typeof user["name"] === "string" && user["name"] ? (user["name"] as string) : username,
    avatarUrl: typeof user["avatar_url"] === "string" ? (user["avatar_url"] as string) : null,
    providerId: user["id"] != null ? String(user["id"]) : username,
  };
}

/**
 * Generic OpenID Connect account reader (Keycloak, Authentik, Zitadel, …).
 *
 * The claims are read from the userinfo endpoint when the provider publishes
 * one, otherwise from the ID-token payload. The ID token itself arrives over a
 * server-to-server TLS call to the discovered token endpoint, so its payload is
 * trusted the same way Google's userinfo response is.
 */
function decodeIdToken(idToken: string | null): Record<string, unknown> {
  if (!idToken) return {};
  const payload = idToken.split(".")[1];
  if (!payload) return {};
  try {
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function fetchOidcAccount(tokens: TokenSet): Promise<SocialAccount> {
  const config = await providerConfig("oidc");
  let claims = decodeIdToken(tokens.idToken);

  if (config.userinfoUrl) {
    const res = await timedFetch(config.userinfoUrl, {
      headers: { authorization: `Bearer ${tokens.accessToken}`, accept: "application/json" },
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.ok && json) claims = { ...claims, ...json };
  }

  const str = (key: string): string =>
    typeof claims[key] === "string" ? (claims[key] as string) : "";
  const email = str("email");
  if (!email) {
    throw new SocialAuthError(
      "no_email",
      "Your identity provider did not share an e-mail address. Grant the `email` scope and try again.",
    );
  }
  const sub = str("sub");
  return {
    email,
    emailVerified: claims["email_verified"] === true,
    fullName:
      str("name") ||
      [str("given_name"), str("family_name")].filter(Boolean).join(" ") ||
      str("preferred_username"),
    avatarUrl: str("picture") || null,
    providerId: sub || email,
  };
}

/** Maps the verified social account onto a ROUT user, creating it on first use. */
async function mintSession(provider: SocialProvider, account: SocialAccount) {
  const { findUserByEmail, createUser, updateUserMetadata } = await import("./auth/users.server");
  const email = account.email.trim().toLowerCase();
  const metadata: Record<string, unknown> = {
    provider_kind: provider,
    [`${provider}_id`]: account.providerId,
    ...(account.fullName ? { full_name: account.fullName } : {}),
    ...(account.avatarUrl ? { avatar_url: account.avatarUrl } : {}),
  };

  const { linkIdentity } = await import("./identities.server");

  const existing = await findUserByEmail(email);
  if (existing) {
    const userId = existing["id"] as string;
    await updateUserMetadata(userId, metadata);
    await linkIdentity({
      userId,
      provider,
      providerAccountId: account.providerId,
      email,
      displayName: account.fullName || null,
      avatarUrl: account.avatarUrl,
    });
    return userId;
  }

  const created = await createUser({
    email,
    metadata,
    // Providers already own the mailbox; a second confirmation adds nothing.
    emailConfirmed: true,
  });
  await linkIdentity({
    userId: created.id,
    provider,
    providerAccountId: account.providerId,
    email,
    displayName: account.fullName || null,
    avatarUrl: account.avatarUrl,
  });
  return created.id;
}

/**
 * Step 2 — exchange the code, verify the account, open the ROUT session and
 * report where the browser should land next.
 */
export async function completeSocialCallback(input: {
  code: string;
  state: string;
  userAgent?: string | null;
}): Promise<{ cookie: string | null; next: string }> {
  const state = await openState(input.state);
  const tokens = await exchangeCode(state, input.code);
  const account =
    state.provider === "google"
      ? await fetchGoogleAccount(tokens.accessToken)
      : state.provider === "gitlab"
        ? await fetchGitLabAccount(tokens.accessToken)
        : state.provider === "oidc"
          ? await fetchOidcAccount(tokens)
          : await fetchGitHubAccount(tokens.accessToken);

  // Linking flow: the member is already signed in and is attaching an extra
  // provider account. No new session is minted, the cookie stays as it is.
  if (state.linkUserId) {
    const { linkIdentity } = await import("./identities.server");
    await linkIdentity({
      userId: state.linkUserId,
      provider: state.provider,
      providerAccountId: account.providerId,
      email: account.email.trim().toLowerCase(),
      displayName: account.fullName || null,
      avatarUrl: account.avatarUrl,
    });
    return { cookie: null, next: state.next };
  }

  const userId = await mintSession(state.provider, account);
  const { createSession, buildSessionCookie, SESSION_TTL_DAYS } = await import(
    "./auth/session.server"
  );
  const session = await createSession(userId, { userAgent: input.userAgent ?? null });
  return {
    cookie: buildSessionCookie(session.token, 60 * 60 * 24 * SESSION_TTL_DAYS),
    next: state.next,
  };
}
