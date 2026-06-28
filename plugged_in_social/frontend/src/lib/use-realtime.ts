"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Real-time event hook using Server-Sent Events.
 *
 * Connects to the sse-pubsub Cloudflare Worker
 * (`${NEXT_PUBLIC_SSE_PUBSUB_URL}/subscribe/{org_id}`) and dispatches
 * events to registered handlers. Automatically reconnects on disconnect.
 *
 * The Worker authenticates using the Supabase JWT (passed as a `?token=`
 * query param because native EventSource cannot set custom headers) and
 * verifies the URL `{org_id}` matches `app_metadata.org_id` on the JWT.
 *
 * Usage:
 *   const { connected, lastEvent } = useRealtime({
 *     onTaskMoved: (payload) => { refetchTasks(); },
 *     onTaskUpdated: (payload) => { updateTaskInPlace(payload); },
 *   });
 */

interface RealtimeEvent {
  event: string;
  entity_type?: string;
  entity_id?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

interface RealtimeHandlers {
  onTaskMoved?: (payload: Record<string, unknown>) => void;
  onTaskUpdated?: (payload: Record<string, unknown>) => void;
  onTaskCreated?: (payload: Record<string, unknown>) => void;
  onTaskDeleted?: (payload: Record<string, unknown>) => void;
  onProjectUpdated?: (payload: Record<string, unknown>) => void;
  onAny?: (event: RealtimeEvent) => void;
}

interface UseRealtimeOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useRealtime(
  handlers: RealtimeHandlers,
  options: UseRealtimeOptions = {}
) {
  const { projectId, enabled = true } = options;
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handlersRef = useRef(handlers);

  // Keep handlers ref current without re-triggering effect
  handlersRef.current = handlers;

  const connect = useCallback(async () => {
    if (!enabled) return;

    // Resolve the live Supabase session — the Worker needs both the
    // access token (as ?token=) and the user's org_id (in the URL path).
    // We read from the same browser client used everywhere else so that
    // sign-out / token refresh stays consistent across the app.
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    const orgId = (session?.user?.app_metadata as { org_id?: string } | undefined)
      ?.org_id;
    if (!token || !orgId) return;

    const pubsubBase = process.env.NEXT_PUBLIC_SSE_PUBSUB_URL;
    if (!pubsubBase) return;

    // Migrated 2026-05-01 from /api/events/stream → sse-pubsub Worker (Path B+).
    const url = `${pubsubBase}/subscribe/${encodeURIComponent(orgId)}?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnected(true);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    es.onmessage = (e) => {
      try {
        const event: RealtimeEvent = JSON.parse(e.data);
        setLastEvent(event);

        // Filter by project if specified
        if (
          projectId &&
          event.payload?.project_id &&
          event.payload.project_id !== projectId
        ) {
          return;
        }

        // Dispatch to handlers
        const h = handlersRef.current;
        switch (event.event) {
          case "task.moved":
            h.onTaskMoved?.(event.payload);
            break;
          case "task.updated":
            h.onTaskUpdated?.(event.payload);
            break;
          case "task.created":
            h.onTaskCreated?.(event.payload);
            break;
          case "task.deleted":
            h.onTaskDeleted?.(event.payload);
            break;
          case "project.updated":
            h.onProjectUpdated?.(event.payload);
            break;
        }

        h.onAny?.(event);
      } catch {
        // Ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;

      // Reconnect with exponential backoff
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };
  }, [enabled, projectId]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return { connected, lastEvent };
}
