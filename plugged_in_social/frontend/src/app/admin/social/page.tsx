"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Share2,
  Calendar,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageCircle,
  Repeat2,
  Eye,
  Trash2,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  apiFetch,
  type SocialPost,
  type SocialAccount,
  type PaginatedResponse,
} from "@/lib/api";
import ImageUpload from "@/components/ImageUpload";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const CONNECT_PLATFORMS = [
  { key: "meta", label: "Instagram / Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "tiktok", label: "TikTok" },
  { key: "google", label: "YouTube" },
  { key: "x", label: "X" },
  { key: "pinterest", label: "Pinterest" },
];

const PHASE_PILLS: Record<string, string> = {
  protect: "bg-stevie-sky/20 text-stevie-sky",
  deepen: "bg-stevie-lavender/30 text-stevie-lavender",
  amplify: "bg-stevie-chartreuse/30 text-stevie-chartreuse",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600",
  scheduled: "bg-blue-50 text-blue-700",
  publishing: "bg-yellow-50 text-yellow-700",
  published: "bg-green-50 text-green-700",
  failed: "bg-red-50 text-red-700",
};

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "bg-pink-50 text-pink-600",
  facebook: "bg-blue-50 text-blue-600",
  tiktok: "bg-gray-900 text-white",
  linkedin: "bg-sky-50 text-sky-700",
  youtube: "bg-red-50 text-red-600",
  x: "bg-gray-50 text-gray-800",
  pinterest: "bg-red-50 text-red-500",
};

function parseMediaUrls(value: string): string[] {
  return value
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u.length > 0);
}

function joinMediaUrls(urls: string[]): string {
  return urls.filter((u) => u.trim().length > 0).join(", ");
}

