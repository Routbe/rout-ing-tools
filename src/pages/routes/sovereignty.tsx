import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";
import { LegalPage } from "@/components/LegalPage";
import { LegalChips, type LegalChip } from "@/components/LegalChips";
import { LegalActionBar } from "@/components/LegalActionBar";
import { TrustSealGrid } from "@/components/ui/trust-badges";
import { Cpu, Globe, KeyRound, Scale, ShieldCheck } from "lucide-react";



const chips: LegalChip[] = [
  { id: "client-side", label: "Local Execution" },
  { id: "eea", label: "EEA Routing" },
  { id: "identity", label: "Sovereign IdP" },
  { id: "agpl", label: "Open Source" },
  { id: "badges", label: "Badge Index" },
];

const sectionWrapper = "mb-6 scroll-mt-24 rounded-xl border border-border/50 bg-card p-5 shadow-sm";
const bodyText = "text-sm leading-relaxed text-foreground/80";
const listClass = "space-y-2 pl-4 text-sm leading-relaxed text-foreground/80 [&>li]:list-disc";
const strong = "font-medium text-foreground";
const badgeClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground";

function numbered(n: string, text: string) {
  return (
    <h2 className="font-serif text-lg font-semibold text-foreground">
      <span className="mr-2 font-mono text-xs text-muted-foreground">{n}.</span>
      {text}
    </h2>
  );
}

function SovereigntyPage() {
  return (
    <LegalPage
      title="Sovereignty Architecture"
      updated="Technical whitepaper · August 2026"
      card
      subtitle={
        <div className="my-3 flex flex-wrap items-center gap-2">
          <span className={badgeClass}>
            <Cpu className="size-3.5" aria-hidden /> Local-first execution
          </span>
          <span className={badgeClass}>
            <Globe className="size-3.5" aria-hidden /> EEA-only infrastructure
          </span>
          <span className={badgeClass}>
            <KeyRound className="size-3.5" aria-hidden /> Passkeys &amp; OIDC
          </span>
          <span className={badgeClass}>
            <Scale className="size-3.5" aria-hidden /> AGPL-3.0
          </span>
        </div>
      }
      quickJump={<LegalChips chips={chips} />}
      sections={[
        {
          id: "client-side",
          heading: (
            <h2 className="flex items-start gap-2 font-serif text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="mr-2 font-mono text-xs text-muted-foreground">01.</span>
                Local execution — the generator never phones home
              </span>
            </h2>
          ),
          wrapperClassName:
            "my-6 scroll-mt-24 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:p-5 dark:bg-emerald-500/10",
          body: (
            <>
              <p className={bodyText}>
                Static QR generation — matrix computation, styling, rasterisation and SVG
                serialisation — runs entirely inside your browser's sandbox, on your own CPU. URLs,
                vCards, Wi-Fi keys and IBAN strings are never transmitted, never logged and never
                stored server-side. There is no payload for us to disclose, subpoena or lose.
              </p>
              <p className={bodyText}>
                Consequence: a static code keeps working forever, even if this service disappears.
                Nothing about it depends on our uptime.
              </p>
            </>
          ),
        },
        {
          id: "eea",
          heading: numbered("02", "EEA infrastructure & transport-layer minimisation"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                <span className={strong}>Residency:</span> application servers, managed PostgreSQL,
                database backups and routing proxies operate strictly inside the European Economic
                Area.
              </li>
              <li>
                <span className={strong}>Dynamic resolution:</span> short links and profile hubs (
                <span className="font-mono text-xs">rout.id</span> /{" "}
                <span className="font-mono text-xs">rout.be</span>) necessarily traverse network
                nodes. Standard transport-layer metadata (IP, User-Agent) is processed in memory for
                real-time routing and immediate DDoS mitigation only.
              </li>
              <li>
                <span className={strong}>No long-term retention:</span> full IP addresses are not
                written to durable storage. Scan analytics are coarse and anonymous — timestamp,
                country, device family — and are destroyed with the link.
              </li>
              <li>
                <span className={strong}>No profiling:</span> no advertising cookies, no cross-site
                identifiers, no browser fingerprinting.
              </li>
            </ul>
          ),
        },
        {
          id: "identity",
          heading: numbered("03", "Sovereign identity — passkeys and your own IdP"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                <span className={strong}>WebAuthn passkeys:</span> biometric or hardware-key sign-in
                where the private key never leaves your device, and no shared secret exists to
                breach.
              </li>
              <li>
                <span className={strong}>Custom OIDC:</span> bring your own identity provider —
                Keycloak, Authentik or Authelia — so account authority stays with you rather than a
                platform.
              </li>
              <li>
                <span className={strong}>Payment decoupling:</span> regulated fiat rails (SEPA,
                PayPal, Venmo) are handled by PCI-DSS compliant processors and stay separated from
                your sovereign identity records.
              </li>
            </ul>
          ),
        },
        {
          id: "agpl",
          heading: numbered("04", "Open source & auditability (AGPL-3.0)"),
          wrapperClassName: sectionWrapper,
          body: (
            <p className={bodyText}>
              ROUT is licensed under the{" "}
              <span className={strong}>GNU Affero General Public License v3.0</span>. Every claim on
              this page is checkable against the source: the client-side generator, the redirect
              handler and the analytics pipeline are all public. The AGPL's network clause means any
              hosted fork must publish its modifications, so the guarantees travel with the code.
              Self-hosting is a first-class path, not an afterthought.
            </p>
          ),
        },
        {
          id: "badges",
          heading: numbered("05", "Trust & sovereignty seals"),
          wrapperClassName: "scroll-mt-24",
          body: <TrustSealGrid />,
        },
      ]}
      footer={
        <LegalActionBar
          links={[
            { to: "/privacy", label: "Privacy Policy" },
            { to: "/terms", label: "Terms of Use" },
            { to: "/self-hosting", label: "Self-hosting guide" },
          ]}
        />
      }
    />
  );
}

export default SovereigntyPage;
