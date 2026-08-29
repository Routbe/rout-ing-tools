import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Studio";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "QR Studio — ontwerp je QR-code | ROUT" },
      { name: "description", content: "Ontwerp QR-codes met eigen kleuren, vormen, frames en logo. Exporteer scherp in PNG, SVG of PDF." },
      { property: "og:title", content: "QR Studio — ontwerp je QR-code | ROUT" },
      { property: "og:description", content: "Ontwerp QR-codes met eigen kleuren, vormen, frames en logo. Exporteer scherp in PNG, SVG of PDF." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});
