import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { exportMyDataFn } from "@/lib/my-data.functions";

/**
 * Data-portabiliteit: één klik levert een volledig .json-bestand met profiel,
 * links, socials, aliassen en domeinen. Geen wachtrij, geen e-mail — direct.
 */
export function DataExportCard() {
  const exportData = useServerFn(exportMyDataFn);
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const payload = await exportData({});
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `rout-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Je export is gedownload.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">Download mijn data</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Alles wat we van je bijhouden in één leesbaar JSON-bestand: profiel, links,
          geverifieerde socials, e-mailaliassen en domeinen.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={download} disabled={busy} className="gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download mijn data
      </Button>
    </div>
  );
}

export default DataExportCard;
