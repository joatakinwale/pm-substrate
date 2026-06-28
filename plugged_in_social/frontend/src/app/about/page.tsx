import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// FE-22 + FE-24: per-page metadata with canonical.
// Title is "About" only — the root layout template "%s | Stevie Social"
// adds the suffix. Previously this read "About | Stevie Social" which the
// template then augmented to "About | Stevie Social | Stevie Social" — a
// real SERP bug that would have doubled the brand in the tab title.
export const metadata: Metadata = {
  title: "About",
  description:
    "Stevie Social is a strategic social media agency for established brands. Learn about our approach, values, and the team behind The Compound Method.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About Stevie Social",
    description:
      "How we approach strategic social content for established brands — values, team, and The Compound Method.",
    url: "/about",
    type: "website",
  },
};

const TEAM = [
  {
    name: "Kelsie",
    role: "Founder & Strategist",
    bio: "After a decade in brand marketing, Kelsie founded Stevie Social to give established brands the strategic depth they deserve — not just another content calendar.",
  },
];

const TIMELINE = [
  {
    year: "Discovery",
    title: "We listen first.",
    description:
      "Before we post a single thing, we audit your brand, study your audience, and map your competitive landscape. Strategy comes before content.",
  },
  {
    year: "Strategy",
    title: "We build the playbook.",
    description:
      "Content pillars, guardrails, KPIs, and a Compound Method roadmap custom-built for your brand. Every decision has a reason.",
  },
  {
    year: "Execution",
    title: "We create and manage.",
    description:
      "On-site shoots, copywriting, scheduling, community management, and monthly reporting. Quality over volume, always.",
  },
  {
    year: "Growth",
    title: "We compound results.",
    description:
      "Only proven content gets amplified. We track what matters — saves, shares, qualified leads — and double down on what works.",
  },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />

      {/* Hero — FE-2: pt-40 (was pt-36) for navbar clearance; see Navbar shadow fix. */}
      <section className="pt-40 pb-20 px-6 bg-foreground text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6">
            About Us
          </div>
          <h1 className="heading-brand text-5xl md:text-6xl mb-6 text-balance">
            We don&apos;t chase.<br />We compound.
          </h1>
          {/* FE-41: text-pretty prevents widows (single word on last line)
              without scattering &nbsp; through copy. The previous render at
              ~1440px dropped "place." onto its own line, which read awkwardly
              under the centered h1. text-pretty is CSS text-wrap: pretty —
              shipping in Chrome 117+, Firefox 121+, Safari 17.5+. Older
              browsers fall through to default wrap, so it's progressive. */}
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed text-pretty">
            Stevie Social is a strategic content agency for established brands
            who want a partner, not a posting service. We believe trust compounds
            — and every piece of content should earn its place.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
                Our Mission
              </div>
              <h2 className="heading-brand text-4xl mb-5 text-balance">
                Social that speaks for your brand.
              </h2>
              {/* FE-41: text-pretty on the mission paragraphs — the second
                  paragraph's "business." was orphaning at md+ column widths
                  (left column of the 2-col grid). */}
              <p className="text-muted-foreground leading-relaxed mb-4 text-pretty">
                Most agencies treat social media like a volume game — more posts,
                more platforms, more noise. We take the opposite approach.
              </p>
              <p className="text-muted-foreground leading-relaxed text-pretty">
                Every brand has a voice worth protecting. Our job is to find it,
                refine it, and amplify it through content that builds real trust
                with the people who matter most to your business.
              </p>
            </div>
            <div className="bg-stevie-lavender/20 rounded-2xl p-10">
              <h3 className="font-margo text-2xl mb-6">Our Values</h3>
              <div className="space-y-4">
                {[
                  { name: "Honor", desc: "Your brand, treated like our own." },
                  { name: "Intention", desc: "Every post has a purpose." },
                  { name: "Partnership", desc: "With you, not just for you." },
                  { name: "Candor", desc: "Honest, even when uncomfortable." },
                  { name: "Quality", desc: "No filler. No fluff." },
                  { name: "Profit", desc: "If it doesn\u2019t drive results, we pivot." },
                ].map((v) => (
                  <div key={v.name} className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-stevie-green mt-2 shrink-0" />
                    <div>
                      <span className="font-semibold">{v.name}</span>
                      <span className="text-muted-foreground"> — {v.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="py-24 px-6 bg-muted">
        <div className="max-w-4xl mx-auto">
          <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
            How We Work
          </div>
          <h2 className="heading-brand text-4xl mb-14">
            From discovery to growth.
          </h2>
          <div className="space-y-12">
            {TIMELINE.map((step, i) => (
              <div key={step.year} className="flex gap-8">
                <div className="shrink-0 w-20 text-right">
                  <span className="font-margo text-lg text-stevie-green">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="flex-1 pb-12 border-l-2 border-stevie-green/20 pl-8 relative">
                  <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-stevie-green" />
                  <h3 className="font-margo text-xl mb-2">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
            The Team
          </div>
          <h2 className="heading-brand text-4xl mb-14">
            Small team. Big results.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {TEAM.map((person) => (
              <div
                key={person.name}
                className="bg-white rounded-2xl border border-border p-8"
              >
                <div className="w-14 h-14 rounded-full bg-stevie-green/10 flex items-center justify-center mb-4">
                  <span className="font-margo text-xl text-stevie-green">
                    {person.name.charAt(0)}
                  </span>
                </div>
                <h3 className="font-margo text-xl mb-1">{person.name}</h3>
                <p className="text-sm text-stevie-green mb-3">{person.role}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {person.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-stevie-chartreuse">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="heading-brand text-4xl md:text-5xl mb-5">
            Ready to work together?
          </h2>
          <p className="text-foreground/70 mb-10 leading-relaxed max-w-xl mx-auto">
            If you&apos;re an established brand looking for a strategic partner
            who treats your social presence with the same care you treat your
            product — let&apos;s talk.
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
