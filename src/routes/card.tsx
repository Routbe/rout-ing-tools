import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/card";

export const Route = createFileRoute("/card")({
  validateSearch: (search: Record<string, unknown>) => ({
    d: typeof search.d === "string" ? search.d : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Digitaal visitekaartje | ROUT" },
      { name: "description", content: "Bekijk en bewaar dit digitale visitekaartje direct als contact op je telefoon." },
      { property: "og:title", content: "Digitaal visitekaartje | ROUT" },
      { property: "og:description", content: "Bekijk en bewaar dit digitale visitekaartje direct als contact op je telefoon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
