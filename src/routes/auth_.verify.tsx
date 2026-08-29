import { useEffect, useRef, useState } from "react";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useNavigate } from "@/lib/router-compat";
import { toast } from "sonner";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/PasswordField";
import { useAuth } from "@/hooks/useAuth";
import { updateAuthUser, verifyAuthToken } from "@/lib/auth.functions";
import { resolvePostLoginPath } from "@/lib/post-login";

type TokenType = "magic_link" | "password_reset" | "email_confirm";

const TYPES: TokenType[] = ["magic_link", "password_reset", "email_confirm"];

export const Route = createFileRoute("/auth_/verify")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    type: TYPES.includes(search.type as TokenType) ? (search.type as TokenType) : "magic_link",
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Aanmeldlink bevestigen — ROUT" },
      { name: "description", content: "Bevestig je aanmeldlink, e-mailadres of nieuw wachtwoord voor je ROUT-account." },
      { property: "og:title", content: "Aanmeldlink bevestigen — ROUT" },
      { property: "og:description", content: "Bevestig je aanmeldlink, e-mailadres of nieuw wachtwoord voor je ROUT-account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerifyPage,
});

function VerifyPage() {
  const { token, type, redirect } = useSearch({ from: "/auth_/verify" });
  const nav = useNavigate();
  const { refresh } = useAuth();

  const [state, setState] = useState<"working" | "reset" | "error">("working");
  const [message, setMessage] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const started = useRef(false);

  /** Land wherever the member belongs once the session exists. */
  const goOnward = async () => {
    await refresh();
    const to = await resolvePostLoginPath(redirect).catch(() => "/dashboard");
    nav(to, { replace: true });
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    if (!token) {
      setState("error");
      setMessage("Deze link is onvolledig. Vraag een nieuwe link aan.");
      return;
    }

    void verifyAuthToken({ data: { token, type } })
      .then(async (result) => {
        if (!result.ok) {
          setState("error");
          setMessage(result.message);
          return;
        }
        if (type === "password_reset") {
          // Session is live; the member now picks a new password.
          setState("reset");
          return;
        }
        toast.success("Je bent ingelogd.");
        await goOnward();
      })
      .catch(() => {
        setState("error");
        setMessage("Verifiëren is mislukt. Probeer het opnieuw.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, type]);

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      toast.error("Gebruik minstens 10 tekens.");
      return;
    }
    setSaving(true);
    try {
      const result = await updateAuthUser({ data: { password } });
      if (!result.ok) {
        toast.error(result.message ?? "Wachtwoord bijwerken is mislukt.");
        return;
      }
      // Changing the password revokes every session, this one included.
      toast.success("Wachtwoord opgeslagen. Meld je opnieuw aan.");
      nav("/auth", { replace: true });
    } catch {
      toast.error("Wachtwoord bijwerken is mislukt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
          {state === "working" && (
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Link wordt gecontroleerd…
            </p>
          )}

          {state === "reset" && (
            <form onSubmit={savePassword} className="space-y-4">
              <div className="space-y-1">
                <h1 className="flex items-center gap-2 font-display text-xl">
                  <ShieldCheck className="h-5 w-5" aria-hidden /> Nieuw wachtwoord
                </h1>
                <p className="text-sm text-muted-foreground">
                  Kies een nieuw wachtwoord van minstens 10 tekens.
                </p>
              </div>
              <PasswordField value={password} onChange={setPassword} required minLength={10} />
              <Button type="submit" className="h-11 w-full rounded-lg" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Wachtwoord opslaan"}
              </Button>
            </form>
          )}

          {state === "error" && (
            <div className="space-y-4 text-center">
              <h1 className="flex items-center justify-center gap-2 font-display text-xl">
                <XCircle className="h-5 w-5 text-destructive" aria-hidden /> Link werkt niet
              </h1>
              <p className="text-sm text-muted-foreground">{message}</p>
              <Button variant="outline" className="w-full" onClick={() => nav("/auth", { replace: true })}>
                Terug naar aanmelden
              </Button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
