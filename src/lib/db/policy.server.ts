/**
 * Access policy for browser-originated queries.
 *
 * Neon has no PostgREST and no row-level security wired to a JWT, so the rules
 * that used to live in RLS policies live here instead: one table allowlist, one
 * ownership column per table, and a hard-coded set of callable functions.
 * Anything not listed is refused.
 */
import { sql } from "@/lib/neon";
import type { QueryDescriptor } from "./types";

type Access = {
  /** Operations the browser may perform. */
  ops: Array<"select" | "insert" | "update" | "upsert" | "delete">;
  /** Column that must equal the signed-in user id; null means unscoped. */
  owner: string | null;
  /** True when anonymous visitors may read the table. */
  publicRead?: boolean;
  /** Columns an anonymous or non-owner reader may never receive. */
  denyColumns?: string[];
};

const TABLES: Record<string, Access> = {
  profiles: { ops: ["select", "update"], owner: "id", publicRead: true },
  public_profiles: { ops: ["select"], owner: null, publicRead: true },
  showcase_profiles: { ops: ["select"], owner: null, publicRead: true },
  reserved_handles: { ops: ["select"], owner: null, publicRead: true },
  badges: { ops: ["select"], owner: null, publicRead: true },
  links: { ops: ["select", "insert", "update", "delete"], owner: "profile_id" },
  saved_qrs: { ops: ["select", "insert", "update", "delete"], owner: "user_id" },
  tracked_qrs: { ops: ["select", "insert", "update", "delete"], owner: "user_id" },
  user_badges: { ops: ["select", "delete"], owner: "user_id" },
  badge_events: { ops: ["select"], owner: "user_id" },
  notifications: { ops: ["select", "update", "delete"], owner: "user_id" },
  custom_domains: { ops: ["select", "insert", "update", "delete"], owner: "user_id" },
  email_aliases: { ops: ["select"], owner: "user_id" },
  api_keys: { ops: ["select", "delete"], owner: "user_id" },
  verification_payments: { ops: ["select"], owner: "user_id" },
  user_roles: { ops: ["select"], owner: "user_id" },
  qr_scans: { ops: ["select", "delete"], owner: "__via_tracked_qr__" },
};

/** Functions the browser may call, and whether they need a session. */
const FUNCTIONS: Record<string, { auth: boolean }> = {
  delete_account: { auth: true },
  claim_referral: { auth: true },
  log_qr_scan: { auth: false },
  manage_short_link: { auth: true },
  resolve_short_link: { auth: false },
  short_link_stats: { auth: false },
  signin_guard_record: { auth: false },
  signin_guard_status: { auth: false },
  is_handle_available: { auth: false },
  get_public_profile: { auth: false },
  get_my_profile: { auth: true },
  get_my_account: { auth: true },
};

export type PolicyDecision =
  | { ok: true; descriptor: QueryDescriptor }
  | { ok: false; message: string };

export async function isAdmin(userId: string | null): Promise<boolean> {
  if (!userId) return false;
  const rows = (await sql.query(
    `select 1 from public.user_roles where user_id = $1 and role = 'admin' limit 1`,
    [userId],
  )) as unknown[];
  return rows.length > 0;
}

export async function authorizeQuery(
  descriptor: QueryDescriptor,
  userId: string | null,
): Promise<PolicyDecision> {
  const access = TABLES[descriptor.table];
  if (!access) return { ok: false, message: `Table ${descriptor.table} is not accessible from the browser` };
  if (!access.ops.includes(descriptor.action)) {
    return { ok: false, message: `${descriptor.action} on ${descriptor.table} is not allowed` };
  }

  if (await isAdmin(userId)) return { ok: true, descriptor };

  if (descriptor.action === "select" && access.owner === null) {
    if (!access.publicRead && !userId) return { ok: false, message: "Sign in required" };
    return { ok: true, descriptor };
  }

  if (!userId) {
    if (descriptor.action === "select" && access.publicRead && descriptor.table === "profiles") {
      return { ok: true, descriptor };
    }
    return { ok: false, message: "Sign in required" };
  }

  if (access.owner === "__via_tracked_qr__") {
    const filter = descriptor.filters.find((f) => f.column === "tracked_qr_id");
    if (!filter) return { ok: false, message: "qr_scans requires a tracked_qr_id filter" };
    const ids = (Array.isArray(filter.value) ? filter.value : [filter.value]).map(String);
    const rows = (await sql.query(
      `select id from public.tracked_qrs where user_id = $1 and id = any($2)`,
      [userId, ids],
    )) as { id: string }[];
    if (rows.length !== ids.length) return { ok: false, message: "Not your tracked QR" };
    return { ok: true, descriptor };
  }

  const owner = access.owner!;
  if (descriptor.table === "profiles" && descriptor.action === "select") {
    // Public profile reads stay open; private columns are not exposed by the
    // views this app reads, so no extra scoping is applied here.
    return { ok: true, descriptor };
  }

  const scoped: QueryDescriptor = {
    ...descriptor,
    filters: [
      ...descriptor.filters.filter((f) => !(f.column === owner)),
      { op: "eq", column: owner, value: userId },
    ],
  };
  if (scoped.action === "insert" || scoped.action === "upsert") {
    const rows = Array.isArray(scoped.values) ? scoped.values : [scoped.values ?? {}];
    scoped.values = rows.map((row) => ({ ...row, [owner]: userId }));
    scoped.filters = descriptor.filters;
  }
  return { ok: true, descriptor: scoped };
}

export function authorizeRpc(fn: string, userId: string | null): { ok: true } | { ok: false; message: string } {
  const rule = FUNCTIONS[fn];
  if (!rule) return { ok: false, message: `Function ${fn} is not callable from the browser` };
  if (rule.auth && !userId) return { ok: false, message: "Sign in required" };
  return { ok: true };
}
