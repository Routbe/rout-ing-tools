import { BadgeCheck, Building2, CreditCard, Fingerprint, ShieldCheck } from "lucide-react";
import { Link } from "@/lib/router-compat";
import { AppLayout } from "@/components/layout/AppLayout";

/** Publieke uitleg over de twee ROUT-verificaties. */

const STEPS = [
  {
    icon: CreditCard,
    title: "Je stort een klein bedrag",
    body: "Je maakt via je eigen bank een symbolisch bedrag over naar onze rekening, met een unieke referentie. Kaart, Bancontact, iDEAL of een klassieke overschrijving — allemaal goed.",
  },
  {
    icon: Building2,
    title: "Je bank bevestigt je naam",
    body: "De naam op de overschrijving komt rechtstreeks van je bank. Wij vergelijken die met de naam op je profiel. Je rekeningnummer bewaren we niet als identiteitsbewijs.",
  },
  {
    icon: BadgeCheck,
    title: "Je vinkje verschijnt",
    body: "Bij een match krijgt je profiel het blauwe vinkje en de schone URL rout.be/naam. Geen kopie van je identiteitskaart in een of andere map.",
  },
] as const;

export default function VerifyGuide() {
  return (
    <AppLayout crumbs={[{ label: "Verificatie" }]}>
      <div className="mx-auto max-w-3xl px-6 py-12 sm:py-20">
        <span className="eyebrow">Vertrouwen zonder dataverzameling</span>
        <h1 className="mb-3 mt-2 font-serif text-4xl font-medium tracking-tight sm:text-5xl">
          Hoe verificatie bij ROUT werkt
        </h1>
        <p className="mb-12 border-b-2 border-dashed border-border-ink/25 pb-8 font-sans text-lg text-muted-foreground">
          Twee badges, twee beloftes. De ene zegt wie je bent, de andere zegt dát je een mens bent.
          Geen van beide levert ons een profiel op dat we kunnen verkopen.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
              <BadgeCheck className="h-4 w-4 text-primary" aria-hidden />
            </span>
            <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              Het blauwe vinkje
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Bewijst je wettelijke identiteit via je bank of eID. Bedoeld voor makers, bedrijven en
              publieke figuren die niet nagebootst willen worden. Levert een schone URL op
              (rout.be/naam), donaties en een relayadres op @rout.be.
            </p>
          </section>

          <section className="rounded-2xl border border-border bg-card/60 p-6 shadow-sm">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-background">
              <ShieldCheck className="h-4 w-4 text-foreground" aria-hidden />
            </span>
            <h2 className="mt-4 font-serif text-2xl font-semibold text-foreground">
              Het privacyschild
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Bevestigt enkel dat er een mens achter het profiel zit. Geen naam, geen documenten,
              geen gedragsmeting. Ideaal als je pseudoniem wil blijven maar toch wil laten zien dat
              je geen bot bent.
            </p>
          </section>
        </div>

        <h2 className="mb-4 mt-12 font-serif text-2xl font-semibold text-foreground">
          Stap voor stap
        </h2>
        <ol className="space-y-4">
          {STEPS.map(({ icon: Icon, ...step }, index) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-2xl border border-border bg-card/60 p-5 shadow-sm"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-background font-mono text-xs">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {step.title}
                </h3>
                <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <section className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-serif text-xl font-semibold text-foreground">
            <Fingerprint className="h-4 w-4 text-muted-foreground" aria-hidden />
            Wat we bewaren
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            De uitkomst van de controle (geslaagd of niet), de geverifieerde naam en de datum. Geen
            scans van documenten, geen biometrie, geen doorverkoop, geen advertentieprofiel. Je kan
            je verificatie op elk moment laten intrekken en je gegevens laten wissen.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Start verificatie
            </Link>
            <Link
              to="/privacy"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Lees het privacybeleid
            </Link>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
