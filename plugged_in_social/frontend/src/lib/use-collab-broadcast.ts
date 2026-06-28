"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

/**
 * Supabase Realtime broadcast hook for last-writer-wins co-editing.
 *
 * Scope (Phase 1): when two editors open the same resource, each keystroke
 * is debounced into a broadcast payload, and remote broadcasts are applied
 * to the local form state. This is intentionally NOT a CRDT — concurrent
 * edits to the same field get resolved by "last writer wins" on arrival
 * order, and the apiFetch ConflictResolutionDialog handles the final save
 * race. A full CRDT (Y.js) is a later track.
 *
 * The channel is `collab:{channel}` (e.g. "collab:post:42"). Payloads
 * include the sender's `user_id` so subscribers filter out their own echo.
 * There is no server-side persistence — broadcasts are ephemeral. The
 * authoritative state still flows through the REST API + optimistic
 * locking.
 *
 * Why debounce here and not at the caller:
 *   - Keystroke fan-out is expensive on free-tier Supabase Realtime.
 *   - Each editor already triggers onUpdate per keystroke; we'd otherwise
 *     hammer the channel. A small flush window (default 150ms) reduces
 *     traffic without making live-typing feel laggy.
 *
 * Usage:
 *   const { broadcast, connected } = useCollabBroadcast<{ title: string }>({
 *     channel: `post:${post.id}`,
 *     userId: self?.user_id ?? null,
 *     onRemote: (patch) => setForm((f) => ({ ...f, ...patch })),
 *   });
 *   // wire local edits:
 *   onChange={(e) => { setForm(...); broadcast({ title: e.target.value }); }}
 */

export interface CollabBroadcastMeta {
  /** Supabase user_id of the sender. */
  from: string;
  /** ISO timestamp stamped by the sender. */
  at: string;
}

interface UseCollabBroadcastOptions<T extends Record<string, unknown>> {
  /** Channel suffix — full topic becomes `collab:${channel}`. */
  channel: string | null | undefined;
  /** Current user id. Broadcasts from this id are filtered out on receive. */
  userId: string | null | undefined;
  /** Apply a remote patch to local state. Called only for OTHER users. */
  onRemote: (patch: Partial<T>, meta: CollabBroadcastMeta) => void;
  /** Set false to opt out. Default true. */
  enabled?: boolean;
  /** Debounce window in ms. Default 150ms. */
  debounceMs?: number;
}

interface UseCollabBroadcastReturn<T extends Record<string, unknown>> {
  /**
   * Queue a patch to broadcast. Multiple calls within debounceMs are
   * merged into a single outgoing payload. Safe to call before SUBSCRIBED
   * — payloads are flushed once the channel connects.
   */
  broadcast: (patch: Partial<T>) => void;
  /** True once SUBSCRIBED. */
  connected: boolean;
}

const EVENT_NAME = "edit";

export function useCollabBroadcast<T extends Record<string, unknown>>(
  opts: UseCollabBroadcastOptions<T>
): UseCollabBroadcastReturn<T> {
  const {
    channel: channelSuffix,
    userId,
    onRemote,
    enabled = true,
    debounceMs = 150,
  } = opts;

  const [connected, setConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingRef = useRef<Partial<T>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // onRemote is user-supplied and often captured from render; keep it ref'd
  // so our effect doesn't rebuild the channel every render.
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;

  useEffect(() => {
    if (!enabled || !channelSuffix || !userId) {
      setConnected(false);
      return;
    }

    const supabase = createClient();
    const topic = `collab:${channelSuffix}`;

    // `self: false` prevents Supabase from echoing our own broadcasts back
    // to us — avoids a pointless round-trip and guards against self-echo
    // overwriting local state.
    const ch = supabase.channel(topic, {
      config: { broadcast: { self: false } },
    });

    ch.on(
      "broadcast",
      { event: EVENT_NAME },
      (message: { payload?: unknown }) => {
        const p = message?.payload;
        if (!p || typeof p !== "object") return;
        const payload = p as {
          from?: unknown;
          at?: unknown;
          patch?: unknown;
        };
        const from = typeof payload.from === "string" ? payload.from : null;
        if (!from || from === userId) return;
        const at = typeof payload.at === "string" ? payload.at : new Date().toISOString();
        const patch = (payload.patch && typeof payload.patch === "object"
          ? payload.patch
          : null) as Partial<T> | null;
        if (!patch) return;
        onRemoteRef.current(patch, { from, at });
      }
    );

    ch.subscribe((status: string) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        // If we queued anything before connecting, flush it now.
        if (Object.keys(pendingRef.current).length > 0) {
          flushNow();
        }
      } else if (
        status === "CHANNEL_ERROR" ||
        status === "TIMED_OUT" ||
        status === "CLOSED"
      ) {
        setConnected(false);
      }
    });

    channelRef.current = ch;

    return () => {
      setConnected(false);
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      pendingRef.current = {};
      supabase.removeChannel(ch).catch(() => {});
      channelRef.current = null;
    };
    // Intentionally not depending on onRemote — it's captured via ref to
    // prevent channel teardown on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelSuffix, userId, enabled]);

  const flushNow = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const ch = channelRef.current;
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (!ch || !userId || Object.keys(patch).length === 0) return;
    ch.send({
      type: "broadcast",
      event: EVENT_NAME,
      payload: {
        from: userId,
        at: new Date().toISOString(),
        patch,
      },
    }).catch(() => {
      // Channel may have torn down mid-flush. Drop the payload rather
      // than retry — the next keystroke will re-broadcast.
    });
  }, [userId]);

  const broadcast = useCallback(
    (patch: Partial<T>) => {
      if (!enabled || !channelSuffix || !userId) return;
      pendingRef.current = { ...pendingRef.current, ...patch };
      if (flushTimerRef.current) return; // already scheduled
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushNow();
      }, debounceMs);
    },
    [enabled, channelSuffix, userId, debounceMs, flushNow]
  );

  return { broadcast, connected };
}
