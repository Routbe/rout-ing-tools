/**
 * ROUT Profile & Link Hub — data model for the public rout.be/@handle page.
 * Kept deliberately small: handle + identity + an ordered list of blocks.
 */
import { handleRuleMessage, type HandleRuleContext } from "./handle-rules";
import type { PublicSocialLink } from "./social-verify";
import { IDENTITY_MISMATCH_MESSAGE, handleMatchesLegalName } from "./legal-name";



export interface ProfileBlock {
  id: string;
  kind: string;
  label: string;
  value: string;
  hidden?: boolean;
}

export interface ProfileRecord {
  id: string;
  username: string | null;
  display_name: string | null;
  tagline: string | null;
  avatar_url: string | null;
  favicon_url?: string | null;
  theme: string;
  card_style: string;
  blocks: ProfileBlock[];
  tier?: string;
  verified?: boolean;
  status?: string;
  bio?: string | null;
  is_early_believer?: boolean;
  show_email_publicly?: boolean;
  forwarding_email?: string | null;
  custom_domain?: string | null;
  created_at?: string | null;
  /** Moment waarop de verificatie is geactiveerd (blauwe badge-popover). */
  verified_at?: string | null;
  /** Weergavevoorkeuren (badge, watermerk, achtergrond) — zie profile-display.ts. */
  display_prefs?: unknown;
  verified_legal_name?: string | null;
  /**
   * Geverifieerde sociale accounts met gecachte volgeraantallen. Deze data komt
   * uitsluitend uit onze database (`social_links`), nooit uit een externe API
   * tijdens het laden van de profielpagina.
   */
  social_links?: PublicSocialLink[];
}

export type ProfileTier = "free" | "early_believer";

export interface PaymentMethodOption {
  id: "stripe" | "sepa";
  label: string;
  note: string;
  instant: boolean;
}

/** One-time Early Believer verification — price locked for life. */
export const EARLY_BELIEVER_CENTS = 399;

/** Optional recurring "Keep ROUT Alive" add-ons on top of the one-time fee. */
export type DonationPlan = "none" | "one_time" | "monthly" | "yearly";

export const DONATION_PLANS: {
  id: DonationPlan;
  label: string;
  note: string;
  cents: number;
  interval: "month" | "year" | null;
}[] = [
  {
    id: "none",
    label: "No extra donation",
    note: `Total: ${"\u20AC"}3.99`,
    cents: 0,
    interval: null,
  },
  {
    id: "one_time",
    label: "One-off extra",
    note: "From €1.00 extra",
    cents: 100,
    interval: null,
  },
  { id: "monthly", label: "€1.00 / month", note: "Minimum — set your own", cents: 100, interval: "month" },
  {
    id: "yearly",
    label: "€12.00 / year",
    note: "Minimum — set your own",
    cents: 1200,
    interval: "year",
  },

];

/** Verification tiers — price in cents, one-off. */
export const VERIFICATION_TIERS: {
  id: Exclude<ProfileTier, "free">;
  label: string;
  amountCents: number;
  instantSurchargeCents: number;
  audience: string;
  perks: string[];
  methods: PaymentMethodOption[];
}[] = [
  {
    id: "early_believer",
    label: "Early Believer",
    amountCents: EARLY_BELIEVER_CENTS,
    instantSurchargeCents: 0,
    audience: "One-time lifetime verification — price locked for life",
    perks: [
      "Verified Early Believer badge on your profile",
      "Your own username@rout.be forwarding address",
      "Custom domain mapping",
      "Priority on new sovereign features",
    ],
    methods: [
      {
        id: "stripe",
        label: "Instant via card",
        note: "Active immediately after payment — €3.99 one-time.",
        instant: true,
      },
      {
        id: "sepa",
        label: "Bank transfer (SEPA)",
        note: "€3.99 one-time — manual matching, 1 to 2 weeks.",
        instant: false,
      },
    ],
  },
];


