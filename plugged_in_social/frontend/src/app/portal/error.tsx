"use client";

/**
 * FE-32: Portal-scoped error boundary.
 *
 * Sits below `/portal/layout.tsx`. Catches runtime errors in portal pages
 * — typically from portalFetch failures (network, 5xx) or render-time
 * throws in portal components. 401s are already handled specially by
 * portalFetch (throws PortalAuthError, caller redirects to /auth).
 *
 * Preserves the portal top-nav chrome so the user can still navigate to
 * Approvals, Invoices, Proposals even if one tab is broken. That's the
 * point of scoped error boundaries — partial failure, not full outage.
 *
 * Copy is deliberately plainer than the public error.tsx: portal users
 * are existing clients, not prospects, so brand-flavoured copy would
 * feel off. Direct and calm is better.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RotateCw } from "lucide-react";

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portal route error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl border border-border p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-stevie-orange/10 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-6 h-6 text-stevie-orange" />
        </div>
        <h2 className="text-xl font-semibold mb-2">
          We couldn&apos;t load this.
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Something went wrong on our end. Try again, or use the nav above
          to jump to a different section.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70 mb-6">
            Ref:{" "}
            <code className="font-mono bg-gray-50 px-1.5 py-0.5 rounded">
              {error.digest}
            </code>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-stevie-green text-white text-sm font-semibold hover:bg-stevie-green-light transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/portal"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full border-2 border-foreground text-foreground text-sm font-semibold hover:bg-foreground hover:text-white transition-colors"
          >
            Portal home
          </Link>
        </div>
      </div>
    </div>
  );
}
