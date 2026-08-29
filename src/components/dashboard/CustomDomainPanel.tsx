import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DOMAIN_CNAME_TARGET,
  addCustomDomain,
  deleteCustomDomain,
  listCustomDomains,
  verifyCustomDomain,
} from "@/lib/domains.functions";

interface DomainRow {
  id: string;
  domain: string;
  status: string;
  verification_token: string;
}

/**
 * Compacte domeinkoppeling in de Studio: zet `links.jouwmerk.com` via een CNAME
 * op je ROUT-profiel. Zodra de DNS klopt, serveert dat domein je profiel.
 */
export function CustomDomainPanel() {
  const [rows, setRows] = useState<DomainRow[]>([]);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = (await listCustomDomains({ data: undefined })) as unknown as DomainRow[];
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function add() {
    const value = domain.trim().toLowerCase();
    if (!value) return;
    setBusy("add");
    try {
      await addCustomDomain({ data: { domain: value } });
      setDomain("");
      toast.success("Domein toegevoegd — maak nu de DNS-records aan.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Toevoegen mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function verify(id: string) {
    setBusy(id);
    try {
      const res = await verifyCustomDomain({ data: { id } });
      toast[res.status === "verified" ? "success" : "message"](
        res.status === "verified"
          ? "Geverifieerd — je profiel is live op dit domein."
          : "DNS nog niet zichtbaar. Probeer over enkele minuten opnieuw.",
      );
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verifiëren mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await deleteCustomDomain({ data: { id } });
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Verwijderen mislukt.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          <Globe className="h-4 w-4" aria-hidden /> Eigen domein
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Wijs een subdomein met een CNAME naar <code className="font-mono">{DOMAIN_CNAME_TARGET}</code>.
          Na verificatie toont dat domein je profiel.
        </p>
      </div>

      <div className="flex gap-2">
        <Input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="links.jouwmerk.com"
          aria-label="Eigen domein"
          maxLength={253}
        />
        <Button type="button" onClick={add} disabled={busy === "add" || !domain.trim()}>
          {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Toevoegen"}
        </Button>
      </div>

      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nog geen domein gekoppeld.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5 text-sm"
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">{row.domain}</span>
              <Badge variant={row.status === "verified" ? "default" : "secondary"} className="gap-1">
                {row.status === "verified" ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                ) : (
                  <Clock className="h-3 w-3" aria-hidden />
                )}
                {row.status}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => verify(row.id)}
                disabled={busy === row.id}
                className="gap-1"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Controleer DNS
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => remove(row.id)}
                disabled={busy === row.id}
                aria-label={`Verwijder ${row.domain}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CustomDomainPanel;