/**
 * Official SEPA bank details for the manual bank-transfer route.
 * Belgian Wise account — single source of truth for every payment view.
 */
export const SEPA_DETAILS = {
  beneficiary: "Jona Zeno De Smet",
  iban: "BE78 9677 2106 1586",
  bic: "TRWIBEB1XXX",
  bank: "Wise",
  bankAddress: "Rue du Trône 100, 1050 Brussels, Belgium",
  country: "België",
};

export const RESERVED_HANDLES = [
  "admin",
  "api",
  "auth",
  "free",
  "u",
  "login",
  "logout",
  "settings",
  "support",
  "dashboard",
  "root",
  "rout",
  "www",
  "mail",
  "help",
  "billing",
  "status",
  "static",
  "assets",
  "cdn",
  "app",
  "go",
  "r",
  "card",
  "hub",
  "stats",
  "privacy",
  "terms",
  "batch",
  "en",
  "nl",
  "me",
  "user",
  "users",
  "profile",
  "security",
  "verify",
  "payment",
  "payments",
  "webhook",
  "webhooks",
  "null",
  "undefined",
  // Top-level app routes — a handle here would shadow a real page in the
  // clean `rout.be/<handle>` namespace.
  "claim",
  "studio",
  "contact",
  "manifesto",
  "sovereignty",
  "self-hosting",
  "signature",
  "email-templates",
  "iban-qr",
  "vcard-qr",
  "wifi-qr",
  "s",
  "dev",
];

export const isReservedHandle = (h: string) => RESERVED_HANDLES.includes(h);

/**
 * Public path for a profile: eigen namespace bij verificatie, anders `/u/`.
 * Zonder `@` — de routes accepteren beide vormen, maar we tonen en delen de
 * schone variant (`rout.be/u/jona`).
 */
export const profilePath = (username: string, verified?: boolean) =>
  verified ? `/${username}` : `/u/${username}`;


