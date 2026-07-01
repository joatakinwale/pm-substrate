"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  createClient,
  hasSupabaseBrowserConfig,
} from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";

/**
 * HTTP heartbeat + SSE-driven org-wide online presence.
 *
 * This is a different system from `use-presence.ts` (which is per-entity
 * Supabase Realtime presence). This hook tracks who in the org is online
 * right now, regardless of which page they're on, and is meant to be
 * mounted ONCE in the admin layout.
 *
 * Wire-up:
 *   - Heartbeat: POST /api/presence/heartbeat every 30s while the tab is
 *     foregrounded.
 *   - Offline beacon: POST /api/presence/offline on tab unload via
 *     `navigator.sendBeacon` so other clients drop our avatar within
 *     seconds. Falls back to fetch+keepalive if sendBeacon is missing.
 *   - SSE: subscribes to the existing useRealtime stream and accumulates
 *     `presence.online` / `presence.offline` events into a Map keyed by
 *     user_id.
 */

export interface OnlineUser {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string | null;
}

interface UseOnlinePresenceReturn {
  onlineUsers: OnlineUser[];
  myUserId: string | null;
}

const HEARTBEAT_MS = 30_000;
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<Record<string, string>> {
  let accessToken: string | undefined;
  if (hasSupabaseBrowserConfig()) {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    accessToken = session?.access_token;
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }
  return headers;
}

async function postHeartbeat(): Promise<void> {
  try {
    const headers = await getAuthHeaders();
    await fetch(`${API_URL}/api/presence/heartbeat`, {
      method: "POST",
      headers,
      // No body required; backend reads identity from JWT.
      body: "{}",
    });
  } catch {
    // Heartbeat failure is non-fatal — next interval will retry.
  }
}

function postOfflineBeacon(token: string | undefined): void {
  if (!token) return;
  const url = `${API_URL}/api/presence/offline`;
  // sendBeacon can't set headers, so we encode the token in a Blob with
  // a JSON body. The backend MUST also accept a Bearer header for the
  // fetch fallback path. To keep things simple here, we send via fetch
  // with keepalive when sendBeacon won't work for auth.
  const body = JSON.stringify({});
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
    // We tunnel the token in a header-shaped blob the backend accepts.
    // If the backend requires Authorization on this endpoint too, the
    // fetch+keepalive fallback below handles it. sendBeacon is best-
    // effort either way.
    try {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(`${url}?token=${encodeURIComponent(token)}`, blob);
      if (sent) return;
    } catch {
      // fall through to fetch
    }
  }
  // Fallback — keepalive lets the request finish after page unload.
  try {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort
  }
}

export function useOnlinePresence(): UseOnlinePresenceReturn {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const authConfigured = hasSupabaseBrowserConfig();
  // Live Map of user_id → OnlineUser. We mirror it into state via setOnlineUsers
  // whenever it mutates so React re-renders.
  const usersRef = useRef<Map<string, OnlineUser>>(new Map());
  const tokenRef = useRef<string | null>(null);

  // Resolve current user identity once.
  useEffect(() => {
    if (!authConfigured) return;

    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (cancelled) return;
      tokenRef.current = session?.access_token ?? null;
      const uid = session?.user?.id;
      if (uid) setMyUserId(String(uid));
    })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authConfigured]);

  // Heartbeat loop + unload beacon.
  useEffect(() => {
    if (!authConfigured) return;

    // Fire immediately on mount, then every 30s.
    postHeartbeat();
    const interval = setInterval(postHeartbeat, HEARTBEAT_MS);

    function handleVisibility() {
      if (document.visibilityState === "hidden") {
        postOfflineBeacon(tokenRef.current ?? undefined);
      } else if (document.visibilityState === "visible") {
        // Re-announce when tab comes back.
        postHeartbeat();
      }
    }
    function handlePageHide() {
      postOfflineBeacon(tokenRef.current ?? undefined);
    }

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("pagehide", handlePageHide);
      // Best-effort offline ping on unmount.
      postOfflineBeacon(tokenRef.current ?? undefined);
    };
  }, [authConfigured]);

  // Snapshot helper — sorts so the current user is first, then by name.
  const snapshot = useCallback((): OnlineUser[] => {
    return [...usersRef.current.values()].sort((a, b) => {
      const an = a.full_name || a.email || "";
      const bn = b.full_name || b.email || "";
      return an.localeCompare(bn);
    });
  }, []);

  // SSE subscription. We piggy-back on the existing useRealtime hook's
  // onAny channel so we don't need to modify the hook.
  useRealtime(
    {
      onAny: (event) => {
        if (event.event === "presence.online") {
          const p = event.payload as Partial<OnlineUser> & { user_id?: string };
          if (!p?.user_id) return;
          const next: OnlineUser = {
            user_id: String(p.user_id),
            full_name: typeof p.full_name === "string" ? p.full_name : "",
            email: typeof p.email === "string" ? p.email : "",
            avatar_url: typeof p.avatar_url === "string" ? p.avatar_url : null,
            role: typeof p.role === "string" ? p.role : null,
          };
          usersRef.current.set(next.user_id, next);
          setOnlineUsers(snapshot());
        } else if (event.event === "presence.offline") {
          const p = event.payload as { user_id?: string };
          if (!p?.user_id) return;
          if (usersRef.current.delete(String(p.user_id))) {
            setOnlineUsers(snapshot());
          }
        }
      },
    },
    { enabled: authConfigured }
  );

  return { onlineUsers, myUserId };
}
