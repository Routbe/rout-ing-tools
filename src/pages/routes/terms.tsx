import { RouteErrorFallback, RoutePendingSkeleton } from "@/components/RouteFallbacks";
import { createFileRoute } from "@tanstack/react-router";
import { canonicalLink, canonicalMeta, socialImageMeta } from "@/lib/site";
import { LegalActionBar } from "@/components/LegalActionBar";
import { LegalPage } from "@/components/LegalPage";
import { LegalChips, type LegalChip } from "@/components/LegalChips";
import { AlertTriangle } from "lucide-react";



const chips: LegalChip[] = [
  { id: "scope", label: "Scope" },
  { id: "handles", label: "Handles & Trademarks" },
  { id: "payments", label: "Payments" },
  { id: "fair-use", label: "Abuse & DSA" },
  { id: "print-warning", label: "Print Warning" },
  { id: "domains", label: "Custom Domains" },
  { id: "api", label: "API & Rates" },
  { id: "sla", label: "SLA" },
  { id: "licensing", label: "Licensing" },
  { id: "jurisdiction", label: "Jurisdiction" },
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

const mailLink = (
  <a
    href="mailto:contact@rout.be"
    className="font-mono text-xs text-primary underline-offset-4 hover:underline"
  >
    contact@rout.be
  </a>
);

function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="Last updated: August 2026"
      card
      quickJump={<LegalChips chips={chips} />}
      footer={
        <LegalActionBar
          links={[
            { to: "/privacy", label: "Privacy Policy" },
            { to: "/sovereignty", label: "Sovereignty" },
            { to: "/contact", label: "Contact" },
          ]}
        />
      }
      sections={[
        {
          id: "scope",
          heading: numbered("01", "Scope & core architecture"),
          wrapperClassName: sectionWrapper,
          body: (
            <>
              <p className={bodyText}>
                ROUT provides high-precision QR generation tools and sovereign digital
                infrastructure.
              </p>
              <ul className={listClass}>
                <li>
                  <span className={strong}>Static QR codes:</span> generated entirely client-side
                  within your browser. They operate independently of ROUT servers and function
                  permanently, with zero server-side data dependency.
                </li>
                <li>
                  <span className={strong}>Dynamic QR codes &amp; routing:</span> rely on our hosted
                  redirection infrastructure (<span className="font-mono text-xs">rout.be</span>).
                  Dynamic paths facilitate real-time tracking, analytics, and target URL updates.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "handles",
          heading: numbered("02", "User accounts, handles & namespace allocation"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                Account handles, usernames, and profile namespaces are allocated on a strict
                first-come, first-served basis.
              </li>
              <li>
                ROUT reserves the absolute right to reclaim, reassign, or terminate handles
                associated with trademark infringement, impersonation, automated squatting, or
                prolonged inactivity without prior notice.
              </li>
              <li>
                <span className={strong}>Trademark protection:</span> handles corresponding to
                registered trademarks, corporate brands or protected designations may be reclaimed
                and reassigned to a verified rights-holder upon documented proof of infringement. No
                compensation, refund or transfer fee is owed to a squatter or infringing holder.
                Rights-holder claims are submitted to {mailLink} with registration evidence; the
                current holder is notified and may respond before reassignment, except where the
                handle is used for active fraud or impersonation.
              </li>
              <li>
                Account verification and advanced features may require a non-refundable
                micro-payment or service fee to cover processing costs and prevent spam.
              </li>
            </ul>
          ),
        },
        {
          id: "domains",
          heading: numbered("03", "Custom domains & external DNS"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                Users may link custom domains to the ROUT infrastructure via CNAME, TXT, or SRV
                records.
              </li>
              <li>
                Users bear sole responsibility for configuring, maintaining, and renewing external
                DNS records and SSL certificates. ROUT accepts no liability for routing failures,
                propagation delays, or downtime caused by misconfigured external DNS providers.
              </li>
            </ul>
          ),
        },
        {
          id: "api",
          heading: numbered("04", "API access & rate limits"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                Programmatic access via API keys is granted for legitimate integration and
                automation purposes.
              </li>
              <li>
                We enforce strict rate limits to preserve system integrity and prevent
                infrastructure abuse. ROUT reserves the right to throttle, suspend, or revoke API
                access immediately upon detecting excessive load, scraping, or suspicious traffic
                patterns.
              </li>
            </ul>
          ),
        },
        {
          id: "payments",
          heading: numbered("05", "Payments, fees & digital goods"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                Fees for account verification, custom domains, or premium features are processed as
                instant digital service fees.
              </li>
              <li>
                Because routing infrastructure and digital verification tokens are provisioned
                instantaneously upon payment completion, all micro-payments and fees are strictly{" "}
                <span className={strong}>non-refundable</span>.
              </li>
              <li>
                <span className={strong}>EU right of withdrawal:</span> consumers in the EU normally
                enjoy a 14-day right of withdrawal for distance contracts. At checkout you expressly
                request immediate performance of the digital service and acknowledge that you{" "}
                <span className={strong}>lose that right of withdrawal</span> once the service is
                fully performed (Art. VI.53, 13° Belgian Code of Economic Law, implementing
                Directive 2011/83/EU). Where performance has not yet started, a withdrawal request
                sent to {mailLink} within 14 days is honoured in full.
              </li>
            </ul>
          ),
        },
        {
          id: "fair-use",
          heading: numbered("06", "Fair use & instant kill-switch"),
          wrapperClassName: sectionWrapper,
          body: (
            <>
              <p className={bodyText}>It is strictly prohibited to use ROUT infrastructure for:</p>
              <ul className={listClass}>
                <li>
                  Phishing, malware distribution, deceptive redirects, or fraudulent campaigns.
                </li>
                <li>Spam, harassment, or any activity violating applicable laws.</li>
                <li>
                  Automated load testing or scraping that degrades performance for other users.
                </li>
              </ul>
              <p className={bodyText}>
                <span className={strong}>Enforcement (DSA-aligned):</span> content posing an
                immediate hazard — phishing, malware distribution, or deceptive redirects — triggers
                instant mitigation: the dynamic link is disabled and the account may be suspended
                without prior notice. Other suspected violations are reviewed before action is
                taken.
              </p>
              <ul className={listClass}>
                <li>
                  <span className={strong}>Notice &amp; action:</span> anyone may report illegal or
                  abusive content to{" "}
                  <a
                    href="mailto:abuse@rout.id"
                    className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                  >
                    abuse@rout.id
                  </a>
                  . Reports are triaged without undue delay and the notifier receives confirmation
                  of the outcome.
                </li>
                <li>
                  <span className={strong}>Statement of reasons:</span> affected users are informed
                  of the measure taken, the ground relied upon, and the factual basis, in line with
                  Article 17 of the Digital Services Act (Regulation (EU) 2022/2065).
                </li>
                <li>
                  <span className={strong}>Appeal path:</span> a decision can be contested within 30
                  days by replying to the statement of reasons or writing to {mailLink}. Appeals are
                  reviewed by a human, and wrongly removed links or handles are restored. Statutory
                  out-of-court dispute settlement and judicial remedies remain available.
                </li>
              </ul>
            </>
          ),
        },
        {
          id: "print-warning",
          heading: (
            <h2 className="flex items-start gap-2 font-serif text-lg font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-1 size-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="mr-2 font-mono text-xs text-muted-foreground">07.</span>
                Limitation of liability &amp; print protection
              </span>
            </h2>
          ),
          wrapperClassName:
            "my-6 scroll-mt-24 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:p-6 dark:bg-amber-500/10",
          body: (
            <ul className={listClass}>
              <li>
                To the maximum extent permitted by law, ROUT and its creator shall not be liable for
                any direct, indirect, incidental, or consequential damages — including printing
                costs, re-printing expenses, marketing losses, or business interruption — arising
                from faulty user input, system downtime, expired domains, or dynamic redirection
                errors.
              </li>
              <li>
                <span className={strong}>Mandatory pre-print scan verification:</span> to the
                maximum extent permitted by applicable Belgian law, users are solely responsible for
                physically scanning a produced proof — on at least one iOS and one Android device —
                and verifying the target destination <em>before</em> initiating any print run,
                packaging, signage, or public marketing campaign.
              </li>
              <li>
                <span className={strong}>Indemnification (vrijwaring / hold harmless):</span> you
                agree to defend, indemnify and hold harmless ROUT and its creator against any
                third-party claim, demand, penalty, printing or re-printing expense, recall cost, or
                commercial loss arising from physical production runs released without that
                pre-print scan verification, or from content you encoded or routed. Nothing in this
                clause limits liability that cannot be excluded under Belgian law, including fraud,
                wilful misconduct, and death or personal injury.
              </li>
            </ul>
          ),
        },
        {
          id: "sla",
          heading: numbered("08", 'Service availability & "as-is" SLA'),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                Hosted services, dynamic redirection, and API endpoints are provided on an{" "}
                <span className={strong}>"as-is"</span> and{" "}
                <span className={strong}>"as-available"</span> basis.
              </li>
              <li>
                No enterprise-grade uptime guarantees, financial SLAs, or continuous availability
                warranties are provided for free or standard hosted tiers. Scheduled or unscheduled
                maintenance may occur at any time.
              </li>
            </ul>
          ),
        },
        {
          id: "licensing",
          heading: numbered("09", "Open source licensing (AGPL-3.0 vs. hosted SaaS)"),
          wrapperClassName: sectionWrapper,
          body: (
            <ul className={listClass}>
              <li>
                The underlying source code of ROUT is open-source and licensed under the{" "}
                <span className={strong}>GNU Affero General Public License v3.0 (AGPL-3.0)</span>,
                allowing inspection, modification, and self-hosting under the terms of that license.
              </li>
              <li>
                These Terms of Use govern exclusively the usage of the hosted commercial/SaaS
                platform provided at{" "}
                <a
                  href="https://rout.be"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-primary underline-offset-4 hover:underline"
                >
                  rout.be
                </a>
                . Self-hosted instances operating outside our infrastructure are bound solely by the
                AGPL-3.0 license.
              </li>
            </ul>
          ),
        },
        {
          id: "creator",
          heading: numbered("10", "Legal status of the operator"),
          wrapperClassName: sectionWrapper,
          body: (
            <p className={bodyText}>
              ROUT is an independent developer infrastructure project operated by a natural person
              established in Brussels, Belgium, acting as the provider of an ad-hoc digital service
              rather than through a separate corporate entity. Paid features (verification fees,
              custom domains, premium routing) are provisioned on that basis, and the consumer
              protections of Belgian and EU law apply to them in full. Free tiers remain best-effort
              in support of open protocols and digital sovereignty.
            </p>
          ),
        },
        {
          id: "jurisdiction",
          heading: numbered("11", "Governing law & jurisdiction"),
          wrapperClassName: sectionWrapper,
          body: (
            <p className={bodyText}>
              These Terms are governed by and construed in accordance with the laws of Belgium. Any
              legal disputes arising in connection with these terms shall fall under the exclusive
              jurisdiction of the courts of Brussels, Belgium.
            </p>
          ),
        },
        {
          id: "contact",
          heading: numbered("12", "Contact"),
          wrapperClassName: "scroll-mt-24",
          body: (
            <p className={bodyText}>
              For legal notices, infrastructure abuse reports, or terms-related inquiries, contact:{" "}
              {mailLink}.
            </p>
          ),
        },
      ]}
    />
  );
}

export default TermsPage;
