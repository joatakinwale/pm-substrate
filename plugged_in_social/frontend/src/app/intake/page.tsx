import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import IntakeForm from "@/components/IntakeForm";

// FE-22 + FE-24: per-page metadata with canonical. Title is "Quick Intake"
// only — root template adds " | Stevie Social".
export const metadata: Metadata = {
  title: "Quick Intake",
  description:
    "Tell us about your brand so we can come prepared for your strategy call. Takes about 3 minutes.",
  alternates: { canonical: "/intake" },
  // Intake is transactional/funnel — no need to expose it via OG previews;
  // rely on the root-layout OG defaults for any stray social shares.
  robots: { index: true, follow: true },
};

export default function IntakePage() {
  return (
    <>
      <Navbar />

      {/* FE-2: pt-32 (was pt-24) so the "Quick Intake" sticker-label chip has
          clear separation from the sticky navbar's bottom border.
          FE-9: min-h-[calc(100vh-4rem)] (navbar is 64px = 4rem) keeps the
          footer pinned below the viewport fold even on the shortest
          intake step, so Footer never rides up into the form's final
          field. pb-24 (was pb-16) adds extra separation when the form
          IS near-viewport-height so the submit button doesn't kiss the
          footer's top border. */}
      <main className="pt-32 pb-24 px-6 min-h-[calc(100vh-4rem)]">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
              Quick Intake
            </div>
            <h1 className="heading-brand text-4xl md:text-5xl mb-5">
              Tell us about your brand.
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              This quick intake helps us come prepared for your strategy call.
              Takes about 3 minutes.
            </p>
          </div>

          {/* Form */}
          <IntakeForm />
        </div>
      </main>

      <Footer />
    </>
  );
}
