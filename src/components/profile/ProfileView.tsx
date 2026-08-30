import { useEffect, useState } from "react";
import { BadgeCheck, Mail, UserPlus } from "lucide-react";
import { blockHref, isWidgetBlock, themeOf, type ProfileRecord } from "@/lib/profile";
import { BookingBlock, NewsletterBlock, isBookingUrl } from "@/components/profile/ProfileWidgets";
import { SocialPlatformIcon } from "@/lib/social-icons";
import { PLATFORM_LABEL, formatFollowers } from "@/lib/social-verify";
import { BadgeShowcase } from "@/components/profile/BadgeShowcase";
import { VerifiedInfoDialog } from "@/components/profile/VerifiedInfoDialog";
import { monthYear } from "@/components/profile/VerifiedBadgePopover";
import { ProfileBadge } from "@/components/profile/ProfileBadge";
import {
  avatarFrameStyle,
  backgroundLayers,
  bannerStyleOf,
  blockButtonStyle,
  FONT_FAMILY,
  nameAccentStyle,
  parseDisplayPrefs,
  shouldShowWatermark,
  availableBioLocales,
  bioForLocale,
  BIO_LOCALE_LABEL,
  type BioLocale,
} from "@/lib/profile-display";
import { downloadVCard } from "@/lib/vcard";

import { useI18n } from "@/lib/i18n";
import { initialsFrom } from "@/components/UserAvatar";

/** Swaps the browser tab icon for the profile's own favicon (or avatar). */
function useProfileFavicon(url?: string | null) {
  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = url;
    document.head.appendChild(link);
    return () => link.remove();
  }, [url]);
}