/** Block catalogue used by the “+ Add block” drawer, grouped in folders. */
export const BLOCK_KINDS: {
  kind: string;
  label: string;
  category: "featured" | "socials" | "web" | "finance" | "media" | "contact";
  placeholder: string;
  /** Turns a handle into a full URL. */
  base?: string;
}[] = [
  // 1 — Soeverein & Fediverse (top-alternatieven eerst)
  {
    kind: "eyou",
    label: "Eyou.social",
    category: "featured",
    placeholder: "routbe",
    base: "https://eyou.social/u/",
  },
  {
    kind: "wsocial",
    label: "Wsocial",
    category: "featured",
    placeholder: "https://wsocial.be/jona",
  },
  {
    kind: "mastodon",
    label: "Mastodon",
    category: "featured",
    placeholder: "https://mastodon.social/@routbe",
  },
  {
    kind: "matrix",
    label: "Matrix",
    category: "featured",
    placeholder: "@jona:matrix.org",
    base: "https://matrix.to/#/",
  },
  { kind: "signal", label: "Signal", category: "featured", placeholder: "https://signal.me/#p/…" },
  {
    kind: "bluesky",
    label: "Bluesky",
    category: "featured",
    placeholder: "rout.be",
    base: "https://bsky.app/profile/",
  },
  {
    kind: "pixelfed",
    label: "Pixelfed",
    category: "featured",
    placeholder: "https://pixelfed.social/jona",
  },
  {
    kind: "substack",
    label: "Substack",
    category: "featured",
    placeholder: "https://jona.substack.com",
  },

  // 2 — Mainstream socials & communities
  {
    kind: "instagram",
    label: "Instagram",
    category: "socials",
    placeholder: "@jona",
    base: "https://instagram.com/",
  },
  {
    kind: "tiktok",
    label: "TikTok",
    category: "socials",
    placeholder: "@jona",
    base: "https://tiktok.com/@",
  },
  {
    kind: "x",
    label: "X / Twitter",
    category: "socials",
    placeholder: "@jona",
    base: "https://x.com/",
  },
  {
    kind: "youtube",
    label: "YouTube",
    category: "socials",
    placeholder: "@jona",
    base: "https://youtube.com/@",
  },
  {
    kind: "linkedin",
    label: "LinkedIn",
    category: "socials",
    placeholder: "@jona",
    base: "https://linkedin.com/in/",
  },
  {
    kind: "facebook",
    label: "Facebook",
    category: "socials",
    placeholder: "@jona",
    base: "https://facebook.com/",
  },
  {
    kind: "snapchat",
    label: "Snapchat",
    category: "socials",
    placeholder: "@jona",
    base: "https://snapchat.com/add/",
  },
  {
    kind: "pinterest",
    label: "Pinterest",
    category: "socials",
    placeholder: "@jona",
    base: "https://pinterest.com/",
  },
  {
    kind: "reddit",
    label: "Reddit",
    category: "socials",
    placeholder: "u/jona",
    base: "https://reddit.com/",
  },
  {
    kind: "threads",
    label: "Threads",
    category: "socials",
    placeholder: "@jona",
    base: "https://threads.net/@",
  },
  {
    kind: "twitch",
    label: "Twitch",
    category: "socials",
    placeholder: "@jona",
    base: "https://twitch.tv/",
  },
  {
    kind: "kick",
    label: "Kick",
    category: "socials",
    placeholder: "jona",
    base: "https://kick.com/",
  },
  {
    kind: "telegram",
    label: "Telegram",
    category: "socials",
    placeholder: "@jona",
    base: "https://t.me/",
  },
  { kind: "whatsapp", label: "WhatsApp", category: "socials", placeholder: "+32 470 00 00 00" },
  { kind: "discord", label: "Discord", category: "socials", placeholder: "https://discord.gg/…" },
  {
    kind: "vk",
    label: "VKontakte",
    category: "socials",
    placeholder: "jona",
    base: "https://vk.com/",
  },

  // 3 — Developer, web & portfolios
  { kind: "website", label: "Website / URL", category: "web", placeholder: "https://rout.be" },
  {
    kind: "github",
    label: "GitHub",
    category: "web",
    placeholder: "@jona",
    base: "https://github.com/",
  },
  {
    kind: "gitlab",
    label: "GitLab",
    category: "web",
    placeholder: "@jona",
    base: "https://gitlab.com/",
  },
  {
    kind: "stackoverflow",
    label: "Stack Overflow",
    category: "web",
    placeholder: "https://stackoverflow.com/users/…",
  },
  {
    kind: "dribbble",
    label: "Dribbble",
    category: "web",
    placeholder: "@jona",
    base: "https://dribbble.com/",
  },
  {
    kind: "behance",
    label: "Behance",
    category: "web",
    placeholder: "@jona",
    base: "https://behance.net/",
  },
  {
    kind: "codepen",
    label: "CodePen",
    category: "web",
    placeholder: "jona",
    base: "https://codepen.io/",
  },
  { kind: "notion", label: "Notion", category: "web", placeholder: "https://notion.site/…" },
  {
    kind: "readcv",
    label: "Read.cv",
    category: "web",
    placeholder: "@jona",
    base: "https://read.cv/",
  },
  {
    kind: "hashnode",
    label: "Hashnode",
    category: "web",
    placeholder: "https://jona.hashnode.dev",
  },
  {
    kind: "wikipedia",
    label: "Wikipedia",
    category: "web",
    placeholder: "https://nl.wikipedia.org/wiki/…",
  },

  // 4 — Financiën, betalingen & crypto
  {
    kind: "paypal",
    label: "PayPal",
    category: "finance",
    placeholder: "@jona",
    base: "https://paypal.me/",
  },
  {
    kind: "stripe",
    label: "Stripe payment link",
    category: "finance",
    placeholder: "https://buy.stripe.com/…",
  },
  {
    kind: "revolut",
    label: "Revolut",
    category: "finance",
    placeholder: "@jona",
    base: "https://revolut.me/",
  },
  { kind: "bancontact", label: "Bancontact", category: "finance", placeholder: "https://…" },
  {
    kind: "payconiq",
    label: "Payconiq",
    category: "finance",
    placeholder: "https://payconiq.com/…",
  },
  { kind: "tikkie", label: "Tikkie", category: "finance", placeholder: "https://tikkie.me/pay/…" },
  {
    kind: "opencollective",
    label: "Open Collective",
    category: "finance",
    placeholder: "jona",
    base: "https://opencollective.com/",
  },
  {
    kind: "kofi",
    label: "Ko-fi",
    category: "finance",
    placeholder: "jona",
    base: "https://ko-fi.com/",
  },
  {
    kind: "bmac",
    label: "Buy Me a Coffee",
    category: "finance",
    placeholder: "jona",
    base: "https://buymeacoffee.com/",
  },
  {
    kind: "patreon",
    label: "Patreon",
    category: "finance",
    placeholder: "jona",
    base: "https://patreon.com/",
  },
  {
    kind: "lightning",
    label: "Bitcoin Lightning address",
    category: "finance",
    placeholder: "jona@getalby.com",
  },
  { kind: "evm", label: "EVM wallet (ETH/Polygon)", category: "finance", placeholder: "0x…" },

  // 5 — Media, gaming & entertainment
  {
    kind: "spotify",
    label: "Spotify",
    category: "media",
    placeholder: "https://open.spotify.com/…",
  },
  {
    kind: "applemusic",
    label: "Apple Music",
    category: "media",
    placeholder: "https://music.apple.com/…",
  },
  {
    kind: "soundcloud",
    label: "SoundCloud",
    category: "media",
    placeholder: "jona",
    base: "https://soundcloud.com/",
  },
  {
    kind: "bandcamp",
    label: "Bandcamp",
    category: "media",
    placeholder: "https://jona.bandcamp.com",
  },
  { kind: "tidal", label: "Tidal", category: "media", placeholder: "https://tidal.com/…" },
  { kind: "deezer", label: "Deezer", category: "media", placeholder: "https://deezer.com/…" },
  {
    kind: "lastfm",
    label: "Last.fm",
    category: "media",
    placeholder: "jona",
    base: "https://last.fm/user/",
  },
  {
    kind: "steam",
    label: "Steam",
    category: "media",
    placeholder: "https://steamcommunity.com/id/jona",
  },
  { kind: "epicgames", label: "Epic Games", category: "media", placeholder: "jona" },
  {
    kind: "letterboxd",
    label: "Letterboxd",
    category: "media",
    placeholder: "jona",
    base: "https://letterboxd.com/",
  },
  {
    kind: "goodreads",
    label: "Goodreads",
    category: "media",
    placeholder: "https://goodreads.com/…",
  },
  { kind: "imdb", label: "IMDb", category: "media", placeholder: "https://imdb.com/name/…" },
  {
    kind: "myanimelist",
    label: "MyAnimeList",
    category: "media",
    placeholder: "jona",
    base: "https://myanimelist.net/profile/",
  },
  {
    kind: "trakt",
    label: "Trakt",
    category: "media",
    placeholder: "jona",
    base: "https://trakt.tv/users/",
  },

  // 6 — Bedrijf, contact & utilities
  {
    kind: "vcard",
    label: "vCard (direct download)",
    category: "contact",
    placeholder: "https://…/contact.vcf",
  },
  { kind: "email", label: "E-mailadres", category: "contact", placeholder: "hello@rout.be" },
  { kind: "phone", label: "Telefoonnummer", category: "contact", placeholder: "+32 470 00 00 00" },
  {
    kind: "whatsapp_chat",
    label: "WhatsApp direct chat",
    category: "contact",
    placeholder: "+32 470 00 00 00",
  },
  {
    kind: "location",
    label: "Google Maps / locatie",
    category: "contact",
    placeholder: "Grote Markt 1, 8500 Kortrijk",
  },
  {
    kind: "applemaps",
    label: "Apple Maps",
    category: "contact",
    placeholder: "https://maps.apple.com/?q=…",
  },
  {
    kind: "calcom",
    label: "Cal.com",
    category: "contact",
    placeholder: "jona",
    base: "https://cal.com/",
  },
  {
    kind: "calendly",
    label: "Calendly",
    category: "contact",
    placeholder: "jona",
    base: "https://calendly.com/",
  },
  { kind: "wifi", label: "Wi-Fi netwerk", category: "contact", placeholder: "SSID · wachtwoord" },
  {
    kind: "trustpilot",
    label: "Trustpilot",
    category: "contact",
    placeholder: "https://trustpilot.com/review/…",
  },
  { kind: "yelp", label: "Yelp", category: "contact", placeholder: "https://yelp.com/biz/…" },
  {
    kind: "booking",
    label: "Booking.com",
    category: "contact",
    placeholder: "https://booking.com/hotel/…",
  },
  { kind: "shop", label: "Shop", category: "contact", placeholder: "https://shop.rout.be" },
  { kind: "link", label: "Eigen link", category: "contact", placeholder: "https://…" },
  // Interactieve widgets: deze renderen als kaart op het profiel i.p.v. als link.
  {
    kind: "newsletter",
    label: "Nieuwsbrief (inschrijfformulier)",
    category: "web",
    placeholder: "Blijf op de hoogte",
  },
  {
    kind: "calendar",
    label: "Afspraak boeken (Cal.com / Calendly)",
    category: "web",
    placeholder: "https://cal.com/jouwnaam/30min",
  },
];


