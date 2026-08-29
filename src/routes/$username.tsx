import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/username";
import { looksLikeBase36Slug } from "@/lib/base36";
import { getPublicProfileByHandle } from "@/lib/studio-profile.functions";
import { getRequestLocale } from "@/lib/locale.functions";
import {
  canonicalLinks,
  profileJsonLd,
  profileSocialMeta,
  socialMeta,
} from "@/lib/social-meta";
import { RESERVED_SLUGS } from "@/lib/reserved-slugs";
import { canonicalHandle } from "@/lib/profile-url";
import type { Locale } from "@/lib/i18n";
import { parseDisplayPrefs, bioForLocale } from "@/lib/profile-display";

type Row = Record<string, unknown> | null;


/**
 * Root namespace. A 4-teken Base36-code (`rout.be/A89K`) is a short link and
 * redirects at the edge; anything else is a member handle and falls through to
 * the app router.
 */
export const Route = createFileRoute("/$username")({
  server: {
    handlers: {
      GET: async ({ request, params, next }) => {
        if (!looksLikeBase36Slug(params.username)) return next();
        const {
          resolveShortLink,
          redirectResponse,
          rateLimitedResponse,
          pausedResponse,
        } = await import("@/lib/short-link-redirect.server");
        const { RateLimitError } = await import("@/lib/rate-limit.server");
        try {
          const result = await resolveShortLink(params.username, request);
          if (result?.status === "ok") return redirectResponse(result.targetUrl);
          if (result?.status === "paused") return pausedResponse(request);
        } catch (error) {
          if (error instanceof RateLimitError) {
            return rateLimitedResponse(error.retryAfterSeconds);
          }
        }
        return next();
      },
    },
  },
  loader: async ({ params }) => {
    const handle = canonicalHandle(params.username);
    let locale: Locale = "en";
    try {
      locale = (await getRequestLocale()).locale;
    } catch {
      /* keep the fallback */
    }
    if (looksLikeBase36Slug(params.username) || RESERVED_SLUGS.has(handle)) {
      return { handle, locale, profile: null as Row };
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
    const url = `https://rout.be/${slug}`;
    if (!profile) return { meta: socialMeta(locale), links: canonicalLinks(`/${slug}`) };
    return {
      links: canonicalLinks(`/${slug}`),
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

