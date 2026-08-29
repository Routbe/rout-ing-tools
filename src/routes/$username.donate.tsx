import { createFileRoute } from "@tanstack/react-router";
import Donate from "@/pages/Donate";
import { canonicalLinks, donateJsonLd } from "@/lib/social-meta";

/** Schone wortel-URL voor geverifieerde leden: rout.be/<naam>/donate */
export const Route = createFileRoute("/$username/donate")({
  validateSearch: (search: Record<string, unknown>) => ({
    donation: typeof search["donation"] === "string" ? (search["donation"] as string) : undefined,
    status: typeof search["status"] === "string" ? (search["status"] as string) : undefined,
  }),
  head: ({ params }) => {
    const handle = (params.username ?? "").replace(/^@/, "");
    const title = `Steun @${handle} — ROUT`;
    const description = `Geef @${handle} rechtstreekse steun via ROUT: kies een bedrag, laat een bericht achter en betaal veilig met Bancontact, iDEAL, Apple Pay of kaart.`;
    const path = `/${handle}/donate`;
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