export const BLOCK_CATEGORIES = [
  { id: "featured", label: "Soeverein & Fediverse" },
  { id: "web", label: "Code & open source" },
  { id: "socials", label: "Mainstream" },
  { id: "finance", label: "Financiën" },
  { id: "media", label: "Media & gaming" },
  { id: "contact", label: "Contact & utilities" },
] as const;

/**
 * Merk-accentkleuren per componenttype — vlakke tinten, geen gradients.
 * Gebruikt voor de visuele kaartjes in de Studio zodat de lijst leesbaar blijft.
 */
export const BLOCK_BRAND: Record<string, string> = {
  eyou: "#16a34a",
  wsocial: "#0ea5a4",
  bluesky: "#0285ff",
  mastodon: "#6364ff",
  pixelfed: "#10b981",
  matrix: "#0f172a",
  signal: "#3a76f0",
  substack: "#ff6719",
  instagram: "#d62976",
  tiktok: "#010101",
  x: "#111111",
  youtube: "#ff0000",
  linkedin: "#0a66c2",
  facebook: "#1877f2",
  snapchat: "#f7c800",
  pinterest: "#e60023",
  reddit: "#ff4500",
  threads: "#111111",
  twitch: "#9146ff",
  kick: "#53fc18",
  telegram: "#229ed9",
  whatsapp: "#25d366",
  whatsapp_chat: "#25d366",
  discord: "#5865f2",
  vk: "#0077ff",
  website: "#0f172a",
  github: "#181717",
  gitlab: "#fc6d26",
  stackoverflow: "#f48024",
  dribbble: "#ea4c89",
  behance: "#1769ff",
  codepen: "#111111",
  notion: "#111111",
  readcv: "#111111",
  hashnode: "#2962ff",
  wikipedia: "#3366cc",
  paypal: "#003087",
  stripe: "#635bff",
  revolut: "#111111",
  bancontact: "#004e9e",
  payconiq: "#ff4785",
  tikkie: "#f57c00",
  opencollective: "#297eff",
  kofi: "#ff5e5b",
  bmac: "#ffdd00",
  patreon: "#ff424d",
  lightning: "#f7931a",
  evm: "#627eea",
  spotify: "#1db954",
  applemusic: "#fa233b",
  soundcloud: "#ff5500",
  bandcamp: "#629aa9",
  tidal: "#111111",
  deezer: "#a238ff",
  lastfm: "#d51007",
  steam: "#1b2838",
  epicgames: "#2a2a2a",
  letterboxd: "#00e054",
  goodreads: "#553b08",
  imdb: "#f5c518",
  myanimelist: "#2e51a2",
  trakt: "#ed1c24",
  vcard: "#0f172a",
  email: "#0ea5e9",
  phone: "#16a34a",
  location: "#ea4335",
  applemaps: "#0f172a",
  calcom: "#111111",
  calendly: "#006bff",
  wifi: "#0ea5e9",
  trustpilot: "#00b67a",
  yelp: "#ff1a1a",
  booking: "#003580",
  shop: "#0f172a",
  link: "#0f172a",
};

