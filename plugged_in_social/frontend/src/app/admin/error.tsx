"use client";

/**
 * FE-32: Admin-scoped error boundary.
 *
 * Sits below `/admin/layout.tsx`, so when an admin page throws, only the
 * page content area crashes — AdminSidebar stays mounted and the user
 * can still navigate to other admin sections without a full reload.
 *
 * Intentionally minimal: admin users are internal and can tolerate
 * sparser UX. The `digest` reference is valuable here because internal
 * users can surface it to engineering directly, skipping the support
 * ticket round-trip.
 *
 * Note: admin layout is a server component that runs Supabase auth
 * before this boundary can catch anything. If auth fails, the layout
 * redirects to /login before rendering — so this boundary only sees
 * errors thrown AFTER successful auth, which means we don't need to
 * re-check auth here.
 */

import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin route error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh] py-12">
      <div className="max-w-md w-full bg-white rounded-2xl border border-border p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-stevie-orange/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6 text-stevie-orange" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Something broke here.</h2>
        <p className="text-sm text-muted-foreground mb-6">
          This admin page hit a runtime error. Other sections should still
          work — try reloading or jump to a different tab in the sidebar.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70 mb-6">
            Ref:{" "}
            <code className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">
              {error.digest}
            </code>
          </p>
        )}
        {error.message && process.env.NODE_ENV === "development" && (
          <pre className="text-xs text-left bg-gray-50 p-3 rounded-lg mb-6 overflow-auto max-h-40 text-muted-foreground">
            {error.message}
          </pre>
        )}
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
        >
          <RotateCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
