import { sql } from "@/lib/neon";
import { generateToken, hashToken, verifyPassword } from "@/lib/auth/password.server";

/**
 * Sovereign account merge.
 *
 * Step A — the primary account mints a one-time ticket: a 6-digit pin plus an
 * opaque QR token, both valid for five minutes and stored only as digests.
 * Step B/C — the secondary account redeems the pin (or scans the token) and
 * re-confirms its own password.
 * Step D — every owned row moves to the primary account and the secondary user
 * is deleted.
 */

const TICKET_TTL_MINUTES = 5;

type Row = Record<string, unknown>;

function randomPin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return String(n % 1_000_000).padStart(6, "0");
}

export async function createMergeTicket(primaryUserId: string) {
  const pin = randomPin();
  const token = generateToken(24);
  const [pinHash, tokenHash] = await Promise.all([hashToken(pin), hashToken(token)]);
  // One live ticket per account keeps the flow unambiguous.
  await sql`
    update public.account_merge_tickets set used_at = now()
     where primary_user_id = ${primaryUserId} and used_at is null
  `;
  const rows = (await sql`
    insert into public.account_merge_tickets (primary_user_id, pin_hash, token_hash, expires_at)
    values (${primaryUserId}, ${pinHash}, ${tokenHash},
            now() + make_interval(mins => ${TICKET_TTL_MINUTES}))
    returning id, expires_at
  `) as Row[];
  const expiresAt = String(rows[0]?.["expires_at"]);

  // The mail only announces the merge attempt; the pin itself stays in the
  // dashboard, so an intercepted mailbox is not enough to merge an account.
  try {
    const { notifyUser } = await import("./notifications.server");
    await notifyUser(
      primaryUserId,
      "merge_verification",
      { ticket_id: rows[0]?.["id"], expires_at: expiresAt },
      { EXPIRES_AT: expiresAt, TTL_MINUTES: TICKET_TTL_MINUTES },
    );
  } catch (error) {
    console.error("[merge] notify failed", error);
  }

  return {
    pin,
    token,
    ticketId: rows[0]?.["id"] as string,
    expiresAt,
  };
}

async function findTicket(pin: string | null, token: string | null) {
  const hash = await hashToken((pin ?? token ?? "").trim());
  const rows = (await sql`
    select id, primary_user_id, expires_at
      from public.account_merge_tickets
     where used_at is null
       and expires_at > now()
       and (pin_hash = ${hash} or token_hash = ${hash})
     order by created_at desc
     limit 1
  `) as Row[];
  return rows[0] ?? null;
}

/** Moves every row owned by the secondary account onto the primary account. */
async function transferOwnership(primaryId: string, secondaryId: string) {
  const tables = [
    "saved_qrs",
    "tracked_qrs",
    "user_badges",
    "badge_events",
    "custom_domains",
    "api_keys",
    "email_aliases",
    "notifications",
    "verification_payments",
    "avatar_objects",
    "user_identities",
  ];
  for (const table of tables) {
    try {
      await sql.query(`update public.${table} set user_id = $1 where user_id = $2`, [
        primaryId,
        secondaryId,
      ]);
    } catch (error) {
      // Unique constraints (a badge held by both accounts, a duplicate identity)
      // mean the primary already owns the equivalent row — drop the secondary's.
      try {
        await sql.query(`delete from public.${table} where user_id = $1`, [secondaryId]);
      } catch {
        console.error(`[merge] could not transfer ${table}`, error);
      }
    }
  }

  // Verification, badges tier and paid status always win in favour of "yes".
  await sql`
    update public.profiles p
       set verified = p.verified or s.verified,
           verified_at = coalesce(p.verified_at, s.verified_at),
           verified_legal_name = coalesce(p.verified_legal_name, s.verified_legal_name),
           tier = case when s.tier = 'verified' or p.tier = 'verified' then 'verified' else p.tier end,
           is_paid = p.is_paid or s.is_paid,
           is_early_believer = p.is_early_believer or s.is_early_believer,
           updated_at = now()
      from public.profiles s
     where p.id = ${primaryId} and s.id = ${secondaryId}
  `;

  await sql`
    insert into public.user_roles (user_id, role)
    select ${primaryId}, role from public.user_roles where user_id = ${secondaryId}
    on conflict (user_id, role) do nothing
  `;
}

export async function redeemMergeTicket(input: {
  secondaryUserId: string;
  secondaryPassword: string;
  pin?: string | null;
  token?: string | null;
}) {
  const ticket = await findTicket(input.pin ?? null, input.token ?? null);
  if (!ticket) return { ok: false as const, reason: "invalid_or_expired" as const };

  const primaryId = ticket["primary_user_id"] as string;
  if (primaryId === input.secondaryUserId) {
    return { ok: false as const, reason: "same_account" as const };
  }

  // Step C — the secondary account re-confirms its own password.
  const rows = (await sql`
    select password_hash from public.users where id = ${input.secondaryUserId} limit 1
  `) as Row[];
  const ok = await verifyPassword(
    input.secondaryPassword,
    (rows[0]?.["password_hash"] as string | null) ?? null,
  );
  if (!ok) return { ok: false as const, reason: "bad_password" as const };

  await transferOwnership(primaryId, input.secondaryUserId);

  await sql`
    update public.account_merge_tickets
       set used_at = now(), secondary_user_id = ${input.secondaryUserId}
     where id = ${ticket["id"] as string}
  `;

  // The secondary profile and user disappear; sessions cascade with the user.
  await sql`delete from public.profiles where id = ${input.secondaryUserId}`;
  await sql`delete from public.users where id = ${input.secondaryUserId}`;

  return { ok: true as const, primaryUserId: primaryId };
}

export async function verifyOwnPassword(userId: string, password: string) {
  const rows = (await sql`
    select password_hash from public.users where id = ${userId} limit 1
  `) as Row[];
  return verifyPassword(password, (rows[0]?.["password_hash"] as string | null) ?? null);
}
