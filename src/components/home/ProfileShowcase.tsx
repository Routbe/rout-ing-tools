import { useMemo, useState } from "react";
import { ArrowUpRight, BadgeCheck, QrCode, Sun, Moon } from "lucide-react";
import { profileQrSvg, DEFAULT_PROFILE_QR_STYLE } from "@/lib/profile-qr";

/**
 * Interactieve profielvitrine op de landingspagina.
 *
 * Drie echte ROUT-profielen in een tabwisselaar, met een live thema-omschakelaar
 * en een QR-overlay die exact dezelfde engine gebruikt als de Studio.
 */

type Showcase = {
  id: string;
  tab: string;
  handle: string;
  name: string;
  tagline: string;
  verified: boolean;
  light: { bg: string; card: string; text: string; muted: string; border: string };
  dark: { bg: string; card: string; text: string; muted: string; border: string };
  links: string[];
  widget: string;
};

const SHOWCASES: Showcase[] = [
  {
    id: "developer",
    tab: "Developer / Creator",
    handle: "jdelplanche",
    name: "Jan Delplanche",
    tagline: "Strategic architect — bouwt soevereine software.",
    verified: true,
    light: { bg: "#F6F4EF", card: "#FFFFFF", text: "#141414", muted: "#6B6862", border: "#DCD7CC" },
    dark: { bg: "#0F0F11", card: "#17171A", text: "#F4EFE3", muted: "#9B978E", border: "#2A2A30" },
    links: ["Matrix", "GitHub", "Mastodon", "Contact opslaan (vCard)"],
    widget: "vCard-download in de header",
  },
  {
    id: "official",
    tab: "Official Platform",
    handle: "rout",
    name: "ROUT",
    tagline: "De officiële hub: docs, status en community.",
    verified: true,
    light: { bg: "#FBF9F5", card: "#FFFFFF", text: "#131211", muted: "#6E6A64", border: "#E3DED4" },
    dark: { bg: "#0B0B0C", card: "#141416", text: "#F1EDE4", muted: "#8F8B84", border: "#26262B" },
    links: ["Discord", "Documentatie", "Status", "Manifest"],
    widget: "Geverifieerd merkbadge",
  },
  {
    id: "studio",
    tab: "Creative / Studio",
    handle: "studio",
    name: "ROUT Studio",
    tagline: "Creatief atelier — boek een sessie of blijf op de hoogte.",
    verified: true,
    light: { bg: "#FFF6F0", card: "#FFFFFF", text: "#2A1206", muted: "#8A6A56", border: "#F0D9C7" },
    dark: { bg: "#140A06", card: "#1E100A", text: "#FFE9DA", muted: "#B79479", border: "#3A2317" },
    links: ["Nieuwsbrief", "Cal.com boeking", "Instagram ✓", "Pixelfed ✓"],
    widget: "Nieuwsbrief + Cal.com embed",
  },
];

export function ProfileShowcase() {
  const [active, setActive] = useState(0);
  const [dark, setDark] = useState(true);
  const [showQr, setShowQr] = useState(false);
  const item = SHOWCASES[active]!;
  const t = dark ? item.dark : item.light;

  const qr = useMemo(
    () =>
      profileQrSvg(`https://rout.be/${item.handle}`, {
        ...DEFAULT_PROFILE_QR_STYLE,
        fgColor: t.text,
        bgColor: t.card,
        cornerStyle: "smooth",
      }, { size: 320 }),
    [item.handle, t.text, t.card],
  );

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-14">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Live voorbeelden
        </p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground sm:text-3xl">
          Eén link, drie karakters
        </h2>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {SHOWCASES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={i === active}
            className={`min-h-10 rounded-full px-4 text-sm font-medium transition-colors ${
              i === active
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground hover:bg-accent"
            }`}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setDark((d) => !d)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          {dark ? <Moon className="h-3.5 w-3.5" aria-hidden /> : <Sun className="h-3.5 w-3.5" aria-hidden />}
          {dark ? "Donker thema" : "Licht thema"}
        </button>
        <button
          type="button"
          onClick={() => setShowQr((q) => !q)}
          aria-pressed={showQr}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent"
        >
          <QrCode className="h-3.5 w-3.5" aria-hidden /> {showQr ? "Verberg QR" : "Toon QR"}
        </button>
        <a
          href={`https://rout.be/${item.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Open live profiel <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </a>
      </div>

      <div
        className="relative mx-auto mt-8 w-full max-w-sm overflow-hidden rounded-3xl border p-6 text-center transition-colors"
        style={{ background: t.bg, borderColor: t.border, color: t.text }}
      >
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold"
          style={{ background: t.card, border: `1px solid ${t.border}` }}
        >
          {item.name.slice(0, 2).toUpperCase()}
        </div>
        <h3 className="mt-3 flex items-center justify-center gap-1.5 font-serif text-xl">
          {item.name}
          {item.verified && <BadgeCheck className="h-4 w-4 text-sky-400" aria-hidden />}
        </h3>
        <p className="mt-1 font-mono text-xs" style={{ color: t.muted }}>
          rout.be/{item.handle}
        </p>
        <p className="mt-2 text-sm" style={{ color: t.muted }}>
          {item.tagline}
        </p>

        <ul className="mt-5 space-y-2">
          {item.links.map((label) => (
            <li
              key={label}
              className="flex min-h-11 items-center justify-center rounded-xl px-4 text-sm font-medium"
              style={{ background: t.card, border: `1px solid ${t.border}` }}
            >
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[11px] uppercase tracking-widest" style={{ color: t.muted }}>
          {item.widget}
        </p>

        {showQr && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 backdrop-blur-sm"
            style={{ background: `${t.bg}ee` }}
          >
            <div
              className="h-56 w-56 rounded-2xl p-2 [&>svg]:h-full [&>svg]:w-full"
              style={{ background: t.card, border: `1px solid ${t.border}` }}
              // Vector-QR uit dezelfde engine als de Studio-export.
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <p className="text-xs" style={{ color: t.muted }}>
              Dynamische ROUT-QR met konijn-embleem
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
