import { sql } from "@/lib/neon";

/**
 * Bootstrap van de beheerdersrol.
 *
 * De "setupmodus"-banner verschijnt zolang er geen enkele rij met rol `admin`
 * in `public.user_roles` staat. Deze helpers zorgen dat dat vanzelf goedkomt:
 *
 *  1. de eigenaarsadressen (standaard `hallo@rout.be`, te overschrijven met
 *     `OWNER_EMAILS`) krijgen altijd de rol `admin`;
 *  2. is er nog geen enkele beheerder, dan krijgt het oudste account de rol.
 *
 * Alles is idempotent — herhaald aanroepen is veilig.
 */

function ownerEmails(): string[] {
  const raw = process.env["OWNER_EMAILS"] ?? process.env["ADMIN_EMAIL"] ?? "hallo@rout.be";
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.includes("@"));
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ownerEmails().includes(email.trim().toLowerCase());
}

async function grantAdmin(userId: string): Promise<void> {
  await sql`
    insert into public.user_roles (user_id, role)
    values (${userId}, 'admin')
    on conflict (user_id, role) do nothing
  `;
}

async function hasAnyAdmin(): Promise<boolean> {
  const rows = (await sql`
    select 1 from public.user_roles where role::text = 'admin' limit 1
  `) as unknown[];
  return rows.length > 0;
}

/**
 * Geeft dit account de beheerdersrol wanneer het een eigenaarsadres is, of
 * wanneer er nog helemaal geen beheerder bestaat en dit het oudste account is.
 * Faalt nooit hard: authenticatie mag hier niet op stuklopen.
 */
export async function ensureOwnerAdmin(
  userId: string,
  email: string | null | undefined,
): Promise<void> {
  try {
    if (isOwnerEmail(email)) {
      await grantAdmin(userId);
      return;
    }
    if (await hasAnyAdmin()) return;
    await ensureBootstrapAdmin();
  } catch (error) {
    console.warn("[owner-admin] could not ensure admin role", error);
  }
}

/**
 * Zorgt dat er minstens één beheerder bestaat: eerst een eigenaarsaccount,
 * anders het oudste account in de database. Geeft terug of er (nu) een
 * beheerder is.
 */
export async function ensureBootstrapAdmin(): Promise<boolean> {
  try {
    if (await hasAnyAdmin()) return true;

    const owners = ownerEmails();
    const ownerRows = (await sql`
      select id from public.users
       where lower(email) = any(${owners})
       order by created_at asc
       limit 1
    `) as { id: string }[];

    const target =
      ownerRows[0] ??
      ((await sql`
        select id from public.users order by created_at asc limit 1
      `) as { id: string }[])[0];

    if (!target) return false;
    await grantAdmin(String(target.id));
    return true;
  } catch (error) {
    console.warn("[owner-admin] bootstrap admin failed", error);
    return false;
  }
}
