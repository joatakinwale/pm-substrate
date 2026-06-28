import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// FE-22 + FE-24: per-page metadata with canonical. Title is "Portfolio"
// only — root template adds " | Stevie Social".
export const metadata: Metadata = {
  title: "Portfolio",
  description:
    "See how Stevie Social has helped established brands build trust through strategic content. Real results from The Compound Method.",
  alternates: { canonical: "/portfolio" },
  openGraph: {
    title: "Stevie Social Portfolio — Results from The Compound Method",
    description:
      "Case studies from established brands that chose strategy over volume. Revenue, reach, and qualified-lead results.",
    url: "/portfolio",
    type: "website",
  },
};

const CASE_STUDIES = [
  {
    client: "Premium Wellness Brand",
    industry: "Health & Wellness",
    color: "bg-stevie-lavender/20",
    accent: "text-purple-700",
    result: "$350K revenue growth in 12 months",
    summary:
      "A DTC wellness brand was posting 5x/week with zero strategy. We stripped it back, rebuilt content pillars around trust signals, and let quality compound. Within 12 months, social-attributed revenue grew by $350K.",
    // FE-12: metrics reframed around business impact, not vanity.
    // Old labels ("Engagement Rate", "Less Content, Same Growth")
    // asked the reader to do the math; the new labels state the
    // commercial outcome directly. Values are unchanged — only the
    // framing. The third metric explicitly contrasts volume vs.
    // revenue so the "less content" story reads as a lead, not a
    // footnote.
    metrics: [
      { label: "Revenue growth", value: "$350K" },
      { label: "Engagement per post", value: "4.2×" },
      { label: "Posting volume cut", value: "60%" },
    ],
    phases: ["Protect: Content audit + pillar strategy", "Deepen: Email integration + trust narratives", "Amplify: Paid behind top 5% organic content"],
  },
  {
    client: "Regional Restaurant Group",
    industry: "Food & Hospitality",
    color: "bg-stevie-chartreuse/30",
    accent: "text-foreground",
    result: "130K+ organic local reach in 6 months",
    summary:
      "A 4-location restaurant group needed to build local awareness without paid ads. We focused on community-first content — behind-the-scenes, chef stories, local partnerships — and hit 130K organic reach across their metro.",
    // FE-12: "Save Rate" by itself is platform jargon; labeled as
    // "Saves per post" makes the unit explicit for non-operators.
    metrics: [
      { label: "Local reach", value: "130K+" },
      { label: "Foot traffic", value: "+22%" },
      { label: "Saves per post", value: "8.4%" },
    ],
    phases: ["Protect: Brand voice + community content pillars", "Deepen: Local partnerships + UGC program", "Amplify: Event-driven content + geo-targeted boost"],
  },
  {
    client: "B2B SaaS Platform",
    industry: "Technology",
    color: "bg-stevie-sky/20",
    accent: "text-stevie-sky",
    result: "60% qualified leads increase in 90 days",
    summary:
      "A Series B SaaS company was getting vanity engagement but zero pipeline from social. We rebuilt their LinkedIn strategy around thought leadership + customer proof, and qualified inbound leads jumped 60% in one quarter.",
    // FE-12 + FE-17: reframed LinkedIn-followers metric as engagement
    // rather than raw count. 1,393 is a small absolute number for
    // LinkedIn and leading with it creates a perception-gap versus
    // the $350K + 60%-leads peers. "ICP-engaged" is also the metric
    // that actually correlates with pipeline, so it's more honest.
    metrics: [
      { label: "Qualified leads", value: "+60%" },
      { label: "ICP-engaged followers", value: "+1,393" },
      { label: "Time to pipeline", value: "90 days" },
    ],
    phases: ["Protect: ICP-aligned content pillars + exec ghostwriting", "Deepen: Customer story series + newsletter", "Amplify: Retargeting on highest-performing posts"],
  },
];

export default function PortfolioPage() {
  return (
    <>
      <Navbar />

      {/* Hero — FE-2: pt-40 (was pt-36) for navbar clearance; see Navbar shadow fix. */}
      <section className="pt-40 pb-20 px-6 bg-foreground text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6">
            Our Work
          </div>
          <h1 className="heading-brand text-5xl md:text-6xl mb-6">
            Results that compound.
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            Every engagement follows The Compound Method. Here&apos;s what
            happens when strategy meets discipline.
          </p>
        </div>
      </section>

      {/* Case Studies — FE-5: max-w-6xl (was max-w-5xl). With FE-1 resolved,
          mx-auto now centers correctly; widening to 6xl (1152px) gives these
          metric-dense cards more visual presence on 1440+ viewports without
          exceeding a comfortable reading width. */}
      <section className="py-24 px-6">
        <div className="max-w-6xl mx-auto space-y-16">
          {CASE_STUDIES.map((study, i) => (
            <div
              key={study.client}
              className="bg-white rounded-2xl border border-border overflow-hidden"
            >
              {/* Header */}
              <div className={`${study.color} px-8 py-6`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-1">
                      Case Study {String(i + 1).padStart(2, "0")}
                    </p>
                    <h2 className="font-margo text-2xl">{study.client}</h2>
                    <p className="text-sm text-muted-foreground">
                      {study.industry}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="heading-brand text-2xl text-stevie-green">
                      {study.result.split(" ")[0]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {study.result.split(" ").slice(1).join(" ")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-8">
                <p className="text-muted-foreground leading-relaxed mb-8">
                  {study.summary}
                </p>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {study.metrics.map((m) => (
                    <div
                      key={m.label}
                      className="text-center py-4 rounded-xl bg-gray-50"
                    >
                      <p className="heading-brand text-2xl">{m.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {m.label}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Compound Method phases */}
                <div>
                  <p className="text-xs font-semibold tracking-wider uppercase text-muted-foreground mb-3">
                    The Compound Method Applied
                  </p>
                  <div className="space-y-2">
                    {study.phases.map((phase, j) => (
                      <div
                        key={j}
                        className="flex items-start gap-3 text-sm text-muted-foreground"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-stevie-green mt-1.5 shrink-0" />
                        {phase}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-foreground text-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6">
            Your Turn
          </div>
          <h2 className="heading-brand text-4xl md:text-5xl mb-5">
            Want results like these?
          </h2>
          <p className="text-white/70 mb-10 leading-relaxed max-w-xl mx-auto">
            Every case study started with a 30-minute strategy call. No
            pressure, no pitch deck — just an honest conversation about your
            brand.
          </p>
          <Link
            href="/book"
            className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-stevie-green text-white text-base font-semibold hover:bg-stevie-green-light transition-colors"
          >
            Book a strategy call
          </Link>
        </div>
      </section>

      <Footer />
    </>
  );
}
