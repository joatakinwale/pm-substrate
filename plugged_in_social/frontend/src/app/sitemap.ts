import type { MetadataRoute } from "next";

// FE-18: Next.js file-convention sitemap. Crawled at /sitemap.xml.
//
// Strategy: static routes are enumerated explicitly (order of priority, not
// order in the nav). Dynamic routes are the published blog posts — fetched
// from the public API at request time. If the API is unreachable we fall
// back to the static routes only rather than failing the whole response,
// because a 500 on /sitemap.xml would nuke indexing for every route.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stevie.social";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ORG_SLUG = process.env.NEXT_PUBLIC_ORG_SLUG || "stevie-social";

// /admin, /portal, /login, /auth, /proposal are NOT indexed (see robots.ts).
// Marketing-funnel routes, ordered by priority: / > /book (primary CTA
// destination) > /about > /portfolio (social-proof) > /blog > /intake.
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
}> = [
  { path: "/", changeFrequency: "weekly", priority: 1.0 },
  { path: "/book", changeFrequency: "monthly", priority: 0.9 },
  { path: "/about", changeFrequency: "monthly", priority: 0.8 },
  { path: "/portfolio", changeFrequency: "monthly", priority: 0.8 },
  { path: "/blog", changeFrequency: "weekly", priority: 0.7 },
  { path: "/intake", changeFrequency: "monthly", priority: 0.5 },
];

interface PublicBlogListItem {
  slug: string;
  published_at: string | null;
  updated_at?: string | null;
}

interface PublicBlogListResponse {
  items: PublicBlogListItem[];
  total: number;
  page: number;
  pages: number;
}

async function fetchPublishedSlugs(): Promise<PublicBlogListItem[]> {
  // per_page: 100 is backend's cap. If we ever exceed 100 published posts
  // we'll need to page through — leave a TODO rather than pretend it works.
  try {
    const res = await fetch(
      `${API_URL}/api/blog/public?org_slug=${ORG_SLUG}&page=1&per_page=100`,
      { next: { revalidate: 60 * 15 } } // 15-min cache — sitemap doesn't need to be realtime
    );
    if (!res.ok) return [];
    const data: PublicBlogListResponse = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified: now,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const posts = await fetchPublishedSlugs();
  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${SITE_URL}/blog/${p.slug}`,
    lastModified: p.updated_at
      ? new Date(p.updated_at)
      : p.published_at
        ? new Date(p.published_at)
        : now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticEntries, ...postEntries];
}
