/**
 * Cloudflare Turnstile — onzichtbare botbescherming.
 *
 * Server-side verificatie van het token dat de widget meestuurt. Zolang
 * `TURNSTILE_SECRET_KEY` niet is ingesteld staat de bescherming uit: dan mag
 * de actie doorgaan (anders zou een ontbrekende sleutel het hele product
 * blokkeren). Zodra de sleutel bestaat is een geldig token verplicht.
 */
const ENDPOINT = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return Boolean(process.env["TURNSTILE_SECRET_KEY"]);
}

export interface TurnstileResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
}

export async function verifyTurnstile(
  token: string | null | undefined,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, skipped: false, reason: "missing_token" };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success) return { ok: true, skipped: false };
    return { ok: false, skipped: false, reason: (json["error-codes"] ?? []).join(",") || "rejected" };
  } catch {
    // Netwerkfout bij Cloudflare mag een echte gebruiker niet buitensluiten.
    return { ok: true, skipped: true, reason: "verifier_unreachable" };
  }
}

/** Gooit een leesbare fout wanneer het token niet klopt. */
export async function assertHuman(token: string | null | undefined, remoteIp?: string | null) {
  const result = await verifyTurnstile(token, remoteIp);
  if (!result.ok) throw new Error("Botcontrole mislukt. Herlaad de pagina en probeer opnieuw.");
}
