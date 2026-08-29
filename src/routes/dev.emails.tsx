import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/dev-email-preview";

const title = "Auth-mail preview | ROUT";
const description =
  "Preview van alle authenticatie-e-mails in ROUT-huisstijl met sample data.";

export const Route = createFileRoute("/dev/emails")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Page,
});
