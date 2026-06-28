import type { CSSProperties } from "react";
import type { Metadata } from "next";
import {
  ArrowRight,
  Banknote,
  CheckCircle2,
  Database,
  FileCheck2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Users,
  Workflow,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: { absolute: "JOATLabs Plaid Use Case" },
  description:
    "A concise Plaid use-case brief for JOATLabs: consented business account linking, transaction sync, served users, and integration flow.",
  keywords: [
    "JOATLabs",
    "Plaid use case",
    "Plaid Transactions",
    "Plaid Link",
    "business financial data",
    "JOATSocial",
  ],
  alternates: { canonical: "/plaid-use-case" },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "JOATLabs Plaid Use Case",
    description:
      "How JOATLabs would use Plaid for consented business financial context inside JOATSocial.",
    url: "/plaid-use-case",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JOATLabs Plaid Use Case",
    description:
      "A focused use-case brief for Plaid review: purpose, users, data scope, and integration flow.",
  },
};

const SNAPSHOT = [
  {
    label: "Initial Plaid scope",
    title: "Transactions via Plaid Link",
    body: "JOATLabs would start with Plaid Link and Transactions, syncing consented business account activity through /transactions/sync.",
    icon: Database,
    accent: "green",
  },
  {
    label: "Primary user",
    title: "Business account admins",
    body: "A verified organization owner or finance admin connects bank and card accounts they are authorized to manage.",
    icon: Users,
    accent: "sky",
  },
  {
    label: "Product purpose",
    title: "Finance-aware operations",
    body: "Transaction context helps JOATSocial tie project work, invoices, and campaign outcomes back to real business movement.",
    icon: Banknote,
    accent: "orange",
  },
  {
    label: "Control model",
    title: "Consent first, removable",
    body: "Tokens stay server-side, account access is role-gated, and the customer can disconnect accounts or request deletion.",
    icon: ShieldCheck,
    accent: "lavender",
  },
] satisfies UseCaseCard[];

const SERVED_AUDIENCES = [
  {
    title: "Service businesses and agencies",
    body: "Operators using JOATSocial to manage leads, projects, invoices, content, reports, and client relationships from one workspace.",
  },
  {
    title: "Founders and finance admins",
    body: "The account owners who need high-level revenue and expense context without exporting bank CSVs into every planning meeting.",
  },
  {
    title: "Fractional teams and collaborators",
    body: "Approved teammates who need scoped insight into trends, project readiness, or reporting context, not raw bank credentials.",
  },
];

const USE_CASES = [
  "Show revenue and spend context next to projects, invoices, proposals, and client reports.",
  "Reduce manual financial uploads during onboarding and monthly operating reviews.",
  "Detect recurring business expenses and revenue patterns that affect scope, timing, and planning.",
  "Help customers understand campaign and content performance with business context, not ad targeting.",
];

const FLOW = [
  {
    step: "01",
    title: "Customer starts the connection",
    body: "An authenticated JOATSocial organization owner or finance admin opens Settings, chooses Connect business bank account, and sees the exact data purpose before launching Plaid Link.",
  },
  {
    step: "02",
    title: "Backend creates a Link token",
    body: "JOATLabs creates a short-lived link token server-side for the signed-in organization, requesting the Transactions product for eligible US business accounts.",
  },
  {
    step: "03",
    title: "Plaid Link handles consent",
    body: "The customer selects their institution, authenticates through Plaid Link, completes OAuth or MFA if required, and approves access for the stated purpose.",
  },
  {
    step: "04",
    title: "Public token becomes a server token",
    body: "The browser sends the public_token to the JOATLabs API. The backend exchanges it for an access_token and item_id, then stores the access token encrypted and never exposes it to the browser.",
  },
  {
    step: "05",
    title: "Transactions sync incrementally",
    body: "A background sync uses /transactions/sync and Plaid webhooks such as SYNC_UPDATES_AVAILABLE to pull new, modified, and removed transactions with a cursor.",
  },
  {
    step: "06",
    title: "JOATSocial turns data into context",
    body: "The app stores normalized fields such as date, amount, merchant, category, account mask, and account type, then renders high-level insights in reports and planning views.",
  },
  {
    step: "07",
    title: "Customer keeps control",
    body: "Admins can disconnect an Item, remove stored Plaid tokens, stop future syncing, and request deletion of retained financial data tied to their organization.",
  },
];

