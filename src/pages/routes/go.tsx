import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";
import { useEffect, useState } from "react";
import { RoutLogo } from "@/components/RoutLogo";

type GoSearch = { i?: string; a?: string; w?: string };

const safe = (v: unknown) =>
  typeof v === "string" && /^https?:\/\//i.test(v.trim()) ? v.trim().slice(0, 600) : undefined;



/** Pick the right destination from the user agent, entirely client-side. */
function pickTarget(ua: string, s: GoSearch): string | undefined {
  if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(ua) && "ontouchend" in document)) {
    return s.i ?? s.w ?? s.a;
  }
  if (/android/i.test(ua)) return s.a ?? s.w ?? s.i;
  return s.w ?? s.i ?? s.a;
}

function GoPage() {
  const search = useSearch({ from: "/go" });
  const [target, setTarget] = useState<string | undefined>();

  useEffect(() => {
    const to = pickTarget(navigator.userAgent, search);
    setTarget(to);
    if (to) window.location.replace(to);
  }, [search]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6 text-center">
      <RoutLogo size={26} />
      <h1 className="font-display text-2xl text-foreground">Taking you to the app…</h1>
      {target ? (
        <a href={target} className="text-sm text-foreground underline underline-offset-4">
          Continue manually
        </a>
      ) : (
        <p className="text-sm text-muted-foreground">This link has no destination configured.</p>
      )}
    </div>
  );
}

export default GoPage;
