"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPortalToken } from "./portal-api";

/**
 * Portal auth guard hook.
 *
 * FE-29: Every protected /portal/* page was duplicating this pattern:
 *
 *   useEffect(() => {
 *     if (!getPortalToken()) {
 *       router.push("/portal/auth");
 *       return;
 *     }
 *     portalFetch(...).catch(() => router.push("/portal/auth"));
 *   }, [router]);
 *
 * That's fine once, but with four pages it meant the redirect target
 * "/portal/auth" lived in eight places — change the auth URL and you'd
 * have to chase all of them. It also meant every page hand-rolled the
 * synchronous token check, making it easy for a new page to forget.
 *
 * This hook centralizes both pieces:
 *
 * - `ready`: flips to true after the mount-time token check passes.
 *   Pages hold their data fetch until ready is true (see useEffect dep).
 *   If no token is present on mount, the hook replaces the route with
 *   /portal/auth (replace, not push, so the protected page doesn't sit
 *   in browser history with a back-button footgun).
 *
 * - `requireAuth()`: call this from a fetch .catch() when the error is
 *   consistent with an expired session — or pass directly as
 *   `.catch(requireAuth)` to preserve the previous "any error ⇒ send
 *   them to /auth" behavior while still deduplicating the URL.
 *
 * Migration note: once the cookie-only auth flip happens (see the
 * portal-api.ts header), `getPortalToken()` becomes meaningless — a
 * valid cookie user may have no localStorage token. At that point the
 * mount-time check here should be removed and auth becomes probe-only
 * (first portalFetch either succeeds or throws PortalAuthError which
 * calls requireAuth). For now we preserve current behavior exactly.
 */
export function useAuthGuard(): {
  ready: boolean;
  requireAuth: () => void;
} {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!getPortalToken()) {
      router.replace("/portal/auth");
      return;
    }
    setReady(true);
  }, [router]);

  const requireAuth = useCallback(() => {
    router.replace("/portal/auth");
  }, [router]);

  return { ready, requireAuth };
}
