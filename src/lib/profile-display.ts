/**
 * Weergavevoorkeuren van een publiek ROUT-profiel.
 *
 * Alles wat *niet* over de inhoud van het profiel gaat (badge, watermerk,
 * achtergrondpatroon, typografie, identiteitsmodus) leeft hier als één
 * JSON-blob (`profiles.display_prefs`). Zo blijft de tabel stabiel en kan de
 * studio nieuwe opties toevoegen zonder migratie per schakelaar.
 */

export type BadgeType = "verified" | "human";
export type BadgeNameFormat = "full" | "initials" | "lower";
export type IdentityMode = "legal" | "private";
export type BackgroundStyle = "solid" | "grid" | "gradient" | "dots" | "mesh" | "noise";
export type Typography = "sans" | "serif" | "mono";
/** Discord-achtige avatarrand, maar in ROUT's ingetogen luxe-register. */
export type AvatarFrame = "none" | "gold" | "neon" | "double" | "aurora";
export type BannerStyle = "none" | "gradient" | "image";
export type NameAccent = "classic" | "gold" | "neon" | "chrome";

export interface ProfileDisplayPrefs {
  /** "legal" = handle blijft herleidbaar naar de wettelijke naam. */
  identityMode: IdentityMode;
  badgeVisible: boolean;
  badgeType: BadgeType;
  badgeNameFormat: BadgeNameFormat;
  /** `null` = volg de standaard (gratis toont watermerk, betalend niet). */
  showWatermark: boolean | null;
  backgroundStyle: BackgroundStyle;
  typography: Typography;
  avatarFrame: AvatarFrame;
  bannerStyle: BannerStyle;
  bannerImageUrl: string | null;
  /** Kleurenpaar voor de gradient-banner. */
  bannerFrom: string | null;
  bannerTo: string | null;
  /** Overschrijft de themakleur van het canvas / het patroonaccent. */
  canvasColor: string | null;
  patternColor: string | null;
  /** Korte statuslijn onder de handle ("Strategic Architect"). */
  statusLine: string | null;
  nameAccent: NameAccent;
  /** Social sharing & SEO (Studio → "Social Sharing & SEO"). */
  metaTitle: string | null;
  metaDescription: string | null;
  ogImageUrl: string | null;
  /** Accentkleur voor <meta name="theme-color"> (Discord/mobiele browserbalk). */
  accentColor: string | null;
  /** Meertalige bio; leeg = val terug op `profiles.bio`. */
  bioNl: string | null;
  bioEn: string | null;
  bioFr: string | null;
  /** Toont de "Contact opslaan" (vCard) knop op het publieke profiel. */
  showVcardButton: boolean;

}

export const DEFAULT_DISPLAY_PREFS: ProfileDisplayPrefs = {
  identityMode: "legal",
  badgeVisible: true,
  badgeType: "verified",
  badgeNameFormat: "full",
  showWatermark: null,
  backgroundStyle: "solid",
  typography: "sans",
  avatarFrame: "none",
  bannerStyle: "none",
  bannerImageUrl: null,
  bannerFrom: null,
  bannerTo: null,
  canvasColor: null,
  patternColor: null,
  statusLine: null,
  nameAccent: "classic",
  metaTitle: null,
  metaDescription: null,
  ogImageUrl: null,
  accentColor: null,
  bioNl: null,
  bioEn: null,
  bioFr: null,
  showVcardButton: true,
};

export const AVATAR_FRAMES: { id: AvatarFrame; label: string }[] = [
  { id: "none", label: "Geen" },
  { id: "gold", label: "Gouden wireframe" },
  { id: "neon", label: "Neon glow ring" },
  { id: "double", label: "Dubbele rand" },
  { id: "aurora", label: "Aurora gradient" },
];

export const BANNER_STYLES: { id: BannerStyle; label: string }[] = [
  { id: "none", label: "Geen banner" },
  { id: "gradient", label: "Kleurverloop" },
  { id: "image", label: "Eigen afbeelding" },
];

export const NAME_ACCENTS: { id: NameAccent; label: string }[] = [
  { id: "classic", label: "Klassiek crème" },
  { id: "gold", label: "Goud verloop" },
  { id: "neon", label: "Neon glow" },
  { id: "chrome", label: "Dark chrome" },
];


