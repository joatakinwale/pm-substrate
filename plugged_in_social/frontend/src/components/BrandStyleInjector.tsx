"use client";

/**
 * Apply per-org branding (primary/accent colors) as CSS variables on
 * <html>. Mounted at the top of admin and portal layouts so child pages
 * inherit ``--brand-primary`` / ``--brand-accent`` without each page
 * re-fetching.
 *
 * Two fetch modes:
 *
 * - Authenticated (admin / portal) — calls ``/api/settings`` so the
 *   logged-in user sees their own org's brand.
 * - Public (slug provided) — calls ``/api/public/branding/{slug}`` for
 *   the marketing-site routes the booking page already runs through.
 *
 * Performance: this is a single fetch per page load, no live socket. The
 * concern in the user's plan ("live connection between public page and
 * backend would be a performance bottleneck") is exactly why this is
 * one-shot — we read once, paint, done.
 */

import { useEffect } from "react";
import { apiFetch, type OrganizationSettings } from "@/lib/api";

type PublicBranding = {
  primary_color: string | null;
  accent_color: string | null;
};

function applyVars(primary: string | null, accent: string | null) {
  const root = document.documentElement;
  if (primary) {
    root.style.setProperty("--brand-primary", primary);
    // Also override the Stevie palette tokens so components that still
    // use ``bg-stevie-green`` etc. inherit the org's brand without
    // every admin/portal page being migrated to ``bg-brand-primary``.
    // Marketing-site pages (``/``, ``/book``) don't render the
    // injector, so they keep the original Stevie green.
    root.style.setProperty("--stevie-green", primary);
    root.style.setProperty("--stevie-green-light", primary);
    root.style.setProperty("--accent", primary);
  } else {
    root.style.removeProperty("--brand-primary");
    root.style.removeProperty("--stevie-green");
    root.style.removeProperty("--stevie-green-light");
    root.style.removeProperty("--accent");
  }
  if (accent) {
    root.style.setProperty("--brand-accent", accent);
    root.style.setProperty("--stevie-orange", accent);
  } else {
    root.style.removeProperty("--brand-accent");
    root.style.removeProperty("--stevie-orange");
  }
}

export default function BrandStyleInjector({ slug }: { slug?: string }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (slug) {
          const data = await apiFetch<PublicBranding>(
            `/api/public/branding/${encodeURIComponent(slug)}`,
          );
          if (!cancelled) applyVars(data.primary_color, data.accent_color);
        } else {
          const data = await apiFetch<OrganizationSettings>(`/api/settings`);
          const primary =
            (data.settings?.brand_primary_color as string | undefined) ?? null;
          const accent =
            (data.settings?.brand_accent_color as string | undefined) ?? null;
          if (!cancelled) applyVars(primary, accent);
        }
      } catch {
        // Non-fatal — fall back to whatever the static theme defines.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return null;
}
