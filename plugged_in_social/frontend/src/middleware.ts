import { updateSession } from "@/lib/supabase/middleware";
import type { NextRequest } from "next/server";

// IMPORTANT: keep this as middleware.ts (NOT proxy.ts) and KEEP the
// experimental-edge runtime export. Reasons, for the next time someone
// is tempted to "modernize" this:
//
// 1. Next.js 16 deprecated middleware.ts in favor of proxy.ts (Node
//    runtime), but middleware.ts is still fully supported. The build
//    just prints a deprecation warning — that's fine.
//
// 2. @opennextjs/cloudflare does NOT yet support Node-runtime
//    middleware. Renaming to proxy.ts produces:
//      ERROR Node.js middleware is not currently supported.
//            Consider switching to Edge Middleware.
//    See https://github.com/opennextjs/opennextjs-cloudflare/issues/962
//
// 3. Next 16 + Turbopack rejects `runtime = "edge"` in middleware and
//    explicitly tells you to use `experimental-edge` instead. The
//    "experimental" label is misleading — this is the documented
//    correct value, not a flag to "fix later".
//
// Page/layout/route files do NOT need this — under OpenNext the whole
// Worker runs Node-compat, so those `export const runtime = 'edge'`
// scaffolds were removed in the same commit that wrote this comment.
// Middleware is the one exception.
export const runtime = "experimental-edge";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - Public assets
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
