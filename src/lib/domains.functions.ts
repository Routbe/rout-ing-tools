import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/middleware";

type DomainRow = { [key: string]: string | number | boolean | null };

/** Where a customer's domain must point for links to resolve. */
export const DOMAIN_CNAME_TARGET = "links.rout.app";
export const DOMAIN_A_TARGET = "185.158.133.1";

const domainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(4)
  .max(253)
  .regex(
    /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/,
    "Enter a bare hostname such as links.yourbrand.com",
  );

/** Register a domain and hand back the DNS records the user has to create. */
export const addCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ domain: domainSchema }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("./entitlement.server");
    await assertEntitled(context.userId); // deep-link / direct-RPC protection
    const { insertCustomDomain } = await import("./domains.server");
    return (await insertCustomDomain(context.userId, data.domain)) as unknown as DomainRow;
  });

/** Re-check DNS and flip the domain to verified when both records are live. */
export const verifyCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("./entitlement.server");
    await assertEntitled(context.userId); // deep-link / direct-RPC protection
    const { getOwnedDomain, updateDomainStatus, checkDomainDns } = await import(
      "./domains.server"
    );
    const row = await getOwnedDomain(data.id, context.userId);
    if (!row) throw new Error("Domain not found.");

    const check = await checkDomainDns(
      row.domain as string,
      row.verification_token as string,
      DOMAIN_CNAME_TARGET,
      DOMAIN_A_TARGET,
    );

    const verified = check.txtFound && check.cnameFound;
    const status = verified ? "verified" : check.txtFound ? "pointing" : "pending";

    await updateDomainStatus(row.id as string, status, verified);

    return { status, ...check };
  });

/** Exactly one domain can be the default used by new dynamic QRs. */
export const setDefaultDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("./entitlement.server");
    await assertEntitled(context.userId); // deep-link / direct-RPC protection
    const { setDefaultDomainFor } = await import("./domains.server");
    await setDefaultDomainFor(context.userId, data.id);
    return { ok: true };
  });

/**
 * Short links on a branded domain are opt-in per domain. Switching this off
 * leaves existing links intact — they simply fall back to the ROUT domain, so
 * a half-configured domain never breaks a printed QR.
 */
export const setDomainShortLinks = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) =>
    z.object({ id: z.string().uuid(), enabled: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("./entitlement.server");
    await assertEntitled(context.userId); // deep-link / direct-RPC protection
    const { setDomainShortLinksFor } = await import("./domains.server");
    await setDomainShortLinksFor(context.userId, data.id, data.enabled);
    return { ok: true };
  });

export const deleteCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertEntitled } = await import("./entitlement.server");
    await assertEntitled(context.userId); // deep-link / direct-RPC protection
    const { deleteDomainFor } = await import("./domains.server");
    await deleteDomainFor(context.userId, data.id);
    return { ok: true };
  });

export const listCustomDomains = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .handler(async ({ context }) => {
    const { assertEntitled } = await import("./entitlement.server");
    await assertEntitled(context.userId); // deep-link / direct-RPC protection
    const { listDomainsFor } = await import("./domains.server");
    return (await listDomainsFor(context.userId)) as unknown as DomainRow[];
  });
