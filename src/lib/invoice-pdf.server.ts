/**
 * Server-only PDF factuur — met de hand opgebouwd (geen native afhankelijkheden,
 * draait dus ook in de Worker-runtime).
 *
 * Stijl: ROUT-esthetiek. Warme crème achtergrond (#FBF9F5), houtskoolzwart,
 * ultradunne haarlijnen, het konijn-embleem als fijne vectorlijntekening, en
 * een groot, sterk vervaagd "ROUT"-watermerk gedraaid in de zijmarge.
 */

export interface InvoiceLine {
  label: string;
  amountCents: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  issuedAt: Date;
  customerEmail: string;
  customerName?: string | null;
  /** ROUT-handle van de klant, zonder @. */
  customerUsername?: string | null;
  /** Interne of Stripe-klantreferentie. */
  customerId?: string | null;
  lines: InvoiceLine[];
  vatCents?: number;
  totalCents: number;
  currency?: string;
  paymentMethod?: string;
  reference?: string;
}

const CHARCOAL = "0.086 0.094 0.106";
const MUTED = "0.45 0.47 0.5";
const HAIRLINE = "0.82 0.83 0.85";
/** #FBF9F5 — de warme crèmetoon van rout.be. */
const CREAM = "0.984 0.976 0.961";
/** Watermerk: nauwelijks zichtbaar, puur textuur. */
const WATERMARK = "0.93 0.91 0.88";

/** WinAnsi-veilige tekst voor de ingebouwde Helvetica. */
function pdfText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/\u2022/g, "-")
    .replace(/[^\x20-\x7E]/g, (ch) => (ch === "\u20AC" ? "\\200" : "?"));
}

