import { useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  HeartHandshake,
  Mail,
  Palette,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "@/lib/router-compat";
import { AppLayout } from "@/components/layout/AppLayout";

/**
 * Publieke marketingpagina van ROUT.
 *
 * Alles is statisch en server-renderbaar: geen tracking, geen client-side
 * meting, geen cookiemuur. De enige interactie is het claimveld, dat de
 * bezoeker met zijn gekozen handle naar de aanmeldpagina brengt.
 */

const HANDLE_RE = /[^a-z0-9._-]/g;

/** Eerlijke vergelijking met de klassieke link-in-bio-diensten. */
const COMPARISON = [
  {
    feature: "Privacy",
    others: "Trackers, cookies en advertentieprofielen",
    rout: "Nul trackers, nul cookiemuur",
  },
  {
    feature: "QR-codes",
    others: "Rasterafbeelding, vaak achter een betaalmuur",
    rout: "Vector SVG/PDF-export voor echte print",
  },
  {
    feature: "Statistieken",
    others: "Bezoekersprofielen per persoon",
    rout: "Geaggregeerde tellingen zonder cookies",
  },
  {
    feature: "Eigen domein",
    others: "Enkel in dure plannen",
    rout: "CNAME naar links.jouwdomein.be",
  },
  {
    feature: "Je data",
    others: "Export beperkt of onmogelijk",
    rout: "Volledige .json-export in één klik",
  },
] as const;

const FEATURES = [
  {
    icon: Sparkles,
    eyebrow: "Soevereine profielen",
    title: "Schone URL's, elf luxe thema's, nul rommel",
    body: "Geverifieerde leden krijgen rout.be/naam, iedereen anders rout.be/u/alias. Glassmorphism-kaarten, serif-typografie en rustige animaties — geen banners, geen aanbevolen accounts, geen algoritme.",
    points: ["rout.be/naam of rout.be/u/alias", "11 luxe thema's", "0 % visuele rommel"],
  },
  {
    icon: BadgeCheck,
    eyebrow: "Verificatie",
    title: "Blauw vinkje én privacyschild",
    body: "Het blauwe vinkje bevestigt je identiteit via een bankoverschrijving of eID. Het privacyschild bevestigt enkel dat je een mens bent — zonder dat we je documenten bewaren, je gedrag volgen of iets doorverkopen.",
    points: ["Bank- of eID-verificatie", "Menselijkheidscheck zonder tracking", "Geen datahandel"],
  },
  {
    icon: Mail,
    eyebrow: "SecureShield™",
    title: "Je echte e-mailadres blijft van jou",
    body: "Krijg een relayadres op @rout.be of @u.rout.be. Alles wordt doorgestuurd naar je echte mailbox, die nergens zichtbaar is. Je betaalt per maand een fractie van een euro uit je prepaid saldo — geen abonnement.",
    points: ["naam@rout.be voor geverifieerde leden", "alias@u.rout.be voor iedereen", "€0,09 per maand"],
  },
  {
    icon: HeartHandshake,
    eyebrow: "Creator support",
    title: "Donaties zonder platformcommissie",
    body: "Geverifieerde makers zetten een donatiepagina open op rout.be/naam/donate. Betalen kan met Bancontact, iDEAL, Apple Pay, kaart of overschrijving — en wat je krijgt, blijft van jou.",
    points: ["0 % platformcommissie", "Lokale betaalmethodes", "Directe uitbetaling"],
  },
] as const;

function DeviceMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[300px]">
      <div
        aria-hidden
        className="absolute -inset-6 rounded-[2.5rem] bg-foreground/5 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-[2rem] border border-border bg-card shadow-xl">
        <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          <span className="ml-2 truncate font-mono text-[10px] text-muted-foreground">
            rout.be/koen
          </span>
        </div>
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-muted to-accent ring-2 ring-border" />
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card">
              <BadgeCheck className="h-4 w-4 text-primary" aria-hidden />
            </span>
          </div>
          <p className="mt-4 font-serif text-lg font-medium text-foreground">Koen Delplanche</p>
          <p className="font-mono text-[11px] text-muted-foreground">rout.be/koen</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Strategic Architect</p>
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {["Geverifieerd", "Privacy Shield", "Founder"].map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] tracking-wide text-muted-foreground"
              >
                {badge}
              </span>
            ))}
          </div>
          <div className="mt-5 w-full space-y-2">
            {["Portfolio", "Mastodon", "Steun mijn werk"].map((link) => (
              <div
                key={link}
                className="rounded-xl border border-border bg-background/70 px-4 py-2.5 text-left text-xs text-foreground"
              >
                {link}
              </div>
            ))}
          </div>
          <p className="mt-6 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
            Made with ROUT
          </p>
        </div>
      </div>
    </div>
  );
}

