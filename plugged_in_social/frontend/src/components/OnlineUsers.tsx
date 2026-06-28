"use client";

import { useOnlinePresence, type OnlineUser } from "@/lib/use-online-presence";

/**
 * Org-wide online presence widget. Mounts once in the admin layout and
 * pulls its data from `useOnlinePresence`. Renders a horizontal stack of
 * up to 5 avatars, with a "+N more" chip for overflow.
 *
 * Visual contract matches PresenceAvatarStack (per-entity presence) for
 * consistency: ring, green dot, deterministic color fallback.
 */

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

const MAX_VISIBLE = 5;

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

function tooltipFor(u: OnlineUser): string {
  const name = u.full_name || u.email || "Unknown";
  if (u.role) return `${name} — ${u.role}`;
  return name;
}

export default function OnlineUsers() {
  const { onlineUsers, myUserId } = useOnlinePresence();

  if (onlineUsers.length === 0) return null;

  // Surface the current user first so the dimmed self-avatar stays
  // anchored on the left of the stack.
  const sorted = [...onlineUsers].sort((a, b) => {
    if (a.user_id === myUserId) return -1;
    if (b.user_id === myUserId) return 1;
    return (a.full_name || a.email).localeCompare(b.full_name || b.email);
  });

  const visible = sorted.slice(0, MAX_VISIBLE);
  const overflow = sorted.length - visible.length;

  return (
    <div
      className="flex items-center"
      aria-label={`${sorted.length} user${sorted.length === 1 ? "" : "s"} online`}
    >
      <div className="flex -space-x-2">
        {visible.map((u) => {
          const isSelf = u.user_id === myUserId;
          const colorClass =
            AVATAR_COLORS[hashString(u.user_id) % AVATAR_COLORS.length];
          const initials = initialsOf(u.full_name, u.email);
          return (
            <div
              key={u.user_id}
              title={isSelf ? `${tooltipFor(u)} (you)` : tooltipFor(u)}
              className={`relative ${isSelf ? "opacity-60" : ""}`}
            >
              {u.avatar_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={u.avatar_url}
                  alt={u.full_name || u.email}
                  className="w-7 h-7 rounded-full ring-2 ring-white object-cover"
                />
              ) : (
                <div
                  className={`w-7 h-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-semibold text-white ${colorClass}`}
                >
                  {initials}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-green-500 ring-2 ring-white" />
            </div>
          );
        })}
        {overflow > 0 && (
          <div
            className="w-7 h-7 rounded-full ring-2 ring-white bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-semibold"
            title={sorted
              .slice(MAX_VISIBLE)
              .map((u) => u.full_name || u.email)
              .join(", ")}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  );
}
