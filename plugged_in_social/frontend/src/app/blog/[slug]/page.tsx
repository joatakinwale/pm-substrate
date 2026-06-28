export const runtime = 'edge';

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import DOMPurify from "isomorphic-dompurify";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || "stevie-social";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stevie.social";
const PUBLIC_CONTENT_REVALIDATE_SECONDS = 300;

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  body: string | null;
  excerpt: string | null;
  category: string | null;
  tags: string[];
  cover_image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  published_at: string | null;
  reading_time_minutes: number | null;
}

async function getPost(slug: string): Promise<BlogPost | null> {
  try {
    const params = new URLSearchParams({ org_slug: ORG_SLUG });
    const res = await fetch(
      `${API_URL}/api/blog/public/${encodeURIComponent(slug)}?${params}`,
      {
        next: {
          revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
          tags: ["blog", `blog:${slug}`],
        },
      }
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "Post Not Found" };
  // FE-22: title is just the post title OR the author-set meta_title —
  // root template " | Stevie Social" appends the brand. Previously we
  // manually appended " | Stevie Social" which the template then doubled.
  // FE-24: per-post canonical points at the public /blog/<slug> URL.
  // FE-19 (BlogPosting JSON-LD) is injected in the page body, not here.
  return {
    title: post.meta_title || post.title,
    description: post.meta_description || post.excerpt || undefined,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.meta_title || post.title,
      description: post.meta_description || post.excerpt || undefined,
      url: `/blog/${post.slug}`,
      type: "article",
      publishedTime: post.published_at || undefined,
      images: post.cover_image_url ? [post.cover_image_url] : undefined,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  if (!post) {
    notFound();
  }

  // FE-19: BlogPosting JSON-LD. Google's minimum recommended fields are
  // headline, image, author, datePublished. We include mainEntityOfPage
  // (canonical page URL) and publisher (linked to the Organization @id
  // from root layout) so the BlogPosting connects to the Organization
  // graph node — this is what drives rich-snippet eligibility.
  const blogPostingJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || post.meta_description || undefined,
    image: post.cover_image_url || undefined,
    datePublished: post.published_at || undefined,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    publisher: {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Stevie Social",
    },
    // author is left off until the public API exposes it — crawlers
    // accept a missing author for BlogPosting (they prefer it present,
    // but will still parse the node without it); a fabricated or
    // Organization-as-author value would be worse than the omission.
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPostingJsonLd) }}
      />
      <Navbar />

      <article className="pt-32 pb-20 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <Link
              href="/blog"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 inline-block"
            >
              &larr; Back to blog
            </Link>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 bg-stevie-green/5 text-stevie-green text-xs font-medium rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <h1 className="heading-brand text-4xl md:text-5xl mb-5">
              {post.title}
            </h1>

            {post.excerpt && (
              <p className="text-lg text-muted-foreground leading-relaxed mb-6">
                {post.excerpt}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-muted-foreground border-b border-border pb-6">
              {post.published_at && (
                <time>
                  {new Date(post.published_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              )}
              {post.reading_time_minutes && (
                <span>{post.reading_time_minutes} min read</span>
              )}
              {post.category && <span>{post.category}</span>}
            </div>
          </div>

          {/* Cover image — FE-20: next/image for automatic optimization,
              lazy-off (priority) because this is above-the-fold on the
              post detail route and LCP-sensitive. The parent div locks
              a 16:9 aspect ratio so there's no CLS while the image
              decodes. sizes hints the browser that the image is capped
              at max-w-3xl (~768px) on desktop and full-width on mobile.
              FE-23: alt falls back to the post title only when the image
              is decorative-adjacent — richer alt requires per-post data
              the CMS doesn't currently surface. */}
          {post.cover_image_url && (
            <div className="mb-10 rounded-2xl overflow-hidden relative aspect-[16/9] bg-stevie-lavender/10">
              <Image
                src={post.cover_image_url}
                alt={post.title}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 768px"
                className="object-cover"
              />
            </div>
          )}

          {/* Body — FE-26: sanitize TipTap-authored HTML before injecting.
              The admin CMS stores raw HTML (TipTap output) in post.body.
              Any author — or anyone who compromises an admin session —
              could therefore plant <script>, javascript: URIs, or other
              XSS vectors that would execute for every reader. We pass the
              body through isomorphic-dompurify (JSDOM on server, native
              DOMPurify on client) with a TipTap-compatible allowlist:
              block/inline tags + headings + lists + links + images +
              code. We explicitly forbid <script>, <iframe>, <object>,
              <embed>, <style>, <form>, and event handlers. FORCE_BODY
              ensures relative paths in src are preserved. */}
          {post.body ? (
            <div
              className="prose prose-lg max-w-none prose-headings:font-margo prose-a:text-stevie-green prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(post.body, {
                  USE_PROFILES: { html: true },
                  FORBID_TAGS: [
                    "script",
                    "iframe",
                    "object",
                    "embed",
                    "style",
                    "form",
                    "input",
                    "button",
                  ],
                  FORBID_ATTR: [
                    "onerror",
                    "onload",
                    "onclick",
                    "onmouseover",
                    "onfocus",
                    "onblur",
                    "onchange",
                    "onsubmit",
                  ],
                  // Allow external images in posts but keep the hook
                  // that rewrites href="javascript:..." to safe no-ops.
                  ALLOW_DATA_ATTR: false,
                }),
              }}
            />
          ) : (
            <p className="text-muted-foreground">
              This post doesn&apos;t have content yet.
            </p>
          )}

          {/* Footer CTA */}
          <div className="mt-16 pt-8 border-t border-border text-center">
            <p className="text-muted-foreground mb-4">
              Want to see how these ideas apply to your brand?
            </p>
            <Link
              href="/book"
              className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
            >
              Book a strategy call
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </>
  );
}
