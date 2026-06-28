import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * FE-32: Blog post 404.
 *
 * `/blog/[slug]/page.tsx` calls `notFound()` when a post slug doesn't
 * resolve (unpublished, deleted, or typo). Next bubbles that up to the
 * nearest not-found.tsx — having this file at the slug segment means
 * the rendered 404 is scoped: "this post doesn't exist" rather than
 * "this page doesn't exist". Better wayfinding for the user.
 *
 * Without this file, the root not-found.tsx would still run, but with a
 * generic "page ghosted us" message. Slug-scoped messaging is cheap and
 * nudges the user toward other posts rather than the homepage.
 */
export default function BlogPostNotFound() {
  return (
    <>
      <Navbar />
      <section className="min-h-[60vh] flex items-center justify-center pt-40 pb-20 px-6">
        <div className="max-w-xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6 bg-foreground">
            Post not found
          </div>
          <h1 className="heading-brand text-4xl md:text-5xl mb-5">
            That post has been retired.
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-10">
            This post was unpublished or the URL changed. Browse the
            current posts — plenty of strategy reading either way.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/blog"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
            >
              See all posts
            </Link>
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
