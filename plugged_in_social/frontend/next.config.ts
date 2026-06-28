import type { NextConfig } from "next";

// FE-20: image optimization domains. Blog post cover + featured images are
// stored on Cloudflare R2 and served from media.stevie.social (see
// NEXT_PUBLIC_MEDIA_URL in .env.local.example). next/image rejects any
// src host not in remotePatterns — we allow our CDN host + r2.dev fallback
// (direct R2 public URL shape if the custom domain is ever unreachable)
// and localhost for dev where the backend may serve media directly.
const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Bundle-bloat fix (the reason next-on-pages was hitting 49 MB / 25 MiB
  // limit): lucide-react@1.14 ships as a single 30 MB barrel ESM file with
  // no per-icon export paths, so our bundler couldn't tree-shake it and
  // each one of the ~30 admin edge functions ended up carrying ~1.5 MB of
  // icons it never used. `optimizePackageImports` rewrites
  //   import { Foo, Bar } from "lucide-react"
  // into deep per-icon imports at build time, which is the official
  // recommended fix for exactly this package. Adding @supabase/ssr and
  // @supabase/supabase-js for the same reason — they're imported in every
  // admin route via the layout and middleware.
  // https://nextjs.org/docs/app/api-reference/next-config-js/optimizePackageImports
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@supabase/ssr",
      "@supabase/supabase-js",
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.stevie.social",
        pathname: "/**",
      },
      {
        // Cloudflare R2 public bucket URLs follow <bucket>.<account>.r2.dev.
        // Permissive match on the r2.dev suffix so we don't have to update
        // next.config every time the account/bucket moniker changes.
        protocol: "https",
        hostname: "**.r2.dev",
        pathname: "/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
