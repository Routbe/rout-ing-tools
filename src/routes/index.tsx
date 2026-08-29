import { createFileRoute } from "@tanstack/react-router";
import Page from "@/pages/Index";
import { HostProfile } from "@/pages/HostProfile";
import { getRequestLocale } from "@/lib/locale.functions";
import { resolveHostProfile } from "@/lib/domain-routing.functions";
import { OG_IMAGE, canonicalLinks, jsonLdScript, socialMeta } from "@/lib/social-meta";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [locale, host] = await Promise.all([
      getRequestLocale().catch(() => ({ locale: "en" as const })),
      resolveHostProfile().catch(() => ({ handle: null as string | null })),
    ]);
    return { ...locale, hostHandle: host.handle };
  },
  head: ({ loaderData }) => ({
    meta: socialMeta(loaderData?.locale ?? "en", `https://rout.be${OG_IMAGE}`),
    links: canonicalLinks("/"),
    scripts: jsonLdScript({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "ROUT",
      url: "https://rout.be",
      inLanguage: loaderData?.locale ?? "en",
      publisher: { "@type": "Organization", name: "ROUT", url: "https://rout.be" },
    }),
  }),
  component: HomeRoute,
});

/** Op een gekoppeld eigen domein toont "/" het profiel van die eigenaar. */
function HomeRoute() {
  const { hostHandle } = Route.useLoaderData();
  if (hostHandle) return <HostProfile handle={hostHandle} />;
  return <Page />;
}
