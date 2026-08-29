import { sql } from "@/lib/neon";
import { isReservedHandle, normalizeHandle } from "@/lib/profile";
import { normalizeHandleForStorage } from "@/lib/handle-rules";


/**
 * Neon-backed data layer for the Profile Hub Studio.
 *
 * All profile content (handle, display name, blocks, styling) lives in the
 * Neon Postgres database in Frankfurt. Nothing in here touches the auth
 * provider or its environment variables — the caller passes the user id.
 */

export type StudioProfile = {
  username: string | null;
  displayName: string | null;
  tagline: string | null;
  avatarUrl: string | null;
  faviconUrl: string | null;
  theme: string;
  cardStyle: string;
  blocks: unknown[];
  verified: boolean;
  status: string;
  verifiedLegalName: string | null;
  /** Weergavevoorkeuren (badge, watermerk, achtergrond, typografie). */
  displayPrefs: Record<string, unknown>;
};

type Row = Record<string, unknown>;

function toStudioProfile(row: Row): StudioProfile {
  return {
    username: (row["username"] as string | null) ?? null,
    displayName: (row["display_name"] as string | null) ?? null,
    tagline: (row["tagline"] as string | null) ?? null,
    avatarUrl: (row["avatar_url"] as string | null) ?? null,
    faviconUrl: (row["favicon_url"] as string | null) ?? null,
    theme: (row["theme"] as string | null) ?? "noir",
    cardStyle: (row["card_style"] as string | null) ?? "bordered",
    blocks: Array.isArray(row["blocks"]) ? (row["blocks"] as unknown[]) : [],
    verified: Boolean(row["verified"]),
    status: (row["status"] as string | null) ?? "active",
    verifiedLegalName: (row["verified_legal_name"] as string | null) ?? null,
    displayPrefs:
      row["display_prefs"] && typeof row["display_prefs"] === "object"
        ? (row["display_prefs"] as Record<string, unknown>)
        : {},
  };
}

export async function readStudioProfile(userId: string): Promise<StudioProfile | null> {
  const rows = (await sql`
    select username, display_name, tagline, avatar_url, favicon_url, theme, card_style,
           blocks, verified, status, verified_legal_name,
           -- Tolerant: werkt ook wanneer migratie 18 nog niet is uitgevoerd.
           to_jsonb(profiles) -> 'display_prefs' as display_prefs
      from public.profiles
     where id = ${userId}
     limit 1
  `) as Row[];
  const row = rows[0];
  return row ? toStudioProfile(row) : null;
}

export type StudioProfileInput = {
  username: string;
  displayName?: string | null;
  tagline?: string | null;
  avatarUrl?: string | null;
  faviconUrl?: string | null;
  theme?: string | null;
  cardStyle?: string | null;
  blocks?: unknown[];
  displayPrefs?: Record<string, unknown> | null;
};

export async function writeStudioProfile(userId: string, input: StudioProfileInput) {
  // Canonieke opslagvorm: lowercase, geen spaties, alleen toegestane tekens.
  const username = normalizeHandleForStorage(input.username);
  if (!username) throw new Error("handle_invalid");
  if (isReservedHandle(username)) throw new Error("handle_reserved");

  const taken = (await sql`
    select id from public.profiles where username = ${username} and id <> ${userId} limit 1
  `) as Row[];
  if (taken.length) throw new Error("handle_taken");

  const rows = (await sql`
    insert into public.profiles (
      id, username, display_name, tagline, avatar_url, favicon_url, theme, card_style, blocks, updated_at
    ) values (
      ${userId}, ${username}, ${input.displayName ?? null}, ${input.tagline ?? null},
      ${input.avatarUrl ?? null}, ${input.faviconUrl ?? null},
      ${input.theme ?? "noir"}, ${input.cardStyle ?? "bordered"},
      ${JSON.stringify(input.blocks ?? [])}, now()
    )
    on conflict (id) do update set
      username = excluded.username,
      display_name = excluded.display_name,
      tagline = excluded.tagline,
      avatar_url = excluded.avatar_url,
      favicon_url = excluded.favicon_url,
      theme = excluded.theme,
      card_style = excluded.card_style,
      blocks = excluded.blocks,
      updated_at = now()
    returning username, display_name, tagline, avatar_url, favicon_url, theme, card_style,
              blocks, verified, status, verified_legal_name
  `) as Row[];

  // Aparte, tolerante update: profielen blijven opslaan wanneer migratie 18
  // nog niet gedraaid is.
  let displayPrefs: Record<string, unknown> = {};
  if (input.displayPrefs) {
    try {
      const saved = (await sql`
        update public.profiles
           set display_prefs = ${JSON.stringify(input.displayPrefs)}::jsonb
         where id = ${userId}
        returning display_prefs
      `) as Row[];
      displayPrefs = (saved[0]?.["display_prefs"] as Record<string, unknown>) ?? {};
    } catch (error) {
      console.warn("[studio:display_prefs:skipped]", error);
    }
  }

  return { ...toStudioProfile(rows[0]!), displayPrefs };
}

