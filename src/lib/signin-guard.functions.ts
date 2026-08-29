import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "@/lib/neon";

/**
 * Server-side brute-force throttle backed by `public.signin_throttle` on
 * Neon. Ports the logic that used to live in the `signin_guard_status` /
 * `signin_guard_record` Postgres functions.
 */

type Row = Record<string, unknown>;
type GuardResult = { locked: boolean; retryAfter: number };

export const signinGuardStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ identityHash: z.string().min(16).max(128) }).parse(data))
  .handler(async ({ data }): Promise<GuardResult> => {
    const rows = (await sql`
      select locked_until from public.signin_throttle where identity_hash = ${data.identityHash}
    `) as Row[];
    const lockedUntil = rows[0]?.["locked_until"] as string | null | undefined;
    if (!lockedUntil || new Date(lockedUntil).getTime() <= Date.now()) {
      return { locked: false, retryAfter: 0 };
    }
    const retryAfter = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
    return { locked: true, retryAfter };
  });

export const signinGuardRecord = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ identityHash: z.string().min(16).max(128), success: z.boolean() }).parse(data),
  )
  .handler(async ({ data }): Promise<GuardResult> => {
    if (data.success) {
      await sql`delete from public.signin_throttle where identity_hash = ${data.identityHash}`;
      return { locked: false, retryAfter: 0 };
    }

    const rows = (await sql`
      select failures, window_started_at, locked_until
        from public.signin_throttle where identity_hash = ${data.identityHash}
      for update
    `) as Row[];
    const row = rows[0];
    const windowStartedAt = row?.["window_started_at"] as string | undefined;
    const isStale = !row || (windowStartedAt && Date.now() - new Date(windowStartedAt).getTime() > 15 * 60_000);

    if (isStale) {
      await sql`
        insert into public.signin_throttle (identity_hash, failures, window_started_at, locked_until)
        values (${data.identityHash}, 1, now(), null)
        on conflict (identity_hash) do update
          set failures = 1, window_started_at = now(), locked_until = null
      `;
      return { locked: false, retryAfter: 0 };
    }

    const newFailures = (Number(row!["failures"]) || 0) + 1;
    const lockForSeconds = newFailures >= 10 ? 900 : newFailures >= 7 ? 300 : newFailures >= 5 ? 60 : null;

    await sql`
      update public.signin_throttle
         set failures = ${newFailures},
             locked_until = ${lockForSeconds ? sql`now() + make_interval(secs => ${lockForSeconds})` : null}
       where identity_hash = ${data.identityHash}
    `;
    await sql`
      delete from public.signin_throttle
       where window_started_at < now() - interval '1 day'
         and (locked_until is null or locked_until < now())
    `;

    if (!lockForSeconds) return { locked: false, retryAfter: 0 };
    return { locked: true, retryAfter: lockForSeconds };
  });
