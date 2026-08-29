/**
 * Brevo-nieuwsbriefinschrijving voor profielwidgets.
 *
 * De widget op een publiek profiel stuurt alleen een e-mailadres en het
 * handle. De lijst-ID komt uit de blokwaarde van de maker, en het adres wordt
 * server-side gevalideerd voordat het naar Brevo gaat.
 */
import { sql } from "@/lib/neon";

type Row = Record<string, unknown>;

const BREVO_CONTACTS = "https://api.brevo.com/v3/contacts";

interface Block {
  kind?: string;
  value?: string;
  hidden?: boolean;
}

/**
 * Leest de nieuwsbrieflijst die de maker zelf heeft ingesteld. We vertrouwen
 * nooit een lijst-ID uit de browser: alleen wat in het profiel staat telt.
 */
export async function newsletterListFor(handle: string): Promise<number | null> {
  const rows = (await sql`
    select blocks from public.profiles where username = ${handle.toLowerCase()} limit 1
  `) as Row[];
  const blocks = (rows[0]?.["blocks"] ?? []) as Block[];
  if (!Array.isArray(blocks)) return null;
  const block = blocks.find((b) => b?.kind === "newsletter" && !b.hidden && b.value);
  if (!block?.value) return null;
  const id = Number.parseInt(String(block.value).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function subscribeToNewsletter(params: {
  handle: string;
  email: string;
}): Promise<{ ok: boolean; message: string }> {
  const key = process.env["BREVO_API_KEY"];
  if (!key) return { ok: false, message: "Nieuwsbrief is nog niet geconfigureerd." };

  const listId = await newsletterListFor(params.handle);
  if (!listId) return { ok: false, message: "Deze maker heeft geen nieuwsbrieflijst ingesteld." };

  const res = await fetch(BREVO_CONTACTS, {
    method: "POST",
    headers: { "api-key": key, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      email: params.email,
      listIds: [listId],
      updateEnabled: true,
      attributes: { ROUT_HANDLE: params.handle },
    }),
  });

  if (res.ok || res.status === 204) return { ok: true, message: "Je bent ingeschreven." };

  // Brevo geeft 400 met code duplicate_parameter als het contact al bestaat.
  const detail = (await res.text().catch(() => "")).slice(0, 200);
  if (detail.includes("duplicate_parameter")) {
    return { ok: true, message: "Je stond al ingeschreven." };
  }
  console.error("[newsletter] Brevo weigerde de inschrijving", res.status, detail);
  return { ok: false, message: "Inschrijven lukte niet. Probeer het later opnieuw." };
}