export async function isHandleFree(rawHandle: string, userId: string | null) {
  const username = normalizeHandle(rawHandle);
  if (!username) return { ok: false, reason: "invalid" as const };
  if (isReservedHandle(username)) return { ok: false, reason: "reserved" as const };
  const rows = (await sql`
    select id from public.profiles where username = ${username} limit 1
  `) as Row[];
  const owner = rows[0]?.["id"] as string | undefined;
  if (!owner || (userId && owner === userId)) return { ok: true, reason: null };
  return { ok: false, reason: "taken" as const };
}

/** Public profile lookup by handle (used by the /@handle pages). */
export async function readPublicProfile(rawHandle: string) {
  const username = normalizeHandle(rawHandle);
  if (!username) return null;
  const rows = (await sql`
    select id, username, display_name, tagline, bio, avatar_url, favicon_url, theme, card_style,
           blocks, verified, verified_at, created_at, is_early_believer,
           status, is_suspended, is_banned, url_style, verified_legal_name,
           to_jsonb(profiles) -> 'display_prefs' as display_prefs
      from public.profiles
     where username = ${username} and coalesce(is_banned, false) = false
     limit 1
  `) as Row[];
  const profile = rows[0];
  if (!profile) return null;
  // Gecachte sociale volgeraantallen: één goedkope join-vrije query, geen
  // externe HTTP-calls tijdens het laden van de publieke pagina.
  const { readPublicSocialLinks } = await import("./social-verify.server");
  const socialLinks = await readPublicSocialLinks(profile["id"] as string);
  return { ...profile, social_links: socialLinks } as Row;
}

/** Aggregated, privacy-clean studio analytics: counts only, no visitor data. */
export async function readStudioAnalytics(userId: string, days: number | null) {
  const qrRows = (await sql`
    select id from public.tracked_qrs where user_id = ${userId}
  `) as Row[];
  const ids = qrRows.map((r) => r["id"] as string);
  if (!ids.length) return { qrs: 0, scans: 0, series: [] as { date: string; scans: number }[] };

  const totals = (await sql`
    select count(*)::int as scans from public.qr_scans where tracked_qr_id = any(${ids}::uuid[])
  `) as Row[];

  const series = (days
    ? await sql`
        select to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') as date, count(*)::int as scans
          from public.qr_scans
         where tracked_qr_id = any(${ids}::uuid[])
           and scanned_at >= now() - make_interval(days => ${days})
         group by 1 order by 1
      `
    : await sql`
        select to_char(date_trunc('day', scanned_at), 'YYYY-MM-DD') as date, count(*)::int as scans
          from public.qr_scans
         where tracked_qr_id = any(${ids}::uuid[])
         group by 1 order by 1
      `) as Row[];

  return {
    qrs: ids.length,
    scans: (totals[0]?.["scans"] as number | undefined) ?? 0,
    series: series.map((r) => ({ date: r["date"] as string, scans: r["scans"] as number })),
  };
}
