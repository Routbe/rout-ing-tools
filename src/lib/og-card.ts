/**
 * Vector-opbouw van de dynamische OpenGraph-kaart (1200×630).
 *
 * Puur tekst-in/SVG-uit: geen database, geen browser. Zo kan dezelfde kaart
 * zowel als `image/svg+xml` (debug, Mastodon) als via de rasterlaag
 * (`og-render.server.ts`) als PNG voor Discord/WhatsApp geleverd worden.
 */
import { routRabbitMarkup } from "@/lib/profile-qr";

export interface OgCardInput {
  handle: string;
  name: string;
  tagline: string;
  verified: boolean;
  accent: string;
  bg: string;
  avatarUrl: string | null;
  /** Optioneel: "rout.be/u/alias" i.p.v. "rout.be/handle". */
  urlLabel?: string;
}

export function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  );
}

/** Breekt tekst af op woordgrenzen zodat de kaart nooit overloopt. */
export function wrap(text: string, perLine: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > perLine) {
      lines.push(current.trim());
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (lines.length < maxLines && current) lines.push(current);
  return lines.slice(0, maxLines);
}

export function initials(name: string) {
  return name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function ogSvg(input: OgCardInput) {
  const lines = wrap(input.tagline, 52, 2);
  const avatar = input.avatarUrl
    ? `<clipPath id="a"><circle cx="150" cy="315" r="90"/></clipPath>
       <circle cx="150" cy="315" r="94" fill="none" stroke="${escapeXml(input.accent)}" stroke-opacity="0.7" stroke-width="4"/>
       <image href="${escapeXml(input.avatarUrl)}" x="60" y="225" width="180" height="180" preserveAspectRatio="xMidYMid slice" clip-path="url(#a)"/>`
    : `<circle cx="150" cy="315" r="90" fill="#12100D" fill-opacity="0.85" stroke="${escapeXml(input.accent)}" stroke-opacity="0.7" stroke-width="4"/>
       <text x="150" y="340" text-anchor="middle" font-family="Inter" font-size="64" font-weight="600" fill="${escapeXml(input.accent)}">${escapeXml(initials(input.name))}</text>`;

  const check = input.verified
    ? `<g transform="translate(${300 + Math.min(input.name.length, 24) * 23} 232)">
         <circle r="20" fill="${escapeXml(input.accent)}"/>
         <path d="M-9 1 -2 8 9 -6" fill="none" stroke="#0f0f11" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
       </g>`
    : "";

  const urlLabel = input.urlLabel ?? `rout.be/${input.handle}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-label="${escapeXml(input.name)} op ROUT">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${escapeXml(input.bg)}"/>
      <stop offset="100%" stop-color="${escapeXml(input.accent)}" stop-opacity="0.35"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="18" y="18" width="1164" height="594" rx="28" fill="none" stroke="${escapeXml(input.accent)}" stroke-opacity="0.35" stroke-width="2"/>
  ${avatar}
  <text x="300" y="252" font-family="Inter" font-size="62" font-weight="600" fill="#F4EFE3">${escapeXml(input.name.slice(0, 26))}</text>
  ${check}
  <text x="302" y="300" font-family="Inter" font-size="30" fill="${escapeXml(input.accent)}">${escapeXml(urlLabel)}</text>
  ${lines
    .map(
      (line, i) =>
        `<text x="302" y="${356 + i * 40}" font-family="Inter" font-size="28" fill="#C9C6BE">${escapeXml(line)}</text>`,
    )
    .join("")}
  <g transform="translate(1040 470) scale(0.9)">${routRabbitMarkup(input.accent)}</g>
  <text x="60" y="566" font-family="Inter" font-size="22" letter-spacing="6" fill="#8A8A94">ROUT — SOEVEREINE IDENTITEIT</text>
</svg>`;
}
