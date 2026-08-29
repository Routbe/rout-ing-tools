import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/_authenticated-dashboard.bluesky";

export const Route = createFileRoute("/_authenticated/dashboard/bluesky")({
  head: () => ({
    meta: [
      { title: "Bluesky | ROUT" },
      { name: "description", content: "Beheer je ROUT-account, links en QR-codes." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Bluesky | ROUT" },
      { property: "og:description", content: "Beheer je ROUT-account, links en QR-codes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
