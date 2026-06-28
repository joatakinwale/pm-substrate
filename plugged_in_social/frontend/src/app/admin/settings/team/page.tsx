"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  UserPlus,
  Shield,
  Trash2,
  RefreshCw,
  AlertCircle,
  ChevronLeft,
  Check,
  X,
  Mail,
} from "lucide-react";
import Link from "next/link";
import { apiFetch, ApiError } from "@/lib/api";
import { useAdminPresence } from "@/lib/use-admin-presence";
import PresenceAvatarStack from "@/components/presence/PresenceAvatarStack";

/**
 * /admin/settings/team — INVITES-1
 *
 * Lists org team members, lets owners/admins invite, change roles, and
 * deactivate/reactivate. Backend is already wired at /team (see backend/app/api/team.py).
 *
 * Presence is piggybacked on this page so two admins editing the team
 * see each other live (reuses CONCURRENT-1 plumbing).
 */

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string | null;
  permissions: { grants?: string[]; revokes?: string[] } | null;
}

interface MyPermissions {
  role: string;
  permissions: string[];
}

// Roles assignable via the team UI. CLIENT role is separate — it belongs
// to portal users, not org team members. Order matters: lowest → highest.
const ASSIGNABLE_ROLES = ["viewer", "editor", "admin", "owner"] as const;
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

const ROLE_BADGE: Record<string, string> = {
  owner: "bg-stevie-orange/10 text-stevie-orange",
  admin: "bg-stevie-green/10 text-stevie-green",
  editor: "bg-blue-50 text-blue-700",
  viewer: "bg-gray-100 text-gray-700",
  client: "bg-purple-50 text-purple-700",
};

