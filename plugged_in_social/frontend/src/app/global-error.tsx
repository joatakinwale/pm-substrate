"use client";

/**
 * FE-32: Global error boundary.
 *
 * This is the last-resort boundary — it catches errors thrown inside the
 * root layout itself (font loading, metadata generation, root script
 * injection). Because the root layout may be broken when this renders,
 * Next requires global-error.tsx to ship its OWN <html> and <body>.
 *
 * Keep styling inline — we can't rely on globals.css being parsed yet if
 * the error happened during layout compilation. This is intentionally
 * minimal: the user needs *something* on screen before they hit refresh.
 *
 * If error.tsx catches the error first (the common case), this file is
 * never rendered. It only fires when the root layout itself crashes.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error (root layout crash):", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, sans-serif",
          margin: 0,
          padding: "48px 24px",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#ffffff",
          color: "#000000",
        }}
      >
        <div style={{ maxWidth: 560, textAlign: "center" }}>
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              border: "2px solid #ff5229",
              color: "#ff5229",
              fontSize: 11,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: 24,
            }}
          >
            Critical error
          </div>
          <h1
            style={{
              fontSize: 40,
              lineHeight: 1.05,
              margin: "0 0 16px",
              letterSpacing: "-0.02em",
            }}
          >
            Stevie Social is down briefly.
          </h1>
          <p style={{ color: "#64748b", lineHeight: 1.6, margin: "0 0 32px" }}>
            Something broke before we could load the page. Refreshing usually
            fixes it — if not, please try again in a minute.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                color: "#94a3b8",
                margin: "0 0 24px",
              }}
            >
              Reference:{" "}
              <code style={{ fontFamily: "ui-monospace, monospace" }}>
                {error.digest}
              </code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "12px 24px",
              borderRadius: 9999,
              backgroundColor: "#089140",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
