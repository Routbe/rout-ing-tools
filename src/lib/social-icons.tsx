import type { ComponentType, SVGProps } from "react";
import {
  Calendar,
  Coffee,
  CreditCard,
  Github,
  Gitlab,
  Globe,
  Instagram,
  Link as LinkIcon,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Music,
  Phone,
  Send,
  ShoppingBag,
  Twitch,
  Twitter,
  Wallet,
  Wifi,
  Youtube,
} from "lucide-react";
import { BlueskyIcon, MastodonIcon } from "@/components/SocialIcons";
import { cn } from "@/lib/utils";
import { lookupBrandIcon } from "@/utils/brandIcons";

export type PlatformIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;

/**
 * Brand marks lucide does not ship. Components are cached per path so the same
 * platform always yields the exact same component identity — React then patches
 * the existing node instead of unmounting and remounting the icon on rerender.
 */
/**
 * Brand marks lucide does not ship. Components are cached per path so the same
 * platform always yields the exact same component identity — React patches the
 * existing node instead of remounting the icon on every rerender.
 */
const MARK_CACHE = new Map<string, PlatformIcon>();

function svg(path: string, viewBox = "0 0 24 24"): PlatformIcon {
  const cacheKey = `${viewBox}|${path}`;
  const cached = MARK_CACHE.get(cacheKey);
  if (cached) return cached;
  function BrandMark(props: SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox={viewBox} fill="currentColor" aria-hidden {...props}>
        <path d={path} />
      </svg>
    );
  }
  MARK_CACHE.set(cacheKey, BrandMark);
  return BrandMark;
}

