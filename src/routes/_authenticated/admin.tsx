import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Beheer | ROUT" },
      { name: "description", content: "Beheer je ROUT-account, links en QR-codes." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Beheer | ROUT" },
      { property: "og:description", content: "Beheer je ROUT-account, links en QR-codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
