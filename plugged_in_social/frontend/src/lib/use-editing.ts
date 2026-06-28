"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useRealtime } from "@/lib/use-realtime";

/**
 * "Currently editing" hook for entity edit pages.
 *
 * Posts a started/stopped lifecycle to `/api/presence/editing` and listens
 * for `entity.editing` SSE events. The returned `othersEditing` list is
 * scoped to (entityType, entityId) and excludes the current user.
 *
 * Mount the hook on the edit view; it auto-fires `notifyStarted` on mount
 * and `notifyStopped` on unmount (via sendBeacon for unmount reliability).
 * The exposed `notifyStarted` / `notifyStopped` are escape hatches for
 * cases where the entity scope changes mid-component (e.g. switching
 * blocks within a single proposal route).
 */

export type EditableEntityType =
  | "page"
  | "proposal"
  | "blog_post"
  | "automation"
  | "campaign"
  | "form";

export interface EditingUser {
  user_id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string | null;
  /** Wall-clock timestamp (ms) when the started event arrived. */
  started_at: number;
}

interface UseEditingReturn {
  othersEditing: EditingUser[];
  notifyStarted: () => void;
  notifyStopped: () => void;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function getAuthHeaders(): Promise<{
  headers: Record<string, string>;
  token: string | null;
}> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }
  return { headers, token: session?.access_token ?? null };
}

async function postEditing(
  entityType: string,
  entityId: string,
  action: "started" | "stopped"
): Promise<void> {
  try {
    const { headers } = await getAuthHeaders();
    await fetch(`${API_URL}/api/presence/editing`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        entity_type: entityType,
        entity_id: entityId,
        action,
      }),
    });
  } catch {
    // best-effort
  }
}

function postEditingBeacon(
  entityType: string,
  entityId: string,
  action: "started" | "stopped",
  token: string | null
): void {
  const url = `${API_URL}/api/presence/editing`;
  const body = JSON.stringify({
    entity_type: entityType,
    entity_id: entityId,
    action,
  });
  if (typeof navigator !== "undefined" && "sendBeacon" in navigator && token) {
    try {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(
        `${url}?token=${encodeURIComponent(token)}`,
        blob
      );
      if (sent) return;
    } catch {
      // fall through
    }
  }
  try {
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // best-effort
  }
}

export function useEditing(
  entityType: EditableEntityType,
  entityId: string | null | undefined
): UseEditingReturn {
  const [othersEditing, setOthersEditing] = useState<EditingUser[]>([]);
  const editorsRef = useRef<Map<string, EditingUser>>(new Map());
  const myUserIdRef = useRef<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  // Resolve identity once.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
      if (cancelled) return;
      tokenRef.current = session?.access_token ?? null;
      myUserIdRef.current = session?.user?.id ?? null;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Reset on entity change so stale editors don't bleed across switches.
  useEffect(() => {
    editorsRef.current = new Map();
    setOthersEditing([]);
  }, [entityType, entityId]);

  const snapshot = useCallback((): EditingUser[] => {
    return [...editorsRef.current.values()].sort(
      (a, b) => a.started_at - b.started_at
    );
  }, []);

  // Auto started/stopped lifecycle. We cache a token for the unmount
  // beacon path so it's available even after the component starts to
  // tear down.
  useEffect(() => {
    if (!entityId) return;
    let active = true;

    // Resolve a fresh token alongside the started post — keeps the
    // beacon path unblocked on the unmount that follows.
    (async () => {
      const { token } = await getAuthHeaders();
      if (!active) return;
      tokenRef.current = token;
      await postEditing(entityType, entityId, "started");
    })();

    return () => {
      active = false;
      // Use sendBeacon for the unmount path — fetch from a teardown
      // would otherwise be cancelled when the route unmounts.
      postEditingBeacon(entityType, entityId, "stopped", tokenRef.current);
    };
  }, [entityType, entityId]);

  // Manual escape hatches.
  const notifyStarted = useCallback(() => {
    if (!entityId) return;
    postEditing(entityType, entityId, "started");
  }, [entityType, entityId]);

  const notifyStopped = useCallback(() => {
    if (!entityId) return;
    // Use beacon here too — callers usually fire this right before
    // navigating away.
    postEditingBeacon(entityType, entityId, "stopped", tokenRef.current);
  }, [entityType, entityId]);

  // SSE subscription via the existing useRealtime hook's onAny channel.
  useRealtime(
    {
      onAny: (event) => {
        if (event.event !== "entity.editing") return;
        if (!entityId) return;
        const p = event.payload as {
          entity_type?: string;
          entity_id?: string;
          user_id?: string;
          full_name?: string;
          email?: string;
          avatar_url?: string | null;
          role?: string | null;
          action?: "started" | "stopped";
        };
        if (p.entity_type !== entityType) return;
        if (String(p.entity_id) !== String(entityId)) return;
        if (!p.user_id) return;
        // Always exclude self.
        if (myUserIdRef.current && String(p.user_id) === myUserIdRef.current) return;

        if (p.action === "started") {
          editorsRef.current.set(String(p.user_id), {
            user_id: String(p.user_id),
            full_name: p.full_name ?? "",
            email: p.email ?? "",
            avatar_url: p.avatar_url ?? null,
            role: p.role ?? null,
            started_at: Date.now(),
          });
          setOthersEditing(snapshot());
        } else if (p.action === "stopped") {
          if (editorsRef.current.delete(String(p.user_id))) {
            setOthersEditing(snapshot());
          }
        }
      },
    },
    {}
  );

  return { othersEditing, notifyStarted, notifyStopped };
}
