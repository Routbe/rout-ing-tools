import { createFileRoute } from "@tanstack/react-router";
import { parseDisplayPrefs } from "@/lib/profile-display";
import { ogSvg } from "@/lib/og-card";

/**
 * Dynamische OpenGraph-kaart (1200×630) voor profielen zonder eigen
 * uploadafbeelding. De vector wordt op de rand gerenderd — geen headless
 * browser, geen externe render-service, geen tracking.
 *
 * `/api/public/og/<handle>.png` levert een PNG (Discord, WhatsApp, Slack,
 * iMessage en LinkedIn tonen geen SVG-kaarten). `<handle>.svg` blijft
 * beschikbaar voor debug en voor crawlers die vector wél aankunnen.
 */
export const Route = createFileRoute("/api_/public/og/$handle")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const raw = String(params.handle ?? "");
        const wantsSvg = /\.svg$/i.test(raw);
        const handle = raw
          .replace(/\.(svg|png)$/i, "")
          .replace(/^@+/, "")
          .toLowerCase();
        if (!/^[a-z0-9._-]{2,40}$/.test(handle)) {
          return new Response("Invalid handle", { status: 400 });
        }

        let name = `@${handle}`;
        let tagline = "Eén soevereine link voor alles wat je maakt.";
        let verified = false;
        let accent = "#C9A84C";
        let avatarUrl: string | null = null;
        let urlLabel: string | undefined;

        try {
          const { sql } = await import("@/lib/neon");
          const rows = (await sql`
            select display_name, tagline, bio, avatar_url, verified,
                   to_jsonb(profiles) -> 'display_prefs' as display_prefs
              from public.profiles
             where username = ${handle} and coalesce(is_banned, false) = false
             limit 1
          `) as Record<string, unknown>[];
          const row = rows[0];
          if (!row) return new Response("Not found", { status: 404 });
          const prefs = parseDisplayPrefs(row["display_prefs"]);
          name = ((row["display_name"] as string | null) || `@${handle}`).trim();
          tagline =
            prefs.metaDescription ||
            ((row["tagline"] as string | null) ?? "").trim() ||
            ((row["bio"] as string | null) ?? "").trim().slice(0, 160) ||
            tagline;
          verified = Boolean(row["verified"]);
          accent = prefs.accentColor ?? accent;
          urlLabel = verified ? `rout.be/${handle}` : `rout.be/u/${handle}`;
          const avatar = row["avatar_url"] as string | null;
          avatarUrl = avatar && avatar.startsWith("http") ? avatar : null;
        } catch {
          // Database onbereikbaar: toon de generieke ROUT-kaart.
        }

        const cache = "public, max-age=1800, s-maxage=86400";

        if (!wantsSvg) {
          try {
            const { svgToPng, fetchImageAsDataUri } = await import(
              "@/lib/og-render.server"
            );
            // resvg haalt zelf geen externe afbeeldingen op: de avatar moet
            // als data-URI in de vector zitten voor we rasteriseren.
            const inlineAvatar = avatarUrl
              ? await fetchImageAsDataUri(avatarUrl)
              : null;
            const png = await svgToPng(
              ogSvg({
                handle,
                name,
                tagline,
                verified,
                accent,
                bg: "#131211",
                avatarUrl: inlineAvatar,
                ...(urlLabel ? { urlLabel } : {}),
              }),
              new URL(request.url).origin,
            );
            return new Response(png as unknown as BodyInit, {
              headers: { "content-type": "image/png", "cache-control": cache },
            });
          } catch (error) {
            console.error("og png render failed", error);
            // Val terug op de vector zodat de kaart nooit helemaal wegvalt.
          }
        }

        const svg = ogSvg({
          handle,
          name,
          tagline,
          verified,
          accent,
          bg: "#131211",
          avatarUrl,
          ...(urlLabel ? { urlLabel } : {}),
        });


        return new Response(svg, {
          headers: {
            "content-type": "image/svg+xml; charset=utf-8",
            "cache-control": cache,
          },
        });
      },
    },
  },
});
