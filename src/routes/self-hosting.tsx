import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/self-hosting";

export const Route = createFileRoute("/self-hosting")({
  head: () => ({
    meta: [
      { title: "Self-hosting ROUT" },
      { name: "description", content: "Draai ROUT op je eigen infrastructuur: installatie, configuratie en updates." },
      { property: "og:title", content: "Self-hosting ROUT" },
      { property: "og:description", content: "Draai ROUT op je eigen infrastructuur: installatie, configuratie en updates." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