export const BADGE_TYPES: { id: BadgeType; label: string; note: string }[] = [
  {
    id: "verified",
    label: "Blauw vinkje",
    note: "Toont je geverifieerde identiteit.",
  },
  {
    id: "human",
    label: "Privacy-schild",
    note: "Bevestigt: echte mens, zonder je naam te tonen.",
  },
];

export const BADGE_NAME_FORMATS: { id: BadgeNameFormat; label: string }[] = [
  { id: "full", label: "Volledige naam" },
  { id: "initials", label: "Initialen (J.Delplanche)" },
  { id: "lower", label: "Kleine letters" },
];

export const BACKGROUND_STYLES: { id: BackgroundStyle; label: string }[] = [
  { id: "solid", label: "Effen" },
  { id: "grid", label: "Subtiel raster" },
  { id: "gradient", label: "Zachte gradient" },
  { id: "dots", label: "Dot matrix" },
  { id: "mesh", label: "Mesh gradient" },
  { id: "noise", label: "Subtiele ruis" },
];

export const TYPOGRAPHY_STYLES: { id: Typography; label: string }[] = [
  { id: "sans", label: "Modern (Sans)" },
  { id: "serif", label: "Klassiek (Serif)" },
  { id: "mono", label: "Technisch (Mono)" },
];

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Alleen veilige, korte CSS-kleuren (hex) uit de database vertrouwen. */
const colorOrNull = (value: unknown): string | null =>
  typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value.trim()) ? value.trim() : null;

const textOrNull = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
};

const urlOrNull = (value: unknown): string | null =>
  typeof value === "string" && /^https?:\/\//.test(value.trim()) ? value.trim() : null;

/** Leest een (mogelijk ontbrekende) JSON-blob uit de database veilig uit. */
export function parseDisplayPrefs(raw: unknown): ProfileDisplayPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DISPLAY_PREFS };
  const r = raw as Record<string, unknown>;
  return {
    identityMode: oneOf(r["identityMode"], ["legal", "private"] as const, "legal"),
    badgeVisible: r["badgeVisible"] === undefined ? true : Boolean(r["badgeVisible"]),
    badgeType: oneOf(r["badgeType"], ["verified", "human"] as const, "verified"),
    badgeNameFormat: oneOf(r["badgeNameFormat"], ["full", "initials", "lower"] as const, "full"),
    showWatermark:
      r["showWatermark"] === null || r["showWatermark"] === undefined
        ? null
        : Boolean(r["showWatermark"]),
    backgroundStyle: oneOf(
      r["backgroundStyle"],
      ["solid", "grid", "gradient", "dots", "mesh", "noise"] as const,
      "solid",
    ),
    typography: oneOf(r["typography"], ["sans", "serif", "mono"] as const, "sans"),
    avatarFrame: oneOf(
      r["avatarFrame"],
      ["none", "gold", "neon", "double", "aurora"] as const,
      "none",
    ),
    bannerStyle: oneOf(r["bannerStyle"], ["none", "gradient", "image"] as const, "none"),
    bannerImageUrl: urlOrNull(r["bannerImageUrl"]),
    bannerFrom: colorOrNull(r["bannerFrom"]),
    bannerTo: colorOrNull(r["bannerTo"]),
    canvasColor: colorOrNull(r["canvasColor"]),
    patternColor: colorOrNull(r["patternColor"]),
    statusLine: textOrNull(r["statusLine"], 60),
    nameAccent: oneOf(r["nameAccent"], ["classic", "gold", "neon", "chrome"] as const, "classic"),
    metaTitle: textOrNull(r["metaTitle"], 70),
    metaDescription: textOrNull(r["metaDescription"], 200),
    ogImageUrl: urlOrNull(r["ogImageUrl"]),
    accentColor: colorOrNull(r["accentColor"]),
    bioNl: textOrNull(r["bioNl"], 500),
    bioEn: textOrNull(r["bioEn"], 500),
    bioFr: textOrNull(r["bioFr"], 500),
    showVcardButton: r["showVcardButton"] === undefined ? true : Boolean(r["showVcardButton"]),
  };
}

