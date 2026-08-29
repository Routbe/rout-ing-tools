import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/sovereignty";

export const Route = createFileRoute("/sovereignty")({
  head: () => ({
    meta: [
      { title: "Digitale soevereiniteit | ROUT" },
      { name: "description", content: "Waarom eigenaarschap van je links en data belangrijk is — en hoe ROUT dat regelt." },
      { property: "og:title", content: "Digitale soevereiniteit | ROUT" },
      { property: "og:description", content: "Waarom eigenaarschap van je links en data belangrijk is — en hoe ROUT dat regelt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