export default function TeamManagementPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [me, setMe] = useState<MyPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState<AssignableRole>("viewer");
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<
    { type: "success" | "error"; text: string } | null
  >(null);

  // Per-row state: track which row is being mutated to disable its controls.
  const [busyId, setBusyId] = useState<string | null>(null);

  // Live presence on this page — lets another admin editing the team see you.
  const presence = useAdminPresence({ channel: "settings:team" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, myPerms] = await Promise.all([
        apiFetch<TeamMember[]>(
          `/team${showInactive ? "?include_inactive=true" : ""}`
        ),
        apiFetch<MyPermissions>("/team/me/permissions"),
      ]);
      setMembers(list);
      setMe(myPerms);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Failed to load team members."
      );
    } finally {
      setLoading(false);
    }
  }, [showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  const canInvite = me?.permissions.includes("team.invite") ?? false;
  const canManage = me?.permissions.includes("team.manage") ?? false;
  const canRemove = me?.permissions.includes("team.remove") ?? false;
  const isOwner = me?.role === "owner";

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteSending(true);
    setInviteMessage(null);
    try {
      const member = await apiFetch<TeamMember>("/team/invite", {
        method: "POST",
        body: JSON.stringify({
          email: inviteEmail,
          full_name: inviteName,
          role: inviteRole,
        }),
      });
      setMembers((prev) => [...prev, member].sort((a, b) =>
        a.full_name.localeCompare(b.full_name)
      ));
      setInviteMessage({
        type: "success",
        text: `Invite sent to ${member.email}.`,
      });
      setInviteEmail("");
      setInviteName("");
      setInviteRole("viewer");
    } catch (err) {
      setInviteMessage({
        type: "error",
        text: err instanceof ApiError ? err.message : "Invite failed.",
      });
    } finally {
      setInviteSending(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    setBusyId(userId);
    try {
      const updated = await apiFetch<TeamMember>(
        `/team/${userId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: newRole }),
        }
      );
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? updated : m))
      );
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to update role."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeactivate(userId: string) {
    if (!confirm("Deactivate this team member? They will lose access immediately.")) {
      return;
    }
    setBusyId(userId);
    try {
      const updated = await apiFetch<TeamMember>(
        `/team/${userId}/deactivate`,
        { method: "POST" }
      );
      if (showInactive) {
        setMembers((prev) =>
          prev.map((m) => (m.id === userId ? updated : m))
        );
      } else {
        setMembers((prev) => prev.filter((m) => m.id !== userId));
      }
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to deactivate member."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleReactivate(userId: string) {
    setBusyId(userId);
    try {
      const updated = await apiFetch<TeamMember>(
        `/team/${userId}/reactivate`,
        { method: "POST" }
      );
      setMembers((prev) =>
        prev.map((m) => (m.id === userId ? updated : m))
      );
    } catch (err) {
      alert(
        err instanceof ApiError
          ? err.message
          : "Failed to reactivate member."
      );
    } finally {
      setBusyId(null);
    }
  }

  async function handleResendInvite(userId: string, email: string) {
    setBusyId(userId);
    try {
      await apiFetch<TeamMember>(`/team/${userId}/resend-invite`, {
        method: "POST",
      });
      setInviteMessage({
        type: "success",
        text: `Fresh invite link sent to ${email}.`,
      });
    } catch (err) {
      setInviteMessage({
        type: "error",
        text:
          err instanceof ApiError
            ? err.message
            : "Failed to re-send invite.",
      });
    } finally {
      setBusyId(null);
    }
  }

  const currentUserId = me ? presence.self?.user_id ?? null : null;

  return (
    <div className="max-w-5xl">
      {/* Back to settings */}
      <div className="mb-4">
        <Link
          href="/admin/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Settings
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <h1 className="heading-brand text-3xl">Team</h1>
          <p className="text-muted-foreground mt-1">
            Manage who has access to your organization and what they can do.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PresenceAvatarStack
            users={presence.others}
            label="Also here:"
          />
          {canInvite && (
            <button
              onClick={() => setShowInvite((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Invite
            </button>
          )}
        </div>
      </div>

      {/* Invite form */}
      {showInvite && canInvite && (
        <section className="bg-white rounded-2xl border border-border p-6 mb-6">
          <h2 className="font-semibold text-lg mb-4">Invite a teammate</h2>
          <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green"
                placeholder="alex@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Full name
              </label>
              <input
                type="text"
                required
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green"
                placeholder="Alex Rivera"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AssignableRole)}
                className="w-full px-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green bg-white"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option
                    key={r}
                    value={r}
                    disabled={(r === "admin" || r === "owner") && !isOwner}
                  >
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                    {(r === "admin" || r === "owner") && !isOwner
                      ? " (owner only)"
                      : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3 flex items-center gap-3">
              <button
                type="submit"
                disabled={inviteSending}
                className="px-5 py-2.5 bg-stevie-green text-white text-sm font-semibold rounded-full hover:bg-stevie-green-light transition-colors disabled:opacity-60"
              >
                {inviteSending ? "Sending…" : "Send invite"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInvite(false);
                  setInviteMessage(null);
                }}
                className="px-5 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              {inviteMessage && (
                <div
                  className={`ml-auto flex items-center gap-2 text-sm ${
                    inviteMessage.type === "success"
                      ? "text-stevie-green"
                      : "text-stevie-orange"
                  }`}
                >
                  {inviteMessage.type === "success" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <AlertCircle className="w-4 h-4" />
                  )}
                  {inviteMessage.text}
                </div>
              )}
            </div>
          </form>
        </section>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 mb-4">
        <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="rounded border-border text-stevie-green focus:ring-stevie-green/30"
          />
          Show deactivated
        </label>
        <button
          onClick={load}
          className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Members table */}
      <section className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Loading team…
          </div>
        ) : error ? (
          <div className="p-6 flex items-center gap-2 text-stevie-orange text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        ) : members.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            No team members yet.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">
                  Member
                </th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">
                  Role
                </th>
                <th className="text-left font-medium text-muted-foreground px-5 py-3">
                  Status
                </th>
                <th className="text-right font-medium text-muted-foreground px-5 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isMe = currentUserId === m.id;
                const isOwnerRow = m.role === "owner";
                const canEditThisRow =
                  canManage && !isMe && (isOwner || !isOwnerRow);

                return (
                  <tr
                    key={m.id}
                    className={`border-b border-border last:border-b-0 ${
                      !m.is_active ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {m.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.avatar_url}
                            alt={m.full_name}
                            className="w-9 h-9 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-stevie-green/10 text-stevie-green flex items-center justify-center text-sm font-semibold">
                            {m.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-medium">
                            {m.full_name}
                            {isMe && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (you)
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {m.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {canEditThisRow ? (
                        <select
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.id, e.target.value)}
                          disabled={busyId === m.id}
                          className="px-2.5 py-1.5 border border-border rounded-md text-xs bg-white focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                        >
                          {ASSIGNABLE_ROLES.map((r) => (
                            <option
                              key={r}
                              value={r}
                              disabled={
                                (r === "admin" || r === "owner") && !isOwner
                              }
                            >
                              {r.charAt(0).toUpperCase() + r.slice(1)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                            ROLE_BADGE[m.role] ?? "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {m.role === "owner" && <Shield className="w-3 h-3" />}
                          {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {m.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-stevie-green">
                          <span className="w-1.5 h-1.5 rounded-full bg-stevie-green" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <X className="w-3 h-3" />
                          Deactivated
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canEditThisRow && (
                        <div className="inline-flex items-center gap-1 justify-end">
                          {m.is_active ? (
                            <>
                              {canInvite && (
                                <button
                                  onClick={() =>
                                    handleResendInvite(m.id, m.email)
                                  }
                                  disabled={busyId === m.id}
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-stevie-green hover:bg-stevie-green/5 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                  title="Send a fresh invite email (24h expiry)"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  Re-send invite
                                </button>
                              )}
                              {canRemove && (
                                <button
                                  onClick={() => handleDeactivate(m.id)}
                                  disabled={busyId === m.id}
                                  className="inline-flex items-center gap-1 text-xs text-stevie-orange hover:bg-stevie-orange/5 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
                                  title="Deactivate member"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Deactivate
                                </button>
                              )}
                            </>
                          ) : (
                            <button
                              onClick={() => handleReactivate(m.id)}
                              disabled={busyId === m.id}
                              className="inline-flex items-center gap-1 text-xs text-stevie-green hover:bg-stevie-green/5 px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-50"
                              title="Reactivate member"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Reactivate
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* Role reference */}
      <section className="mt-6 text-xs text-muted-foreground">
        <p className="font-medium mb-2">Role quick reference</p>
        <ul className="space-y-1">
          <li>
            <span className="font-medium text-stevie-orange">Owner</span> —
            full control, including billing and owner/admin role assignment.
            Only owners can assign this role.
          </li>
          <li>
            <span className="font-medium text-stevie-green">Admin</span> — manage
            team, settings, content, and integrations.
          </li>
          <li>
            <span className="font-medium text-blue-700">Editor</span> — create
            and edit content. No team or settings access.
          </li>
          <li>
            <span className="font-medium text-gray-700">Viewer</span> — read-only
            access to the admin console.
          </li>
        </ul>
      </section>
    </div>
  );
}
