"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Send,
  ExternalLink,
} from "lucide-react";
import {
  apiFetch,
  ApiError,
  ConflictError,
  type SitePage,
  type PaginatedResponse,
} from "@/lib/api";
import { useAdminPresence } from "@/lib/use-admin-presence";
import { useCollabBroadcast } from "@/lib/use-collab-broadcast";
import PresenceAvatarStack from "@/components/presence/PresenceAvatarStack";
import { useEditing } from "@/lib/use-editing";
import EditingBanner from "@/components/EditingBanner";
import ImageUpload from "@/components/ImageUpload";
import {
  ConflictResolutionDialog,
  type ConflictFieldView,
} from "@/components/ConflictResolutionDialog";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/editor/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-[200px] border border-border rounded-xl animate-pulse bg-gray-50" />,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600",
  published: "bg-green-50 text-green-700",
  archived: "bg-gray-50 text-gray-400",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const STATUS_TABS = ["all", "draft", "published", "archived"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

export default function PagesAdmin() {
  const [pages_list, setPagesList] = useState<SitePage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<SitePage | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);

  // 409 conflict state — see ConflictResolutionDialog for the UX.
  const [conflict, setConflict] = useState<{
    server: SitePage;
    attempted: Record<string, unknown>;
    message: string;
    mode: "save" | "publish";
  } | null>(null);

  // Lightweight stale-save toast (separate from the structured
  // version_conflict flow above). Fired when the save endpoint returns a
  // generic 409 — e.g. an admin clicked "Save" while another editor was
  // actively typing.
  const [staleToast, setStaleToast] = useState<{ by: string } | null>(null);

  const [form, setForm] = useState({
    title: "",
    slug: "",
    html_content: "",
    meta_title: "",
    meta_description: "",
    og_image_url: "",
    status: "draft",
  });

  // Presence: list-level (who's on /admin/pages) + per-page (who's in the modal)
  const listPresence = useAdminPresence({ channel: "pages:list" });
  const pagePresence = useAdminPresence({
    channel: editing ? `page:${editing.id}` : null,
  });

  // "Currently editing" pubsub for the page-edit drawer. Hook is a no-op
  // when entity_id is null, so it's safe to mount unconditionally.
  const { othersEditing: pageEditors } = useEditing("page", editing?.id ?? null);

  // CONCURRENT-3: live co-edit broadcast on the same page entity.
  // Uses the `collab:page:{id}` topic (separate Supabase channel from
  // the presence one) so we can keep presence and content sync
  // independent. `remoteHtml` feeds RichTextEditor.remoteContent so
  // incoming broadcasts update the editor without stomping on the
  // local cursor.
  const [remoteHtml, setRemoteHtml] = useState<string | null>(null);
  type PageBroadcastPatch = {
    title: string;
    html_content: string;
    meta_title: string;
    meta_description: string;
    og_image_url: string;
    status: string;
  };
  const { broadcast: broadcastEdit } = useCollabBroadcast<PageBroadcastPatch>({
    channel: editing ? `page:${editing.id}` : null,
    userId: pagePresence.self?.user_id ?? null,
    enabled: !!editing && showCreate,
    onRemote: (patch) => {
      setForm((prev) => ({ ...prev, ...patch }));
      if (typeof patch.html_content === "string") {
        setRemoteHtml(patch.html_content);
      }
    },
  });

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "20",
      });
      if (statusTab !== "all") params.set("status", statusTab);
      if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
      const data = await apiFetch<PaginatedResponse<SitePage>>(
        `/api/pages?${params}`
      );
      setPagesList(data.items);
      setTotal(data.total);
      setTotalPages(data.pages);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [page, statusTab, debouncedSearch]);

  // Debounce the search box so we don't hammer the API on every keystroke.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(h);
  }, [search]);

  // Reset back to page 1 whenever filters change so we don't land on an
  // empty page when the total shrinks.
  useEffect(() => {
    setPage(1);
  }, [statusTab, debouncedSearch]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  function openCreate() {
    setForm({ title: "", slug: "", html_content: "", meta_title: "", meta_description: "", og_image_url: "", status: "draft" });
    setEditing(null);
    setRemoteHtml(null);
    setShowCreate(true);
  }

  function openEdit(pg: SitePage) {
    // content might be stored as {html: "..."} or just a string
    const html = typeof pg.content === "object" && pg.content !== null && "html" in pg.content
      ? String((pg.content as Record<string, unknown>).html)
      : "";
    setForm({
      title: pg.title,
      slug: pg.slug,
      html_content: html,
      meta_title: pg.meta_title || "",
      meta_description: pg.meta_description || "",
      og_image_url: pg.og_image_url || "",
      status: pg.status,
    });
    setEditing(pg);
    setRemoteHtml(null);
    setShowCreate(true);
  }

  function pagePayloadFromForm(): Record<string, unknown> {
    return {
      title: form.title,
      content: { html: form.html_content },
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      og_image_url: form.og_image_url || null,
      status: form.status,
    };
  }

  async function handleSave() {
    if (!form.title || !form.slug) return;
    setSaving(true);
    try {
      const payload = pagePayloadFromForm();

      if (editing) {
        await apiFetch(`/api/pages/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, version: editing.version }),
        });
      } else {
        await apiFetch("/api/pages", {
          method: "POST",
          body: JSON.stringify({ ...payload, slug: form.slug }),
        });
      }
      setShowCreate(false);
      setEditing(null);
      fetchPages();
    } catch (err: unknown) {
      if (err instanceof ConflictError && editing) {
        setConflict({
          server: err.current as unknown as SitePage,
          attempted: pagePayloadFromForm(),
          message: err.message,
          mode: "save",
        });
      } else if (err instanceof ApiError && err.status === 409) {
        // TODO: backend 409 conflict on stale save — once the API ships
        // {detail: "stale", last_modified_by, last_modified_at}, pull the
        // editor's name out of the body and surface it here.
        const body = err.body as
          | { last_modified_by?: { full_name?: string; email?: string } }
          | null
          | undefined;
        const by =
          body?.last_modified_by?.full_name ||
          body?.last_modified_by?.email ||
          "another editor";
        setStaleToast({ by });
      } else {
        alert(err instanceof Error ? err.message : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this page?")) return;
    try {
      await apiFetch(`/api/pages/${id}`, { method: "DELETE" });
      fetchPages();
    } catch {
      /* empty */
    }
  }

  async function handlePublish(pg: SitePage) {
    try {
      await apiFetch(`/api/pages/${pg.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", version: pg.version }),
      });
      fetchPages();
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        setConflict({
          server: err.current as unknown as SitePage,
          attempted: { status: "published" },
          message: err.message,
          mode: "publish",
        });
      } else {
        alert(err instanceof Error ? err.message : "Publish failed");
      }
    }
  }

  async function resolveKeepMine() {
    if (!conflict) return;
    setSaving(true);
    try {
      const targetId =
        conflict.mode === "publish" ? conflict.server.id : editing?.id;
      if (!targetId) return;
      await apiFetch(`/api/pages/${targetId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...conflict.attempted,
          version: conflict.server.version,
        }),
      });
      setConflict(null);
      if (conflict.mode === "save") {
        setShowCreate(false);
        setEditing(null);
      }
      fetchPages();
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        setConflict({
          ...conflict,
          server: err.current as unknown as SitePage,
          message: err.message,
        });
      } else {
        alert(err instanceof Error ? err.message : "Save failed");
        setConflict(null);
      }
    } finally {
      setSaving(false);
    }
  }

  function resolveKeepTheirs() {
    if (!conflict) return;
    const s = conflict.server;
    if (conflict.mode === "save") {
      setEditing(s);
      const html =
        typeof s.content === "object" &&
        s.content !== null &&
        !Array.isArray(s.content) &&
        typeof (s.content as { html?: unknown }).html === "string"
          ? ((s.content as { html: string }).html)
          : "";
      setForm({
        title: s.title,
        slug: s.slug,
        html_content: html,
        meta_title: s.meta_title || "",
        meta_description: s.meta_description || "",
        og_image_url: s.og_image_url || "",
        status: s.status,
      });
      // Push the server copy through remoteContent so Tiptap adopts it.
      setRemoteHtml(html);
    }
    setConflict(null);
    fetchPages();
  }

  function buildConflictFields(): ConflictFieldView[] {
    if (!conflict) return [];
    const server = conflict.server;
    const mine = conflict.attempted;
    const keys: Array<{ key: string; label: string }> = [
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "meta_title", label: "Meta title" },
      { key: "meta_description", label: "Meta description" },
      { key: "og_image_url", label: "Social image" },
      { key: "content", label: "Page content" },
    ];
    return keys
      .filter((k) => k.key in mine)
      .map((k) => ({
        key: k.key,
        label: k.label,
        mine: mine[k.key],
        theirs: (server as unknown as Record<string, unknown>)[k.key],
      }));
  }

  // Filtering happens server-side now; just alias for readability below.
  const filtered = pages_list;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Pages</h1>
          <p className="text-muted-foreground text-sm">{total} page{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-4">
          <PresenceAvatarStack users={listPresence.others} label="Also here:" />
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition">
            <Plus className="w-4 h-4" /> New Page
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
        <div className="flex gap-2">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusTab(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition capitalize ${
                statusTab === s
                  ? "bg-foreground text-white border-foreground"
                  : "bg-white text-muted-foreground border-border hover:border-foreground/20"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No pages yet</p>
          <p className="text-xs mt-1">Click &quot;New Page&quot; to create a landing page</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pg) => (
            <div key={pg.id} className="bg-white rounded-2xl border border-border p-5 hover:border-foreground/20 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(pg)}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">{pg.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[pg.status]}`}>{pg.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">/{pg.slug}</span>
                    {pg.status === "published" && <ExternalLink className="w-3 h-3" />}
                    <span>{new Date(pg.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  {pg.status === "draft" && (
                    <button onClick={() => handlePublish(pg)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Publish">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => openEdit(pg)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(pg.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Editor drawer */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-3xl bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-4">
                <h2 className="font-semibold text-lg">{editing ? "Edit Page" : "New Page"}</h2>
                {editing && (
                  <PresenceAvatarStack users={pagePresence.others} label="Editing:" />
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleSave} disabled={saving || !form.title || !form.slug} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {staleToast && (
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
                  <span className="flex-1">
                    This was changed by{" "}
                    <span className="font-semibold">{staleToast.by}</span> — reload?
                  </span>
                  <button
                    onClick={() => {
                      setStaleToast(null);
                      fetchPages();
                      if (editing) {
                        // Re-pull the row so the form re-hydrates from
                        // the latest server copy.
                        apiFetch<SitePage>(`/api/pages/${editing.id}`)
                          .then((latest) => openEdit(latest))
                          .catch(() => {});
                      }
                    }}
                    className="px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition"
                  >
                    Reload
                  </button>
                  <button
                    onClick={() => setStaleToast(null)}
                    className="text-amber-700 hover:text-amber-900 text-xs"
                  >
                    Dismiss
                  </button>
                </div>
              )}
              {editing && <EditingBanner editors={pageEditors} />}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => {
                      const t = e.target.value;
                      setForm({ ...form, title: t, slug: !editing ? slugify(t) : form.slug });
                      broadcastEdit({ title: t });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    placeholder="Page title"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Slug *</label>
                  <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="page-slug" disabled={!!editing} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => {
                      const status = e.target.value;
                      setForm({ ...form, status });
                      broadcastEdit({ status });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Social Image</label>
                  <ImageUpload
                    value={form.og_image_url}
                    onChange={(og_image_url) => {
                      setForm({ ...form, og_image_url });
                      broadcastEdit({ og_image_url });
                    }}
                    context="page-og"
                    aspect="wide"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">Content</label>
                <RichTextEditor
                  content={form.html_content}
                  remoteContent={remoteHtml}
                  onChange={(html) => {
                    setForm({ ...form, html_content: html });
                    broadcastEdit({ html_content: html });
                  }}
                  placeholder="Write your page content..."
                />
              </div>

              <div className="pt-4 border-t border-border">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">SEO</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Meta Title</label>
                    <input
                      type="text"
                      value={form.meta_title}
                      onChange={(e) => {
                        const meta_title = e.target.value;
                        setForm({ ...form, meta_title });
                        broadcastEdit({ meta_title });
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Meta Description</label>
                    <textarea
                      value={form.meta_description}
                      onChange={(e) => {
                        const meta_description = e.target.value;
                        setForm({ ...form, meta_description });
                        broadcastEdit({ meta_description });
                      }}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConflictResolutionDialog
        open={conflict !== null}
        resource="page"
        message={conflict?.message ?? ""}
        fields={buildConflictFields()}
        busy={saving}
        onKeepMine={resolveKeepMine}
        onKeepTheirs={resolveKeepTheirs}
        onCancel={() => setConflict(null)}
      />
    </div>
  );
}
