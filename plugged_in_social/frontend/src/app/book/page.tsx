import type { Metadata } from "next";
import { headers } from "next/headers";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BookingWidget from "./_components/BookingWidget";

// Required by @cloudflare/next-on-pages — any non-static route must opt
// into the Edge Runtime so the CF adapter can compile it for Workers.
export const runtime = "edge";

export const metadata: Metadata = {
  title: "Book a call",
  description:
    "Book a 30-minute strategy call with Stevie Social. We work with established brands seeking a strategic partner for social content.",
  alternates: { canonical: "/book" },
  openGraph: {
    title: "Book a strategy call with Stevie Social",
    description:
      "A 30-minute strategy call for established brands ready for a strategic partner, not a posting service.",
    url: "/book",
    type: "website",
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Tenant slug resolution (same logic as the old Cal.com page) ──────────

function deriveSlugFromHost(host: string | null): string | null {
  if (!host) return null;
  const bare = host.split(":")[0]!.toLowerCase();
  const parts = bare.split(".");
  if (parts.length < 2) return null;
  const first = parts[0]!;
  if (first === "www" || first === "localhost") return null;
  return first;
}

// ── Booking page metadata from the public API ─────────────

interface BookingPageInfo {
  org_name: string;
  org_slug: string;
  profile_name: string;
  profile_slug: string;
  duration_minutes: number;
  location: Record<string, unknown>;
  working_hours: unknown[];
  buffer_before_minutes: number;
  buffer_after_minutes: number;
}

async function loadBookingPage(
  orgSlug: string,
  profileSlug: string,
): Promise<BookingPageInfo | null> {
  try {
    const res = await fetch(
      `${API_URL}/api/public/booking/${encodeURIComponent(orgSlug)}/${encodeURIComponent(profileSlug)}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as BookingPageInfo;
  } catch {
    return null;
  }
}

/** Resolve (orgSlug, profileSlug) from the request host + branding endpoint. */
async function resolveBookingContext(): Promise<{
  orgSlug: string;
  profileSlug: string;
  info: BookingPageInfo | null;
} | null> {
  const headerStore = await headers();
  const host =
    headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const orgSlug = deriveSlugFromHost(host);
  if (!orgSlug) return null;

  // First, look up the org's default booking profile via the branding endpoint.
  try {
    const brandingRes = await fetch(
      `${API_URL}/api/public/branding/${encodeURIComponent(orgSlug)}`,
      { next: { revalidate: 300 } },
    );
    if (!brandingRes.ok) return null;
    const branding = (await brandingRes.json()) as {
      booking_profile_slug?: string | null;
    };
    const profileSlug = branding.booking_profile_slug;
    if (!profileSlug) return { orgSlug, profileSlug: "", info: null };

    const info = await loadBookingPage(orgSlug, profileSlug);
    return { orgSlug, profileSlug, info };
  } catch {
    return null;
  }
}

// ── Page component ────────────────────────────────────────

export default async function BookPage() {
  const ctx = await resolveBookingContext();
  const bookingConfigured =
    ctx !== null && ctx.profileSlug !== "" && ctx.info !== null;

  return (
    <>
      <Navbar />

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-14">
            <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-4">
              Get Started
            </div>
            <h1 className="heading-brand text-4xl md:text-5xl mb-5">
              Let&apos;s see if we&apos;re a fit.
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
              We work with established brands ($10M&ndash;$50M revenue) who are
              ready for a strategic partner, not a posting service. Book a{" "}
              {bookingConfigured
                ? `${ctx.info!.duration_minutes}-minute`
                : "30-minute"}{" "}
              strategy call to explore how we can help.
            </p>
          </div>

          {/* Booking widget or fallback */}
          {bookingConfigured ? (
            <BookingWidget
              orgSlug={ctx.orgSlug}
              profileSlug={ctx.profileSlug}
              durationMinutes={ctx.info!.duration_minutes}
              orgName={ctx.info!.org_name}
              profileName={ctx.info!.profile_name}
            />
          ) : (
            <div className="border border-border rounded-2xl bg-white shadow-sm p-10 text-center">
              <h2 className="font-margo text-2xl mb-3">
                Online booking is temporarily unavailable
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                Our scheduler is being updated. Email us to book your strategy
                call &mdash; we&apos;ll reply within one business day.
              </p>
              <a
                href="mailto:hello@stevie.social?subject=Strategy%20Call%20Request"
                className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
              >
                Email hello@stevie.social
              </a>
            </div>
          )}

          {/* What to Expect */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Quick Intake",
                description:
                  "Fill out a short form about your brand, revenue, and goals so we come prepared.",
                href: "/intake",
              },
              {
                step: "02",
                title: "Strategy Call",
                description:
                  "A 30-minute conversation about your brand, current challenges, and where you want to go.",
              },
              {
                step: "03",
                title: "Custom Proposal",
                description:
                  "If we\u2019re a fit, we\u2019ll send a tailored Compound Method strategy proposal within 48 hours.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-stevie-green/10 text-stevie-green font-margo text-lg mb-3">
                  {item.step}
                </div>
                <h3 className="font-margo text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
                {item.href && (
                  <a
                    href={item.href}
                    className="mt-2 inline-block text-xs text-stevie-green hover:underline"
                  >
                    Start intake form →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
