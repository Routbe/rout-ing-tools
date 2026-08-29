import { useState, useEffect, useRef } from "react";
import { useSearch } from "@tanstack/react-router";
import { Link, useNavigate } from "@/lib/router-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClientError, authClientLog, newCorrelationId } from "@/lib/correlation";

import { toast } from "sonner";
import { checkSigninGuard, recordSigninAttempt, lockoutMessage } from "@/lib/signin-guard";
import { authFailureMessage, withAuthTimeout } from "@/lib/auth-timeout";

import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, KeyRound, Loader2, Mail, MailCheck, ShieldCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/lib/i18n";
import { PasswordField } from "@/components/PasswordField";
import { BRAND_ICONS } from "@/utils/brandIcons";
import { getBootstrapState } from "@/lib/bootstrap.functions";
import { resolvePostLoginPath } from "@/lib/post-login";
import {
  requestMagicLink,
  requestPasswordReset,
  signInWithPassword as signInWithPasswordFn,
  signUp as signUpFn,
  verifyEmailCode as verifyEmailCodeFn,
} from "@/lib/auth.functions";
import { startMastodonLogin } from "@/lib/mastodon-auth.functions";
import { normalizeInstance } from "@/lib/mastodon-instance";
import { mastodonErrorMessage } from "@/lib/mastodon-auth.errors";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Officiële merkvectoren uit de harde merkkaart (`simple-icons`), zodat elke
 * providerknop het echte logo in de echte merkkleur toont.
 */
const MARKS: Record<string, string> = {
  github: BRAND_ICONS.github!.path,
  gitlab: BRAND_ICONS.gitlab!.path,
  google: BRAND_ICONS.google!.path,
  oidc: BRAND_ICONS.oidc!.path,
  mastodon: BRAND_ICONS.mastodon!.path,
  keycloak: BRAND_ICONS.keycloak!.path,
};

/** Official multi-colour Google "G" — required by Google Identity branding. */
function GoogleColorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 6-1.08 8-2.93l-3.88-3.05c-1.08.72-2.45 1.16-4.12 1.16-3.17 0-5.85-2.14-6.81-5.02H1.18v3.15C3.15 21.23 7.27 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.19 14.16c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.45H1.18C.43 7.94 0 9.91 0 12s.43 4.06 1.18 5.55l4.01-3.39z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.99 1.19 15.24 0 12 0 7.27 0 3.15 2.77 1.18 6.45l4.01 3.39c.96-2.88 3.64-5.09 6.81-5.09z"
      />
    </svg>
  );
}

type ProviderKey = "google" | "github" | "gitlab" | "oidc";

/**
 * Auth-tegels. Elk `mark` is een geverifieerd inline pad met de officiële
 * merkkleur, zodat de rij nooit leeg of vergrijsd rendert.
 */
const TILES: {
  id: string;
  label: string;
  provider: ProviderKey;
  mark: string;
  color: string;
}[] = [
  {
    id: "github",
    label: "GitHub",
    provider: "github",
    mark: MARKS.github!,
    color: BRAND_ICONS.github!.color,
  },
  {
    id: "google",
    label: "Google",
    provider: "google",
    mark: MARKS.google!,
    color: BRAND_ICONS.google!.color,
  },
  {
    id: "mastodon",
    label: "Mastodon / Fediverse",
    provider: "gitlab",
    mark: MARKS.mastodon!,
    color: BRAND_ICONS.mastodon!.color,
  },
  {
    id: "keycloak",
    label: "Keycloak / OIDC",
    provider: "oidc",
    mark: MARKS.keycloak!,
    color: BRAND_ICONS.keycloak!.color,
  },
  {
    id: "gitlab",
    label: "GitLab",
    provider: "gitlab",
    mark: MARKS.gitlab!,
    color: BRAND_ICONS.gitlab!.color,
  },
];


const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  gitlab: "GitLab",
  oidc: "Keycloak / Custom OIDC",
};

/** Deliberately permissive: catches typos, never rejects a valid address. */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_SECONDS = 30;
/** Minimum enforced server-side in `assertPassword`. */
const MIN_PASSWORD_LENGTH = 10;
/** Where the sign-in correlation id is kept across an OAuth round-trip. */
const CID_STORAGE_KEY = "rout.auth.cid";

type Mode = "magic" | "password" | "signup";

