import { useState } from "react";
import { ExternalLink, Share2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BIO_LOCALES,
  BIO_LOCALE_LABEL,
  type BioLocale,
  type ProfileDisplayPrefs,
} from "@/lib/profile-display";

/**
 * Studio-kaart "Social Sharing & SEO".
 *
 * Bepaalt hoe het profiel eruitziet wanneer iemand de link deelt op Discord,
 * WhatsApp, Mastodon of X: eigen titel, beschrijving, deelafbeelding en
 * accentkleur (`<meta name="theme-color">`). Leeg laten = ROUT genereert zelf
 * een kaart op `/api/public/og/<handle>.png`.
 */
export function SocialSharingCard({
  handle,
  displayName,
  prefs,
  setPref,
}: {
  handle: string | null;
  displayName: string;
  prefs: ProfileDisplayPrefs;
  setPref: <K extends keyof ProfileDisplayPrefs>(
    key: K,
    value: ProfileDisplayPrefs[K],
  ) => void;
}) {
  const [bioTab, setBioTab] = useState<BioLocale>("nl");
  const clean = (handle ?? "").replace(/^@+/, "").trim();
  const defaultTitle = `${displayName.trim() || `@${clean || "handle"}`} (@${clean || "handle"}) — ROUT`;
  const previewImage = prefs.ogImageUrl
    ? prefs.ogImageUrl
    : clean
      ? `/api/public/og/${clean}.png`
      : null;

  const bioKey = ({ nl: "bioNl", en: "bioEn", fr: "bioFr" } as const)[bioTab];

  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Share2 className="h-4 w-4" aria-hidden /> Social Sharing &amp; SEO
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Zo ziet je link eruit in Discord, WhatsApp, Mastodon en zoekresultaten.
        </p>
      </div>

      <div className="space-y-2">
        <label className="input-label" htmlFor="meta-title">
          Meta-titel
        </label>
        <Input
          id="meta-title"
          maxLength={70}
          value={prefs.metaTitle ?? ""}
          placeholder={defaultTitle}
          onChange={(e) => setPref("metaTitle", e.target.value || null)}
          className="input-field h-11 rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <label className="input-label" htmlFor="meta-description">
          Meta-beschrijving
        </label>
        <Textarea
          id="meta-description"
          maxLength={200}
          rows={2}
          value={prefs.metaDescription ?? ""}
          placeholder="Standaard: je bio of statuslijn."
          onChange={(e) => setPref("metaDescription", e.target.value || null)}
          className="input-field rounded-xl"
        />
      </div>

      <div className="space-y-2">
        <label className="input-label" htmlFor="og-image">
          Eigen deelafbeelding (1200×630)
        </label>
        <Input
          id="og-image"
          value={prefs.ogImageUrl ?? ""}
          placeholder="https://…/share.jpg — leeg = automatische ROUT-kaart"
          onChange={(e) => setPref("ogImageUrl", e.target.value.trim() || null)}
          className="input-field h-11 rounded-xl"
        />
        {previewImage && (
          <a
            href={previewImage}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Bekijk je deelkaart
          </a>
        )}
      </div>

      <div className="space-y-2">
        <span className="input-label">Accentkleur (theme-color)</span>
        <div className="flex items-center gap-2">
          <input
            type="color"
            aria-label="Accentkleur"
            value={prefs.accentColor ?? "#c9a84c"}
            onChange={(e) => setPref("accentColor", e.target.value)}
            className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-transparent"
          />
          <Input
            value={prefs.accentColor ?? ""}
            placeholder="#c9a84c"
            onChange={(e) => setPref("accentColor", e.target.value.trim() || null)}
            className="input-field h-11 flex-1 rounded-xl font-mono"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Kleurt de Discord-zijbalk en de adresbalk op mobiel.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="input-label">Meertalige bio</span>
          <div className="flex gap-1">
            {BIO_LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setBioTab(l)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  bioTab === l
                    ? "bg-foreground text-background"
                    : "border border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                {BIO_LOCALE_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          rows={3}
          maxLength={500}
          value={prefs[bioKey] ?? ""}
          placeholder={`Bio in het ${BIO_LOCALE_LABEL[bioTab]} — leeg = val terug op je standaard bio.`}
          onChange={(e) => setPref(bioKey, e.target.value || null)}
          className="input-field rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          Bezoekers krijgen automatisch hun eigen taal en kunnen wisselen met de
          taalpil op je profiel.
        </p>
      </div>
    </section>
  );
}
