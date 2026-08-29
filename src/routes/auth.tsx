import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Inloggen bij ROUT" },
      { name: "description", content: "Meld je aan met een magic link of Google om je QR-codes en korte links te beheren." },
      { property: "og:title", content: "Inloggen bij ROUT" },
      { property: "og:description", content: "Meld je aan met een magic link of Google om je QR-codes en korte links te beheren." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
