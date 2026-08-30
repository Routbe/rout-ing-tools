import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Index";

/**
 * /qr — dezelfde generator als de homepage, maar bedoeld om vanuit Studio
 * naar toe te linken: `?type=profile_hub` selecteert meteen de profielhub.
 * Zo blijft er één bron van waarheid voor QR-styling.
 */
export const Route = createFileRoute("/qr")({
  head: () => ({
    meta: [
      { title: "QR-generator | ROUT" },
      {
        name: "description",
        content: "Ontwerp je ROUT QR-code: kleuren, patronen, logo en profielhub-link.",
      },
      { property: "og:title", content: "QR-generator | ROUT" },
      {
        property: "og:description",
        content: "Ontwerp je ROUT QR-code: kleuren, patronen, logo en profielhub-link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
