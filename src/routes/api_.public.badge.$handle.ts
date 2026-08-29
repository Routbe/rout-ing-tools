import { createFileRoute } from "@tanstack/react-router";

/**
 * "Verified on ROUT" badge — publieke SVG die makers op hun eigen site kunnen
 * embedden. Geen PII: alleen handle en verificatiestatus.
 */
function escapeXml(value: string) {
  return value.replace(/[<>&"']/g, (c) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c] ?? c,
  );
}

function badgeSvg(handle: string, verified: boolean) {
  const label = `@${handle}`;
  const width = Math.max(190, 118 + label.length * 8);
  const accent = verified ? "#3ea6ff" : "#c9b273";
  const mark = verified
    ? `<path d="M0 -6.2 1.9 -4.3 4.4 -5 4.9 -2.4 7.1 -1 5.8 1.3 6.2 3.9 3.6 4.4 1.9 6.4 -0.4 5.2 -2.8 6.1 -3.9 3.8 -6.4 3 -6 0.4 -7.6 -1.6 -5.7 -3.5 -5.7 -6.1 -3.1 -6.5 -1.6 -8.6z" fill="${accent}" opacity="0.18"/><path d="M-3.2 0.2 -1 2.4 3.4 -2.2" fill="none" stroke="${accent}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/><circle r="7.4" fill="none" stroke="${accent}" stroke-width="1.6"/>`
    : `<path d="M0 -7.6 6.6 -4.8V0.6C6.6 4.2 3.8 6.6 0 7.8 -3.8 6.6 -6.6 4.2 -6.6 0.6V-4.8Z" fill="none" stroke="${accent}" stroke-width="1.6"/><path d="M-2.9 0.2 -0.8 2.2 3 -1.9" fill="none" stroke="${accent}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="40" viewBox="0 0 ${width} 40" role="img" aria-label="${escapeXml(label)} — ${verified ? "verified" : "privacy shield"} on ROUT">
  <rect x="0.5" y="0.5" width="${width - 1}" height="39" rx="10" fill="#0f0f11" stroke="#2a2a30"/>
  <g transform="translate(24 20)">${mark}</g>
  <text x="42" y="16.5" font-family="ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif" font-size="9" letter-spacing="1.4" fill="#8a8a94">${verified ? "VERIFIED ON ROUT" : "PRIVACY SHIELD"}</text>
  <text x="42" y="29.5" font-family="ui-sans-serif,-apple-system,Segoe UI,Roboto,sans-serif" font-size="12.5" font-weight="600" fill="#f4efe3">${escapeXml(label)}</text>
</svg>`;
}

export const Route = createFileRoute("/api_/public/badge/$handle")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const handle = String(params.handle ?? "")
          .replace(/\.svg$/i, "")
          .replace(/^@+/, "")
          .toLowerCase();

        if (!/^[a-z0-9._-]{2,40}$/.test(handle)) {
          return new Response("Invalid handle", { status: 400 });
        }

        let verified = false;
        try {
          const { sql } = await import("@/lib/neon");
          const rows = (await sql`
            select verified from public.profiles where username = ${handle} limit 1
          `) as { verified?: boolean }[];
          if (rows.length === 0) return new Response("Not found", { status: 404 });
          verified = Boolean(rows[0]?.verified);
        } catch {
          // Database niet bereikbaar: toon de neutrale schild-variant.
        }

        return new Response(badgeSvg(handle, verified), {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