function updateMediaUrlAt(value: string, index: number, nextUrl: string): string {
  const urls = parseMediaUrls(value);
  if (nextUrl) {
    urls[index] = nextUrl;
  } else {
    urls.splice(index, 1);
  }
  return joinMediaUrls(urls);
}

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function SocialPage() {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<SocialPost | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    social_account_id: "",
    platform: "instagram",
    caption: "",
    hashtags: "",
    media_urls: "",
    media_type: "",
    scheduled_at: "",
    compound_phase: "",
    internal_notes: "",
  });
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [connectingPlatform, setConnectingPlatform] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (phaseFilter) params.set("compound_phase", phaseFilter);
    if (platformFilter) params.set("platform", platformFilter);
    try {
      setLoadError(null);
      const [postsData, accountsData] = await Promise.all([
        apiFetch<PaginatedResponse<SocialPost>>(`/api/social/posts?${params}`),
        apiFetch<SocialAccount[]>("/api/social/accounts"),
      ]);
      setPosts(postsData.items);
      setTotal(postsData.total);
      setPages(postsData.pages);
      setAccounts(accountsData);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load social posts."));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, phaseFilter, platformFilter]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const handleCreate = async () => {
    if (!createForm.social_account_id) return;
    setCreating(true);
    setFormError(null);
    try {
      const hashtags = createForm.hashtags
        ? createForm.hashtags
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter((t) => t.length > 0)
        : null;
      const media_urls = parseMediaUrls(createForm.media_urls);
      await apiFetch("/api/social/posts", {
        method: "POST",
        body: JSON.stringify({
          social_account_id: createForm.social_account_id,
          platform: createForm.platform,
          caption: createForm.caption || null,
          hashtags,
          media_urls: media_urls.length > 0 ? media_urls : null,
          media_type: createForm.media_type || null,
          scheduled_at: createForm.scheduled_at
            ? new Date(createForm.scheduled_at).toISOString()
            : null,
          compound_phase: createForm.compound_phase || null,
          internal_notes: createForm.internal_notes || null,
        }),
      });
      setShowCreate(false);
      setCreateForm({
        social_account_id: "",
        platform: "instagram",
        caption: "",
        hashtags: "",
        media_urls: "",
        media_type: "",
        scheduled_at: "",
        compound_phase: "",
        internal_notes: "",
      });
      void fetchPosts();
    } catch (err) {
      setFormError(errorMessage(err, "Could not create social post."));
    } finally {
      setCreating(false);
    }
  };

  const handleConnect = async (platform: string) => {
    setConnectingPlatform(platform);
    setConnectError(null);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error("Your session expired. Sign in again before connecting a social account.");
      }

      const response = await fetch(
        `${API_URL}/api/social/oauth/${platform}/authorize?as_json=true`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
          credentials: "include",
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : `Could not start connect flow (${response.status}).`
        );
      }
      if (typeof body.authorization_url !== "string") {
        throw new Error("Connect flow did not return an authorization URL.");
      }
      window.location.assign(body.authorization_url);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not start the social connect flow.";
      setConnectError(message);
      setConnectingPlatform(null);
    }
  };

  const handlePublish = async (id: string) => {
    if (!confirm("Publish this post now?")) return;
    try {
      setActionError(null);
      await apiFetch(`/api/social/posts/${id}/publish`, { method: "POST" });
      void fetchPosts();
      setSelected(null);
    } catch (err) {
      setActionError(errorMessage(err, "Could not publish post."));
    }
  };

  const handleSchedule = async (id: string) => {
    try {
      setActionError(null);
      await apiFetch(`/api/social/posts/${id}/schedule`, { method: "POST" });
      void fetchPosts();
      setSelected(null);
    } catch (err) {
      setActionError(errorMessage(err, "Could not schedule post."));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    try {
      setActionError(null);
      await apiFetch(`/api/social/posts/${id}`, { method: "DELETE" });
      void fetchPosts();
      setSelected(null);
    } catch (err) {
      setActionError(errorMessage(err, "Could not delete post."));
    }
  };

  const filtered = posts.filter(
    (p) => !search || p.caption?.toLowerCase().includes(search.toLowerCase())
  );
  const createMediaUrls = parseMediaUrls(createForm.media_urls);
  const usesImageUpload =
    createForm.media_type === "image" || createForm.media_type === "carousel";
  const imageSlotCount =
    createForm.media_type === "carousel"
      ? Math.min(Math.max(createMediaUrls.length + 1, 2), 10)
      : 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Social Media</h1>
          <p className="text-muted-foreground text-sm">
            {accounts.length} account{accounts.length !== 1 ? "s" : ""} · {total} post{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setFormError(null);
            setShowCreate(true);
          }}
          disabled={accounts.length === 0}
          title={accounts.length === 0 ? "Connect a social account first" : "Create post"}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {accounts.map((account) => (
            <div key={account.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium shrink-0 ${PLATFORM_COLORS[account.platform] || "bg-gray-50"}`}>
              <span className="capitalize">{account.platform}</span>
              <span className="opacity-70">@{account.account_name}</span>
            </div>
          ))}
        </div>
      )}

      {accounts.length === 0 && !loading && (
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="font-semibold text-sm mb-1">Connect an account</h2>
              <p className="text-sm text-muted-foreground">
                Posts need a connected social profile before they can be drafted,
                scheduled, or published.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {CONNECT_PLATFORMS.map((platform) => (
                <button
                  key={platform.key}
                  type="button"
                  onClick={() => handleConnect(platform.key)}
                  disabled={connectingPlatform !== null}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-xs font-medium hover:border-foreground/30 disabled:opacity-50 transition"
                >
                  {connectingPlatform === platform.key ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ExternalLink className="w-3.5 h-3.5" />
                  )}
                  {platform.label}
                </button>
              ))}
            </div>
          </div>
          {connectError && (
            <p className="mt-3 text-xs text-red-600">{connectError}</p>
          )}
        </div>
      )}

      {/* Filters */}
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
          {["draft", "scheduled", "published"].map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(statusFilter === s ? null : s); setPage(1); }}
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

      {/* Phase + Platform filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Phase:</span>
          {[
            { value: "", label: "All" },
            { value: "protect", label: "Protect" },
            { value: "deepen", label: "Deepen" },
            { value: "amplify", label: "Amplify" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setPhaseFilter(opt.value); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                phaseFilter === opt.value
                  ? opt.value
                    ? PHASE_PILLS[opt.value] + " ring-2 ring-offset-1 ring-foreground/20"
                    : "bg-foreground text-white"
                  : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Platform:</span>
          <select
            value={platformFilter}
            onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
            className="px-3 py-1 rounded-full text-xs border border-border bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10"
          >
            <option value="">All</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="linkedin">LinkedIn</option>
            <option value="youtube">YouTube</option>
            <option value="x">X (Twitter)</option>
            <option value="pinterest">Pinterest</option>
          </select>
        </div>
      </div>

      {/* Posts grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-3" />
              <div className="h-16 bg-gray-100 rounded mb-3" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Share2 className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No posts found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <div
              key={post.id}
              onClick={() => {
                setActionError(null);
                setSelected(post);
              }}
              className="bg-white rounded-2xl border border-border overflow-hidden hover:border-foreground/20 cursor-pointer transition"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b border-border/50">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PLATFORM_COLORS[post.platform] || "bg-gray-50"}`}>
                  {post.platform}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[post.status]}`}>
                  {post.status}
                </span>
              </div>
              <div className="p-4">
                <p className="text-sm line-clamp-3 mb-3">{post.caption || "No caption"}</p>
                {post.status === "published" && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {post.likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {post.comments}</span>
                    <span className="flex items-center gap-1"><Repeat2 className="w-3 h-3" /> {post.shares}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {post.impressions}</span>
                  </div>
                )}
                {post.scheduled_at && post.status === "scheduled" && (
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {new Date(post.scheduled_at).toLocaleString()}
                  </p>
                )}
                {post.is_amplified && (
                  <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-stevie-chartreuse/30 text-[10px] font-semibold">Amplified</span>
                )}
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

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PLATFORM_COLORS[selected.platform]}`}>{selected.platform}</span>
                <h2 className="font-semibold text-lg">Post Details</h2>
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                {selected.compound_phase && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${PHASE_PILLS[selected.compound_phase] || ""}`}>
                    {selected.compound_phase}
                  </span>
                )}
                {selected.is_amplified && <span className="px-2 py-0.5 rounded-full bg-stevie-chartreuse/30 text-[10px] font-semibold">Amplified</span>}
                {(selected.status === "draft" || selected.status === "scheduled") && (
                  <button onClick={() => handlePublish(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground text-white text-xs font-medium hover:bg-foreground/90 transition"><Send className="w-3 h-3" /> Publish Now</button>
                )}
                {selected.status === "draft" && selected.scheduled_at && (
                  <button onClick={() => handleSchedule(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition"><Clock className="w-3 h-3" /> Schedule</button>
                )}
                {selected.status !== "published" && (
                  <button onClick={() => handleDelete(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium hover:bg-red-100 transition"><Trash2 className="w-3 h-3" /> Delete</button>
                )}
              </div>
              {actionError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {actionError}
                </div>
              )}

              <div className="space-y-3">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Caption</h3>
                <p className="text-sm whitespace-pre-wrap">{selected.caption || "No caption"}</p>
              </div>

              {selected.hashtags && selected.hashtags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selected.hashtags.map((tag, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-50 rounded-full text-[10px] text-muted-foreground">#{tag}</span>
                  ))}
                </div>
              )}

              {selected.status === "published" && (
                <div className="space-y-3">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Engagement</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{selected.likes}</p><p className="text-[10px] text-muted-foreground">Likes</p></div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{selected.comments}</p><p className="text-[10px] text-muted-foreground">Comments</p></div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{selected.shares}</p><p className="text-[10px] text-muted-foreground">Shares</p></div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{selected.impressions.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Impressions</p></div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{selected.reach.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Reach</p></div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center"><p className="text-lg font-bold">{selected.engagement_rate ? `${selected.engagement_rate.toFixed(1)}%` : "—"}</p><p className="text-[10px] text-muted-foreground">Eng. Rate</p></div>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground pt-4 border-t border-border space-y-1">
                <p>Created: {new Date(selected.created_at).toLocaleString()}</p>
                {selected.scheduled_at && <p>Scheduled: {new Date(selected.scheduled_at).toLocaleString()}</p>}
                {selected.published_at && <p>Published: {new Date(selected.published_at).toLocaleString()}</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Drawer */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">New Post</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Account *</label>
                <select value={createForm.social_account_id} onChange={(e) => { const acc = accounts.find(a => a.id === e.target.value); setCreateForm({ ...createForm, social_account_id: e.target.value, platform: acc?.platform || "instagram" }); }} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10">
                  <option value="">Select account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.platform} — @{a.account_name}</option>
                  ))}
                </select>
                {accounts.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">Connect a social account first via Settings.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Caption</label>
                <textarea value={createForm.caption} onChange={(e) => setCreateForm({ ...createForm, caption: e.target.value })} rows={5} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none" placeholder="Write your caption..." />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Hashtags</label>
                <input
                  type="text"
                  value={createForm.hashtags}
                  onChange={(e) => setCreateForm({ ...createForm, hashtags: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  placeholder="stevie, socialmedia, branding"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Comma-separated. # is optional.</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Media Type</label>
                <select value={createForm.media_type} onChange={(e) => setCreateForm({ ...createForm, media_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10">
                  <option value="">None (text only)</option>
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="carousel">Carousel</option>
                  <option value="reel">Reel/Short</option>
                </select>
              </div>
              {usesImageUpload ? (
                <div className="space-y-3">
                  <label className="block text-xs font-medium">Media</label>
                  {Array.from({ length: imageSlotCount }).map((_, index) => (
                    <ImageUpload
                      key={index}
                      value={createMediaUrls[index] ?? ""}
                      onChange={(url) =>
                        setCreateForm({
                          ...createForm,
                          media_urls: updateMediaUrlAt(
                            createForm.media_urls,
                            index,
                            url,
                          ),
                        })
                      }
                      context="social-post"
                      aspect="wide"
                      showUrlInput={false}
                    />
                  ))}
                </div>
              ) : createForm.media_type ? (
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Media URL
                  </label>
                  <input
                    type="text"
                    value={createForm.media_urls}
                    onChange={(e) => setCreateForm({ ...createForm, media_urls: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    placeholder="https://...mp4"
                  />
                </div>
              ) : null}
              <div>
                <label className="block text-xs font-medium mb-1">Schedule For</label>
                <input
                  type="datetime-local"
                  value={createForm.scheduled_at}
                  onChange={(e) => setCreateForm({ ...createForm, scheduled_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Leave blank to save as draft.</p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Compound Phase</label>
                <select value={createForm.compound_phase} onChange={(e) => setCreateForm({ ...createForm, compound_phase: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10">
                  <option value="">None</option>
                  <option value="protect">Protect</option>
                  <option value="deepen">Deepen</option>
                  <option value="amplify">Amplify</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Internal Notes</label>
                <textarea
                  value={createForm.internal_notes}
                  onChange={(e) => setCreateForm({ ...createForm, internal_notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none"
                />
              </div>
              <button onClick={handleCreate} disabled={creating || !createForm.social_account_id} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                {creating ? "Creating..." : "Create Post"}
              </button>
              {formError && (
                <p className="text-xs text-red-600">{formError}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