const DATA_PRINCIPLES = [
  {
    title: "Purpose limitation",
    body: "Plaid data supports customer-facing operational context inside JOATSocial. It is not sold, rented, or used for third-party advertising.",
  },
  {
    title: "Minimal initial scope",
    body: "Initial production scope is Transactions only. JOATLabs is not requesting Auth, Identity, Assets, Income, or payment initiation for this launch.",
  },
  {
    title: "No credit decisions",
    body: "The integration does not underwrite loans, set credit terms, make eligibility decisions, or run collections workflows.",
  },
  {
    title: "Server-side custody",
    body: "Plaid access tokens remain in backend infrastructure, encrypted at rest, with access limited to service code that performs sync and disconnect actions.",
  },
];

const REVIEW_POINTS = [
  "Product requested: Transactions",
  "Integration entry point: Plaid Link from an authenticated JOATSocial settings screen",
  "Account intent: US business depository and credit accounts the user is authorized to connect",
  "Sync path: /transactions/sync with cursor storage and Plaid transaction webhooks",
  "Initial non-goals: no ACH account numbers, no payment initiation, no lending, no payroll, no data resale",
  "User controls: disconnect account, stop sync, and request data deletion",
];

type Accent = "green" | "sky" | "orange" | "lavender";

interface UseCaseCard {
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  accent: Accent;
}

const ACCENT_CLASSES: Record<Accent, string> = {
  green: "bg-stevie-green text-white",
  sky: "bg-stevie-sky text-foreground",
  orange: "bg-stevie-orange text-white",
  lavender: "bg-stevie-lavender text-foreground",
};

const CUBE_FACES: Array<{
  label: string;
  className: string;
  transform: CSSProperties["transform"];
}> = [
  {
    label: "Consent",
    className: "bg-stevie-chartreuse text-foreground",
    transform: "translateZ(72px)",
  },
  {
    label: "Plaid Link",
    className: "bg-stevie-green text-white",
    transform: "rotateY(90deg) translateZ(72px)",
  },
  {
    label: "Sync",
    className: "bg-stevie-sky text-foreground",
    transform: "rotateY(180deg) translateZ(72px)",
  },
  {
    label: "Insights",
    className: "bg-stevie-orange text-white",
    transform: "rotateY(-90deg) translateZ(72px)",
  },
  {
    label: "Security",
    className: "bg-white text-foreground",
    transform: "rotateX(90deg) translateZ(72px)",
  },
  {
    label: "Control",
    className: "bg-stevie-lavender text-foreground",
    transform: "rotateX(-90deg) translateZ(72px)",
  },
];

function CubeVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[360px] w-full max-w-[420px] sm:h-[420px]"
    >
      <div className="absolute inset-8 rounded-[32px] border border-white/10 bg-white/[0.03]" />
      <div className="absolute left-8 top-10 h-20 w-20 rounded-2xl border border-stevie-chartreuse/40 bg-stevie-chartreuse/10" />
      <div className="absolute bottom-12 right-8 h-24 w-24 rounded-full border border-stevie-sky/50 bg-stevie-sky/10" />
      <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 [perspective:900px]">
        <div
          className="relative h-full w-full"
          style={{
            transformStyle: "preserve-3d",
            transform: "rotateX(-18deg) rotateY(31deg)",
          }}
        >
          {CUBE_FACES.map((face) => (
            <div
              key={face.label}
              className={`absolute inset-0 flex items-center justify-center border-2 border-foreground/20 px-4 text-center font-margo text-xl shadow-[0_24px_70px_rgba(0,0,0,0.28)] ${face.className}`}
              style={{
                transform: face.transform,
                backfaceVisibility: "hidden",
              }}
            >
              {face.label}
            </div>
          ))}
        </div>
      </div>
      <div className="absolute bottom-7 left-1/2 w-[78%] -translate-x-1/2 rounded-full border border-white/10 bg-black/20 px-5 py-3 text-center text-xs text-white/55">
        One consented connection becomes clean operational context.
      </div>
    </div>
  );
}