/** Renders a public ROUT link hub for both the /@handle and /u/@handle namespaces. */
export function ProfileView({
  profile,
  free = false,
  layout = "auto",
}: {
  profile: ProfileRecord;
  free?: boolean;
  /** "wide" toont links in twee kolommen (desktopvoorbeeld / brede schermen). */
  layout?: "auto" | "wide";
}) {
  const { t: tr, locale } = useI18n();
  const t = themeOf(profile.theme);
  const prefs = parseDisplayPrefs(profile.display_prefs);
  const blocks = profile.blocks.filter(
    (b) => !b.hidden && (b.value.trim() !== "" || b.kind === "newsletter"),
  );
  const buttonStyle = blockButtonStyle(profile.card_style, t);
  /** Eigen canvas- en patroonkleuren overschrijven het thema, indien gekozen. */
  const canvas = {
    ...t,
    bg: prefs.canvasColor ?? t.bg,
    border: prefs.patternColor ?? t.border,
    accent: prefs.patternColor ?? t.accent,
  };
  const surface = backgroundLayers(prefs.backgroundStyle, canvas);
  const banner = bannerStyleOf(prefs, t);
  const frame = avatarFrameStyle(prefs.avatarFrame, t);
  const nameStyle = nameAccentStyle(prefs.nameAccent, t);

  const showBadge = Boolean(profile.verified) && prefs.badgeVisible;
  const showWatermark = shouldShowWatermark(Boolean(profile.verified), prefs);
  const wide = layout === "wide";
  const earlyBeliever = Boolean(profile.is_early_believer);
  const [showVerifyInfo, setShowVerifyInfo] = useState(false);
  /** Taalpil: auto-detect via de sitetaal, bezoeker mag zelf wisselen. */
  const bioLocales = availableBioLocales(prefs);
  const [bioLocale, setBioLocale] = useState<BioLocale | null>(null);
  const shownBio = bioForLocale(prefs, profile.bio, bioLocale ?? locale ?? "nl");
  const aliasEmail =
    profile.show_email_publicly && earlyBeliever && profile.username
      ? `${profile.username}@rout.be`
      : null;

  const memberSince = monthYear(profile.created_at ?? null, locale || "nl");

  useProfileFavicon(profile.favicon_url ?? profile.avatar_url);

  return (
    <main
      className={`min-h-screen w-full px-4 pb-12 ${banner ? "pt-0" : "pt-12"}`}
      style={{ ...surface, color: t.text, fontFamily: FONT_FAMILY[prefs.typography] }}
    >
      {banner && (
        <div
          aria-hidden
          className="-mx-4 mb-[-2.5rem] h-32 w-[calc(100%+2rem)] sm:h-40"
          style={{ ...banner, borderBottom: `1px solid ${t.border}` }}
        />
      )}
      <div
        className={`relative mx-auto flex w-full flex-col items-center ${wide ? "max-w-3xl" : "max-w-md"}`}
      >
        <div style={frame} className="inline-flex">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={profile.display_name || `@${profile.username}`}
              className="h-20 w-20 rounded-full object-cover"
              style={{ border: `1px solid ${t.border}` }}
              loading="lazy"
            />
          ) : (
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-xl font-medium"
              style={{ background: t.card, border: `1px solid ${t.border}` }}
            >
              {initialsFrom(profile.display_name || profile.username)}
            </div>
          )}
        </div>

        <h1 className="mt-4 flex items-center gap-1.5 break-words text-center font-display text-2xl">
          <span style={nameStyle}>{profile.display_name || `@${profile.username}`}</span>
          {showBadge && (
            <ProfileBadge
              type={prefs.badgeType}
              legalName={profile.verified_legal_name ?? profile.display_name ?? null}
              nameFormat={prefs.badgeNameFormat}
              verifiedAt={profile.verified_at ?? null}
              size={earlyBeliever ? "md" : "sm"}
              cardBg={t.card}
              cardBorder={t.border}
              textColor={t.text}
              mutedColor={t.muted}
            />
          )}
        </h1>

        {earlyBeliever && (
          <button
            type="button"
            onClick={() => setShowVerifyInfo(true)}
            className="mt-2 inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest transition-opacity hover:opacity-80"
            style={{ border: `1px solid ${t.border}`, color: t.text }}
          >
            <BadgeCheck className="h-3 w-3" aria-hidden /> Early Believer
          </button>
        )}

        <VerifiedInfoDialog
          open={showVerifyInfo}
          onClose={() => setShowVerifyInfo(false)}
          username={profile.username}
          createdAt={profile.created_at ?? null}
          verified={Boolean(profile.verified)}
          earlyBeliever={earlyBeliever}
        />
        <p className="mt-1 break-all text-center text-sm" style={{ color: t.muted }}>
          {/* Free members show their clean community URL; verified members the handle. */}
          {free ? `rout.be/u/${profile.username}` : `@${profile.username}`}
        </p>
        {prefs.statusLine && (
          <p className="mt-1 text-center text-xs font-medium" style={{ color: t.text }}>
            {prefs.statusLine}
          </p>
        )}

        {memberSince && (
          <p className="mt-1 text-center text-xs" style={{ color: t.muted }}>
            {tr("profile.member_since")} {memberSince}
          </p>
        )}
        {aliasEmail && (
          <a
            href={`mailto:${aliasEmail}`}
            className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{ border: `1px solid ${t.border}`, color: t.text }}
          >
            <Mail className="h-3.5 w-3.5" aria-hidden /> Contact via {aliasEmail}
          </a>
        )}
        {(shownBio || profile.tagline) && (
          <p className="mt-3 max-w-sm text-balance text-center text-sm" style={{ color: t.muted }}>
            {shownBio || profile.tagline}
          </p>
        )}

        {bioLocales.length > 1 && (
          <div className="mt-2 flex items-center gap-1">
            {bioLocales.map((l) => {
              const active = (bioLocale ?? locale) === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => setBioLocale(l)}
                  aria-pressed={active}
                  className="rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-widest transition-opacity hover:opacity-80"
                  style={{
                    border: `1px solid ${t.border}`,
                    background: active ? t.text : "transparent",
                    color: active ? t.bg : t.muted,
                  }}
                >
                  {BIO_LOCALE_LABEL[l]}
                </button>
              );
            })}
          </div>
        )}

        {/* vCard: bezoekers bewaren het profiel meteen in hun adresboek. */}
        {prefs.showVcardButton && (
        <button
          type="button"

          onClick={() =>
            downloadVCard({
              handle: profile.username ?? "",
              displayName: profile.display_name,
              tagline: profile.tagline,
              bio: shownBio,
              avatarUrl: profile.avatar_url,
              email: aliasEmail,
              profileUrl:
                typeof window === "undefined"
                  ? `https://rout.be/${profile.username ?? ""}`
                  : window.location.href,
              links: blocks
                .filter((b) => /^https?:\/\//.test(blockHref(b)))
                .map((b) => ({ label: b.kind, url: blockHref(b) })),
            })
          }
          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
          style={{ border: `1px solid ${t.border}`, color: t.text }}
        >
          <UserPlus className="h-3.5 w-3.5" aria-hidden /> Contact opslaan
        </button>
        )}


        <BadgeShowcase userId={profile.id} theme={t} />

        {/* Geverifieerde socials met gecachte volgeraantallen (0 externe calls). */}
        {(profile.social_links ?? []).length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {(profile.social_links ?? []).map((link) => {
              const followers = formatFollowers(link.followerCount);
              return (
                <a
                  key={link.platform}
                  href={link.url}
                  target="_blank"
                  rel="me noopener noreferrer"
                  title={`${PLATFORM_LABEL[link.platform]} — geverifieerd`}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-opacity hover:opacity-80"
                  style={{ border: `1px solid ${t.border}`, color: t.muted }}
                >
                  <SocialPlatformIcon source={link.url} className="h-3.5 w-3.5 text-current" />
                  <BadgeCheck className="h-3 w-3 text-emerald-500" aria-hidden />
                  {followers && <span>{followers} volgers</span>}
                </a>
              );
            })}
          </div>
        )}

        <div className={`mt-8 grid w-full gap-3 ${wide ? "sm:grid-cols-2" : "grid-cols-1"}`}>
          {blocks.length === 0 && (
            <p className="text-center text-sm" style={{ color: t.muted }}>
              No links yet.
            </p>
          )}
          {blocks.map((b) =>
            isWidgetBlock(b.kind) || isBookingUrl(blockHref(b)) ? (
              b.kind === "newsletter" ? (
                <NewsletterBlock
                  key={b.id}
                  handle={profile.username ?? ""}
                  label={b.label}
                  style={buttonStyle}
                />
              ) : (
                <BookingBlock
                  key={b.id}
                  href={blockHref(b)}
                  label={b.label}
                  style={buttonStyle}
                />
              )
            ) : (
            <a
              key={b.id}
              href={blockHref(b)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-sm font-medium transition-opacity hover:opacity-80"
              style={buttonStyle}
            >
              <SocialPlatformIcon
                source={blockHref(b) || b.kind}
                className="h-4 w-4 text-current"
              />
              <span className="min-w-0 flex-1 truncate text-center">{b.label}</span>
              <span className="h-4 w-4 shrink-0" aria-hidden />
            </a>
            ),
          )}
        </div>

        {showWatermark && (
          <a
            href="/about?ref=watermark"
            className="mt-10 text-[11px] uppercase tracking-widest transition-opacity hover:opacity-70"
            style={{ color: t.muted }}
          >
            Made with ROUT
          </a>
        )}

      </div>
    </main>
  );
}

export function ProfileMissing({ username, free }: { username: string; free?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <h1 className="font-display text-2xl">@{username} is still available</h1>
      <p className="text-sm text-muted-foreground">
        This handle has not been claimed {free ? "in the community namespace" : "or verified"} yet.
      </p>
      <a href="/auth?mode=signup" className="mt-2 text-sm font-medium underline">
        Claim it on ROUT →
      </a>
    </div>
  );
}

/**
 * Shown when the database lookup itself failed. Never conflate this with an
 * unclaimed handle: telling a member their own profile is "available" because
 * a query timed out is worse than showing an honest error.
 */
export function ProfileLookupError({
  username,
  onRetry,
}: {
  username: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-6 text-center">
      <h1 className="font-display text-2xl">We couldn&apos;t load @{username}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The profile lookup failed, so we can&apos;t tell whether this handle is taken. This is a
        connection or server problem — not a missing profile.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-sm font-medium underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  );
}
