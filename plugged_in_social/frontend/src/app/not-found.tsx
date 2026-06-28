import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * FE-32: Root 404 page.
 *
 * Triggered by:
 *   - Any URL that doesn't match a route (e.g. /pricng)
 *   - Any page/layout/generateMetadata call that invokes `notFound()` and
 *     isn't caught by a nearer not-found.tsx (e.g. /blog/[slug] has its
 *     own not-found.tsx for missing slugs).
 *
 * Default Next.js 404s are a stark white page with "404" on it — fine for
 * dev, but a missed branding moment in production. This version keeps
 * Navbar + Footer so the user still has wayfinding, and offers a clear
 * "back to something useful" CTA rather than leaving them stuck.
 */
export default function NotFound() {
  return (
    <>
      <Navbar />
      <section className="min-h-[70vh] flex items-center justify-center pt-40 pb-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6 bg-foreground">
            404
          </div>
          <h1 className="heading-brand text-5xl md:text-6xl mb-6">
            This page has ghosted us.
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-10">
            The link you followed is broken, or the page has moved. Head
            back to the homepage or browse the blog — plenty of strategy
            notes over there.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
            >
              Back to home
            </Link>
            <Link
              href="/blog"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-foreground text-foreground text-sm font-semibold hover:bg-foreground hover:text-white transition-colors"
            >
              Read the blog
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
