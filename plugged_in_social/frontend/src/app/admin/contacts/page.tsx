"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Tag,
  Plus,
  X,
  Mail,
  Trash2,
  Loader2,
  Pencil,
  UserPlus,
} from "lucide-react";
import { apiFetch, type Contact, type PaginatedResponse } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const EMPTY_CREATE = {
  email: "",
  full_name: "",
  tags: "",
  source: "",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [subscribed, setSubscribed] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Selected row / detail drawer
  const [selected, setSelected] = useState<Contact | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    full_name: "",
    tags: "",
    engagement_score: "",
    subscribed: true,
  });
  const [saving, setSaving] = useState(false);

  // Create drawer
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (search) params.set("search", search);
      if (subscribed === "true") params.set("subscribed", "true");
      if (subscribed === "false") params.set("subscribed", "false");
      if (tagFilter) params.set("tag", tagFilter);

      const data = await apiFetch<PaginatedResponse<Contact>>(
        `/api/contacts?${params.toString()}`
      );
      setContacts(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setContacts([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, subscribed, tagFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      full_name: selected.full_name ?? "",
      tags: selected.tags.join(", "),
      engagement_score: selected.engagement_score != null ? String(selected.engagement_score) : "",
      subscribed: selected.subscribed,
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        full_name: editForm.full_name.trim() || null,
        tags: editForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        subscribed: editForm.subscribed,
      };
      const score = editForm.engagement_score.trim();
      if (score) {
        const parsed = Number(score);
        if (!Number.isNaN(parsed)) payload.engagement_score = parsed;
      } else {
        payload.engagement_score = null;
      }
      const updated = await apiFetch<Contact>(`/api/contacts/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setSelected(updated);
      setEditing(false);
      fetchContacts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!confirm(`Delete contact ${selected.email}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/contacts/${selected.id}`, { method: "DELETE" });
      setSelected(null);
      fetchContacts();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const email = createForm.email.trim().toLowerCase();
      if (!email || !email.includes("@")) {
        setCreateError("Valid email is required");
        setCreating(false);
        return;
      }
      const payload = {
        email,
        full_name: createForm.full_name.trim() || null,
        tags: createForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        source: createForm.source.trim() || "manual",
      };
      await apiFetch<Contact>(`/api/contacts`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowCreate(false);
      setCreateForm(EMPTY_CREATE);
      fetchContacts();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  };

  // Precompute stats from the visible page — good enough for a dashboard header
  const subscribedCount = contacts.filter((c) => c.subscribed).length;
  const avgEngagement =
    contacts.filter((c) => c.engagement_score != null).length > 0
      ? contacts
          .filter((c) => c.engagement_score != null)
          .reduce((sum, c) => sum + (c.engagement_score ?? 0), 0) /
        contacts.filter((c) => c.engagement_score != null).length
      : null;

  // Collect unique tags on this page for the tag filter pills
  const uniqueTags = Array.from(
    new Set(contacts.flatMap((c) => c.tags).filter((t) => t.length > 0))
  ).slice(0, 12);

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="heading-brand text-3xl">Contacts</h1>
          <p className="text-muted-foreground mt-1">
            {total} contact{total !== 1 ? "s" : ""} across all channels
            {total > 0 && (
              <>
                {" · "}
                {subscribedCount}/{contacts.length} subscribed on this page
                {avgEngagement !== null && (
                  <>
                    {" · avg engagement "}
                    <span className="font-medium">{Math.round(avgEngagement)}</span>
                  </>
                )}
              </>
            )}
            .
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> Add Contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
          />
        </div>
        <div className="flex gap-2">
          {[
            { value: "", label: "All" },
            { value: "true", label: "Subscribed" },
            { value: "false", label: "Unsubscribed" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setSubscribed(opt.value);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs rounded-full border transition-colors ${
                subscribed === opt.value
                  ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-semibold"
                  : "border-border text-muted-foreground hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {uniqueTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 items-center">
          <span className="text-xs text-muted-foreground">Tags:</span>
          {tagFilter && (
            <button
              onClick={() => setTagFilter("")}
              className="px-2 py-1 text-xs rounded-full border border-border text-muted-foreground hover:bg-gray-50 inline-flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
          {uniqueTags.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTagFilter(tagFilter === t ? "" : t);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors inline-flex items-center gap-1 ${
                tagFilter === t
                  ? "border-stevie-green bg-stevie-green/10 text-stevie-green font-semibold"
                  : "border-border text-muted-foreground hover:border-gray-300"
              }`}
            >
              <Tag className="w-2.5 h-2.5" />
              {t}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Loading contacts...
          </div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">
              {search || subscribed || tagFilter
                ? "No contacts match your filters."
                : "No contacts yet. Add one, or they\u2019ll be created from leads and form submissions."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden md:table-cell">Tags</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden lg:table-cell">Engagement</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden sm:table-cell">Added</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr
                  key={contact.id}
                  onClick={() => { setSelected(contact); setEditing(false); }}
                  className="border-b border-border last:border-b-0 hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium">
                      {contact.full_name || "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {contact.email}
                    </div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    {contact.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-muted-foreground"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                        {contact.tags.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{contact.tags.length - 3}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell">
                    {contact.engagement_score != null ? (
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-stevie-green rounded-full"
                            style={{
                              width: `${Math.min(100, contact.engagement_score)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(contact.engagement_score)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        contact.subscribed
                          ? "bg-stevie-green/10 text-stevie-green"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {contact.subscribed ? "Subscribed" : "Unsubscribed"}
                    </span>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell text-xs text-muted-foreground">
                    {formatDate(contact.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-gray-50/50">
            <span className="text-xs text-muted-foreground">
              Page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-border hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-1.5 rounded-lg border border-border hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Drawer */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => !creating && setShowCreate(false)}
          />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">Add Contact</h2>
              <button
                onClick={() => !creating && setShowCreate(false)}
                className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-40"
                disabled={creating}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  disabled={creating}
                  placeholder="jane@example.com"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  disabled={creating}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={createForm.tags}
                  onChange={(e) => setCreateForm({ ...createForm, tags: e.target.value })}
                  disabled={creating}
                  placeholder="vip, newsletter"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Source
                </label>
                <input
                  type="text"
                  value={createForm.source}
                  onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                  disabled={creating}
                  placeholder="manual, import, event, etc."
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                />
              </div>
              {createError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                  {createError}
                </div>
              )}
              <div className="flex gap-2 pt-4 border-t border-border">
                <button
                  onClick={handleCreate}
                  disabled={creating || !createForm.email.trim()}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {creating ? "Creating..." : "Create Contact"}
                </button>
                <button
                  onClick={() => { setShowCreate(false); setCreateForm(EMPTY_CREATE); }}
                  disabled={creating}
                  className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail / Edit Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => { setSelected(null); setEditing(false); }}
          />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <h2 className="font-semibold text-lg truncate">
                  {selected.full_name || selected.email}
                </h2>
                <p className="text-xs text-muted-foreground truncate">{selected.email}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setEditing(false); }}
                className="p-1.5 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    selected.subscribed
                      ? "bg-stevie-green/10 text-stevie-green"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {selected.subscribed ? "Subscribed" : "Unsubscribed"}
                </span>
                {!editing && (
                  <button
                    onClick={openEdit}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium hover:bg-gray-200"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                )}
                {!editing && (
                  <a
                    href={`mailto:${selected.email}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium hover:bg-gray-200"
                  >
                    <Mail className="w-3 h-3" /> Email
                  </a>
                )}
                {!editing && (
                  <button
                    onClick={handleDelete}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={editForm.tags}
                      onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Engagement Score (0-100)
                    </label>
                    <input
                      type="number"
                      value={editForm.engagement_score}
                      onChange={(e) => setEditForm({ ...editForm, engagement_score: e.target.value })}
                      min="0"
                      max="100"
                      step="0.1"
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={editForm.subscribed}
                      onChange={(e) => setEditForm({ ...editForm, subscribed: e.target.checked })}
                      className="rounded"
                    />
                    Subscribed to marketing
                  </label>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Engagement</p>
                      <p className="font-medium">
                        {selected.engagement_score != null
                          ? Math.round(selected.engagement_score)
                          : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Source</p>
                      <p className="font-medium">{selected.source || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Added</p>
                      <p className="font-medium">{formatDate(selected.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Updated</p>
                      <p className="font-medium">{formatDate(selected.updated_at)}</p>
                    </div>
                  </div>

                  {selected.tags.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">
                        Tags
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-muted-foreground"
                          >
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                    <p className="font-mono">ID: {selected.id}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
