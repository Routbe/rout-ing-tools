import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/About";
import { OG_IMAGE, canonicalLinks, jsonLdScript } from "@/lib/social-meta";

const TITLE = "ROUT — het soevereine alternatief voor je link-in-bio";
const DESCRIPTION =
  "Eén rustige pagina met je naam, links, verificatie en donaties. Schone URL's, SecureShield™ mailrelay, 0 % data-oogst en Europese infrastructuur.";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://rout.be/about" },
      { property: "og:image", content: `https://rout.be${OG_IMAGE}` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `https://rout.be${OG_IMAGE}` },
    ],
    links: canonicalLinks("/about"),
    scripts: jsonLdScript({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "ROUT",
      url: "https://rout.be",
      description: DESCRIPTION,
      logo: "https://rout.be/logo.svg",
    }),
  }),
  component: Page,
});