/** Accentkleur van een component (valt terug op een neutrale tint). */
export const brandOf = (kind: string) => BLOCK_BRAND[kind] ?? "#64748b";

/** Flat UI theme presets — background / card / text tokens per theme. */
export const PROFILE_THEMES: {
  id: string;
  label: string;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  /** Accentkleur voor neon-knoppen en mesh-achtergronden. */
  accent?: string;
}[] = [
  {
    id: "noir",
    label: "Noir",
    bg: "#0d0d0d",
    card: "#171717",
    text: "#f5f5f5",
    muted: "#a3a3a3",
    border: "#2a2a2a",
    accent: "#e5e5e5",
  },
  {
    id: "papier",
    label: "Papier",
    bg: "#f7f4ef",
    card: "#ffffff",
    text: "#1c1917",
    muted: "#78716c",
    border: "#e3ded5",
    accent: "#1c1917",
  },
  {
    id: "midnight",
    label: "Midnight",
    bg: "#0b1220",
    card: "#141d31",
    text: "#eef2ff",
    muted: "#94a3b8",
    border: "#22304d",
    accent: "#6366f1",
  },
  {
    id: "forest",
    label: "Forest",
    bg: "#0e1a14",
    card: "#16251d",
    text: "#ecfdf5",
    muted: "#8faca0",
    border: "#22382c",
    accent: "#10b981",
  },
  {
    id: "terracotta",
    label: "Terracotta",
    bg: "#fdf3ee",
    card: "#ffffff",
    text: "#2b1a12",
    muted: "#8a6b5c",
    border: "#ecd9cd",
    accent: "#c2703f",
  },
  {
    id: "mocha",
    label: "Mocha",
    bg: "#1b1310",
    card: "#2a1e19",
    text: "#f6ece3",
    muted: "#bda695",
    border: "#3b2b23",
    accent: "#c08457",
  },
  {
    id: "slate",
    label: "Slate",
    bg: "#f1f5f9",
    card: "#ffffff",
    text: "#0f172a",
    muted: "#64748b",
    border: "#dbe3ec",
    accent: "#3b82f6",
  },
  {
    id: "emerald",
    label: "Emerald Glass",
    bg: "#04211a",
    card: "#0b3328",
    text: "#e6fff6",
    muted: "#8fc7b3",
    border: "#12513f",
    accent: "#34d399",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    bg: "#0a0a0f",
    card: "#15121f",
    text: "#f4f2ff",
    muted: "#9d95c7",
    border: "#2b2440",
    accent: "#a855f7",
  },
  {
    id: "arctic",
    label: "Arctic Frost",
    bg: "#f2f8fd",
    card: "#ffffff",
    text: "#0b2434",
    muted: "#5f7f92",
    border: "#d7e7f2",
    accent: "#38bdf8",
  },
  {
    id: "sunset",
    label: "Sunset Gold",
    bg: "#17120d",
    card: "#241a12",
    text: "#fdf3e3",
    muted: "#c4a884",
    border: "#3a2a1c",
    accent: "#f59e0b",
  },
];

