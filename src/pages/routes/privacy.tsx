import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";
import { Link } from "@/lib/router-compat";
import { cn } from "@/lib/utils";
import { LegalActionBar } from "@/components/LegalActionBar";
import { LegalPage } from "@/components/LegalPage";
import { LegalChips, type LegalChip } from "@/components/LegalChips";
import { ShieldCheck } from "lucide-react";



const badgeClass =
  "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground";

/**
 * Compliance badge. Uses a single neutral/positive status dot instead of an
 * emoji or a red indicator: red reads as "problem" next to a privacy claim.
 */
function Badge({
  children,
  tone = "positive",
}: {
  children: string;
  tone?: "positive" | "neutral";
}) {
  return (
    <span className={badgeClass}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "positive" ? "bg-emerald-500" : "bg-muted-foreground/50",
        )}
      />
      {children}
    </span>
  );
}

const chips: LegalChip[] = [
  { id: "controller", label: "Controller" },
  { id: "static", label: "Static QR" },
  { id: "dynamic", label: "Analytics" },
  { id: "accounts", label: "Accounts & SSO" },
  { id: "domains", label: "Custom Domains" },
  { id: "api", label: "API Logs" },
  { id: "payments", label: "Payments" },
  { id: "hosting", label: "EU Hosting" },
  { id: "rights", label: "Your Rights" },
];

function numbered(n: string, text: string) {
  return (
    <h2 className="font-serif text-lg font-semibold text-foreground">
      <span className="mr-2 font-mono text-xs text-muted-foreground">{n}.</span>
      {text}
    </h2>
  );
}

const sectionWrapper = "mb-6 border-b border-border/40 pb-6 scroll-mt-24";
const bodyText = "text-sm leading-relaxed text-foreground/80";
const listClass = "space-y-2 pl-4 text-sm leading-relaxed text-foreground/80 [&>li]:list-disc";
const strong = "font-medium text-foreground";

const rights = [
  {
    title: "Access & portability",
    detail: "Instant mechanisms to export a machine-readable copy of your personal data.",
  },
  {
    title: "Rectification & erasure",
    detail: "Immediate self-service deletion of accounts, custom links, and associated metadata.",
  },
  {
    title: "Restriction & objection",
    detail: "Rights to restrict or object to legitimate-interest processing at any time.",
  },
  {
    title: "Supervisory recourse",
    detail:
      "Explicit right to lodge a formal complaint with the Brussels GBA/APD, Drukpersstraat 35, 1000 Brussels.",
  },
];