function SectionHeading({
  label,
  title,
  body,
  invert = false,
}: {
  label: string;
  title: string;
  body?: string;
  invert?: boolean;
}) {
  return (
    <div className="max-w-3xl">
      <div
        className={`sticker-label text-xs uppercase tracking-widest ${
          invert ? "text-stevie-chartreuse" : "text-stevie-green"
        } mb-4`}
      >
        {label}
      </div>
      <h2
        className={`heading-brand text-4xl md:text-5xl ${
          invert ? "text-white" : "text-foreground"
        } mb-5 text-balance`}
      >
        {title}
      </h2>
      {body ? (
        <p
          className={`max-w-2xl leading-relaxed text-pretty ${
            invert ? "text-white/68" : "text-muted-foreground"
          }`}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

function SnapshotCard({ item }: { item: UseCaseCard }) {
  const Icon = item.icon;

  return (
    <article className="rounded-2xl border border-border bg-white p-6 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
      <div
        className={`mb-6 flex h-12 w-12 items-center justify-center rounded-xl ${ACCENT_CLASSES[item.accent]}`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {item.label}
      </p>
      <h3 className="font-margo text-2xl leading-tight">{item.title}</h3>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {item.body}
      </p>
    </article>
  );
}

export default function PlaidUseCasePage() {
  return (
    <main id="top" className="min-h-screen bg-white text-foreground">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-foreground/95 text-white backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <a href="#top" className="font-margo text-2xl tracking-tight">
            <span>JOAT</span>
            <span className="text-stevie-green">Labs</span>
          </a>
          <nav aria-label="Plaid use-case sections" className="hidden items-center gap-7 md:flex">
            <a
              href="#use-case"
              className="inline-flex h-11 items-center text-sm text-white/60 transition-colors hover:text-white"
            >
              Use case
            </a>
            <a
              href="#integration-flow"
              className="inline-flex h-11 items-center text-sm text-white/60 transition-colors hover:text-white"
            >
              Flow
            </a>
            <a
              href="#review"
              className="inline-flex h-11 items-center text-sm text-white/60 transition-colors hover:text-white"
            >
              Review points
            </a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-foreground px-6 pb-16 pt-16 text-white md:pb-24 md:pt-24">
        <div
          className="absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg width='420' height='420' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 210 C105 105 315 315 420 210' fill='none' stroke='white' stroke-width='1'/%3E%3Cpath d='M210 0 C105 105 315 315 210 420' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E\")",
            backgroundSize: "420px 420px",
          }}
        />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.76fr)]">
          <div>
            <div className="sticker-label mb-6 text-xs uppercase tracking-widest text-stevie-chartreuse md:mb-8">
              Plaid Use-Case Review
            </div>
            <h1 className="heading-brand max-w-4xl text-4xl md:text-6xl text-balance">
              JOATLabs would use Plaid for consented business financial context.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 text-pretty md:mt-7 md:text-lg">
              JOATLabs builds JOATSocial, an operations workspace for service
              businesses. Plaid would let a customer securely connect business
              bank and card accounts so JOATSocial can turn transaction data
              into cleaner onboarding, finance-aware reporting, and practical
              planning context.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row md:mt-10">
              <a
                href="#integration-flow"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stevie-green px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-stevie-green-light"
              >
                Review integration flow
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
              <a
                href="#data-principles"
                className="inline-flex items-center justify-center rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                Data principles
              </a>
            </div>
          </div>
          <CubeVisual />
        </div>
      </section>

      <section id="use-case" className="border-y border-border bg-muted px-6 py-16">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-2 lg:grid-cols-4">
          {SNAPSHOT.map((item) => (
            <SnapshotCard key={item.title} item={item} />
          ))}
        </div>
      </section>

      <section className="px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <SectionHeading
            label="Who It Serves"
            title="Built for customers who run the business and the client work."
            body="The user connecting Plaid is not a passive visitor. They are an authorized business owner, operator, or finance admin inside a JOATSocial organization."
          />

          <div className="grid gap-5">
            {SERVED_AUDIENCES.map((audience) => (
              <article
                key={audience.title}
                className="rounded-2xl border border-border bg-white p-7"
              >
                <h3 className="font-margo text-2xl">{audience.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {audience.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-stevie-lavender/25 px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="rounded-[28px] border border-foreground/10 bg-white p-8 shadow-[0_20px_80px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-3 border-b border-border pb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stevie-green text-white">
                <Workflow className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Operational output
                </p>
                <h3 className="font-margo text-2xl">What Plaid unlocks</h3>
              </div>
            </div>
            <div className="mt-7 grid gap-4">
              {USE_CASES.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-stevie-green"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <SectionHeading
            label="What It Is For"
            title="Business context, not financial exploitation."
            body="The integration is designed to reduce manual data entry and make customer-owned reporting more accurate. It does not initiate money movement, sell data, target ads, or make lending decisions."
          />
        </div>
      </section>

      <section id="integration-flow" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            label="Integration Flow"
            title="A clean Link-to-sync path with server-side token custody."
            body="The core flow follows Plaid's standard pattern: create a Link token, receive a public token, exchange it server-side, then keep transaction data current with cursor-based sync and webhooks."
          />

          <div className="mt-14 grid gap-5">
            {FLOW.map((item) => (
              <article
                key={item.step}
                className="grid gap-5 rounded-2xl border border-border bg-white p-6 md:grid-cols-[96px_minmax(0,1fr)] md:p-7"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground font-margo text-2xl text-stevie-chartreuse">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-margo text-2xl">{item.title}</h3>
                  <p className="mt-3 max-w-4xl text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="data-principles" className="bg-foreground px-6 py-24 text-white">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            label="Data Handling"
            title="The integration keeps the customer in control."
            body="JOATLabs would treat connected account data as sensitive customer-owned business data, scoped to the purpose presented at connection time."
            invert
          />

          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {DATA_PRINCIPLES.map((principle) => (
              <article
                key={principle.title}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-7"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-stevie-chartreuse text-foreground">
                  <LockKeyhole className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-margo text-2xl">{principle.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/62">
                  {principle.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="review" className="px-6 py-24">
        <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
          <SectionHeading
            label="Call Checklist"
            title="The Plaid review conversation in one place."
            body="These are the concrete points JOATLabs can confirm on the use-case call before moving from planning to implementation."
          />

          <div className="rounded-[28px] border border-border bg-muted p-7 md:p-8">
            <div className="grid gap-4">
              {REVIEW_POINTS.map((point) => (
                <div key={point} className="flex gap-3 rounded-2xl bg-white p-4">
                  <FileCheck2
                    className="mt-0.5 h-5 w-5 shrink-0 text-stevie-green"
                    aria-hidden="true"
                  />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {point}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-2xl border border-stevie-orange/25 bg-stevie-orange/10 p-5">
              <div className="flex items-start gap-3">
                <XCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-stevie-orange"
                  aria-hidden="true"
                />
                <p className="text-sm leading-relaxed text-foreground/72">
                  Out of scope for launch: consumer credit decisions, loan
                  applications, payment initiation, payroll, insurance
                  underwriting, identity verification, account/routing number
                  retrieval, or selling Plaid-derived data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-border bg-stevie-chartreuse px-6 py-20">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground/55">
              Prepared for Plaid use-case review
            </p>
            <h2 className="heading-brand max-w-2xl text-4xl md:text-5xl">
              Consent, sync, context, control.
            </h2>
          </div>
          <a
            href="#top"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-foreground/88"
          >
            Back to top
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </section>
    </main>
  );
}
