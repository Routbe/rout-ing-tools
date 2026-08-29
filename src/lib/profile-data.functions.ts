import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

/** Server RPC layer backing the /dashboard/profile page. */
export const getProfileSettings = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { readProfileSettings } = await import("./profile-data.server");
    return readProfileSettings(context.userId);
  });

export type SaveProfileSettingsInput = {
  username: string | null;
  displayName: string | null;
  tagline: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

export const saveProfileSettings = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: SaveProfileSettingsInput) => input)
  .handler(async ({ data, context }) => {
    const { writeProfileSettings } = await import("./profile-data.server");
    try {
      await writeProfileSettings(context.userId, data);
      return { ok: true as const };
    } catch (error) {
      return { ok: false as const, message: error instanceof Error ? error.message : "save_failed" };
    }
  });
