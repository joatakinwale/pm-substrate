"use client";

import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import type { EditingUser } from "@/lib/use-editing";

/**
 * Amber "currently editing" banner. Renders nothing when no other editors
 * are present, so it can be sprinkled across edit views without padding
 * around it.
 */

interface EditingBannerProps {
  editors: EditingUser[];
}

function relativeTime(fromMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (diffSec < 30) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

function displayName(u: EditingUser): string {
  return u.full_name?.trim() || u.email?.trim() || "Someone";
}

export default function EditingBanner({ editors }: EditingBannerProps) {
  // Live "X min ago" — re-render once a minute so the label stays fresh
  // without per-keystroke churn.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (editors.length === 0) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [editors.length]);

  if (editors.length === 0) return null;

  // Sort newest-first so the most recent editor anchors the banner copy.
  const sorted = [...editors].sort((a, b) => b.started_at - a.started_at);
  const primary = sorted[0];
  const others = sorted.length - 1;
  const updated = relativeTime(primary.started_at, now);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm"
      role="status"
    >
      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
      <div className="flex-1 min-w-0">
        {others === 0 ? (
          <p>
            <span className="font-semibold">{displayName(primary)}</span>{" "}
            is editing this — last updated {updated}.
          </p>
        ) : (
          <p>
            <span className="font-semibold">{displayName(primary)}</span>{" "}
            and {others} other{others === 1 ? "" : "s"} are editing this — last
            updated {updated}.
          </p>
        )}
      </div>
    </div>
  );
}
