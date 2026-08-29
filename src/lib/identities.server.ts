import { sql } from "@/lib/neon";

/**
 * Linked sign-in identities (Google / GitHub).
 *
 * Multiple accounts per provider are supported — a member can attach both a
 * personal and a work Google account. Unlinking is refused when it would leave
 * the member without any way to sign in.
 */

export type IdentityRow = {
  id: string;
  provider: string;
  providerAccountId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
};

type Row = Record<string, unknown>;

export async function listIdentities(userId: string): Promise<IdentityRow[]> {
  const rows = (await sql`
    select id, provider, provider_account_id, email, display_name, avatar_url, created_at
      from public.user_identities
     where user_id = ${userId}
     order by provider, created_at
  `) as Row[];
  return rows.map((r) => ({
    id: r["id"] as string,
    provider: r["provider"] as string,
    providerAccountId: r["provider_account_id"] as string,
    email: (r["email"] as string | null) ?? null,
    displayName: (r["display_name"] as string | null) ?? null,
    avatarUrl: (r["avatar_url"] as string | null) ?? null,
    createdAt: String(r["created_at"]),
  }));
}

export async function hasPassword(userId: string): Promise<boolean> {
  const rows = (await sql`
    select password_hash is not null as has_password from public.users where id = ${userId} limit 1
  `) as Row[];
  return rows[0]?.["has_password"] === true;
}

/** Idempotent upsert used by the OAuth callback for sign-in and for linking. */
export async function linkIdentity(input: {
  userId: string;
  provider: string;
  providerAccountId: string;
  email?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
}) {
  await sql`
    insert into public.user_identities
      (user_id, provider, provider_account_id, email, display_name, avatar_url)
    values (${input.userId}, ${input.provider}, ${input.providerAccountId},
            ${input.email ?? null}, ${input.displayName ?? null}, ${input.avatarUrl ?? null})
    on conflict (provider, provider_account_id) do update
      set user_id = excluded.user_id,
          email = excluded.email,
          display_name = excluded.display_name,
          avatar_url = excluded.avatar_url
  `;
}

export async function unlinkIdentity(userId: string, identityId: string) {
  const identities = await listIdentities(userId);
  const target = identities.find((i) => i.id === identityId);
  if (!target) return { ok: false as const, reason: "not_found" as const };
  if (identities.length <= 1 && !(await hasPassword(userId))) {
    return { ok: false as const, reason: "last_method" as const };
  }
  await sql`delete from public.user_identities where id = ${identityId} and user_id = ${userId}`;
  return { ok: true as const };
}