const XIcon = svg(
  "M18.9 2.5h3.3l-7.2 8.2 8.5 11.3h-6.7l-5.2-6.9-6 6.9H1.3l7.7-8.8L.9 2.5h6.9l4.7 6.3 6.4-6.3Zm-1.2 17.6h1.8L7.4 4.3H5.4l12.3 15.8Z",
);
const MatrixIcon = svg(
  "M.6 0v24h2v.5H0V-.5h2.6V0H.6Zm5.9 7.4v1.2h.03c.33-.45.72-.8 1.19-1.05a3.2 3.2 0 0 1 1.55-.37c.58 0 1.11.11 1.59.34.48.23.85.63 1.1 1.2.27-.4.64-.76 1.1-1.07a2.9 2.9 0 0 1 1.63-.47c.47 0 .9.06 1.3.17.4.12.74.3 1.02.55.29.25.51.58.67.98.16.4.24.89.24 1.46v5.9h-2.48v-5c0-.3-.01-.58-.03-.84a1.8 1.8 0 0 0-.19-.68 1.1 1.1 0 0 0-.45-.46 1.7 1.7 0 0 0-.82-.17c-.35 0-.63.07-.85.2-.21.14-.38.31-.5.53a2.1 2.1 0 0 0-.25.74c-.04.28-.06.56-.06.84v4.84h-2.48v-4.95c0-.27 0-.53-.02-.8a2.2 2.2 0 0 0-.15-.72 1.1 1.1 0 0 0-.43-.53 1.6 1.6 0 0 0-.88-.2c-.16 0-.37.04-.63.11-.26.08-.51.22-.75.42-.24.2-.45.49-.62.86-.17.37-.25.85-.25 1.45v4.36H4.05V7.4h2.45ZM21.4 24V0h-2v-.5H24v25h-4.6V24h2Z",
);
const TelegramIcon = svg(
  "M23.1 3.6 19.6 20a1.3 1.3 0 0 1-2.1.7l-4.8-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9-8.2c.4-.4-.1-.6-.6-.2L7 12.1 2.3 10.6c-1-.3-1-1 .2-1.5L21.7 2c.9-.3 1.6.2 1.4 1.6Z",
);
const SignalIcon = svg(
  "M12 1.5a10.5 10.5 0 0 0-9.3 15.4L1.5 22.5l5.7-1.2A10.5 10.5 0 1 0 12 1.5Zm0 2a8.5 8.5 0 1 1-4.3 15.8l-.4-.3-3 .7.6-3-.3-.4A8.5 8.5 0 0 1 12 3.5Z",
);
const WhatsappIcon = svg(
  "M12.04 2C6.6 2 2.2 6.4 2.2 11.85c0 1.9.5 3.7 1.45 5.3L2 22l5-1.6a9.8 9.8 0 0 0 5.04 1.38h.01c5.44 0 9.85-4.4 9.85-9.85S17.48 2 12.04 2Zm0 18a8.1 8.1 0 0 1-4.15-1.14l-.3-.18-3.06.98.99-2.98-.2-.31a8.1 8.1 0 1 1 6.72 3.63Zm4.5-5.9c-.24-.13-1.46-.72-1.68-.8-.23-.09-.4-.13-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23a7.5 7.5 0 0 1-1.38-1.72c-.15-.25-.02-.38.1-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.09-.16.05-.31-.02-.43-.06-.13-.55-1.35-.76-1.84-.2-.48-.4-.41-.55-.42h-.48c-.16 0-.43.06-.65.31-.23.25-.85.83-.85 2.03s.87 2.35.99 2.51c.12.17 1.71 2.61 4.14 3.66.58.25 1.03.4 1.38.51.58.19 1.11.16 1.53.1.47-.07 1.45-.6 1.66-1.17.2-.58.2-1.07.14-1.18-.06-.1-.22-.16-.46-.28Z",
);
// Canoniek eYou-merkpad uit public/img/brand/eyou.svg (113×106 viewBox).
const EyouIcon = svg(
  "M112.4 86.2L85.1 97.4C84.2 86.3 76.3 67.1 69.2 59.7C65.6 76.9 52.1 93.7 40.4 105.9L17.6 83.1C28.1 77 45.2 67.9 52.1 55.5C34.3 57.5 15.9 52.6 0 45.4L13 14.4C25.1 25 39 36.1 56.9 37.8C55 32.3 47.7 21.8 43.4 17.3L60.7 0C64.6 6.2 70.1 26.5 70.4 34.3C78.1 28.5 100.2 18.8 111.1 17.2V44.2C104.6 43.4 84.4 45.2 79 47.1C88.4 52.6 103.7 68.4 109.5 79.8C110.4 81.7 111.5 84.1 112.5 86.3L112.4 86.2Z",
  "0 0 113 106",
);
const WsocialIcon = svg(
  "M1.2 3.4h4.1l3 11.1 3-11.1h3.4l3 11.1 3-11.1h4.1l-5.1 17.2h-4.1L12 9.9 9.4 20.6H5.3L1.2 3.4Z",
);
const DiscordIcon = svg(
  "M20.3 4.4A19 19 0 0 0 15.6 3l-.24.44c1.6.4 2.34.96 3.13 1.66a11.5 11.5 0 0 0-9.5-.34l-.5.34c.84-.74 1.8-1.3 3.13-1.66L11.4 3a19 19 0 0 0-4.7 1.4C3.7 8.8 2.9 13.1 3.3 17.3A19.2 19.2 0 0 0 9 20.2l.9-1.6c-.98-.36-1.9-.82-2.7-1.42l.6-.44a13.6 13.6 0 0 0 11.4 0l.6.44c-.8.6-1.72 1.06-2.7 1.42l.9 1.6a19.2 19.2 0 0 0 5.7-2.9c.5-4.86-.83-9.13-3.4-12.9ZM9.2 14.9c-1.1 0-2-1-2-2.3 0-1.26.88-2.3 2-2.3s2.02 1.04 2 2.3c0 1.27-.88 2.3-2 2.3Zm5.6 0c-1.1 0-2-1-2-2.3 0-1.26.88-2.3 2-2.3s2.02 1.04 2 2.3c0 1.27-.88 2.3-2 2.3Z",
);

/** Hostname → icon. Order matters only for substring fallbacks. */
const HOST_MAP: [RegExp, PlatformIcon][] = [
  [/(^|\.)github\.com$/, Github],
  [/(^|\.)gitlab\.com$/, Gitlab],
  [/(^|\.)instagram\.com$/, Instagram],
  [/(^|\.)linkedin\.com$/, Linkedin],
  [/(^|\.)bsky\.app$/, BlueskyIcon],
  [/(^|\.)(x|twitter)\.com$/, XIcon],
  [/(^|\.)matrix\.to$/, MatrixIcon],
  [/(^|\.)(youtube\.com|youtu\.be)$/, Youtube],
  [/(^|\.)t\.me$|(^|\.)telegram\.(me|org)$/, TelegramIcon],
  [/(^|\.)signal\.(me|org)$/, SignalIcon],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, WhatsappIcon],
  [/(^|\.)discord\.(gg|com)$/, DiscordIcon],
  [/(^|\.)twitch\.tv$/, Twitch],
  [/(^|\.)eyou\.social$/, EyouIcon],
  [/(^|\.)w\.social$|(^|\.)wsocial\./, WsocialIcon],
  [/mastodon|fosstodon|mstdn|social\.|pixelfed/, MastodonIcon],
];

