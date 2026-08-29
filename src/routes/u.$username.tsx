import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/u.username";
import { getPublicProfileByHandle } from "@/lib/studio-profile.functions";
import { getRequestLocale } from "@/lib/locale.functions";
import {
  canonicalLinks,
  profileJsonLd,
  profileSocialMeta,
  socialMeta,
} from "@/lib/social-meta";
import type { Locale } from "@/lib/i18n";
import { parseDisplayPrefs, bioForLocale } from "@/lib/profile-display";

type Row = Record<string, unknown> | null;

export const Route = createFileRoute("/u/$username")({
  /**
   * Server-side lookup so crawlers (Mastodon, Bluesky, WhatsApp …) receive a
   * real profile card instead of the generic site card.
   */
  loader: async ({ params }) => {
    const handle = params.username.replace(/^@/, "").toLowerCase();
    let locale: Locale = "en";
    try {
      locale = (await getRequestLocale()).locale;
    } catch {
      /* keep the fallback */
    }
    let row: Row = null;
    try {
      row = (await getPublicProfileByHandle({ data: { handle } })) as Row;
    } catch {
      row = null;
    }
    return { handle, locale, profile: row };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: socialMeta("en") };
    const { profile, handle, locale } = loaderData;
    const slug = (profile?.["username"] as string | undefined) ?? handle;
    const url = `https://rout.be/u/${slug}`;
    if (!profile) return { meta: socialMeta(locale), links: canonicalLinks(`/u/${slug}`) };
    return {
      links: canonicalLinks(`/u/${slug}`),
      scripts:
        profile["status"] === "frozen"
          ? []
          : profileJsonLd({
              handle: slug,
              url,
              displayName: profile["display_name"] as string | null,
              bio: profile["bio"] as string | null,
              avatarUrl: profile["avatar_url"] as string | null,
            }),
      meta: (() => {
        const prefs = parseDisplayPrefs(profile["display_prefs"]);
        return profileSocialMeta({
          locale,
          handle: (profile["username"] as string | undefined) ?? handle,
          displayName: profile["display_name"] as string | null,
          tagline: profile["tagline"] as string | null,
          bio: bioForLocale(prefs, profile["bio"] as string | null, locale),
          avatarUrl: profile["avatar_url"] as string | null,
          frozen: profile["status"] === "frozen",
          metaTitle: prefs.metaTitle,
          metaDescription: prefs.metaDescription,
          ogImageUrl: prefs.ogImageUrl,
          accentColor: prefs.accentColor,
          url,
        });
      })(),
    };
  },
  component: Page,
});
