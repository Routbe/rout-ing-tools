import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/go";

export const Route = createFileRoute("/go")({
  validateSearch: (search: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(search).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string | undefined>,
  head: () => ({
    meta: [
      { title: "Doorverwijzen… | ROUT" },
      { name: "description", content: "Slimme doorverwijzing naar de juiste app of website voor jouw toestel." },
      { property: "og:title", content: "Doorverwijzen… | ROUT" },
      { property: "og:description", content: "Slimme doorverwijzing naar de juiste app of website voor jouw toestel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
