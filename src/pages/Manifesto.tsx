import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { AppLayout } from "@/components/layout/AppLayout";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const POINTS = ["one", "two", "three", "four"] as const;

const HIGHLIGHTS = [
  "A QR code is a link, not a surveillance device.",
  "Een QR-code is een link, geen bewakingsmiddel.",
];

function HighlightBody({ text }: { text: string }) {
  const match = HIGHLIGHTS.find((h) => text.startsWith(h));
  if (!match) return <>{text}</>;
  const rest = text.slice(match.length);
  return (
    <>
      <span className="font-medium text-foreground sketch-underline">{match}</span>
      {rest}
    </>
  );
}

export default function Manifesto() {
  const { t } = useI18n();

  return (
    <AppLayout crumbs={[{ label: "Manifesto" }]}>
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-24">
        <span className="eyebrow">Our point of view</span>
        <h1 className="mb-3 mt-2 font-serif text-4xl font-medium tracking-tight sm:text-5xl">
          The ROUT manifesto
        </h1>
        <p className="mb-12 border-b-2 border-dashed border-border-ink/25 pb-8 font-sans text-lg text-muted-foreground">
          Why a QR generator needs a point of view.
        </p>

        {/* Each point sits in its own light container, matching /privacy and /terms. */}
        <div className="space-y-4 sm:space-y-5">
          {POINTS.map((p, i) => (
            <section
              key={p}
              className="relative rounded-2xl border border-border bg-card/60 p-5 shadow-sm sm:p-6"
            >
              <span
                className={cn(
                  "sticker-badge mb-3 inline-block bg-cream font-mono tracking-widest",
                  i % 2 === 0 ? "tilt-left" : "tilt-right",
                )}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="mb-2 font-serif text-2xl font-semibold text-foreground">
                {t(`manifesto.${p}.title`)}
              </h2>
              <p className="font-sans text-[17px] leading-relaxed text-muted-foreground">
                {p === "one" ? (
                  <HighlightBody text={t(`manifesto.${p}.body`)} />
                ) : (
                  t(`manifesto.${p}.body`)
                )}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-10 border-t-2 border-dashed border-border-ink/25 pt-8">
          <p className="font-mono text-sm text-muted-foreground">
            Part of the Delplanche ecosystem —{" "}
            <a
              href="https://delplanche.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 transition-colors hover:text-foreground"
            >
              delplanche.com
            </a>
          </p>
        </div>

        {/* Primary call to action back into the generator. */}
        <section
          data-testid="manifesto-cta"
          className="mt-8 rounded-2xl border border-border bg-card p-6 text-center shadow-sm sm:p-8"
        >
          <h2 className="font-serif text-xl font-semibold text-foreground sm:text-2xl">
            Ready to create sovereign, zero-tracking QR codes?
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Everything is generated in your browser. No account, no payload upload, no tracking.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
          >
            Open Generator
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      </div>
    </AppLayout>
  );
}