/**
 * Sign-in surface for the Neon-native auth layer.
 *
 * Everything on this page talks to our own server functions in
 * `@/lib/auth.functions` — sessions are httpOnly cookies backed by
 * `public.user_sessions` in Frankfurt. No third-party identity provider is
 * involved; the only external flow left is the Fediverse handshake, which runs
 * through our own server too.
 */
export default function Auth() {
  const { t } = useI18n();
  const nav = useNavigate();
  const { user, refresh } = useAuth();
  const { redirect } = useSearch({ from: "/auth" });

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<Mode>("magic");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);
  const [code, setCode] = useState("");
  const [codeBusy, setCodeBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needsFirstAdmin, setNeedsFirstAdmin] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const redirectStarted = useRef(false);

  /** Fediverse sign-in: the instance domain is asked for in a small dialog. */
  const [mastodonOpen, setMastodonOpen] = useState(false);
  const [mastodonInstance, setMastodonInstance] = useState("");
  const [mastodonError, setMastodonError] = useState<string | null>(null);
  const [mastodonBusy, setMastodonBusy] = useState(false);

  /** Dev-only diagnostics for the e-mail flows. */
  const [authDebug, setAuthDebug] = useState<Record<string, unknown> | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /** Cooldown so an impatient double-tap cannot flood the mail queue. */
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    let active = true;
    getBootstrapState()
      .then((s) => active && setNeedsFirstAdmin(s.needsFirstAdmin))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const resolveDestination = async () => resolvePostLoginPath(redirect);

  useEffect(() => {
    if (!user || redirectStarted.current) return;
    redirectStarted.current = true;
    setRedirecting(true);
    let active = true;
    console.info("[post-login:start] resolving destination for authenticated member");
    void resolveDestination()
      .then((to) => {
        if (!active) return;
        console.info(`[post-login:navigate] ${to}`);
        nav(to, { replace: true });
      })
      .catch((error) => {
        console.error("[post-login:unexpected-failure]", error);
        if (active) nav("/dashboard", { replace: true });
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, nav, redirect]);

  /**
   * Correlation id of the attempt in progress. One id per attempt, echoed in
   * every client and server log line, so a single sign-in can be traced
   * end-to-end in the runtime logs.
   */
  const cidRef = useRef<string>("");
  const beginAttempt = (method: string) => {
    const cid = newCorrelationId();
    cidRef.current = cid;
    try {
      sessionStorage.setItem(CID_STORAGE_KEY, cid);
    } catch {
      /* private mode — tracing degrades, sign-in does not */
    }
    authClientLog("attempt_started", cid, { method, origin: window.location.origin });
    return cid;
  };

  /** Final gate before any auth request leaves the browser. */
  const emailAccepted = () => {
    if (EMAIL_REGEX.test(email.trim())) return true;
    const message = t("auth.email.invalid");
    setEmailError(message);
    toast.error(message);
    return false;
  };

  const reportAuthError = (error: unknown, scope: string) => {
    const err = error as { message?: string; code?: string; name?: string };
    authClientError("attempt_failed", cidRef.current || "cid_unknown", {
      scope,
      code: err?.code ?? null,
    });
    console.error(`[auth:${scope}]`, error);
    toast.error(err?.message || t("auth.toast.failed"), { duration: 8000 });
    setAuthDebug({
      scope,
      cid: cidRef.current || null,
      at: new Date().toISOString(),
      origin: typeof window !== "undefined" ? window.location.origin : null,
      name: err?.name ?? null,
      code: err?.code ?? null,
      message: err?.message ?? String(error),
    });
  };

  /** Magic link: the server mails a one-time token to /auth/verify. */
  const continueWithEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAccepted()) return;
    setLoading(true);
    const cid = beginAttempt("magic-link");
    const address = email.trim().toLowerCase();
    try {
      const guard = await checkSigninGuard(address);
      if (guard.locked) return toast.error(lockoutMessage(guard.retryAfter));
      await withAuthTimeout(requestMagicLink({ data: { email: address } }), "requestMagicLink");
      authClientLog("magic_link_sent", cid, {});
      setSentTo(address);
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      reportAuthError(err, "magic-link");
      toast.error(authFailureMessage(err, t("auth.toast.signinFailed")));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    if (!sentTo || resendIn > 0 || resending) return;
    setResending(true);
    try {
      await withAuthTimeout(requestMagicLink({ data: { email: sentTo } }), "requestMagicLink:resend");
      setResendIn(RESEND_COOLDOWN_SECONDS);
      toast.success(t("auth.toast.newCode"));
    } catch (err) {
      toast.error(authFailureMessage(err, t("auth.toast.resendFailed")));
    } finally {
      setResending(false);
    }
  };

  /** Second half of e-mail sign-in: the 6-digit code from the same mail. */
  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sentTo || code.replace(/\D/g, "").length !== 6) return;
    setCodeBusy(true);
    try {
      const result = await withAuthTimeout(
        verifyEmailCodeFn({ data: { email: sentTo, code } }),
        "verifyEmailCode",
      );
      if (!result.ok) return toast.error(result.message);
      toast.success(t("auth.toast.signedIn"));
      await refresh();
    } catch (err) {
      reportAuthError(err, "email-code");
      toast.error(authFailureMessage(err, t("auth.toast.signinFailed")));
    } finally {
      setCodeBusy(false);
    }
  };

  const signInWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAccepted()) return;
    setLoading(true);
    beginAttempt("password");
    const address = email.trim().toLowerCase();
    try {
      // Brute-force guard: keyed on an anonymous hash of the address, never the
      // address itself, an IP or a user agent.
      const guard = await checkSigninGuard(address);
      if (guard.locked) return toast.error(lockoutMessage(guard.retryAfter));

      const result = await withAuthTimeout(
        signInWithPasswordFn({ data: { email: address, password } }),
        "signInWithPassword",
      );
      const after = await recordSigninAttempt(address, result.ok);
      if (!result.ok) {
        return toast.error(after.locked ? lockoutMessage(after.retryAfter) : result.message);
      }
      toast.success(t("auth.toast.welcome"));
      await refresh();
    } catch (err) {
      reportAuthError(err, "password");
      toast.error(authFailureMessage(err, t("auth.toast.signinFailed")));
    } finally {
      setLoading(false);
    }
  };

  /** Explicit account creation with a password; a confirmation mail follows. */
  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailAccepted()) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      return toast.error(`Gebruik minstens ${MIN_PASSWORD_LENGTH} tekens.`);
    }
    setLoading(true);
    beginAttempt("signup");
    try {
      const result = await withAuthTimeout(
        signUpFn({ data: { email: email.trim().toLowerCase(), password } }),
        "signUp",
      );
      if (!result.ok) return toast.error(result.message);
      toast.success(t("auth.toast.welcome"));
      await refresh();
    } catch (err) {
      reportAuthError(err, "signup");
      toast.error(authFailureMessage(err, t("auth.toast.signinFailed")));
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    if (!email) return toast.error(t("auth.toast.emailFirst"));
    if (!emailAccepted()) return;
    setLoading(true);
    try {
      await requestPasswordReset({ data: { email: email.trim().toLowerCase() } });
      toast.success(t("auth.toast.resetSent"));
    } catch (err) {
      reportAuthError(err, "password-reset");
    } finally {
      setLoading(false);
    }
  };

  /** Fediverse: normalize locally, then let the server register + authorize. */
  const startMastodon = async () => {
    const instance = normalizeInstance(mastodonInstance);
    if (!instance) {
      setMastodonError(mastodonErrorMessage("invalid_instance"));
      return;
    }
    setMastodonBusy(true);
    setMastodonError(null);
    try {
      const cid = beginAttempt("mastodon");
      const { url } = await startMastodonLogin({
        data: { instance, cid, ...(redirect ? { next: redirect } : {}) },
      });
      authClientLog("mastodon_redirecting", cid, { instance });
      window.location.assign(url);
    } catch (e) {
      setMastodonBusy(false);
      setMastodonError(e instanceof Error && e.message ? e.message : mastodonErrorMessage("unknown"));
    }
  };

  /**
   * Google and GitHub run through our own server routes under
   * /api/auth/*: the browser leaves for the provider and comes back with
   * the same httpOnly session cookie a password sign-in produces. The remaining
   * tiles are not wired to the Neon auth layer and say so.
   */
  const oauth = (tileId: string, provider: ProviderKey) => {
    if (tileId === "google" || tileId === "github" || tileId === "gitlab") {
      const next = redirect ? `?next=${encodeURIComponent(redirect)}` : "";
      window.location.assign(`/api/auth/${tileId}${next}`);
      return;
    }
    toast.info(t("auth.toast.providerUnavailable", { name: PROVIDER_LABELS[provider] }));
  };

  const onEmailChange = (value: string) => {
    setEmail(value);
    setEmailError(value && !EMAIL_REGEX.test(value.trim()) ? t("auth.email.invalid") : null);
  };

  const emailField = (
    <div className="space-y-1">
      <Label htmlFor="auth-email" className="text-sm">
        {t("auth.email.label")}
      </Label>
      <Input
        id="auth-email"
        type="email"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        placeholder="you@domain.com"
        autoComplete="email"
        aria-invalid={emailError ? true : undefined}
        aria-describedby={emailError ? "auth-email-error" : undefined}
        className={`h-10 rounded-lg ${emailError ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
        required
      />
      {emailError && (
        <p id="auth-email-error" className="text-[11px] text-destructive">
          {emailError}
        </p>
      )}
    </div>
  );

  if (user || redirecting) {
    return (
      <AppLayout>
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
          <div className="flex min-h-44 w-full max-w-md items-center justify-center rounded-2xl border border-border bg-card">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Account wordt geopend…
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-4rem)] w-full flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("auth.back")}
          </Link>
        </div>
        {needsFirstAdmin && (
          <div className="mb-3 w-full max-w-md border border-foreground bg-muted p-3">
            <p className="text-xs font-semibold uppercase tracking-wide">{t("auth.setup.title")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("auth.setup.body")}</p>
          </div>
        )}
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 sm:p-7">
          <div className="mb-4">
            <h1 className="mb-1 font-display text-2xl text-foreground">{t("auth.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          </div>

          {import.meta.env.DEV && (
            <details className="mb-3 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-[11px]">
              <summary className="cursor-pointer font-medium">Auth debug (dev only)</summary>
              <p className="mt-2 break-all text-muted-foreground">
                origin: <code>{hydrated ? window.location.origin : "—"}</code>
              </p>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-muted-foreground">
                {authDebug ? JSON.stringify(authDebug, null, 2) : "No auth errors yet."}
              </pre>
            </details>
          )}

          {/* Secondary connectors — equal weight, all masked to one colour */}
          <div
            data-testid="auth-provider-tiles"
            className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5"
          >
            {TILES.map((tile) => (
              <button
                key={tile.id}
                type="button"
                onClick={() =>
                  tile.id === "mastodon"
                    ? (setMastodonError(null), setMastodonOpen(true))
                    : oauth(tile.id, tile.provider)
                }
                disabled={loading}
                aria-label={`Verder met ${tile.label}`}
                title={`Verder met ${tile.label}`}
                className="group flex h-11 items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/60 p-2 transition-all hover:border-border hover:bg-muted/50 disabled:opacity-60"
              >
                {tile.id === "google" ? (
                  <GoogleColorMark className="h-[18px] w-[18px] shrink-0" />
                ) : (
                  <svg
                    className="h-[18px] w-[18px] shrink-0"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    style={{ color: tile.color }}
                    aria-hidden
                  >
                    <path d={tile.mark} />
                  </svg>
                )}
                <span className="sr-only">{`Verder met ${tile.label}`}</span>
              </button>
            ))}
          </div>


          <Dialog open={mastodonOpen} onOpenChange={(o) => !mastodonBusy && setMastodonOpen(o)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>{t("auth.fedi.title")}</DialogTitle>
                <DialogDescription>{t("auth.fedi.desc")}</DialogDescription>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void startMastodon();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="mastodon-instance">{t("auth.fedi.instance")}</Label>
                  <Input
                    id="mastodon-instance"
                    autoFocus
                    autoComplete="url"
                    placeholder="mastodon.social"
                    value={mastodonInstance}
                    onChange={(e) => {
                      setMastodonInstance(e.target.value);
                      setMastodonError(null);
                    }}
                    disabled={mastodonBusy}
                  />
                  {mastodonError && <p className="text-xs text-destructive">{mastodonError}</p>}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={mastodonBusy} className="w-full">
                    {mastodonBusy ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("auth.fedi.connecting")}
                      </>
                    ) : (
                      t("auth.fedi.continue")
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0" aria-hidden /> {t("auth.sso.note")}
          </p>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              {t("auth.divider")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {sentTo ? (
            <div
              data-testid="auth-link-sent"
              className="mx-auto w-full max-w-sm space-y-5 overflow-hidden rounded-2xl border border-border bg-card/60 p-4 text-center sm:p-6"
            >
              <div className="space-y-2">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted/60">
                  <MailCheck className="h-5 w-5" aria-hidden />
                </span>
                <h2 className="font-display text-lg">{t("auth.sent.title")}</h2>
                <p className="mx-auto max-w-[16rem] text-[13px] leading-relaxed text-muted-foreground sm:max-w-xs">
                  {t("auth.sent.body1")}{" "}
                  <strong className="font-medium text-foreground">{sentTo}</strong>
                  {t("auth.sent.body2")}
                </p>
              </div>

              <form onSubmit={submitCode} className="space-y-3">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="000000"
                  aria-label={t("auth.otp.aria")}
                  className="mx-auto h-12 max-w-40 rounded-xl text-center font-mono text-xl tracking-[0.4em]"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="w-full max-w-40 rounded-full"
                  disabled={codeBusy || code.length !== 6}
                >
                  {codeBusy ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />{" "}
                      {t("auth.resend.sending")}
                    </>
                  ) : (
                    t("auth.password.signin")
                  )}
                </Button>
              </form>

              <div className="space-y-4 border-t border-border/70 pt-5">
                <div className="flex flex-col items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resend}
                    className="w-full max-w-40 rounded-full"
                    disabled={resending || resendIn > 0}
                    aria-live="polite"
                  >
                    {resending ? (
                      <>
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />{" "}
                        {t("auth.resend.sending")}
                      </>
                    ) : resendIn > 0 ? (
                      <span className="tabular-nums">{t("auth.resend.in", { s: resendIn })}</span>
                    ) : (
                      t("auth.resend.cta")
                    )}
                  </Button>
                  {resendIn > 0 && (
                    <span
                      aria-hidden
                      className="h-[3px] w-full max-w-40 overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className="block h-full rounded-full bg-foreground/50 transition-[width] duration-1000 ease-linear"
                        style={{ width: `${(1 - resendIn / RESEND_COOLDOWN_SECONDS) * 100}%` }}
                      />
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSentTo(null)}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t("auth.other")}
                </button>
              </div>
            </div>
          ) : mode === "password" ? (
            <form onSubmit={signInWithPassword} className="space-y-3.5">
              {emailField}
              <PasswordField value={password} onChange={setPassword} required minLength={8} />
              <Button
                type="submit"
                className="h-11 w-full rounded-lg font-medium"
                disabled={loading || !!emailError}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.password.signin")}
              </Button>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode("magic")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden /> {t("auth.password.magic")}
                </button>
                <button
                  type="button"
                  onClick={resetPassword}
                  className="text-[11px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {t("auth.password.forgot")}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                <UserPlus className="h-3.5 w-3.5" aria-hidden /> Account aanmaken
              </button>
            </form>
          ) : mode === "signup" ? (
            <form onSubmit={signUp} className="space-y-3.5">
              {emailField}
              <PasswordField
                value={password}
                onChange={setPassword}
                required
                minLength={MIN_PASSWORD_LENGTH}
              />
              <p className="text-[11px] text-muted-foreground">
                Minstens {MIN_PASSWORD_LENGTH} tekens. Je krijgt een bevestigingsmail.
              </p>
              <Button
                type="submit"
                data-testid="auth-signup"
                className="h-11 w-full rounded-lg font-medium"
                disabled={loading || !!emailError}
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Account aanmaken"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("magic")}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden /> {t("auth.password.magic")}
              </button>
            </form>
          ) : (
            <form onSubmit={continueWithEmail} className="space-y-3.5">
              {emailField}
              <Button
                type="submit"
                data-testid="auth-continue"
                className="h-11 w-full rounded-lg font-medium"
                disabled={loading || !!emailError}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {t("auth.continue.sending")}
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" /> {t("auth.continue.cta")}
                  </>
                )}
              </Button>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {t("auth.continue.note")}
              </p>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden /> {t("auth.havePassword")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden /> Account aanmaken
                </button>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {t("auth.terms.prefix")}{" "}
                <Link to="/terms" className="underline underline-offset-4">
                  {t("auth.terms.terms")}
                </Link>{" "}
                {t("auth.terms.and")}{" "}
                <Link to="/privacy" className="underline underline-offset-4">
                  {t("auth.terms.privacy")}
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