/** CSS voor de gekozen avatarrand (wordt op een wrapper rond de avatar gezet). */
export function avatarFrameStyle(
  frame: AvatarFrame,
  theme: { bg: string; card: string; text: string; border: string; accent?: string },
): Record<string, string | number> {
  const accent = theme.accent ?? theme.border;
  switch (frame) {
    case "gold":
      return {
        padding: 3,
        borderRadius: 999,
        background: "linear-gradient(135deg,#e8c87a,#8a6a24 45%,#f4e2b0)",
        boxShadow: "0 6px 24px -12px rgba(232,200,122,0.9)",
      };
    case "neon":
      return {
        padding: 3,
        borderRadius: 999,
        background: theme.bg,
        border: `2px solid ${accent}`,
        boxShadow: `0 0 0 4px color-mix(in oklab, ${accent} 18%, transparent), 0 0 26px -4px ${accent}`,
      };
    case "double":
      return {
        padding: 5,
        borderRadius: 999,
        border: `1px solid ${theme.border}`,
        boxShadow: `inset 0 0 0 3px ${theme.bg}, inset 0 0 0 4px ${theme.border}`,
      };
    case "aurora":
      return {
        padding: 3,
        borderRadius: 999,
        background: `conic-gradient(from 180deg, ${accent}, ${theme.text}, ${accent})`,
        boxShadow: `0 8px 30px -14px ${accent}`,
      };
    default:
      return { padding: 0, borderRadius: 999 };
  }
}