function money(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function text(x: number, y: number, size: number, font: "R" | "B", value: string, color = CHARCOAL) {
  return `BT ${color} rg /${font} ${size} Tf ${x} ${y} Td (${pdfText(value)}) Tj ET\n`;
}

function line(x1: number, y1: number, x2: number, y2: number, width = 0.4) {
  return `${HAIRLINE} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`;
}

/** Volvlak achtergrond in de ROUT-crèmetoon. */
function background(w: number, h: number): string {
  return `${CREAM} rg 0 0 ${w} ${h} re f\n`;
}

/**
 * Officieel ROUT-embleem: konijn als fijne lijntekening (kop, twee oren, oog,
 * snuit). Bewust minimalistisch — één gewicht, geen vulling.
 */
function bunnyEmblem(x: number, y: number): string {
  const k = 0.5523;
  const r = 9;
  const cx = x + 10;
  const cy = y;
  return (
    `${CHARCOAL} RG 0.7 w\n` +
    // kop (cirkel)
    `${cx - r} ${cy} m ` +
    `${cx - r} ${cy + r * k} ${cx - r * k} ${cy + r} ${cx} ${cy + r} c ` +
    `${cx + r * k} ${cy + r} ${cx + r} ${cy + r * k} ${cx + r} ${cy} c ` +
    `${cx + r} ${cy - r * k} ${cx + r * k} ${cy - r} ${cx} ${cy - r} c ` +
    `${cx - r * k} ${cy - r} ${cx - r} ${cy - r * k} ${cx - r} ${cy} c S\n` +
    // linkeroor
    `${cx - 4} ${cy + 7} m ${cx - 9} ${cy + 20} ${cx - 4} ${cy + 26} ${cx - 1.5} ${cy + 12} c S\n` +
    // rechteroor
    `${cx + 4} ${cy + 7} m ${cx + 9} ${cy + 20} ${cx + 4} ${cy + 26} ${cx + 1.5} ${cy + 12} c S\n` +
    // snuit
    `${cx - 2} ${cy - 3.4} m ${cx} ${cy - 5} ${cx + 2} ${cy - 5} ${cx + 3.4} ${cy - 3.2} c S\n` +
    // oog
    `${CHARCOAL} rg ${cx + 2.6} ${cy + 1.2} 1.5 1.5 re f\n`
  );
}

/**
 * Groot, sterk vervaagd "ROUT"-watermerk, 90° gedraaid in de linkermarge.
 * De rotatiematrix staat in de tekstmatrix zelf (cos, sin, -sin, cos, x, y).
 */
function watermark(x: number, y: number): string {
  return `q BT ${WATERMARK} rg /B 54 Tf 0 1 -1 0 ${x} ${y} Tm 24 Tc (${pdfText("ROUT")}) Tj ET Q\n`;
}

function buildContent(data: InvoiceData): string {
  const currency = data.currency ?? "EUR";
  const W = 595.28;
  const H = 841.89;
  let out = background(W, H);
  out += watermark(62, 150);
  let y = 780;

  out += bunnyEmblem(56, y - 6);
  out += text(84, y - 4, 15, "B", "ROUT");
  out += text(84, y - 20, 8, "R", "rout.be", MUTED);

  out += text(W - 200, y - 4, 22, "R", "Factuur");
  out += text(W - 200, y - 22, 8.5, "R", `Nr. ${data.invoiceNumber}`, MUTED);
  out += text(W - 200, y - 34, 8.5, "R", data.issuedAt.toISOString().slice(0, 10), MUTED);

  y -= 62;
  out += line(56, y, W - 56, y);

  y -= 34;
  out += text(56, y, 8, "R", "GEFACTUREERD AAN", MUTED);
  let cy = y - 16;
  out += text(56, cy, 11, "R", data.customerName?.trim() || data.customerEmail);
  if (data.customerUsername?.trim()) {
    cy -= 14;
    out += text(56, cy, 9.5, "R", `@${data.customerUsername.trim().replace(/^@/, "")}`, MUTED);
  }
  if (data.customerName?.trim()) {
    cy -= 14;
    out += text(56, cy, 9.5, "R", data.customerEmail, MUTED);
  }
  if (data.customerId?.trim()) {
    cy -= 14;
    out += text(56, cy, 8.5, "R", `Klant-ID ${data.customerId.trim()}`, MUTED);
  }

  out += text(W - 200, y, 8, "R", "BETAALWIJZE", MUTED);
  out += text(W - 200, y - 16, 11, "R", data.paymentMethod ?? "card");
  if (data.reference) out += text(W - 200, y - 30, 9.5, "R", `Ref. ${data.reference}`, MUTED);

  y = Math.min(cy, y - 44) - 42;
  out += text(56, y, 8, "R", "OMSCHRIJVING", MUTED);
  out += text(W - 140, y, 8, "R", "BEDRAG", MUTED);
  y -= 10;
  out += line(56, y, W - 56, y);

  for (const item of data.lines) {
    y -= 26;
    out += text(56, y, 10.5, "R", item.label);
    out += text(W - 140, y, 10.5, "R", money(item.amountCents, currency));
    y -= 10;
    out += line(56, y, W - 56, y, 0.25);
  }

  if (typeof data.vatCents === "number") {
    y -= 24;
    out += text(W - 260, y, 9.5, "R", "BTW", MUTED);
    out += text(W - 140, y, 9.5, "R", money(data.vatCents, currency), MUTED);
  }

  y -= 34;
  out += line(W - 280, y + 16, W - 56, y + 16);
  out += text(W - 260, y, 12, "B", "Totaal betaald");
  out += text(W - 140, y, 12, "B", money(data.totalCents, currency));

  out += line(56, 96, W - 56, 96, 0.25);
  out += text(56, 78, 8, "R", "ROUT — rout.be — hallo@rout.be", MUTED);
  out += text(
    56,
    66,
    8,
    "R",
    "Dit document is automatisch aangemaakt en is geldig zonder handtekening.",
    MUTED,
  );

  return out;
}

/** Bouwt de PDF en geeft hem terug als base64 (klaar voor Brevo-bijlage). */
export function renderInvoicePdf(data: InvoiceData): string {
  const content = buildContent(data);
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /R 5 0 R /B 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const bytes = new Uint8Array(pdf.length);
  for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 0xff;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
