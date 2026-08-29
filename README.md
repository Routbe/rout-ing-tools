<div align="center">

<br />

# ROUT

**Sovereign High-Resolution QR Infrastructure & Open Alias Layer**

<br />

<a href="https://rout.be/sponsor">
  <img src="https://img.shields.io/badge/—_Sponsor_Infrastructure-0B0B0C?style=for-the-badge&logo=githubsponsors&logoColor=10B981" height="38" alt="Sponsor Rout" />
</a>
&nbsp;
<a href="../../discussions">
  <img src="https://img.shields.io/badge/—_Community_Discussions-0B0B0C?style=for-the-badge&logo=github&logoColor=A855F7" height="38" alt="GitHub Discussions" />
</a>
&nbsp;
<a href="https://rout.be">
  <img src="https://img.shields.io/badge/—_Live_Platform-0B0B0C?style=for-the-badge&logo=globe&logoColor=3B82F6" height="38" alt="Live Platform" />
</a>

<br /><br />

<p align="center">
  <code>MIT License</code> &nbsp;•&nbsp; 
  <code>PostgreSQL (EU Nodes)</code> &nbsp;•&nbsp; 
  <code>WebAuthn Passkeys</code> &nbsp;•&nbsp; 
  <code>Zero Telemetry Harvesting</code>
</p>

</div>

---

## Vision & Architecture

Rout is built to enforce digital data sovereignty. Commercial QR generators often restrict vector exports behind paywalls, harvest user analytics, or inject tracking redirects. Rout operates on a zero-tracking, ad-free, open-source model designed for production environments requiring privacy and resolution purity.

* **Client-Side Vector Engine:** Direct generation of SVG, PDF, and EPS files without server processing or loss of fidelity.
* **Telemetry Purity:** Zero tracking wrappers, zero analytics injection, and zero IP or location logging.
* **EU Sovereign Infrastructure:** Hosted strictly on European server nodes with Swiss encrypted storage via Infomaniak.

---

## Infrastructure Funding (`rout.be/sponsor`)

To maintain independence from venture capital and advertising networks, Rout is sustained through direct community contributions. 100% of funds go toward EU server capacity, database redundancy, and continuous open-source maintenance.

<br />

<div align="center">

| Channel | Method | Specifications | Status |
| :--- | :--- | :--- | :--- |
| **Sovereign Portal** | Direct SEPA / Wise | 0% transaction fees • Automated reconciliation via unique reference webhook | `Active` |
| **Direct Checkout** | Bancontact / Card / Apple Pay | Instant processing via Stripe infrastructure | `Active` |
| **GitHub Sponsors** | Developer Sponsorship | One-time or recurring contributions linked to GitHub profile | `Active` |

</div>

<br />

> **Automated Settlement:** Direct bank transfers made via `rout.be/sponsor` include an automated reference code. An inbound Wise webhook matches payments immediately without human inspection or manual overhead.

---

## Community Hub & Discussions

The GitHub Discussions tab serves as the primary coordination node for architectural proposals, security reviews, and feature requests.

* **Architecture & Security:** Discussion on Postgres row-level security, WebAuthn/FIDO2 passkey implementation, and TanStack server functions.
* **Vector & Design Systems:** Proposals for custom corner radiuses, aesthetic patterns, and hand-drawn style templates.
* **Integrations:** Implementation support for embedding the Rout rendering pipeline into custom client applications.
* **Showcase:** Production implementations and deployments using Rout infrastructure.

---

## Technical Stack


├── Framework         React 18 + TypeScript + Tailwind CSS (Obsidian Dark System)
├── Database          Neon PostgreSQL (Frankfurt) + row-level security
├── Edge Runtime      Deno Edge Functions (EU West Region)
├── Sovereign Storage Infomaniak Swiss Cloud (S3-Compatible)
├── Authentication    WebAuthn / FIDO2 Passkey Standard
└── License           MIT Open Source

---

## Developer Quickstart

```bash
# Clone repository
git clone [https://github.com/jdelplanche/routbe-43f6ee75.git](https://github.com/jdelplanche/routbe-43f6ee75.git)

# Navigate to directory
cd routbe-43f6ee75

# Install dependencies
npm install

# Launch development environment
npm run dev

<div align="center">
Rout Infrastructure • Designed in Obsidian Dark Mode (#0B0B0C) • Built for Performance & Data Sovereignty
</div>


## E-mail (Brevo) documentatie & audit

- `docs/brevo-templates.md` — volledige template-mapping (taal-offsets, fallbacks, params, env-overrides). Gegenereerd, niet handmatig bewerken.
- `bun run audit:brevo` — controleert of elke actief gebruikte template-ID overeenkomt met het schema en de env-overrides (exit 1 bij afwijking).
- `bun run docs:brevo` — regenereert de documentatie.
- `bun run test` — unit tests o.a. voor de template-lookup in `src/emails/template-ids.ts`.
- CI draait lint, tests, de audit en een check dat de documentatie up-to-date is (`.github/workflows/ci.yml`).
