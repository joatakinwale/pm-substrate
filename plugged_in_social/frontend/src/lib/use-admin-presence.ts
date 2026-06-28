"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePresence, type PresenceUser } from "@/lib/use-presence";

/**
 * Convenience wrapper around usePresence that auto-fetches the current
 * Supabase user. Designed for /admin/* pages where we already know the
 * session exists (layout enforces it server-side) and we just need the
 * identity for the presence payload.
 *
 * Returns the same shape as usePresence, plus a nullable `self` in case
 * a caller wants to render the current user in the stack too.
 */

interface UseAdminPresenceOptions {
  /** Channel suffix (no `presence:` prefix). Pass null/undefined to disable. */
  channel: string | null | undefined;
  enabled?: boolean;
}

interface UseAdminPresenceReturn {
  others: PresenceUser[];
  update: (patch: Partial<Pick<PresenceUser, "cursor" | "focus">>) => void;
  connected: boolean;
  self: Pick<PresenceUser, "user_id" | "email" | "name" | "avatar_url"> | null;
}

export function useAdminPresence(opts: UseAdminPresenceOptions): UseAdminPresenceReturn {
  const { channel, enabled = true } = opts;
  const [self, setSelf] = useState<UseAdminPresenceReturn["self"]>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getUser().then((res: { data: { user: Record<string, unknown> | null } }) => {
      if (cancelled) return;
      const u = res.data.user;
      if (!u) {
        setSelf(null);
        return;
      }
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const email = typeof u.email === "string" ? u.email : "";
      const name =
        (typeof meta.full_name === "string" && meta.full_name) ||
        (typeof meta.name === "string" && meta.name) ||
        email.split("@")[0] ||
        "User";
      const avatar_url =
        (typeof meta.avatar_url === "string" && meta.avatar_url) || null;
      setSelf({
        user_id: String(u.id),
        email,
        name,
        avatar_url,
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const presence = usePresence({
    channel: channel ?? "",
    user: self,
    enabled: enabled && !!channel && !!self,
  });

  return { ...presence, self };
}
