import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// FE-13 + FE-17: parallel grammar across the four stats ("X in N period"), and
// the 1,393 figure owns its specificity with the "zero bot farms" frame
// instead of being rounded (rounding would feel more fabricated, not less).
const STATS = [
  { value: "$350K", label: "Revenue growth in 12 months", accent: "stevie-green" },
  { value: "130K+", label: "Organic local reach in 6 months", accent: "stevie-orange" },
  { value: "1,393", label: "Niche followers, zero bot farms", accent: "stevie-green" },
  { value: "60%", label: "More qualified leads in 90 days", accent: "stevie-orange" },
];

const SERVICES = [
  {
    title: "Strategy",
    tag: "Social Strategy",
    description:
      "Brand positioning, audience segments, content pillars, guardrails, KPIs \u2014 all defined before a single post goes live.",
    color: "bg-stevie-lavender",
  },
  {
    title: "Content Creation",
    tag: "Content Creation",
    description:
      "On-site shoots, editing, copywriting, and asset organization. Quality over volume. Every piece serves the strategy.",
    color: "bg-stevie-chartreuse",
  },
  {
    title: "Management",
    tag: "Social Management",
    description:
      "Scheduling, distribution, community management, paid amplification (only for proven content), and monthly reporting.",
    color: "bg-stevie-sky",
  },
];

const COMPOUND_PHASES = [
  {
    phase: "01",
    name: "Protect",
    duration: "60\u201390 days",
    color: "bg-stevie-green",
    tagColor: "text-stevie-green",
    description:
      "Establish message discipline across all channels. Define content pillars with clear purpose and business outcomes. Set guardrails for what we will and will not post.",
    metrics: "Saves, shares, alignment signals, misaligned inquiry rate",
  },
  {
    phase: "02",
    name: "Deepen",
    duration: "90\u2013180 days",
    color: "bg-stevie-sky",
    tagColor: "text-stevie-sky",
    description:
      "Deepen relationships beyond algorithm reach. Email strategy, trust-building narratives, and nurture sequences that create genuine connection.",
    metrics: "Inbound conversation quality, brand recognition, content library depth",
  },
  {
    phase: "03",
    name: "Amplify",
    duration: "180+ days",
    color: "bg-stevie-orange",
    tagColor: "text-stevie-orange",
    description:
      "Only content that has proven organic alignment gets amplified. Ad spend is directed at the highest-performing content \u2014 not guesswork.",
    metrics: "Cost per qualified lead, paid vs. organic comparison, revenue attribution",
  },
];

const BRAND_VALUES = [
  { name: "Honor", description: "We treat your brand the way we\u2019d treat our own." },
  { name: "Intention", description: "Every post, every campaign has a reason behind it." },
  { name: "Partnership", description: "We work with you, not just for you." },
  { name: "Candor", description: "Honest feedback, even when it\u2019s uncomfortable." },
  { name: "Quality", description: "No filler. No fluff. Every asset earns its place." },
  { name: "Profit", description: "If it doesn\u2019t drive results, we\u2019re not doing our job." },
];

