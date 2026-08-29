import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/terms";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Algemene voorwaarden | ROUT" },
      { name: "description", content: "De voorwaarden voor het gebruik van ROUT en zijn diensten." },
      { property: "og:title", content: "Algemene voorwaarden | ROUT" },
      { property: "og:description", content: "De voorwaarden voor het gebruik van ROUT en zijn diensten." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
