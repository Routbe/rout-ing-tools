import type { Locale } from "@/lib/i18n";

/**
 * Multilingual social preview cards.
 *
 * The site keeps flat, language-independent URLs, so the locale comes from the
 * `rout_lang` cookie (server-rendered) or the `/en/`, `/fr/`, `/de/` prefix
 * when a link carries one. Every locale gets its own OpenGraph + Twitter card.
 */

export const OG_IMAGE = "/og-banner.jpg";

type Card = { title: string; description: string };

export const SOCIAL_CARDS: Record<Locale, Card> = {
  nl: {
    title: "ROUT — QR-codes en korte links met karakter",
    description:
      "Maak stijlvolle QR-codes en trackbare korte links. Gratis te gebruiken, privacyvriendelijk en volledig in eigen beheer.",
  },
  en: {
    title: "ROUT — QR codes and short links with character",
    description:
      "Create stylish QR codes and trackable short links. Free, privacy-friendly, and fully self-hosted.",
  },
  fr: {
    title: "ROUT — Des QR codes et liens courts avec du caractère",
    description:
      "Créez des QR codes élégants et des liens courts traçables. Gratuit, respectueux de la vie privée et entièrement auto-hébergé.",
  },
  de: {
    title: "ROUT — QR-Codes und Kurzlinks mit Charakter",
    description:
      "Erstelle stilvolle QR-Codes und nachverfolgbare Kurzlinks. Kostenlos, datenschutzfreundlich und vollständig selbst gehostet.",
  },
};

/** Picks the locale from a `/en/…` style path prefix, if present. */
export function localeFromPath(pathname: string): Locale | null {
  const match = /^\/(nl|en|fr|de)(?:\/|$)/.exec(pathname);
  return (match?.[1] as Locale | undefined) ?? null;
}

/** Ready-to-spread `meta` array for a route `head()`. */
export function socialMeta(locale: Locale, absoluteImageUrl?: string | null) {
  const card = SOCIAL_CARDS[locale] ?? SOCIAL_CARDS.en;
  const image = absoluteImageUrl ?? null;
  return [
    { title: card.title },
    { name: "description", content: card.description },
    { property: "og:title", content: card.title },
    { property: "og:description", content: card.description },
    { property: "og:locale", content: `${locale}_${locale.toUpperCase()}` },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
    ...(image
      ? [
          { property: "og:image", content: image },
          { name: "twitter:image", content: image },
        ]
      : []),
  ];
}

/**
 * OpenGraph card for a public member profile. Mastodon, Bluesky and friends
 * read these tags straight from the server-rendered HTML.
 */
export function profileSocialMeta(input: {
  locale: Locale;
  handle: string;
  displayName?: string | null;
  tagline?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  frozen?: boolean;
  /** Eigen overrides uit de Studio ("Social Sharing & SEO"). */
  metaTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  accentColor?: string | null;
  /** Absolute URL van de profielpagina zelf. */
  url?: string | null;
}) {
  const name = input.displayName?.trim() || `@${input.handle}`;
  const title = input.metaTitle?.trim() || `${name} (@${input.handle}) — ROUT`;
  const description = input.frozen
    ? SOCIAL_CARDS[input.locale].description
    : (input.metaDescription?.trim() ||
        input.tagline?.trim() ||
        input.bio?.trim()?.slice(0, 160) ||
        SOCIAL_CARDS[input.locale].description);
  // Eigen upload > dynamisch gegenereerde ROUT-kaart (nooit de kale avatar).
  const image =
    input.ogImageUrl?.trim() ||
    `https://rout.be/api/public/og/${encodeURIComponent(input.handle)}.png`;
  const url = input.url?.trim() || `https://rout.be/${input.handle}`;
  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: "profile" },
    { property: "og:site_name", content: "ROUT" },
    { property: "og:url", content: url },
    { property: "og:locale", content: `${input.locale}_${input.locale.toUpperCase()}` },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { property: "og:image:alt", content: `${name} op ROUT` },
    { property: "og:image:type", content: image.endsWith(".svg") ? "image/svg+xml" : "image/png" },
    // Discord kleurt de rand van de embed met theme-color; mobiele browsers de
    // adresbalk. Zonder eigen accent valt ROUT terug op het huisgoud.
    { name: "theme-color", content: input.accentColor?.trim() || "#C9A84C" },
    ...(input.frozen ? [{ name: "robots", content: "noindex, nofollow" }] : []),
  ];
}

/** Canonieke URL voor een publieke route (altijd absoluut, zonder query). */
export function canonicalLinks(path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return [{ rel: "canonical", href: `https://rout.be${clean.replace(/\/+$/, "") || "/"}` }];
}

/** JSON-LD-script voor een route `head()`. */
export function jsonLdScript(data: Record<string, unknown>) {
  return [{ type: "application/ld+json", children: JSON.stringify(data) }];
}

/** Gestructureerde data voor een publiek ledenprofiel. */
export function profileJsonLd(input: {
  handle: string;
  url: string;
  displayName?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}) {
  return jsonLdScript({
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: input.displayName?.trim() || `@${input.handle}`,
      alternateName: `@${input.handle}`,
      url: input.url,
      ...(input.bio ? { description: input.bio.slice(0, 300) } : {}),
      ...(input.avatarUrl?.startsWith("http") ? { image: input.avatarUrl } : {}),
    },
  });
}

/** Gestructureerde data voor een donatiepagina. */
export function donateJsonLd(input: { handle: string; url: string }) {
  return jsonLdScript({
    "@context": "https://schema.org",
    "@type": "DonateAction",
    name: `Steun @${input.handle}`,
    url: input.url,
    recipient: { "@type": "Person", alternateName: `@${input.handle}`, url: input.url },
  });
}
