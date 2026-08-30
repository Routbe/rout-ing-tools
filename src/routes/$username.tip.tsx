import { createFileRoute } from "@tanstack/react-router";
import Donate from "@/pages/Donate";
import { canonicalLinks, donateJsonLd } from "@/lib/social-meta";

/** Fooi-variant op de schone wortel-URL: rout.be/<handle>/tip */
export const Route = createFileRoute("/$username/tip")({
  validateSearch: (search: Record<string, unknown>) => ({
    donation: typeof search["donation"] === "string" ? (search["donation"] as string) : undefined,
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
  }),
  head: ({ params }) => {
    const handle = (params.username ?? "").replace(/^@/, "");
    const title = `Geef een fooi aan @${handle} — ROUT`;
    const description = `Steun @${handle} met een fooi: kies een bedrag, laat een bericht achter en betaal veilig met Bancontact, iDEAL, Apple Pay of kaart.`;
    const path = `/${handle}/tip`;
    return {
      links: canonicalLinks(path),
      scripts: donateJsonLd({ handle, url: `https://rout.be${path}` }),
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "profile" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: Donate,
});
