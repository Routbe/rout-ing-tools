/**
 * Browser-side environment sanity check.
 *
 * The app talks to its own Neon Postgres through server functions, so the
 * browser bundle needs no database credentials at all — `DATABASE_URL` stays
 * server-only. Only genuinely public settings are validated here.
 */
import { z } from "zod";

const schema = z.object({
  /** Optional canonical site URL, used for absolute links and share cards. */
  VITE_SITE_URL: z.string().url("VITE_SITE_URL must be a valid URL").optional(),
});

const parsed = schema.safeParse({
  VITE_SITE_URL: import.meta.env.VITE_SITE_URL,
});

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `• ${i.message}`).join("\n");
  console.error(`[env:invalid] Public configuration is not usable.\n${issues}`);
}

export const env = parsed.success ? parsed.data : null;
export const envErrors = parsed.success ? [] : parsed.error.issues.map((i) => i.message);