export const CARD_STYLES = [
  { id: "bordered", label: "Bordered" },
  { id: "solid", label: "Solid flat" },
  { id: "pill", label: "Pill" },
  { id: "sharp", label: "Sharp" },
  { id: "glass", label: "Glass" },
  { id: "neon", label: "Neon glow" },
] as const;

export const themeOf = (id: string) => PROFILE_THEMES.find((t) => t.id === id) ?? PROFILE_THEMES[0];

/** Lowercase, url-safe handle. Never throws; returns '' when unusable. */
export function normalizeHandle(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 30);
}

/** Minimum handle length — 5 characters is the platform-wide floor. */
export const HANDLE_MIN_LENGTH = 5;
export const HANDLE_MAX_LENGTH = 30;

export const HANDLE_RULE = "5–30 characters · lowercase letters, numbers and . - _";

/** Tier-aware hint shown under the handle input. */
export function handleRuleHint(ctx: HandleRuleContext = {}): string {
  return ctx.tier === "verified"
    ? "5–30 characters · lowercase letters, numbers and . - _ · must stay traceable to your legal name (e.g. j.delplanche)"
    : "Free handle: 5–30 characters with at least 2 numbers (e.g. jona26) · lowercase letters, numbers and . - _";
}

export const isValidHandle = (h: string) => /^[a-z0-9](?:[a-z0-9._-]{3,28}[a-z0-9])$/.test(h);

