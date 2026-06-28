"use client";

import { useMemo } from "react";
import type { PresenceUser } from "@/lib/use-presence";

/**
 * Small avatar stack showing who else is currently viewing/editing the
 * same entity. Renders nothing when no one else is present — keeps the UI
 * quiet in single-user workflows.
 *
 * Visual: overlapping circles (max 4 shown, +N badge for overflow), colored
 * initials fallback when no avatar_url. Hover any avatar to see full name.
 */

interface PresenceAvatarStackProps {
  users: PresenceUser[];
  /** How many avatars to render before collapsing to +N. Default 4. */
  max?: number;
  /** Optional label prefix, e.g. "Also here:" or "Viewing:". */
  label?: string;
  className?: string;
}

// Deterministic color from user_id — so the same user always gets the same
// color across the app. Hand-picked so it works on the admin gray background.
const AVATAR_COLORS = [
  "bg-stevie-sky",
  "bg-stevie-lavender",
  "bg-stevie-chartreuse",
  "bg-stevie-orange",
  "bg-stevie-green",
  "bg-purple-400",
  "bg-pink-400",
  "bg-teal-400",
  "bg-amber-400",
  "bg-indigo-400",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initialsOf(name: string, email: string): string {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

export default function PresenceAvatarStack({
  users,
  max = 4,
  label,
  className,
}: PresenceAvatarStackProps) {
  const sorted = useMemo(
    () => [...users].sort((a, b) => a.joined_at.localeCompare(b.joined_at)),
    [users]
  );

  if (sorted.length === 0) return null;

  const visible = sorted.slice(0, max);
  const overflow = sorted.length - visible.length;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {label && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      )}
      <div className="flex -space-x-2" aria-label={`${sorted.length} other user${sorted.length === 1 ? "" : "s"} present`}>
        {visible.map((u) => {
          const colorClass = AVATAR_COLORS[hashString(u.user_id) % AVATAR_COLORS.length];
          const initials = initialsOf(u.name, u.email);
          return (
            <div
              key={u.user_id}
              title={`${u.name}${u.email ? ` · ${u.email}` : ""}`}
              className="relative"
            >
              {u.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.avatar_url}
                  alt={u.name}
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-semibold text-white ${colorClass}`}
                >
                  {initials}
                </div>
              )}
              {/* Green dot indicating live presence */}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 ring-2 ring-white" />
            </div>
          );
        })}
        {overflow > 0 && (
          <div
            className="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-semibold"
            title={sorted.slice(max).map((u) => u.name).join(", ")}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