function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="Last updated: August 2026 · GDPR / AVG compliant"
      card
      subtitle={
        <div className="my-3 flex flex-wrap items-center gap-2">
          <Badge>EU hosted (Postgres EU)</Badge>
          <Badge>No advertising trackers</Badge>
          <Badge>GDPR / AVG compliant</Badge>
          <Badge tone="neutral">GBA / APD Brussels</Badge>
        </div>
      }
      quickJump={<LegalChips chips={chips} />}
      sections={[
        {
          id: "controller",
          heading: numbered("01", "Legal basis & controller identification"),
          wrapperClassName: sectionWrapper,
          body: (
            <>
              <p className={bodyText}>
                ROUT is operated as an independent developer infrastructure project by an individual
                creator, established in Brussels, Belgium (EU). The creator acts as the{" "}
                <span className={strong}>data controller</span> for all processing described here.
                The architecture is zero-trust by design: local execution first, data minimisation
                throughout, and absolute transparency about what leaves your device.
              </p>
              <p className={bodyText}>
                Contact channel for all privacy matters:{" "}
                <a
                  href="mailto:contact@rout.be"
                  className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                >
                  contact@rout.be
                </a>
                . Statutory response timeline: we answer data subject requests{" "}
                <span className={strong}>within one calendar month</span>, in line with Article 12
                GDPR.
              </p>
              <p className={bodyText}>
                Primary supervisory authority:{" "}
                <span className={strong}>
                  Gegevensbeschermingsautoriteit (GBA) / Autorité de protection des données (APD)
                </span>
                , Drukpersstraat 35, 1000 Brussels, Belgium.
              </p>
            </>
          ),
        },
        {
          id: "static",
          heading: (
            <h2 className="flex items-start gap-2 font-serif text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="mr-2 font-mono text-xs text-muted-foreground">02.</span>
                Static QR codes — absolute zero-data architecture
              </span>
            </h2>
          ),
          wrapperClassName:
            "my-6 scroll-mt-24 rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:p-6 dark:bg-emerald-500/10",
          body: (
            <p className={bodyText}>
              Static QR codes are compiled and generated entirely client-side, inside your browser's
              local sandbox. Payload contents — URLs, vCards, Wi-Fi keys, IBAN strings — never touch
              ROUT servers, are never intercepted, and generate zero server-side logs or residual
              telemetry. Nothing is uploaded, so there is nothing for us to store, disclose, or
              lose.
            </p>
          ),
        },
        {
          id: "dynamic",
          heading: numbered("03", "Dynamic routing, short links & anonymous analytics"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                <span className={strong}>Contractual necessity (Art. 6(1)(b) GDPR):</span> we
                process destination URLs solely to execute the redirects you requested.
              </li>
              <li>
                <span className={strong}>Legitimate interest (Art. 6(1)(f) GDPR):</span> collection
                of coarse, strictly anonymised scan metadata — timestamp, country-level geolocation,
                and device category family.
              </li>
              <li>
                <span className={strong}>Strict privacy guarantees:</span> full visitor IP addresses
                are never logged or stored. Visitor browser fingerprinting is explicitly disabled.
                Advertising profiling and cross-site tracking are fundamentally omitted.
              </li>
              <li>
                <span className={strong}>Transport-layer transparency:</span> while browser-based QR
                generation is 100% local and zero-knowledge, dynamic link and profile hub resolution
                (<span className="font-mono text-xs">rout.id</span> /{" "}
                <span className="font-mono text-xs">rout.be</span>) necessarily passes through
                network nodes. Standard transport metadata (IP address, User-Agent) is processed
                in-memory strictly for real-time routing and immediate DDoS mitigation, with{" "}
                <span className={strong}>zero long-term retention</span> and no advertising
                fingerprinting.
              </li>
              <li>
                <span className={strong}>Data lifecycle:</span> scan analytics are tied directly to
                the lifecycle of the dynamic link — purging or deleting a link instantly erases its
                aggregated statistics.
              </li>
            </ul>
          ),
        },
        {
          id: "accounts",
          heading: numbered("04", "Authentication, user accounts & OAuth federation"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                <span className={strong}>Account data:</span> email addresses, secure password
                hashes (where applicable), and user profile configurations.
              </li>
              <li>
                <span className={strong}>External SSO handlers:</span> when authenticating via
                external identity providers (such as GitHub, Google, Apple, GitLab, or a custom OIDC
                provider), ROUT securely ingests only the necessary baseline identifiers — email and
                display name — for active session maintenance.
              </li>
              <li>
                <span className={strong}>Identity / payment decoupling:</span> sovereign profile
                management (WebAuthn passkeys, custom OIDC via Keycloak or Authentik) is kept
                strictly separate from regulated fiat payment gateways (SEPA, PayPal, Venmo).
                Financial verification data is processed independently by PCI-DSS compliant
                providers and is never joined to your decentralised identity records.
              </li>
              <li>
                <span className={strong}>Session integrity:</span> essential authentication state is
                maintained via isolated secure cookies and local storage tokens. Zero commercial
                tracking pixels or third-party analytics scripts exist on authenticated endpoints.
              </li>
            </ul>
          ),
        },
        {
          id: "domains",
          heading: numbered("05", "Custom domains & infrastructure routing"),
          wrapperClassName: sectionWrapper,
          body: (
            <p className={bodyText}>
              When end-users route traffic through custom domains linked to ROUT, core proxy and
              routing metadata are handled strictly for high-precision redirection and SSL
              termination. Visitor IP tracking on custom domain zones is disabled to preserve user
              sovereignty.
            </p>
          ),
        },
        {
          id: "api",
          heading: numbered("06", "Programmatic access, API keys & rate limiting"),
          wrapperClassName: sectionWrapper,
          body: (
            <p className={bodyText}>
              API interactions generate minimal technical access logs — timestamp, endpoint URI,
              response status, and rate-limiting counters — retained exclusively for infrastructure
              security, defence against DDoS attacks, and API stability enforcement.
            </p>
          ),
        },
        {
          id: "payments",
          heading: numbered("07", "Micro-payments, verification fees & financial data"),
          wrapperClassName: sectionWrapper,
          body: (
            <>
              <p className={bodyText}>
                Financial transactions for account verification or premium routing tiers are
                processed securely through certified, PCI-DSS compliant third-party payment
                gateways. ROUT does not store raw credit card credentials, IBAN mandates or other
                sensitive financial instruments on its own infrastructure.
              </p>
              <p className={bodyText}>
                <span className={strong}>Strict separation:</span> the billing record required by
                accounting law lives in a distinct processing context from your handle, passkeys and
                published profile data. Regulated payment identity is never merged into, exported
                with, or used to enrich sovereign identity records.
              </p>
            </>
          ),
        },
        {
          id: "hosting",
          heading: numbered("08", "Sovereign infrastructure & hosting (EU)"),
          wrapperClassName: sectionWrapper,
          body: (
            <>
              <p className={bodyText}>
                All user state and relational configurations are stored within{" "}
                <span className={strong}>European Economic Area (EEA)</span> data centres on managed
                PostgreSQL infrastructure, under a strict Data Processing Agreement (DPA) featuring
                encryption in transit and at rest.
              </p>
              <p className={bodyText}>
                <span className={strong}>Residency commitment:</span> primary databases, automated
                backups and routing proxies all operate inside the EEA. No production personal data
                is replicated to jurisdictions subject to extraterritorial surveillance frameworks
                such as the US CLOUD Act.
              </p>
            </>
          ),
        },
        {
          id: "rights",
          heading: numbered("09", "Enforceable data subject rights (GDPR Chapter III)"),
          wrapperClassName: "scroll-mt-24",
          body: (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rights.map((r) => (
                <div
                  key={r.title}
                  className="rounded-lg border border-border/50 bg-background p-3.5 text-xs leading-relaxed text-muted-foreground"
                >
                  <strong className="mb-1 block text-foreground">{r.title}</strong>
                  {r.detail}
                </div>
              ))}
            </div>
          ),
        },
      ]}
      footer={
        <LegalActionBar
          links={[
            { to: "/contact", label: "Contact data request" },
            { to: "/terms", label: "Terms of Use" },
            { to: "/sovereignty", label: "Sovereignty" },
          ]}
        />
      }
    />
  );
}

export default PrivacyPage;
