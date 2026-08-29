/**
 * Server-only helpers for the contact form.
 *
 * Responsibilities:
 *  - deliver two Brevo *template* e-mails per submission (customer + admin)
 *  - push a real-time notification to Infomaniak KChat
 *
 * There is deliberately NO HTML in this file: every e-mail body lives in a
 * Brevo visual template and is filled through `params`. Each network call is
 * defensive — a failing channel never blocks the others, and the caller always
 * gets a structured result it can persist.
 */

export const CONTACT_RECIPIENT = process.env["CONTACT_ADMIN_EMAIL"] ?? "hallo@rout.be";
export const CONTACT_LOCALES = ["nl", "en", "fr", "de"] as const;
export type ContactLocale = (typeof CONTACT_LOCALES)[number];

export interface ContactPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  locale: ContactLocale;
  submittedAt?: string;
}

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

function brevoKey(): string | null {
  return process.env["BREVO_API_KEY"] ?? null;
}

function senderAddress(): { name: string; email: string } {
  return {
    name: process.env["BREVO_SENDER_NAME"] ?? "ROUT",
    email: process.env["BREVO_SENDER_EMAIL"] ?? CONTACT_RECIPIENT,
  };
}

/**
 * kChat webhook — read exclusively from the KCHAT_WEBHOOK_URL environment
 * variable. No fallbacks, no hardcoded URL anywhere in the codebase.
 */
function kchatWebhook(): string | null {
  const value = process.env["KCHAT_WEBHOOK_URL"];
  return value && value.trim().length > 0 ? value.trim() : null;
}

/**
 * Template routing follows the decimal hierarchy in `src/emails/template-ids.ts`:
 * visitor confirmations live in the 20-block (form confirmations, offset =
 * language, 29 = reserve) and the internal admin notification in the 10-block
 * (admin & system, 19 = reserve).
 */
import { brevoTemplateId } from "@/emails/template-ids";

export function isBrevoConfigured(): boolean {
  return brevoKey() !== null;
}

function escape(value: string): string {
  return value.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/** Call 1 — visitor confirmation, rendered by the language template (20-28). */
export async function sendVisitorAutoReply(payload: ContactPayload): Promise<void> {
  const { sendMail } = await import("@/emails/send.server");
  const { sent, error } = await sendMail({
    to: payload.email,
    subject: `ROUT — ${payload.subject}`,
    category: "form",
    language: payload.locale,
    replyTo: { email: CONTACT_RECIPIENT, name: "ROUT" },
    params: { NAME: payload.name, MESSAGE: payload.message, SUBJECT: payload.subject },
    html:
      `<p>${escape(payload.name)},</p>` +
      `<p>Bedankt voor je bericht. We komen er zo snel mogelijk op terug.</p>` +
      `<blockquote>${escape(payload.message)}</blockquote><p>— ROUT</p>`,
    tags: ["contact-form-autoreply"],
  });
  if (!sent) throw new Error(error ?? "Brevo refused the visitor confirmation");
}

/** Call 2 — internal admin notification (10-18); replying answers the visitor. */
export async function sendAdminNotification(payload: ContactPayload): Promise<void> {
  const { sendMail } = await import("@/emails/send.server");
  const { sent, error } = await sendMail({
    to: CONTACT_RECIPIENT,
    subject: adminSubject(payload),
    category: "system",
    language: "nl",
    replyTo: { email: payload.email, name: payload.name },
    params: {
      NAME: payload.name,
      EMAIL: payload.email,
      SUBJECT: payload.subject,
      MESSAGE: payload.message,
      DATE: payload.submittedAt ?? new Date().toISOString(),
    },
    html:
      `<p><strong>${escape(payload.name)}</strong> &lt;${escape(payload.email)}&gt; — ${escape(payload.locale.toUpperCase())}</p>` +
      `<p><strong>${escape(payload.subject)}</strong></p>` +
      `<blockquote>${escape(payload.message)}</blockquote>`,
    tags: ["contact-form"],
  });
  if (!sent) throw new Error(error ?? "Brevo refused the admin notification");
}

/** Explicit IDs, exposed for the admin diagnostics panel. */
export function contactTemplateIds(locale: ContactLocale) {
  return {
    customer: brevoTemplateId("form", locale),
    admin: brevoTemplateId("system", "nl"),
  };
}


/** Plain-text summary used by the admin log view and the kChat message. */
export function adminSubject(payload: ContactPayload): string {
  return `Contact: ${payload.subject} — ${payload.name} (${payload.locale.toUpperCase()})`;
}

export function kchatMessage(payload: ContactPayload): string {
  const replyLink = `mailto:${payload.email}?subject=${encodeURIComponent(`Re: ${payload.subject}`)}`;
  return [
    "#### :envelope: Nieuw contactbericht via rout.be",
    "",
    `**Naam:** ${payload.name} (${payload.email})`,
    `**Onderwerp:** ${payload.subject}`,
    `**Taal:** ${payload.locale.toUpperCase()}`,
    "",
    "> " + payload.message.split("\n").join("\n> "),
    "",
    `[:arrow_right: Antwoord ${payload.name}](${replyLink})`,
  ].join("\n");
}

export function isKchatConfigured(): boolean {
  return kchatWebhook() !== null;
}

export async function notifyKchat(payload: ContactPayload): Promise<void> {
  const webhook = kchatWebhook();
  if (!webhook) throw new Error("KCHAT_WEBHOOK_URL is not configured");

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: kchatMessage(payload),
        username: process.env["KCHAT_USERNAME"] ?? "rout.be",
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(`[kchat] webhook failed [${response.status}]: ${detail.slice(0, 300)}`);
      throw new Error(`KChat webhook failed [${response.status}]: ${detail.slice(0, 300)}`);
    }
  } catch (error) {
    console.error("[kchat] webhook threw:", error instanceof Error ? error.message : error);
    throw error;
  }
}

/**
 * Privacy-preserving sender fingerprint: the raw address is never stored or
 * logged, only an irreversible hash used for spam throttling.
 */
export async function senderHashFromHeaders(headers: Headers): Promise<string | null> {
  const candidates = [
    headers.get("cf-connecting-ip"),
    headers.get("x-real-ip"),
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  ];
  const address = candidates.find((value) => value && value.length > 0);
  if (!address) return null;

  const salt = process.env["CONTACT_HASH_SALT"] ?? "rout-contact-form";
  const bytes = new TextEncoder().encode(`${salt}:${address}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
