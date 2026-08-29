import { useCallback, useEffect, useState } from "react";
import { Github, Loader2, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getMyIdentities, unlinkMyIdentity } from "@/lib/identities.functions";
import type { IdentityRow } from "@/lib/identities.server";

/** Tab 3 — link and unlink Google / GitHub sign-in identities. */
export function IdentitiesPanel() {
  const { t } = useI18n();
  const [identities, setIdentities] = useState<IdentityRow[]>([]);
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await getMyIdentities();
      setIdentities(result.identities);
      setHasPassword(result.hasPassword);
    } catch {
      /* the panel simply shows the empty state */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const link = (provider: "google" | "github") => {
    const next = encodeURIComponent("/settings?tab=identities");
    window.location.href = `/api/auth/${provider}?link=1&next=${next}`;
  };

  const unlink = async (identityId: string) => {
    const result = await unlinkMyIdentity({ data: { identityId } });
    if (!result.ok) {
      toast.error(result.reason === "last_method" ? t("oauth.last_method") : "Not found.");
      return;
    }
    toast.success(t("oauth.unlink"));
    void load();
  };

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-lg font-medium">{t("oauth.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("oauth.body")}</p>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : identities.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("oauth.none")}</p>
      ) : (
        <ul className="divide-y divide-border/60 rounded-xl border border-border">
          {identities.map((identity) => (
            <li key={identity.id} className="flex items-center gap-3 p-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-border/60 text-muted-foreground">
                {identity.provider === "github" ? (
                  <Github className="h-4 w-4" aria-hidden />
                ) : (
                  <Mail className="h-4 w-4" aria-hidden />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm capitalize text-foreground">
                  {identity.provider}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {identity.email ?? identity.displayName ?? identity.providerAccountId}
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={identities.length <= 1 && !hasPassword}
                onClick={() => unlink(identity.id)}
              >
                {t("oauth.unlink")}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="gap-1.5" onClick={() => link("google")}>
          <Plus className="h-4 w-4" /> {t("oauth.link_google")}
        </Button>
        <Button variant="outline" className="gap-1.5" onClick={() => link("github")}>
          <Github className="h-4 w-4" /> {t("oauth.link_github")}
        </Button>
      </div>
    </section>
  );
}
