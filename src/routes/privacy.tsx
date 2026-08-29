import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/privacy";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacybeleid | ROUT" },
      { name: "description", content: "Hoe ROUT met je gegevens, scans en analytics omgaat." },
      { property: "og:title", content: "Privacybeleid | ROUT" },
      { property: "og:description", content: "Hoe ROUT met je gegevens, scans en analytics omgaat." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
