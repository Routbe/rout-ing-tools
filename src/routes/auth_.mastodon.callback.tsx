import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/routes/auth_.mastodon.callback";

export const Route = createFileRoute("/auth_/mastodon/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Fediverse-aanmelding — ROUT" },
      {
        name: "description",
        content: "Je Mastodon-account wordt gecontroleerd en je sessie wordt gestart.",
      },
      { property: "og:title", content: "Fediverse-aanmelding — ROUT" },
      {
        property: "og:description",
        content: "Je Mastodon-account wordt gecontroleerd en je sessie wordt gestart.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});