/** Keyword (platform kind or free-text label) → icon. */
const NAME_MAP: Record<string, PlatformIcon> = {
  github: Github,
  gitlab: Gitlab,
  instagram: Instagram,
  linkedin: Linkedin,
  bluesky: BlueskyIcon,
  bsky: BlueskyIcon,
  x: XIcon,
  twitter: XIcon,
  mastodon: MastodonIcon,
  fediverse: MastodonIcon,
  pixelfed: MastodonIcon,
  eyou: EyouIcon,
  "eyou.social": EyouIcon,
  wsocial: WsocialIcon,
  "w.social": WsocialIcon,
  matrix: MatrixIcon,
  element: MatrixIcon,
  youtube: Youtube,
  telegram: TelegramIcon,
  signal: SignalIcon,
  whatsapp: WhatsappIcon,
  whatsapp_chat: WhatsappIcon,
  discord: DiscordIcon,
  twitch: Twitch,
  email: Mail,
  mail: Mail,
  phone: Phone,
  location: MapPin,
  applemaps: MapPin,
  wifi: Wifi,
  shop: ShoppingBag,
  spotify: Music,
  applemusic: Music,
  soundcloud: Music,
  bandcamp: Music,
  tidal: Music,
  deezer: Music,
  calcom: Calendar,
  calendly: Calendar,
  paypal: CreditCard,
  stripe: CreditCard,
  revolut: CreditCard,
  bancontact: CreditCard,
  payconiq: CreditCard,
  tikkie: CreditCard,
  lightning: Wallet,
  evm: Wallet,
  kofi: Coffee,
  bmac: Coffee,
  website: Globe,
  web: Globe,
  link: LinkIcon,
  vcard: LinkIcon,
  sms: MessageCircle,
  send: Send,
};

/**
 * Resolves an official platform icon from either a full URL
 * (`https://bsky.app/profile/x`) or a bare keyword (`bluesky`, `Matrix`).
 * Unknown values fall back to a clean Globe (URL-ish) or Link icon.
 */
export function getSocialPlatformIcon(urlOrName: string): PlatformIcon {
  const raw = (urlOrName ?? "").trim();
  if (!raw) return LinkIcon;

  // 0 — Harde merkkaart eerst: een bekend platform krijgt altijd zijn eigen
  // officiële vector, nooit een generiek icoon.
  const brand = lookupBrandIcon(raw);
  if (brand) return svg(brand.path, brand.viewBox);

  // 1 — URL form: match on hostname so query strings never confuse the parser.
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let host = "";
  try {
    host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    host = "";
  }
  if (host && raw.includes(".")) {
    for (const [pattern, Icon] of HOST_MAP) if (pattern.test(host)) return Icon;
  }

  // 2 — Keyword form: exact kind/label, then a loose contains match.
  const key = raw
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[\s/]+/g, "");
  if (NAME_MAP[key]) return NAME_MAP[key];
  for (const [name, Icon] of Object.entries(NAME_MAP)) {
    if (name.length > 3 && key.includes(name)) return Icon;
  }

  // 3 — A fediverse handle (@user@domain) still resolves to Mastodon.
  if (/^@?[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(raw)) return MastodonIcon;

  // 4 — Onbekende bestemming: een net link-symbool, geen wereldbol voor iets
  // dat op een sociaal netwerk lijkt. Alleen kale websites krijgen de globe.
  return /^(https?:\/\/)?[^@\s]+\.[a-z]{2,}(\/|$)/i.test(raw) && !raw.includes("@")
    ? Globe
    : LinkIcon;
}

/**
 * Merkicoon-renderer. Bekende platformen renderen in hun officiële merkkleur;
 * onbekende bronnen blijven neutraal en volgen het thema.
 */
export function SocialPlatformIcon({
  source,
  className,
  monochrome = false,
}: {
  source: string;
  className?: string;
  /** Forceert themakleur in plaats van de merkkleur. */
  monochrome?: boolean;
}) {
  const Icon = getSocialPlatformIcon(source);
  const brand = monochrome ? null : lookupBrandIcon(source);
  return (
    <Icon
      className={cn("h-5 w-5 shrink-0", brand ? "" : "text-foreground", className)}
      style={brand ? { color: brand.color } : undefined}
      aria-hidden
    />
  );
}

