import { useMemo, useState } from "react";
import { Download, FileText, ImageIcon, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CORNER_STYLES,
  DEFAULT_PROFILE_QR_STYLE,
  profileQrPdf,
  profileQrSvg,
  type ProfileQrStyle,
  type QrCornerStyle,
} from "@/lib/profile-qr";
import { styledProfileLabel, styledProfileUrl, type UrlStyle } from "@/lib/profile-url";
import { themeOf } from "@/lib/profile";

/**
 * Studio-kaart voor de dynamische profiel-QR. De code encodeert altijd de
 * ROUT-profiel-URL, dus geprinte kaartjes blijven geldig als de links erachter
 * wijzigen.
 */
export function ProfileQrCard({
  handle,
  urlStyle,
  theme,
}: {
  handle: string;
  urlStyle: UrlStyle;
  theme?: string;
}) {
  const palette = themeOf(theme ?? "cream");
  const [style, setStyle] = useState<ProfileQrStyle>(DEFAULT_PROFILE_QR_STYLE);

  const clean = handle.replace(/^@+/, "").trim();
  const url = clean ? styledProfileUrl(clean, urlStyle) : "";
  const label = clean ? styledProfileLabel(clean, urlStyle) : "rout.be/[handle]";

  const svg = useMemo(
    () => (url ? profileQrSvg(url, style, { size: 512 }) : ""),
    [url, style],
  );

  function patch(next: Partial<ProfileQrStyle>) {
    setStyle((current) => ({ ...current, ...next }));
  }

  function matchTheme() {
    patch({
      fgColor: (palette?.text as string) ?? "#1A1A1A",
      bgColor: (palette?.bg as string) ?? "#FFFFFF",
    });
    toast.success("Kleuren overgenomen van je profielthema");
  }

  function download(blob: Blob, extension: string) {
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `rout-${clean || "profiel"}-qr.${extension}`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function exportPng() {
    if (!url) return;
    const source = profileQrSvg(url, style, { size: 2048 });
    const image = new Image();
    image.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("render_failed"));
      image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
    });
    const canvas = document.createElement("canvas");
    canvas.width = 2048;
    canvas.height = 2048;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(image, 0, 0, 2048, 2048);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (blob) download(blob, "png");
  }

  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 px-1 text-lg font-medium">
        <QrCode className="h-5 w-5" aria-hidden /> Profiel-QR
      </h2>
      <p className="px-1 text-sm text-muted-foreground">
        Deze QR verwijst dynamisch naar <strong>{label}</strong>. Print hem op visitekaartjes: de
        code blijft geldig, ook als je je links later aanpast.
      </p>

      <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[200px_1fr]">
        <div
          className="flex aspect-square items-center justify-center rounded-md border border-border p-2"
          style={{ background: style.bgColor }}
          // Eigen render-engine: dezelfde vectoren als de SVG/PDF-export.
          dangerouslySetInnerHTML={{ __html: svg }}
        />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              Voorgrond
              <input
                type="color"
                value={style.fgColor}
                onChange={(event) => patch({ fgColor: event.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Voorgrondkleur"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              Achtergrond
              <input
                type="color"
                value={style.bgColor === "transparent" ? "#ffffff" : style.bgColor}
                onChange={(event) => patch({ bgColor: event.target.value })}
                className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
                aria-label="Achtergrondkleur"
              />
            </label>
            <Button size="sm" variant="outline" onClick={matchTheme}>
              Match profielthema
            </Button>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Hoekstijl</p>
            <div className="flex gap-2">
              {CORNER_STYLES.map((option) => (
                <Button
                  key={option.id}
                  size="sm"
                  variant={style.cornerStyle === option.id ? "default" : "outline"}
                  onClick={() => patch({ cornerStyle: option.id as QrCornerStyle })}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 text-sm">
            <span>ROUT Rabbit-embleem in het midden</span>
            <Switch
              checked={style.emblem}
              onCheckedChange={(checked) => patch({ emblem: checked })}
              aria-label="Embleem tonen"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={exportPng} disabled={!url}>
              <ImageIcon className="mr-1 h-4 w-4" aria-hidden /> PNG (2048px)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  new Blob([profileQrSvg(url, style, { size: 1024 })], {
                    type: "image/svg+xml",
                  }),
                  "svg",
                )
              }
              disabled={!url}
            >
              <Download className="mr-1 h-4 w-4" aria-hidden /> Vector SVG
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => download(profileQrPdf(url, style), "pdf")}
              disabled={!url}
            >
              <FileText className="mr-1 h-4 w-4" aria-hidden /> Print-PDF (60 mm)
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