export default function HomePage() {
  return (
    <>
      <Navbar />

      {/* ═══ HERO ═══ */}
      {/* FE-2: pt-40 (was pt-36) gives ~112px below the 64px sticky navbar so
          the sticker-label "Social That Speaks" has breathing room on first
          render and doesn't look jammed against the navbar's bottom border. */}
      <section className="relative bg-foreground text-white pt-40 pb-28 px-6 overflow-hidden">
        {/* Subtle S-curve accent */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='400' height='400' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 200 C100 100 300 300 400 200' fill='none' stroke='white' stroke-width='1'/%3E%3C/svg%3E")`,
          backgroundSize: "400px 400px",
        }} />
        <div className="max-w-4xl mx-auto text-center relative">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-8">
            Social That Speaks
          </div>
          {/* FE-4: text-4xl md:text-6xl (was text-5xl md:text-7xl). The old
              scale read like a billboard next to the rest of the brand system
              — scaled down one step keeps it dominant without shouting. */}
          <h1 className="heading-brand text-4xl md:text-6xl mb-6">
            Stop chasing trends.<br />
            Start building trust.
          </h1>
          <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed mb-10">
            Strategic content creation and social management for established
            brands ready to compound — not just post.
          </p>
          {/* FE-3: gap-4 sm:gap-5 — 16px between stacked CTAs on mobile, 20px
              between them side-by-side on sm+ so the two pills don't read as
              one fused blob at hero scale. */}
          <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 justify-center">
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full bg-stevie-green text-white text-base font-semibold hover:bg-stevie-green-light transition-colors"
            >
              Book a strategy call
            </Link>
            <Link
              href="/portfolio"
              className="inline-flex items-center justify-center px-8 py-3.5 rounded-full border border-white/30 text-white text-base font-semibold hover:bg-white/10 transition-colors"
            >
              See Our Work
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      {/* FE-4: bg-muted (was bg-stevie-chartreuse). Chartreuse as a full-width
          band fought the lavender/sky/orange palette downstream. Muted (#f8f9fa)
          lets each stat's accent color carry the visual weight, and reserves
          chartreuse for the hero and CTA sticker-labels where it's an
          intentional highlight, not a wallpaper. */}
      <section className="border-y border-border bg-muted">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {STATS.map((stat, i) => {
            // Static class map — Tailwind's JIT requires literal class names.
            // Alternating green/orange matches the accent field on each STATS
            // entry and keeps the rhythm down the bar.
            const accentClass =
              stat.accent === "stevie-green"
                ? "text-stevie-green"
                : "text-stevie-orange";
            return (
              <div
                key={i}
                className="py-8 px-6 text-center border-r border-border last:border-r-0"
              >
                <div className={`heading-brand text-3xl md:text-4xl ${accentClass}`}>
                  {stat.value}
                </div>
                <div className="text-xs text-foreground/60 mt-1">
                  {stat.label}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══ THE STEVIE SPECIAL ═══ */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
            Our Offering
          </div>
          <h2 className="heading-brand text-4xl md:text-5xl mb-4">
            The Stevie Special
          </h2>
          <p className="text-muted-foreground max-w-xl mb-14 leading-relaxed">
            Everything we offer, in one simple package. Strategy, content
            creation, and management combined &mdash; the foundation of every
            client engagement.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SERVICES.map((service) => (
              <div
                key={service.title}
                className="group border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className={`${service.color} px-8 py-5`}>
                  <span className="font-margo text-lg text-foreground">
                    {service.tag}
                  </span>
                </div>
                <div className="p-8 bg-white">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {service.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE COMPOUND METHOD ═══ */}
      <section className="py-24 px-6 bg-muted">
        <div className="max-w-7xl mx-auto">
          <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
            Our Process
          </div>
          <h2 className="heading-brand text-4xl md:text-5xl mb-4">
            The Compound Method
          </h2>
          <p className="text-muted-foreground max-w-xl mb-14 leading-relaxed">
            Trust compounds. Every piece of content builds on the last. We
            don&apos;t chase &mdash; we compound. Three phases, each earned by
            performance signals, not the calendar.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {COMPOUND_PHASES.map((phase) => (
              <div
                key={phase.name}
                className="bg-white border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className={`${phase.color} h-2`} />
                <div className="p-8">
                  <div className="text-xs font-semibold text-muted-foreground tracking-wider mb-1">
                    PHASE {phase.phase}
                  </div>
                  <h3 className="heading-brand text-2xl mb-1">{phase.name}</h3>
                  <div className="text-xs text-muted-foreground mb-5">
                    {phase.duration}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                    {phase.description}
                  </p>
                  <div className={`text-xs font-medium ${phase.tagColor}`}>
                    We track: {phase.metrics}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ BRAND VALUES ═══ */}
      <section className="py-24 px-6 bg-stevie-lavender/30">
        <div className="max-w-7xl mx-auto">
          <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
            What We Stand For
          </div>
          <h2 className="heading-brand text-4xl md:text-5xl mb-14">
            Our Values
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
            {BRAND_VALUES.map((val) => (
              <div key={val.name}>
                <h3 className="font-margo text-xl mb-2">{val.name}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {val.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="py-24 px-6 bg-foreground text-white">
        <div className="max-w-3xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6">
            Let&apos;s Talk
          </div>
          <h2 className="heading-brand text-4xl md:text-5xl mb-5">
            Ready to stop chasing<br />and start compounding?
          </h2>
          <p className="text-white/70 mb-10 leading-relaxed max-w-xl mx-auto">
            We work with established brands ($10M&ndash;$50M revenue) who want a
            strategic partner, not a posting service. If that sounds like you,
            let&apos;s talk.
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
