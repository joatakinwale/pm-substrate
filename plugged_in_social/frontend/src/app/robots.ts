import type { MetadataRoute } from "next";

// FE-18: Next.js file-convention robots. Crawled at /robots.txt.
// Disallowed paths are the authenticated + session-scoped surfaces:
//   /admin   — CMS
//   /portal  — client portal (auth-gated per FE-25)
//   /login   — auth entry; never useful in a SERP
//   /auth    — OAuth callback handlers
//   /proposal — signed/tokenized proposal viewer
//   /api     — backend API paths if ever served through this Next app
// Everything else (/, /about, /portfolio, /blog, /blog/[slug], /book,
// /intake) remains crawlable and is enumerated in sitemap.ts.

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://stevie.social";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/portal", "/login", "/auth", "/proposal", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
