import { useMemo, useState } from "react";
import { Check, Code2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** "Verified on ROUT"-badge voor de eigen site van de maker (SEO-backlink). */
export function VerifiedBadgeCard({
  handle,
  siteUrl = "https://rout.be",
}: {
  handle: string | null;
  siteUrl?: string;
}) {
  const [copied, setCopied] = useState<"html" | "svg" | null>(null);
  const clean = (handle ?? "").replace(/^@+/, "").toLowerCase();

  const snippets = useMemo(() => {
    const badge = `${siteUrl}/api/public/badge/${clean}`;
    const profile = `${siteUrl}/${clean}`;
    return {
      html: `<a href="${profile}" target="_blank" rel="noopener">\n  <img src="${badge}" alt="Verified on ROUT — @${clean}" width="220" height="40" loading="lazy" />\n</a>`,
      svg: badge,
    };
  }, [clean, siteUrl]);

  async function copy(kind: "html" | "svg") {
    try {
      await navigator.clipboard.writeText(kind === "html" ? snippets.html : snippets.svg);
      setCopied(kind);
      toast.success("Gekopieerd naar je klembord.");
      setTimeout(() => setCopied(null), 1800);
    } catch {
      toast.error("Kopiëren mislukt — selecteer de code handmatig.");
    }
  }

  if (!clean) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Code2 className="h-4 w-4" aria-hidden />
          Badge voor je eigen site
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verified on ROUT-badge</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <img
              src={snippets.svg}
              alt={`Verified on ROUT — @${clean}`}
              width={220}
              height={40}
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Plaats deze HTML in je footer. De badge linkt terug naar je ROUT-profiel.
            </p>
            <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed">
              <code>{snippets.html}</code>
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => copy("html")} className="gap-2">
                {copied === "html" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                HTML kopiëren
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy("svg")}
                className="gap-2"
              >
                {copied === "svg" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                SVG-URL kopiëren
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default VerifiedBadgeCard;
