import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";
import {
  Globe,
  Linkedin,
  Instagram,
  Music2,
  Twitter,
  Youtube,
  Github,
  MessageCircle,
} from "lucide-react";
import { RoutLogo } from "@/components/RoutLogo";

/** Short param -> presentation. Kept in sync with SOCIAL_HUB_PARAMS. */
const LINKS = [
  { param: "w", label: "Website", Icon: Globe },
  { param: "li", label: "LinkedIn", Icon: Linkedin },
  { param: "ig", label: "Instagram", Icon: Instagram },
  { param: "tt", label: "TikTok", Icon: Music2 },
  { param: "x", label: "X", Icon: Twitter },
  { param: "yt", label: "YouTube", Icon: Youtube },
  { param: "gh", label: "GitHub", Icon: Github },
  { param: "wa", label: "WhatsApp", Icon: MessageCircle },
] as const;

type HubSearch = Record<string, string | undefined>;



const normalize = (param: string, value: string) => {
  if (param === "wa") return `https://wa.me/${value.replace(/[^\d]/g, "")}`;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
};

function HubPage() {
  const search = useSearch({ from: "/hub" });

  // `o` carries the creator's display priority as dot-separated short params.
  const priority = (search.o ?? "").split(".").filter(Boolean);
  const links = LINKS.filter((l) => search[l.param]).sort((a, b) => {
    const ia = priority.indexOf(a.param);
    const ib = priority.indexOf(b.param);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-5 py-14">
      <main className="w-full max-w-sm">
        <header className="text-center mb-8">
          <h1 className="font-display text-3xl text-foreground">{search.n || "Profile"}</h1>
          {search.t && <p className="text-sm text-muted-foreground mt-2">{search.t}</p>}
        </header>

        {links.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">This hub has no links yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {links.map(({ param, label, Icon }) => (
              <li key={param}>
                <a
                  href={normalize(param, search[param]!)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 transition-colors hover:bg-muted/60"
                >
                  <Icon className="w-4 h-4 text-foreground" aria-hidden />
                  <span className="font-medium text-sm text-foreground">{label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}

        <footer className="mt-12 flex justify-center opacity-60">
          <a href="/about?ref=watermark" aria-label="Made with ROUT">
            <RoutLogo size={20} />
          </a>
        </footer>
      </main>
    </div>
  );
}

export default HubPage;
