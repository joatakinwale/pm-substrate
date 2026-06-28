"use client";

/**
 * FE-32: Root segment error boundary.
 *
 * Catches runtime errors thrown in any route segment under `/` that isn't
 * wrapped by a more specific error.tsx (admin/, portal/, blog/). This
 * renders in place of the crashed subtree — the root layout (html/body,
 * fonts, Organization JSON-LD) stays mounted, so the user keeps their
 * brand context and fonts don't re-flash.
 *
 * `reset()` re-mounts the failed segment; useful for transient network
 * errors where the user can retry without a full reload. We also give a
 * "Back to home" link as the no-recover path — same-origin navigation
 * triggers a full re-render so even hard-stuck client state unwinds.
 *
 * Next.js requires error.tsx to be a Client Component — the `"use client"`
 * directive above is mandatory (compile error otherwise).
 */

import { useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to console in dev; production errors should flow to whatever
    // observability pipeline we wire up (Sentry/LogRocket). The `digest`
    // is Next's hashed fingerprint of the error — safe to show users for
    // support-ticket correlation without leaking the stack trace.
    console.error("Route error:", error);
  }, [error]);

  return (
    <>
      <Navbar />
      <section className="min-h-[70vh] flex items-center justify-center pt-40 pb-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="sticker-label text-stevie-orange text-xs tracking-widest uppercase mb-6">
            Something broke
          </div>
          <h1 className="heading-brand text-5xl md:text-6xl mb-6">
            That didn&apos;t go as planned.
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-10">
            We hit an unexpected error loading this page. It&apos;s on our
            end, not yours. Try again, or head back home.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/70 mb-8">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
            >
              Try again
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full border-2 border-foreground text-foreground text-sm font-semibold hover:bg-foreground hover:text-white transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}
