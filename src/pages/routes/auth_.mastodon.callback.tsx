import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { completeMastodonLogin } from "@/lib/mastodon-auth.functions";
import { mastodonErrorMessage } from "@/lib/mastodon-auth.errors";
import { normalizeCorrelationId } from "@/lib/correlation";
import { useAuth } from "@/hooks/useAuth";

/**
 * Fediverse OAuth landing route: the instance sends the user back here with a
 * code + sealed state. The server verifies both, opens the ROUT session cookie
 * on Neon, and we simply refresh the client-side session before forwarding to
 * the intended destination.
 */
export default function MastodonCallback() {
  const nav = useNavigate();
  const { refresh } = useAuth();
  const search = useSearch({ from: "/auth_/mastodon/callback" });
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const run = async () => {
      if (search.error) {
        setError(mastodonErrorMessage("code_rejected"));
        return;
      }
      if (!search.code || !search.state) {
        setError(mastodonErrorMessage("state_invalid"));
        return;
      }
      // The server only ever throws the safe vocabulary, so its message is
      // safe to render verbatim; anything unexpected falls back to "unknown".
      let result: Awaited<ReturnType<typeof completeMastodonLogin>>;
      try {
        // Carry the correlation id from the tab that started the attempt, so
        // both legs of the round-trip share one traceable id.
        const cid = normalizeCorrelationId(sessionStorage.getItem("rout.auth.cid"));
        result = await completeMastodonLogin({
          data: { code: search.code, state: search.state, ...(cid ? { cid } : {}) },
        });
      } catch (e) {
        setError(e instanceof Error && e.message ? e.message : mastodonErrorMessage("unknown"));
        return;
      }
      await refresh();
      nav({ to: result.next || "/dashboard", replace: true } as never);
    };

    void run();
  }, [nav, refresh, search.code, search.state, search.error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-sm text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-foreground">Aanmelden niet afgerond</h1>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <button
              onClick={() => nav({ to: "/auth", search: {}, replace: true } as never)}
              className="mt-4 inline-flex items-center justify-center rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Terug naar inloggen
            </button>
          </>
        ) : (
          <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Je Fediverse-account wordt gecontroleerd…
          </p>
        )}
      </div>
    </div>
  );
}
