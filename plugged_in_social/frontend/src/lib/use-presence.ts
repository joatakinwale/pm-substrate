"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime presence hook.
 *
 * Subscribes to a channel keyed by entity (e.g. `presence:page:123`) and
 * broadcasts the current user's identity. Returns the list of OTHER users
 * currently subscribed to the same channel.
 *
 * Design notes:
 * - One channel per (entity_type, entity_id) pair — this isolates presence
 *   so viewers of different pages/projects don't leak into each other.
 * - Self is filtered out client-side. The server still sees the full state
 *   via the `sync` event but we only render `others`.
 * - Updates to `update()` are debounced by the caller (e.g. cursor move).
 *
 * Usage:
 *   const { others, update, connected } = usePresence({
 *     channel: `page:${pageId}`,
 *     user: { id, email, name, avatar_url },
 *   });
 */

export interface PresenceUser {
  user_id: string;
  email: string;
  name: string;
  avatar_url?: string | null;
  joined_at: string;
  /** Optional — set by cursor-move handlers for future collaborative editing */
  cursor?: { x: number; y: number } | null;
  /** Optional — which field/section the user is focused on */
  focus?: string | null;
}

interface UsePresenceOptions {
  /** Channel suffix — e.g. "page:123" or "project:abc". Full channel will be `presence:${channel}`. */
  channel: string;
  /** The current user's identity. If null/undefined, presence is disabled. */
  user: Pick<PresenceUser, "user_id" | "email" | "name" | "avatar_url"> | null | undefined;
  /** Set false to opt out (e.g. for single-user orgs). Default true. */
  enabled?: boolean;
}

interface UsePresenceReturn {
  /** Users present on the channel, excluding self. */
  others: PresenceUser[];
  /** Mutate the tracked payload (e.g. after cursor move). Safe to call even before subscribed. */
  update: (patch: Partial<Pick<PresenceUser, "cursor" | "focus">>) => void;
  /** True once SUBSCRIBED. */
  connected: boolean;
}

export function usePresence(opts: UsePresenceOptions): UsePresenceReturn {
  const { channel: channelSuffix, user, enabled = true } = opts;

  const [others, setOthers] = useState<PresenceUser[]>([]);
  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const payloadRef = useRef<PresenceUser | null>(null);

  // Stable identity: only rebuild the channel when user_id or channel changes.
  const userId = user?.user_id;
  const email = user?.email;
  const name = user?.name;
  const avatarUrl = user?.avatar_url;

  useEffect(() => {
    if (!enabled || !userId || !channelSuffix) {
      setConnected(false);
      setOthers([]);
      return;
    }

    const supabase = createClient();
    const topic = `presence:${channelSuffix}`;

    const ch = supabase.channel(topic, {
      config: { presence: { key: userId } },
    });

    const initialPayload: PresenceUser = {
      user_id: userId,
      email: email ?? "",
      name: name ?? email ?? "Unknown",
      avatar_url: avatarUrl ?? null,
      joined_at: new Date().toISOString(),
      cursor: null,
      focus: null,
    };
    payloadRef.current = initialPayload;

    const handleSync = () => {
      const state = ch.presenceState() as Record<string, Array<Record<string, unknown>>>;
      // state: { [key]: Array<payload> } — we key by user_id so the
      // inner array is usually length 1. Dedupe by user_id and exclude self.
      const seen = new Set<string>();
      const collected: PresenceUser[] = [];
      for (const key of Object.keys(state)) {
        if (key === userId) continue;
        const entries = state[key] ?? [];
        for (const entry of entries) {
          const uid = typeof entry?.user_id === "string" ? entry.user_id : null;
          if (!uid || seen.has(uid)) continue;
          seen.add(uid);
          collected.push(entry as unknown as PresenceUser);
        }
      }
      setOthers(collected);
    };

    ch.on("presence", { event: "sync" }, handleSync);
    ch.on("presence", { event: "join" }, handleSync);
    ch.on("presence", { event: "leave" }, handleSync);

    ch.subscribe(async (status: string) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        await ch.track(payloadRef.current);
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        setConnected(false);
      }
    });

    channelRef.current = ch;

    return () => {
      setConnected(false);
      setOthers([]);
      ch.untrack().catch(() => {});
      supabase.removeChannel(ch).catch(() => {});
      channelRef.current = null;
      payloadRef.current = null;
    };
  }, [channelSuffix, userId, email, name, avatarUrl, enabled]);

  const update = useCallback(
    (patch: Partial<Pick<PresenceUser, "cursor" | "focus">>) => {
      const ch = channelRef.current;
      const current = payloadRef.current;
      if (!ch || !current) return;
      const next: PresenceUser = { ...current, ...patch };
      payloadRef.current = next;
      // Supabase presence.track is idempotent — safe to call frequently.
      ch.track(next).catch(() => {});
    },
    []
  );

  return { others, update, connected };
}
