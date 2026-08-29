import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Loader2, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  deletePasskey,
  finishPasskeyRegistration,
  listPasskeys,
  startPasskeyRegistration,
} from "@/lib/webauthn.functions";

interface PasskeyRow {
  id: string;
  device_label: string | null;
  created_at: string;
  last_used_at: string | null;
}

const fmt = (value: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "never";

/** Turns any thrown value into a readable "message (code · HTTP 500)" string. */
function describe(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const meta = err as Error & { code?: string; status?: number; name?: string };
  const detail = [meta.code, meta.status ? `HTTP ${meta.status}` : null].filter(Boolean).join(" · ");
  const base = meta.message || fallback;
  return detail ? `${base} (${detail})` : base;
}

/** Newest `last_used_at` in the list, so the active credential is obvious. */
function mostRecentlyUsedId(rows: PasskeyRow[]): string | null {
  let best: PasskeyRow | null = null;
  for (const row of rows) {
    if (!row.last_used_at) continue;
    if (!best || new Date(row.last_used_at) > new Date(best.last_used_at!)) best = row;
  }
  return best?.id ?? null;
}

/**
 * Settings card: register a new passkey and manage the ones already attached
 * to the account. Deletes are RLS-scoped to the owner server-side.
 */
export function PasskeysPanel() {
  const [keys, setKeys] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PasskeyRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && typeof window.PublicKeyCredential === "function",
    );
  }, []);

  const refresh = useCallback(async () => {
    try {
      setKeys((await listPasskeys()) as PasskeyRow[]);
      setError(null);
    } catch (err) {
      console.error("[passkeys] list failed", err);
      setError(describe(err, "Could not load your passkeys."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    if (!supported) {
      toast.error("This device or browser does not support passkeys.");
      return;
    }
    setRegistering(true);
    setError(null);
    try {
      const { startRegistration } = await import("@simplewebauthn/browser");

      let options: unknown;
      try {
        options = await startPasskeyRegistration();
      } catch (err) {
        console.error("[passkeys] startPasskeyRegistration failed", err);
        throw new Error(describe(err, "The server could not start passkey registration."));
      }

      const attestation = await startRegistration({ optionsJSON: options as never });
      const result = await finishPasskeyRegistration({ data: { response: attestation } });
      if (!result.ok) {
        setError(result.reason ?? "This passkey could not be registered.");
        toast.error(result.reason ?? "This passkey could not be registered.");
        return;
      }
      toast.success("Passkey added");
      await refresh();
    } catch (err) {
      console.error("[passkeys] registration failed", err);
      const name = (err as { name?: string }).name;
      const message =
        name === "NotAllowedError" || name === "AbortError"
          ? "Registration was cancelled."
          : name === "InvalidStateError"
            ? "This device already has a passkey for your account."
            : describe(err, "Something went wrong adding this passkey.");
      setError(message);
      toast.error(message);
    } finally {
      setRegistering(false);
    }
  };

  const remove = async (row: PasskeyRow) => {
    setRemoving(row.id);
    try {
      const res = await deletePasskey({ data: { id: row.id } });
      if (!res.ok) throw new Error("Delete was refused.");
      setKeys((rows) => rows.filter((r) => r.id !== row.id));
      toast.success("Passkey removed");
    } catch (err) {
      console.error("[passkeys] delete failed", err);
      toast.error(describe(err, "Could not remove that passkey."));
    } finally {
      setRemoving(null);
      setPendingDelete(null);
    }
  };

  const recentId = mostRecentlyUsedId(keys);

  return (
    <section className="mt-4 space-y-3 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Fingerprint className="h-4 w-4" /> Passkeys
        </h2>
        <Button onClick={add} disabled={registering || !supported} className="h-10 gap-2">
          {registering ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Plus className="h-4 w-4" aria-hidden />
          )}
          {registering ? "Registering…" : "Add a passkey"}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        Sign in with Face ID, Touch ID, Windows Hello or a security key — no e-mail round trip.
      </p>

      {!supported ? (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          This browser or device doesn&apos;t support passkeys. Try a recent version of Safari,
          Chrome, Edge or Firefox on a device with a screen lock — your e-mail link and 6-digit code
          keep working everywhere.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading passkeys…
          </p>
        ) : keys.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-3 text-sm text-muted-foreground">
            No passkeys registered yet.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {keys.map((key) => (
              <li key={key.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {key.device_label || "Passkey"}
                    {key.id === recentId ? (
                      <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Most recent
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Added {fmt(key.created_at)} · last used {fmt(key.last_used_at)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
                  disabled={removing === key.id}
                  onClick={() => setPendingDelete(key)}
                  aria-label={`Remove ${key.device_label || "passkey"}`}
                >
                  {removing === key.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden />
                  )}
                  Delete
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this passkey?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.device_label || "This passkey"} will no longer sign you in. You can
              always register it again, and your e-mail link keeps working.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => pendingDelete && void remove(pendingDelete)}
            >
              Delete passkey
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
