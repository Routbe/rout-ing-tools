import { createServerFn } from "@tanstack/react-start";
import { requireAuth } from "@/lib/auth/middleware";

/**
 * Avatar uploads on our own infrastructure.
 *
 * There is no object store in the Neon stack, so an avatar is kept as a small
 * base64 blob in `public.avatar_objects` in Frankfurt and streamed back by
 * `/api/public/avatar`. Files are capped at 5 MB and always live under the
 * member's own user id.
 */
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export const uploadAvatar = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((input: { base64: string; contentType: string; ext: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; path?: string; message?: string }> => {
    if (!ALLOWED.includes(data.contentType)) {
      return { ok: false, message: "Use a JPG, PNG, WebP or GIF image." };
    }
    const bytes = Math.floor((data.base64.length * 3) / 4);
    if (bytes > MAX_BYTES) return { ok: false, message: "Keep the image under 5 MB." };

    const { sql } = await import("@/lib/neon");
    const ext = (data.ext || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = `${context.userId}/avatar-${Date.now()}.${ext}`;
    await sql.query(
      `insert into public.avatar_objects (path, user_id, content_type, data)
       values ($1, $2, $3, $4)
       on conflict (path) do update set content_type = excluded.content_type, data = excluded.data`,
      [path, context.userId, data.contentType, data.base64],
    );
    // Keep only the newest few uploads per member.
    await sql.query(
      `delete from public.avatar_objects
       where user_id = $1
         and path not in (
           select path from public.avatar_objects where user_id = $1
           order by created_at desc limit 3
         )`,
      [context.userId],
    );
    return { ok: true, path };
  });
