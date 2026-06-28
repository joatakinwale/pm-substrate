export const runtime = "edge";

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import DOMPurify from "isomorphic-dompurify";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || "stevie-social";
const PUBLIC_CONTENT_REVALIDATE_SECONDS = 300;

interface SitePage {
  id: string;
  slug: string;
  title: string;
  content: Record<string, unknown> | unknown[];
  meta_title: string | null;
  meta_description: string | null;
  og_image_url: string | null;
  updated_at: string;
}

function pageHtml(content: SitePage["content"]): string {
  if (
    content &&
    !Array.isArray(content) &&
    typeof content === "object" &&
    typeof (content as { html?: unknown }).html === "string"
  ) {
    return (content as { html: string }).html;
  }
  return "";
}

function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
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
    ALLOW_DATA_ATTR: false,
  });
}

async function getPage(slug: string): Promise<SitePage | null> {
  try {
    const params = new URLSearchParams({ org_slug: ORG_SLUG });
    const res = await fetch(
      `${API_URL}/api/pages/by-slug/${encodeURIComponent(slug)}?${params}`,
      {
        next: {
          revalidate: PUBLIC_CONTENT_REVALIDATE_SECONDS,
          tags: ["page", `page:${slug}`],
        },
      },
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
  const page = await getPage(slug);
  if (!page) return { title: "Page Not Found", robots: { index: false } };

  return {
    title: page.meta_title || page.title,
    description: page.meta_description || undefined,
    alternates: { canonical: `/${page.slug}` },
    openGraph: {
      title: page.meta_title || page.title,
      description: page.meta_description || undefined,
      url: `/${page.slug}`,
      type: "website",
      images: page.og_image_url ? [page.og_image_url] : undefined,
    },
  };
}

export default async function PublicCmsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const html = pageHtml(page.content);

  return (
    <>
      <Navbar />
      <main className="pt-32 pb-20 px-6">
        <article className="max-w-3xl mx-auto">
          <h1 className="heading-brand text-4xl md:text-5xl mb-8">
            {page.title}
          </h1>
          {html ? (
            <div
              className="prose prose-lg max-w-none prose-headings:font-margo prose-a:text-stevie-green prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          ) : (
            <p className="text-muted-foreground">
              This page does not have content yet.
            </p>
          )}
        </article>
      </main>
      <Footer />
    </>
  );
}
