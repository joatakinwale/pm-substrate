export const runtime = 'edge';

// FE-21: Converted from client component to server component.
// Prior version used "use client" + useState + useEffect + fetch — which
// meant the grid rendered empty on first paint, the crawler saw zero
// posts, and pagination pushed state into a hook tree instead of the URL.
// Now the fetch runs on the server at request time, pagination is driven
// by ?page=N so it's shareable/linkable/crawlable, and there's no client
// JS cost for the default render. (The loading state is therefore gone —
// SSR either has data or falls into the empty-state branch.)
//
// FE-20: <img> replaced with next/image for thumbnails — automatic
// optimization + CLS-free aspect-ratio containers.

import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import BlogSubscribeForm from "@/components/BlogSubscribeForm";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || "stevie-social";

const PER_PAGE = 9;

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image_url: string | null;
  author_name: string | null;
  reading_time_minutes: number | null;
  published_at: string;
  tags: string[];
}

interface PaginatedResponse {
  items: BlogPost[];
  total: number;
  page: number;
  pages: number;
}

async function getPosts(page: number): Promise<PaginatedResponse | null> {
  try {
    const params = new URLSearchParams({
      org_slug: ORG_SLUG,
      page: String(page),
      per_page: String(PER_PAGE),
    });
    const res = await fetch(
      `${API_URL}/api/blog/public?${params}`,
      // 5-minute revalidation: fresh enough for blog cadence, cheap
      // enough that we're not hammering the API on every crawl.
      { next: { revalidate: 300, tags: ["blog:index"] } }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const rawPage = Number.parseInt(pageParam ?? "1", 10);
  // Clamp so a manually-tampered ?page=-5 or ?page=abc doesn't throw.
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  const data = await getPosts(page);
  const posts = data?.items ?? [];
  const pages = data?.pages ?? 0;

  return (
    <>
      <Navbar />

      {/* Hero — FE-2: pt-40 (was pt-36) for navbar clearance; see Navbar shadow fix. */}
      <section className="pt-40 pb-16 px-6 bg-foreground text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="sticker-label text-stevie-chartreuse text-xs tracking-widest uppercase mb-6">
            Blog
          </div>
          <h1 className="heading-brand text-5xl md:text-6xl mb-5">
            Insights that compound.
          </h1>
          {/* FE-16: was 18 words and front-loaded "strategy, creative
              thinking, and lessons learned from…" — the cadence diluted the
              "trust" payload. Tightened to 9 words so the last beat lands. */}
          <p className="text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            Strategy and lessons from brands people actually trust.
          </p>
        </div>
      </section>

      {/* Posts grid — FE-6: min-h-[50vh] and flex-center so the empty state
          (short copy + two CTAs) doesn't leave the footer hovering mid-
          viewport on tall screens. */}
      <section className="py-20 px-6 min-h-[50vh] flex items-center">
        <div className="max-w-6xl mx-auto w-full">
          {posts.length === 0 ? (
            // FE-14: empty-state-as-lead-gen. Previously showed a dead
            // "Check back soon" message that hurt the first impression.
            // This variant gives visitors two clear next steps — book a
            // call (primary) or email for first-post notification.
            <div className="max-w-xl mx-auto text-center py-12">
              <div className="sticker-label text-stevie-green text-xs tracking-widest uppercase mb-5">
                Coming Soon
              </div>
              <h2 className="heading-brand text-3xl md:text-4xl mb-4">
                The first essay drops soon.
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                We&apos;re writing about the Compound Method — strategy,
                creative, and what it actually takes to build trust on social.
                Short, opinionated, and grounded in the work we do with
                established brands.
              </p>
              <div className="flex flex-col items-center justify-center gap-3">
                <Link
                  href="/book"
                  className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
                >
                  Book a strategy call
                </Link>
                <BlogSubscribeForm orgSlug={ORG_SLUG} />
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className="group bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {/* Thumbnail — FE-20: next/image with fill inside a
                        fixed 16:9 container. sizes hints the browser the
                        image will render at ~1/3 viewport on desktop
                        (3-col grid) and full-width on mobile. */}
                    {post.featured_image_url ? (
                      <div className="aspect-[16/9] bg-gray-100 overflow-hidden relative">
                        <Image
                          src={post.featured_image_url}
                          alt={post.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div
                        className="aspect-[16/9] bg-stevie-lavender/10 flex items-center justify-center"
                        // FE-23: decorative placeholder — the card heading
                        // already announces the post, so we don't need a
                        // screen-reader to spend time on the bucket "S".
                        aria-hidden="true"
                      >
                        <span className="font-margo text-3xl text-stevie-lavender/40">
                          S
                        </span>
                      </div>
                    )}

                    <div className="p-6">
                      {/* Tags */}
                      {post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {post.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-stevie-green/5 text-stevie-green text-[11px] font-medium rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      <h2 className="font-margo text-xl mb-2 group-hover:text-stevie-green transition-colors">
                        {post.title}
                      </h2>

                      {post.excerpt && (
                        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                          {post.excerpt}
                        </p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {post.author_name && <span>{post.author_name}</span>}
                        <span>
                          {new Date(post.published_at).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" }
                          )}
                        </span>
                        {post.reading_time_minutes && (
                          <span>{post.reading_time_minutes} min read</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>

              {/* Pagination — FE-21: URL-driven via ?page= query param.
                  Links instead of buttons so middle-click / cmd-click /
                  copy-link all work, and so the crawler can walk the
                  paginated surface (each page is its own URL). Prev/Next
                  render as non-clickable spans at the boundaries. */}
              {pages > 1 && (
                <nav
                  aria-label="Blog pagination"
                  className="flex justify-center gap-3 mt-12"
                >
                  {page > 1 ? (
                    <Link
                      href={`/blog?page=${page - 1}`}
                      className="inline-flex items-center min-h-[44px] px-4 text-sm rounded-full border border-border hover:bg-gray-50 transition-colors"
                      rel="prev"
                    >
                      Previous
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center min-h-[44px] px-4 text-sm rounded-full border border-border opacity-40 cursor-default"
                    >
                      Previous
                    </span>
                  )}
                  <span className="inline-flex items-center min-h-[44px] px-4 text-sm text-muted-foreground">
                    Page {page} of {pages}
                  </span>
                  {page < pages ? (
                    <Link
                      href={`/blog?page=${page + 1}`}
                      className="inline-flex items-center min-h-[44px] px-4 text-sm rounded-full border border-border hover:bg-gray-50 transition-colors"
                      rel="next"
                    >
                      Next
                    </Link>
                  ) : (
                    <span
                      aria-disabled="true"
                      className="inline-flex items-center min-h-[44px] px-4 text-sm rounded-full border border-border opacity-40 cursor-default"
                    >
                      Next
                    </span>
                  )}
                </nav>
              )}
            </>
          )}
        </div>
      </section>

      <Footer />
    </>
  );
}
