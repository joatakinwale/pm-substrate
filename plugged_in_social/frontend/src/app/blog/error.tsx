"use client";

/**
 * FE-32: Blog-scoped error boundary.
 *
 * Sits below `/blog/layout.tsx`, so if the public-blog API fetch throws
 * (FE-21 server fetch calls `/api/content/public/blog`), only the blog
 * subtree unmounts — the root layout + Navbar survive and the user can
 * navigate away without a full refresh.
 *
 * Separate from root error.tsx so the copy can be specific: "couldn't
 * load posts" is more useful than the generic "something broke".
 */

import { useEffect } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Blog route error:", error);
  }, [error]);

  return (
    <>
      <Navbar />
      <section className="min-h-[60vh] flex items-center justify-center pt-40 pb-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="sticker-label text-stevie-orange text-xs tracking-widest uppercase mb-6">
            Blog offline
          </div>
          <h1 className="heading-brand text-4xl md:text-5xl mb-5">
            Couldn&apos;t load the posts.
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Our blog service isn&apos;t responding right now. Try again in a
            moment or head back home.
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