/** CSS voor de bannerkaart boven het profiel. `null` = geen banner tonen. */
export function bannerStyleOf(
  prefs: ProfileDisplayPrefs,
  theme: { bg: string; card: string; border: string; accent?: string },
): Record<string, string> | null {
  const accent = theme.accent ?? theme.border;
  if (prefs.bannerStyle === "image" && prefs.bannerImageUrl) {
    return {
      backgroundImage: `url("${prefs.bannerImageUrl}")`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  if (prefs.bannerStyle === "gradient") {
    const from = prefs.bannerFrom ?? accent;
    const to = prefs.bannerTo ?? theme.card;
    return { backgroundImage: `linear-gradient(120deg, ${from}, ${to})` };
  }
  return null;
}

/** Tekststijl voor de weergavenaam volgens het gekozen accent. */
export function nameAccentStyle(
  accent: NameAccent,
  theme: { text: string; accent?: string },
): Record<string, string> {
  const a = theme.accent ?? theme.text;
  switch (accent) {
    case "gold":
      return {
        backgroundImage: "linear-gradient(100deg,#f4e2b0,#d8b455 40%,#8a6a24)",
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
      };
    case "neon":
      return { color: a, textShadow: `0 0 18px ${a}, 0 0 42px ${a}` };
    case "chrome":
      return {
        backgroundImage: `linear-gradient(180deg, ${theme.text}, color-mix(in oklab, ${theme.text} 45%, transparent))`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
      };
    default:
      return { color: theme.text };
  }
}


/**
 * Gratis leden dragen altijd het "Made with ROUT"-watermerk; geverifieerde /
 * betalende leden krijgen standaard een white-label profiel en mogen het
 * merkje in de studio alsnog aanzetten.
 */
export function shouldShowWatermark(verified: boolean, prefs: ProfileDisplayPrefs): boolean {
  if (!verified) return true;
  return prefs.showWatermark ?? false;
}

/** Naamweergave naast de badge, volgens de gekozen opmaak. */
export function formatBadgeName(name: string, format: BadgeNameFormat): string {
  const clean = name.trim();
  if (!clean) return "";
  if (format === "lower") return clean.toLowerCase();
  if (format === "initials") {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return clean;
    const last = parts[parts.length - 1]!;
    const initials = parts
      .slice(0, -1)
      .map((p) => `${p[0]!.toUpperCase()}.`)
      .join("");
    return `${initials}${last}`;
  }
  return clean;
}

export const BADGE_VERIFIED_BODY =
  "Officieel geverifieerd lid. Identiteit en accountstatus zijn succesvol gevalideerd via ROUT.";

export const BADGE_HUMAN_BODY =
  "Menselijk account, geverifieerd door ROUT. Deze persoon koos ervoor haar of zijn wettelijke identiteit privé te houden.";

/** CSS-achtergrondlagen voor het gekozen patroon, bovenop de themakleur. */
export function backgroundLayers(
  style: BackgroundStyle,
  theme: { bg: string; border: string; accent?: string; card: string },
): { background: string; backgroundSize?: string } {
  const accent = theme.accent ?? theme.border;
  switch (style) {
    case "grid":
      return {
        background: `linear-gradient(${theme.border} 1px, transparent 1px) 0 0 / 32px 32px, linear-gradient(90deg, ${theme.border} 1px, transparent 1px) 0 0 / 32px 32px, ${theme.bg}`,
      };
    case "gradient":
      return {
        background: `linear-gradient(180deg, ${theme.card} 0%, ${theme.bg} 55%, ${theme.bg} 100%)`,
      };
    case "dots":
      return {
        background: `radial-gradient(${theme.border} 1.2px, transparent 1.2px) 0 0 / 18px 18px, ${theme.bg}`,
      };
    case "mesh":
      return {
        background: `radial-gradient(45rem 30rem at 12% 8%, ${accent}44, transparent 60%), radial-gradient(38rem 28rem at 88% 18%, ${theme.card}, transparent 62%), radial-gradient(40rem 32rem at 50% 100%, ${accent}22, transparent 65%), ${theme.bg}`,
      };
    case "noise":
      return {
        background: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.28'/%3E%3C/svg%3E"), ${theme.bg}`,
      };
    default:
      return { background: theme.bg };
  }
}

export const FONT_FAMILY: Record<Typography, string | undefined> = {
  sans: undefined,
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

/** Knopstijl (vorm + effect) voor een linkblok, afgeleid van het thema. */
export function blockButtonStyle(
  cardStyle: string,
  theme: { bg: string; card: string; text: string; border: string; accent?: string },
): Record<string, string | number> {
  const accent = theme.accent ?? theme.border;
  const base: Record<string, string | number> = {
    borderRadius: 16,
    background: theme.card,
    color: theme.text,
    border: "1px solid transparent",
  };
  switch (cardStyle) {
    case "pill":
      return { ...base, borderRadius: 999, border: `1px solid ${theme.border}` };
    case "solid":
      return { ...base, background: theme.text, color: theme.bg, border: "1px solid transparent" };
    case "sharp":
      return { ...base, borderRadius: 0, border: `1px solid ${theme.text}` };
    case "glass":
      return {
        ...base,
        borderRadius: 18,
        background: `color-mix(in oklab, ${theme.card} 55%, transparent)`,
        border: `1px solid color-mix(in oklab, ${theme.text} 18%, transparent)`,
        backdropFilter: "blur(14px) saturate(140%)",
      };
    case "neon":
      return {
        ...base,
        borderRadius: 14,
        border: `1px solid ${accent}`,
        boxShadow: `0 0 0 1px color-mix(in oklab, ${accent} 25%, transparent), 0 8px 30px -8px ${accent}`,
      };
    default:
      return { ...base, border: `1px solid ${theme.border}` };
  }
}

/* --------------------------------------------------- meertalige bio (NL/EN/FR) */

export const BIO_LOCALES = ["nl", "en", "fr"] as const;
export type BioLocale = (typeof BIO_LOCALES)[number];

export const BIO_LOCALE_LABEL: Record<BioLocale, string> = {
  nl: "NL",
  en: "EN",
  fr: "FR",
};

const BIO_KEY: Record<BioLocale, "bioNl" | "bioEn" | "bioFr"> = {
  nl: "bioNl",
  en: "bioEn",
  fr: "bioFr",
};

/** Welke vertalingen heeft dit profiel effectief ingevuld? */
export function availableBioLocales(prefs: ProfileDisplayPrefs): BioLocale[] {
  return BIO_LOCALES.filter((l) => Boolean(prefs[BIO_KEY[l]]));
}

/**
 * Bio in de gevraagde taal, met auto-detect: gevraagde taal → NL → eerste
 * ingevulde vertaling → de klassieke `profiles.bio`.
 */
export function bioForLocale(
  prefs: ProfileDisplayPrefs,
  fallback: string | null | undefined,
  locale: string,
): string | null {
  const wanted = (BIO_LOCALES as readonly string[]).includes(locale)
    ? (locale as BioLocale)
    : null;
  if (wanted && prefs[BIO_KEY[wanted]]) return prefs[BIO_KEY[wanted]];
  const first = availableBioLocales(prefs)[0];
  if (first) return prefs[BIO_KEY[first]];
  return fallback?.trim() || null;
}
