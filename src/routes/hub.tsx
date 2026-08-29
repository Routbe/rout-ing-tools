import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/hub";

export const Route = createFileRoute("/hub")({
  validateSearch: (search: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(search).filter(([, v]) => typeof v === "string"),
    ) as Record<string, string | undefined>,
  head: () => ({
    meta: [
      { title: "Link hub | ROUT" },
      { name: "description", content: "Alle sociale links van dit profiel op één kleine, snelle pagina." },
      { property: "og:title", content: "Link hub | ROUT" },
      { property: "og:description", content: "Alle sociale links van dit profiel op één kleine, snelle pagina." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
