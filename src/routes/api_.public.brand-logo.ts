import { createFileRoute } from "@tanstack/react-router";

/**
 * CORS-enabled favicon proxy.
 *
 * The QR renderer inlines the centre logo through the DOM, so it needs an
 * image served with CORS headers — favicon CDNs send none. This route fetches
 * the icon server-side and re-serves it same-origin.
 */
const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export const Route = createFileRoute("/api_/public/brand-logo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { guardRequest } = await import("@/lib/api-guard.server");
        const limited = guardRequest(request, "brand-logo", 120, 60000);
        if (limited) return limited;

        const domain = (new URL(request.url).searchParams.get("domain") ?? "")
          .toLowerCase()
          .replace(/^www\./, "");
        if (!domain || domain.length > 253 || !DOMAIN_RE.test(domain)) {
          return new Response("Invalid domain", { status: 400 });
        }

        try {
          const upstream = await fetch(
            `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`,
            { headers: { accept: "image/*" } },
          );
          const type = upstream.headers.get("content-type") ?? "";
          if (!upstream.ok || !type.startsWith("image/")) {
            return new Response("Not found", { status: 404 });
          }
          return new Response(await upstream.arrayBuffer(), {
            status: 200,
            headers: {
              "content-type": type,
              "cache-control": "public, max-age=86400",
              "access-control-allow-origin": "*",
            },
          });
        } catch {
          return new Response("Upstream error", { status: 502 });
        }
      },
    },
  },
});
