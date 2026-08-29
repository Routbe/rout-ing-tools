import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Contact";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | ROUT" },
      { name: "description", content: "Vragen, feedback of support voor ROUT? Neem hier contact met ons op." },
      { property: "og:title", content: "Contact | ROUT" },
      { property: "og:description", content: "Vragen, feedback of support voor ROUT? Neem hier contact met ons op." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
