import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

/**
 * Profile Hub Studio RPC layer.
 *
 * Authentication still comes from the managed auth provider (we only need the
 * user id), while every byte of profile content lives in our Neon Postgres
 * database in Frankfurt (see `src/lib/studio-profile.server.ts`).
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type StudioProfileDTO = {
  username: string | null;
  displayName: string | null;
  tagline: string | null;
  avatarUrl: string | null;
  faviconUrl: string | null;
  theme: string;
  cardStyle: string;
  blocks: Json[];
  verified: boolean;
  status: string;
  verifiedLegalName: string | null;
  displayPrefs: Record<string, Json>;
};

export const getStudioProfile = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { readStudioProfile } = await import("./studio-profile.server");
    const profile = await readStudioProfile(context.userId);
    return profile as StudioProfileDTO | null;
  });

export type SaveStudioProfileInput = {
  username: string;
  displayName?: string | null;
  tagline?: string | null;
  avatarUrl?: string | null;
  faviconUrl?: string | null;
  theme?: string | null;
  cardStyle?: string | null;
  blocks?: Json[];
  displayPrefs?: Record<string, Json> | null;
};

export const saveStudioProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: SaveStudioProfileInput) => input)
  .handler(async ({ data, context }) => {
    const { writeStudioProfile } = await import("./studio-profile.server");
    try {
      const profile = (await writeStudioProfile(context.userId, data)) as StudioProfileDTO;
      return { ok: true as const, profile, reason: null };
    } catch (error) {
      const reason = error instanceof Error ? error.message : "save_failed";
      return { ok: false as const, profile: null, reason };
    }
  });

export const checkStudioHandle = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { handle: string }) => input)
  .handler(async ({ data, context }) => {
    const { isHandleFree } = await import("./studio-profile.server");
    return isHandleFree(data.handle, context.userId);
  });

export const getStudioAnalytics = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { days?: number | null }) => input)
  .handler(async ({ data, context }) => {
    const { readStudioAnalytics } = await import("./studio-profile.server");
    return readStudioAnalytics(context.userId, data.days ?? null);
  });

/** Public read used by the /@handle profile pages — no auth required. */
export const getPublicProfileByHandle = createServerFn({ method: "GET" })
  .inputValidator((input: { handle: string }) => input)
  .handler(async ({ data }) => {
    const { readPublicProfile } = await import("./studio-profile.server");
    const row = await readPublicProfile(data.handle);
    if (!row) return null;
    return row as Record<string, Json>;
  });
