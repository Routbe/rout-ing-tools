import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getSessionUser } from "@/lib/auth.functions";
import { completeBunqOAuth } from "@/lib/bunq-oauth.functions";
import { resolvePostLoginPath } from "@/lib/post-login";
import { BrandLoader } from "@/components/BrandLoader";
import { Button } from "@/components/ui/button";

function AuthCallback() {
  const nav = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    // bunq OAuth deelt deze redirect-URL met de magic-link-callback: een
    // `state` die met `bunq.` begint hoort bij de bankkoppeling.
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state") ?? "";
    const isBunq = Boolean(code) && state.startsWith("bunq.");

    const finishBunq = async (): Promise<void> => {
      const result = await completeBunqOAuth({ data: { code: code!, state } }).catch(() => null);
      if (!active) return;
      const ok = Boolean(result && "ok" in result && result.ok);
      nav({
        to: "/dashboard",
        search: { bunq: ok ? "linked" : "failed" },
        replace: true,
      } as never);
    };

    if (isBunq) {
      void finishBunq();
      return () => {
        active = false;
      };
    }

    // The session lives in an httpOnly cookie, so the server is asked whether
    // the sign-in landed. A few short retries cover the redirect race.
    const resolve = async (attempt = 0): Promise<void> => {
      const user = await getSessionUser().catch(() => null);
      if (!active) return;
      if (!user) {
        if (attempt < 4) {
          window.setTimeout(() => void resolve(attempt + 1), 600);
          return;
        }
        setFailed(true);
        return;
      }
      const to = await resolvePostLoginPath();
      if (active) nav({ to, replace: true } as never);
    };

    void resolve();

    const timer = window.setTimeout(() => active && setFailed(true), 5000);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [nav]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {failed ? (
          <div className="animate-in fade-in duration-500">
            <h1 className="text-lg font-semibold text-foreground">Aanmelden niet afgerond</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              De link is verlopen of al gebruikt. Probeer opnieuw in te loggen.
            </p>
            <Button
              variant="outline"
              onClick={() => nav({ to: "/auth", search: {}, replace: true } as never)}
              className="mt-6 rounded-2xl"
            >
              Terug naar inloggen
            </Button>
          </div>
        ) : (
          <div className="relative h-24">
            <BrandLoader label="Sessie wordt gecontroleerd…" size={32} />
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
