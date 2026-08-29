import { noindexMeta } from "@/lib/site";
import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import { SubdomainPanel } from "@/components/dashboard/SubdomainPanel";
import { BlueskyWizard } from "@/components/dashboard/BlueskyWizard";
import { requireFeature } from "@/lib/entitlement-guard";



function BlueskyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Bluesky handle</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verify your rout.be subdomain and use it as your handle on Bluesky.
        </p>
      </header>
      <SubdomainPanel />
      <BlueskyWizard />
    </div>
  );
}

export default BlueskyPage;
