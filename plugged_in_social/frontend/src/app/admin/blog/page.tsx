"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  BookOpen,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Clock,
  Send,
} from "lucide-react";
import {
  apiFetch,
  ConflictError,
  type BlogPost,
  type PaginatedResponse,
} from "@/lib/api";
import dynamic from "next/dynamic";
import {
  ConflictResolutionDialog,
  type ConflictFieldView,
} from "@/components/ConflictResolutionDialog";
import ImageUpload from "@/components/ImageUpload";
import { useAdminPresence } from "@/lib/use-admin-presence";
import { useCollabBroadcast } from "@/lib/use-collab-broadcast";

const RichTextEditor = dynamic(() => import("@/components/editor/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-[200px] border border-border rounded-xl animate-pulse bg-gray-50" />,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600",
  published: "bg-green-50 text-green-700",
  scheduled: "bg-blue-50 text-blue-700",
  archived: "bg-gray-50 text-gray-400",
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function BlogAdmin() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Editor state
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  // Validation state — populated on Create attempt with empty required
  // fields. Cleared as the user types into the offending field. Lets us
  // keep the Create button enabled (so clicking it actually does
  // something) and surface a red helper line per field instead.
  const [fieldErrors, setFieldErrors] = useState<{
    title?: string;
    slug?: string;
    scheduled_for?: string;
  }>({});

  // Optimistic-locking conflict state. When a PATCH returns 409 with a
  // version_conflict payload we stash the collision here and open the
  // dialog; the user's pending payload is preserved so we can retry
  // with the server's current version if they choose "Keep mine".
  const [conflict, setConflict] = useState<{
    server: BlogPost;
    attempted: Record<string, unknown>;
    message: string;
    mode: "save" | "publish";
  } | null>(null);

  // Create/edit form. ``scheduled_for`` is a local-time <input type="datetime-local">
  // value (no timezone suffix) — we convert to ISO on submit.
  const [form, setForm] = useState({
    title: "",
    slug: "",
    body: "",
    excerpt: "",
    category: "",
    tags: "",
    cover_image_url: "",
    meta_title: "",
    meta_description: "",
    status: "draft",
    scheduled_for: "",
  });

  // Live co-editing (CONCURRENT-3). `remoteBody` is the latest HTML we
  // received over the broadcast channel; RichTextEditor applies it
  // out-of-band so we don't clobber the local cursor.
  const { self } = useAdminPresence({ channel: null });
  const [remoteBody, setRemoteBody] = useState<string | null>(null);
  type BroadcastPatch = {
    title: string;
    body: string;
    excerpt: string;
    category: string;
    tags: string;
    cover_image_url: string;
    meta_title: string;
    meta_description: string;
    status: string;
    scheduled_for: string;
  };
  const { broadcast: broadcastEdit } = useCollabBroadcast<BroadcastPatch>({
    channel: editing ? `post:${editing.id}` : null,
    userId: self?.user_id ?? null,
    enabled: !!editing && showCreate,
    onRemote: (patch) => {
      setForm((prev) => ({ ...prev, ...patch }));
      if (typeof patch.body === "string") setRemoteBody(patch.body);
    },
  });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    try {
      const data = await apiFetch<PaginatedResponse<BlogPost>>(`/api/blog?${params}`);
      setPosts(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debouncedSearch]);

  // Debounce the search box so we don't hammer the API per keystroke.
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(h);
  }, [search]);

  // Reset to page 1 when filters narrow the set.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  function openCreate() {
    setForm({
      title: "",
      slug: "",
      body: "",
      excerpt: "",
      category: "",
      tags: "",
      cover_image_url: "",
      meta_title: "",
      meta_description: "",
      status: "draft",
      scheduled_for: "",
    });
    setEditing(null);
    setRemoteBody(null);
    setShowCreate(true);
  }

  function openEdit(post: BlogPost) {
    // datetime-local needs "YYYY-MM-DDTHH:mm" in local time — strip the
    // trailing "Z" and seconds from the server's ISO value so the input
    // renders the user's stored schedule instead of an empty picker.
    const scheduledLocal = post.scheduled_for
      ? new Date(post.scheduled_for).toISOString().slice(0, 16)
      : "";
    setForm({
      title: post.title,
      slug: post.slug,
      body: post.body || "",
      excerpt: post.excerpt || "",
      category: post.category || "",
      tags: (post.tags || []).join(", "),
      cover_image_url: post.cover_image_url || "",
      meta_title: post.meta_title || "",
      meta_description: post.meta_description || "",
      status: post.status,
      scheduled_for: scheduledLocal,
    });
    setEditing(post);
    setRemoteBody(null);
    setShowCreate(true);
  }

  async function handleSave() {
    const errors: typeof fieldErrors = {};
    if (!form.title.trim()) errors.title = "Title is required";
    if (!form.slug.trim()) errors.slug = "Slug is required";
    if (form.status === "scheduled" && !form.scheduled_for) {
      errors.scheduled_for = "Pick a date/time when status is Scheduled";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      const payload = payloadFromForm();

      if (editing) {
        await apiFetch(`/api/blog/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ ...payload, version: editing.version }),
        });
      } else {
        await apiFetch("/api/blog", {
          method: "POST",
          body: JSON.stringify({ ...payload, slug: form.slug }),
        });
      }
      setShowCreate(false);
      setEditing(null);
      setFieldErrors({});
      fetchPosts();
    } catch (err: unknown) {
      if (err instanceof ConflictError && editing) {
        setConflict({
          server: err.current as unknown as BlogPost,
          attempted: payloadFromForm(),
          message: err.message,
          mode: "save",
        });
      } else {
        setFieldErrors({
          ...errors,
          title: err instanceof Error ? err.message : "Save failed",
        });
      }
    } finally {
      setSaving(false);
    }
  }

  /** Re-derive the current form's payload (minus version) so the
   * conflict dialog can re-submit it against the server's new version. */
  function payloadFromForm(): Record<string, unknown> {
    // datetime-local inputs produce local naive strings; new Date() parses
    // them as local time, .toISOString() emits UTC. Send null when cleared
    // so the backend unsets the schedule cleanly.
    const scheduledIso = form.scheduled_for
      ? new Date(form.scheduled_for).toISOString()
      : null;
    return {
      title: form.title,
      body: form.body || null,
      excerpt: form.excerpt || null,
      category: form.category || null,
      tags: form.tags
        ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : [],
      cover_image_url: form.cover_image_url || null,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      status: form.status,
      scheduled_for: scheduledIso,
    };
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this post?")) return;
    try {
      await apiFetch(`/api/blog/${id}`, { method: "DELETE" });
      fetchPosts();
    } catch {
      /* empty */
    }
  }

  async function handlePublish(post: BlogPost) {
    try {
      await apiFetch(`/api/blog/${post.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "published", version: post.version }),
      });
      fetchPosts();
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        setConflict({
          server: err.current as unknown as BlogPost,
          attempted: { status: "published" },
          message: err.message,
          mode: "publish",
        });
      } else {
        alert(err instanceof Error ? err.message : "Publish failed");
      }
    }
  }

  /** User chose "Overwrite with mine" — re-submit the pending payload
   * against the server's current version. If THAT hits a conflict too,
   * re-open the dialog with the newer server state. */
  async function resolveKeepMine() {
    if (!conflict) return;
    setSaving(true);
    try {
      const targetId =
        conflict.mode === "publish" ? conflict.server.id : editing?.id;
      if (!targetId) return;
      await apiFetch(`/api/blog/${targetId}`, {
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
      fetchPosts();
    } catch (err: unknown) {
      if (err instanceof ConflictError) {
        setConflict({
          ...conflict,
          server: err.current as unknown as BlogPost,
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

  /** User chose "Discard mine & reload" — replace the editor state with
   * the server's version so they can see what the other editor changed
   * and continue from there. */
  function resolveKeepTheirs() {
    if (!conflict) return;
    const s = conflict.server;
    if (conflict.mode === "save") {
      setEditing(s);
      const scheduledLocal = s.scheduled_for
        ? new Date(s.scheduled_for).toISOString().slice(0, 16)
        : "";
      setForm({
        title: s.title,
        slug: s.slug,
        body: s.body || "",
        excerpt: s.excerpt || "",
        category: s.category || "",
        tags: (s.tags || []).join(", "),
        cover_image_url: s.cover_image_url || "",
        meta_title: s.meta_title || "",
        meta_description: s.meta_description || "",
        status: s.status,
        scheduled_for: scheduledLocal,
      });
      // Force the Tiptap editor to adopt the server's body via the
      // remoteContent channel — the content prop alone is initial-only.
      setRemoteBody(s.body || "");
    }
    setConflict(null);
    fetchPosts();
  }

  /** Comparison pairs for the conflict dialog — only the fields we
   * actually submit on PATCH. */
  function buildConflictFields(): ConflictFieldView[] {
    if (!conflict) return [];
    const server = conflict.server;
    const mine = conflict.attempted;
    const keys: Array<{ key: string; label: string }> = [
      { key: "title", label: "Title" },
      { key: "status", label: "Status" },
      { key: "excerpt", label: "Excerpt" },
      { key: "category", label: "Category" },
      { key: "tags", label: "Tags" },
      { key: "cover_image_url", label: "Cover image" },
      { key: "meta_title", label: "Meta title" },
      { key: "meta_description", label: "Meta description" },
      { key: "body", label: "Body" },
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

  // Filtering happens server-side now; alias for readability below.
  const filtered = posts;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Blog</h1>
          <p className="text-muted-foreground text-sm">{total} post{total !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition">
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search posts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
        <div className="flex gap-2">
          {["draft", "published", "scheduled", "archived"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                statusFilter === s
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
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No blog posts yet</p>
          <p className="text-xs mt-1">Click &quot;New Post&quot; to start writing</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl border border-border p-5 hover:border-foreground/20 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => openEdit(post)}>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-sm">{post.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[post.status]}`}>{post.status}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">/{post.slug}</p>
                  {post.excerpt && <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{post.excerpt}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                    {post.category && <span className="px-1.5 py-0.5 bg-gray-50 rounded font-semibold">{post.category}</span>}
                    {post.tags.length > 0 && <span>{post.tags.join(", ")}</span>}
                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                    {post.reading_time_minutes && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> {post.reading_time_minutes} min read</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0">
                  {post.status === "draft" && (
                    <button onClick={() => handlePublish(post)} className="p-1.5 rounded-lg hover:bg-green-50 text-green-600" title="Publish">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => openEdit(post)} className="p-1.5 rounded-lg hover:bg-gray-100" title="Edit">
                    <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(post.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Full-screen editor drawer */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-3xl bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">{editing ? "Edit Post" : "New Post"}</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition"
                >
                  {saving ? "Saving..." : editing ? "Update" : "Create"}
                </button>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Title + slug */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Title *</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm({
                        ...form,
                        title,
                        slug: !editing ? slugify(title) : form.slug,
                      });
                      if (fieldErrors.title) {
                        setFieldErrors({ ...fieldErrors, title: undefined });
                      }
                      broadcastEdit({ title });
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 ${
                      fieldErrors.title ? "border-red-400" : "border-border"
                    }`}
                    placeholder="Post title"
                  />
                  {fieldErrors.title && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.title}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Slug *</label>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={(e) => {
                      setForm({ ...form, slug: slugify(e.target.value) });
                      if (fieldErrors.slug) {
                        setFieldErrors({ ...fieldErrors, slug: undefined });
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground/10 ${
                      fieldErrors.slug ? "border-red-400" : "border-border"
                    }`}
                    placeholder="post-slug"
                    disabled={!!editing}
                  />
                  {fieldErrors.slug && (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.slug}</p>
                  )}
                </div>
              </div>

              {/* Rich text body */}
              <div>
                <label className="block text-xs font-medium mb-1">Body</label>
                <RichTextEditor
                  content={form.body}
                  remoteContent={remoteBody}
                  onChange={(html) => {
                    setForm({ ...form, body: html });
                    broadcastEdit({ body: html });
                  }}
                  placeholder="Write your blog post..."
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-xs font-medium mb-1">Excerpt</label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => {
                    const excerpt = e.target.value;
                    setForm({ ...form, excerpt });
                    broadcastEdit({ excerpt });
                  }}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none"
                  placeholder="Brief summary for cards and previews..."
                />
              </div>

              {/* Category + Tags */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => {
                      const category = e.target.value;
                      setForm({ ...form, category });
                      broadcastEdit({ category });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    placeholder="e.g. Marketing Tips"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={form.tags}
                    onChange={(e) => {
                      const tags = e.target.value;
                      setForm({ ...form, tags });
                      broadcastEdit({ tags });
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    placeholder="social media, branding, tips"
                  />
                </div>
              </div>

              {/* Cover image */}
              <div>
                <label className="block text-xs font-medium mb-1">Cover Image</label>
                <ImageUpload
                  value={form.cover_image_url}
                  onChange={(cover_image_url) => {
                    setForm({ ...form, cover_image_url });
                    broadcastEdit({ cover_image_url });
                  }}
                  context="blog-cover"
                  aspect="wide"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => {
                    const status = e.target.value;
                    setForm({ ...form, status });
                    if (fieldErrors.scheduled_for) {
                      setFieldErrors({ ...fieldErrors, scheduled_for: undefined });
                    }
                    broadcastEdit({ status });
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Schedule — only meaningful when status == scheduled, but
                  we allow setting it anytime so the author can queue up
                  a time before flipping status. */}
              {(form.status === "scheduled" || form.scheduled_for) && (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Scheduled for {form.status === "scheduled" && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="datetime-local"
                    value={form.scheduled_for}
                    onChange={(e) => {
                      const scheduled_for = e.target.value;
                      setForm({ ...form, scheduled_for });
                      if (fieldErrors.scheduled_for) {
                        setFieldErrors({ ...fieldErrors, scheduled_for: undefined });
                      }
                      broadcastEdit({ scheduled_for });
                    }}
                    className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 ${
                      fieldErrors.scheduled_for ? "border-red-400" : "border-border"
                    }`}
                  />
                  {fieldErrors.scheduled_for ? (
                    <p className="text-xs text-red-600 mt-1">{fieldErrors.scheduled_for}</p>
                  ) : (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Cron publishes scheduled posts every 15 minutes.
                    </p>
                  )}
                </div>
              )}

              {/* SEO */}
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
                      placeholder="Override the page title for search engines"
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
                      placeholder="Search engine description (150-160 chars)"
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
        resource="post"
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