function HandleClaim() {
  const [value, setValue] = useState("");
  const handle = useMemo(() => value.toLowerCase().replace(HANDLE_RE, "").slice(0, 30), [value]);
  const target = handle ? `/auth?redirect=${encodeURIComponent(`/dashboard/profile?handle=${handle}`)}` : "/auth";

  return (
    <form
      className="mt-8 w-full max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        window.location.assign(target);
      }}
    >
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:flex-row sm:items-center">
        <label htmlFor="claim-handle" className="sr-only">
          Kies je handle
        </label>
        <div className="flex min-w-0 flex-1 items-center gap-1 px-3">
          <span className="shrink-0 font-mono text-sm text-muted-foreground">rout.be/</span>
          <input
            id="claim-handle"
            value={handle}
            onChange={(event) => setValue(event.target.value)}
            placeholder="jouwnaam"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Claim handle
          <ArrowRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <p className="mt-2 px-2 text-xs text-muted-foreground">
        Enkel kleine letters, cijfers, punt, streepje en liggend streepje. Nooit willekeurige
        cijfers achter je naam.
      </p>
    </form>
  );
}

export default function About() {
  return (
    <AppLayout crumbs={[{ label: "Over ROUT" }]}>
      <div className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
        <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <span className="eyebrow">Soevereine digitale identiteit</span>
            <h1 className="mb-4 mt-2 font-serif text-4xl font-medium leading-tight tracking-tight sm:text-5xl">
              Het soevereine alternatief voor je digitale identiteit en link-in-bio.
            </h1>
            <p className="max-w-xl font-sans text-lg text-muted-foreground">
              Eén rustige pagina met je naam, je links, je verificatie en je donaties. Europese
              infrastructuur, geen advertenties, geen trackers, geen datahandel — en jij houdt de
              sleutels.
            </p>
            <HandleClaim />
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> 0 % data-oogst
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" aria-hidden /> 11 luxe thema's
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" aria-hidden /> SecureShield™ relay
              </span>
            </div>
          </div>
          <DeviceMockup />
        </section>

        <section className="mt-20 grid gap-4 sm:mt-28 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, ...feature }) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
                <Icon className="h-4 w-4 text-foreground" aria-hidden />
              </span>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                {feature.eyebrow}
              </p>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-foreground">
                {feature.title}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {feature.body}
              </p>
              <ul className="mt-4 space-y-1.5">
                {feature.points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <span
                      aria-hidden
                      className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-foreground/50"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Onafhankelijk &amp; soeverein
          </p>
          <h2 className="mt-2 font-serif text-2xl font-semibold text-foreground">
            Waarom we ROUT gebouwd hebben
          </h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Je online identiteit hoort niet thuis bij een advertentiebedrijf. De meeste
              link-in-bio-diensten leven van meten, profileren en doorverkopen: elke klik
              wordt een datapunt, elk profiel een advertentieplaats. ROUT is het
              tegenovergestelde — geen trackers, geen cookiemuur, geen algoritme dat bepaalt
              wie jouw links te zien krijgt.
            </p>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              We draaien op eigen infrastructuur in Europa, bewaren enkel wat een profiel
              nodig heeft, en geven je alles terug wanneer je dat wil: één klik exporteert je
              volledige profiel als <code className="font-mono text-xs">.json</code>. Wil je
              weg? Je neemt je data, je QR-codes en je eigen domein gewoon mee.
            </p>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl border border-border">
            <div className="grid grid-cols-3 bg-muted/50 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="p-3">Functie</div>
              <div className="p-3">Klassieke link-tools</div>
              <div className="p-3">ROUT</div>
            </div>
            {COMPARISON.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-3 border-t border-border text-sm"
              >
                <div className="p-3 font-medium text-foreground">{row.feature}</div>
                <div className="p-3 text-muted-foreground">{row.others}</div>
                <div className="p-3 text-foreground">{row.rout}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-border bg-foreground p-8 text-center text-background shadow-sm">
          <h2 className="font-serif text-2xl font-semibold">Claim jouw soevereine handle</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm opacity-80">
            rout.be/jouwnaam — gratis, zonder tracking, met vector-QR en eigen domein wanneer
            je eraan toe bent.
          </p>
          <Link
            to="/auth"
            className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-background px-6 text-sm font-medium text-foreground transition-opacity hover:opacity-90"
          >
            Claim je handle
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>

        <section className="mt-16 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            Klaar om je naam te claimen?
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Gratis beginnen, later verifiëren. Je profiel blijft van jou — exporteerbaar,
            verwijderbaar en zonder platformcommissie op wat je verdient.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/auth"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Maak je profiel
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/verify"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Hoe verificatie werkt
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