/** Human-readable reason a handle is unusable, or null when it is valid. */
export function handleIssue(h: string, ctx: HandleRuleContext = {}): string | null {
  if (!h) return "Choose a handle to claim your namespace.";
  const ruleIssue = handleRuleMessage(h, ctx);
  if (ruleIssue) return ruleIssue;
  if (h.length > HANDLE_MAX_LENGTH)
    return `Handles can be at most ${HANDLE_MAX_LENGTH} characters long.`;
  if (isReservedHandle(h)) return "That handle is reserved by the system.";
  if (!isValidHandle(h))
    return "Use lowercase letters, numbers and the separators . - _ ; start and end with a letter or number.";
  // Verified identity: the handle must stay traceable to the legal name.
  // Privacy-modus: geverifieerde leden mogen een schone alias kiezen die niets
  // over hun wettelijke naam prijsgeeft.
  if (
    ctx.tier === "verified" &&
    ctx.identityMode !== "private" &&
    ctx.legalName &&
    !handleMatchesLegalName(h, ctx.legalName)
  ) {
    return IDENTITY_MISMATCH_MESSAGE;
  }
  return null;
}

/** Resolves a block value (handle, phone, e-mail or full URL) to an href. */
export function blockHref(block: ProfileBlock): string {
  const raw = block.value.trim();
  if (!raw) return "";
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;

  switch (block.kind) {
    case "email":
      return `mailto:${raw}`;
    case "lightning":
      return raw.includes("@") ? `lightning:${raw}` : raw;
    case "evm":
      return `https://etherscan.io/address/${raw}`;
    case "wifi":
    case "newsletter":
      return "";
    case "calendar":
      return raw.startsWith("http") ? raw : `https://${raw.replace(/^\/+/, "")}`;
    case "phone":
      return `tel:${raw.replace(/[^\d+]/g, "")}`;
    case "whatsapp":
      return `https://wa.me/${raw.replace(/[^\d]/g, "")}`;
    case "location":
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(raw)}`;
    default: {
      const def = BLOCK_KINDS.find((k) => k.kind === block.kind);
      if (def?.base) return `${def.base}${raw.replace(/^@+/, "")}`;
      return `https://${raw.replace(/^\/+/, "")}`;
    }
  }
}

/** Blokken die als interactieve widget renderen i.p.v. als gewone linkknop. */
export const isWidgetBlock = (kind: string) => kind === "newsletter" || kind === "calendar";

export const newBlockId = () =>
  `b_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Formats cents as a Belgian euro price (€1,50). */
export const euro = (cents: number) => `€${(cents / 100).toFixed(2).replace(".", ",")}`;
