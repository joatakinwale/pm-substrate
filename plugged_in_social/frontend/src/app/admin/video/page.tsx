"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  Search,
  Video,
  Film,
  X,
  ChevronLeft,
  ChevronRight,
  Archive,
  Play,
  HardDrive,
  Trash2,
  Pencil,
  Upload,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  apiFetch,
  type VideoAssetItem,
  type PaginatedResponse,
  type PresignedUploadResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-50 text-blue-700",
  processing: "bg-yellow-50 text-yellow-700",
  ready: "bg-green-50 text-green-700",
  archived: "bg-gray-50 text-gray-600",
};

const TYPE_LABELS: Record<string, string> = {
  raw: "Raw",
  edited: "Edited",
  final: "Final",
};

const ASSET_TYPES = ["raw", "edited", "final"] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPage() {
  const [assets, setAssets] = useState<VideoAssetItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<VideoAssetItem | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    client_name: "",
    campaign: "",
    asset_type: "",
    tags: "",
  });
  const [saving, setSaving] = useState(false);

  // Upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    client_name: "",
    campaign: "",
    asset_type: "raw",
    tags: "",
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("asset_type", typeFilter);
    try {
      const data = await apiFetch<PaginatedResponse<VideoAssetItem>>(`/api/video/assets?${params}`);
      setAssets(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Poll while any asset is still processing (Mux ingest can take a minute)
  useEffect(() => {
    const hasPending = assets.some(
      (a) => a.status === "uploaded" || a.status === "processing",
    );
    if (hasPending) {
      pollTimerRef.current = setTimeout(() => fetchAssets(), 8000);
    }
    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [assets, fetchAssets]);

  const handleArchive = async (id: string) => {
    try {
      await apiFetch(`/api/video/assets/${id}/archive`, { method: "POST" });
      fetchAssets();
      setSelected(null);
    } catch {
      /* empty */
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this video? This removes the R2 object, Mux asset, and DB row. This cannot be undone.")) return;
    try {
      await apiFetch(`/api/video/assets/${id}`, { method: "DELETE" });
      fetchAssets();
      setSelected(null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const openEdit = () => {
    if (!selected) return;
    setEditForm({
      client_name: selected.client_name ?? "",
      campaign: selected.campaign ?? "",
      asset_type: selected.asset_type ?? "",
      tags: (selected.tags ?? []).join(", "),
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        client_name: editForm.client_name.trim() || null,
        campaign: editForm.campaign.trim() || null,
        asset_type: editForm.asset_type.trim() || null,
        tags: editForm.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
      };
      const updated = await apiFetch<VideoAssetItem>(
        `/api/video/assets/${selected.id}`,
        { method: "PATCH", body: JSON.stringify(payload) },
      );
      setSelected(updated);
      setEditing(false);
      fetchAssets();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const resetUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadForm({ client_name: "", campaign: "", asset_type: "raw", tags: "" });
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      // Step 1: Ask backend for a presigned R2 upload URL
      const presigned = await apiFetch<PresignedUploadResponse>(
        `/api/media/upload`,
        {
          method: "POST",
          body: JSON.stringify({
            filename: uploadFile.name,
            content_type: uploadFile.type || "video/mp4",
            asset_type: "video",
            context: "video-library",
          }),
        },
      );

      if (!presigned.r2_key) {
        throw new Error(
          "Video uploads require R2 storage. The backend routed to Cloudflare Stream instead, which isn't supported for the Mux pipeline. Disable CF_STREAM in backend config.",
        );
      }

      // Step 2: PUT the file bytes directly to R2 using the presigned URL.
      // Using XMLHttpRequest so we can show upload progress — fetch() does
      // not surface progress events yet without streams (which aren't broadly
      // supported for request bodies in browsers).
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", presigned.upload_url);
        xhr.setRequestHeader("Content-Type", uploadFile.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`R2 upload failed: ${xhr.status} ${xhr.statusText}`));
        };
        xhr.onerror = () => reject(new Error("R2 upload network error"));
        xhr.send(uploadFile);
      });

      // Step 3: Register the VideoAsset row. The backend enqueues Mux ingest
      // from here — it doesn't need a second round-trip from the browser.
      await apiFetch(`/api/video/assets`, {
        method: "POST",
        body: JSON.stringify({
          filename: uploadFile.name,
          file_size_bytes: uploadFile.size,
          mime_type: uploadFile.type || "video/mp4",
          r2_key: presigned.r2_key,
          client_name: uploadForm.client_name.trim() || null,
          campaign: uploadForm.campaign.trim() || null,
          asset_type: uploadForm.asset_type || null,
          tags: uploadForm.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0),
        }),
      });

      resetUpload();
      fetchAssets();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  };

  const filtered = assets.filter(
    (a) =>
      !search ||
      a.filename.toLowerCase().includes(search.toLowerCase()) ||
      a.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Video Library</h1>
          <p className="text-muted-foreground text-sm">
            {total} asset{total !== 1 ? "s" : ""} · {formatBytes(assets.reduce((sum, a) => sum + a.file_size_bytes, 0))} total
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> Upload Video
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search videos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
        <div className="flex gap-2">
          {["uploaded", "processing", "ready", "archived"].map((s) => (
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
        <div className="flex gap-2">
          {ASSET_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(typeFilter === t ? null : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                typeFilter === t
                  ? "bg-foreground text-white border-foreground"
                  : "bg-white text-muted-foreground border-border hover:border-foreground/20"
              }`}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border overflow-hidden animate-pulse">
              <div className="h-32 bg-gray-100" />
              <div className="p-4"><div className="h-4 bg-gray-200 rounded w-3/4" /></div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Film className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((asset) => (
            <div
              key={asset.id}
              onClick={() => setSelected(asset)}
              className="bg-white rounded-2xl border border-border overflow-hidden hover:border-foreground/20 cursor-pointer transition"
            >
              <div className="h-32 bg-gray-900 relative flex items-center justify-center">
                {asset.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={asset.thumbnail_url} alt={asset.filename} className="w-full h-full object-cover" />
                ) : (
                  <Video className="w-8 h-8 text-gray-600" />
                )}
                {asset.duration_seconds && (
                  <span className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/70 text-white text-[10px] rounded font-mono">
                    {formatDuration(asset.duration_seconds)}
                  </span>
                )}
                {asset.mux_playback_id && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition bg-black/20">
                    <Play className="w-10 h-10 text-white drop-shadow-lg" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-medium text-sm truncate flex-1">{asset.filename}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ml-2 shrink-0 ${STATUS_COLORS[asset.status]}`}>
                    {asset.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{formatBytes(asset.file_size_bytes)}</span>
                  {asset.resolution && <span>{asset.resolution}</span>}
                  {asset.asset_type && (
                    <span className="px-1.5 py-0.5 bg-gray-50 rounded font-semibold">
                      {TYPE_LABELS[asset.asset_type] || asset.asset_type}
                    </span>
                  )}
                </div>
                {asset.client_name && (
                  <p className="text-[10px] text-muted-foreground mt-1">{asset.client_name}</p>
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

      {/* Upload Drawer */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => !uploading && resetUpload()} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">Upload Video</h2>
              <button
                onClick={resetUpload}
                disabled={uploading}
                className="p-1.5 rounded-full hover:bg-gray-100 disabled:opacity-40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Video File
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  disabled={uploading}
                  onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-muted-foreground file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-foreground file:text-white hover:file:bg-foreground/90 file:cursor-pointer"
                />
                {uploadFile && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {uploadFile.name} · {formatBytes(uploadFile.size)} · {uploadFile.type || "video/mp4"}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Asset Type
                  </label>
                  <select
                    value={uploadForm.asset_type}
                    onChange={(e) => setUploadForm({ ...uploadForm, asset_type: e.target.value })}
                    disabled={uploading}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:bg-gray-50"
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Client
                  </label>
                  <input
                    type="text"
                    value={uploadForm.client_name}
                    onChange={(e) => setUploadForm({ ...uploadForm, client_name: e.target.value })}
                    disabled={uploading}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:bg-gray-50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Campaign
                </label>
                <input
                  type="text"
                  value={uploadForm.campaign}
                  onChange={(e) => setUploadForm({ ...uploadForm, campaign: e.target.value })}
                  disabled={uploading}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  disabled={uploading}
                  placeholder="hero, reel, amplify"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 disabled:bg-gray-50"
                />
              </div>

              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" /> Uploading to R2
                    </span>
                    <span className="font-mono">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadError && (
                <div className="flex gap-2 items-start p-3 rounded-lg bg-red-50 text-red-700 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p>{uploadError}</p>
                </div>
              )}

              <div className="flex gap-2 pt-4 border-t border-border">
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? "Uploading..." : "Upload"}
                </button>
                <button
                  onClick={resetUpload}
                  disabled={uploading}
                  className="px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => { setSelected(null); setEditing(false); }} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg truncate">{selected.filename}</h2>
              <button onClick={() => { setSelected(null); setEditing(false); }} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-6">
              {/* Player / Thumbnail */}
              {selected.mux_playback_id ? (
                <div className="bg-black rounded-xl overflow-hidden">
                  <video
                    controls
                    className="w-full"
                    poster={selected.thumbnail_url || undefined}
                    src={`https://stream.mux.com/${selected.mux_playback_id}.m3u8`}
                  >
                    <source
                      src={`https://stream.mux.com/${selected.mux_playback_id}.m3u8`}
                      type="application/x-mpegURL"
                    />
                    Your browser does not support HLS video playback.
                  </video>
                </div>
              ) : (
                <div className="h-48 bg-gray-900 rounded-xl flex items-center justify-center">
                  {selected.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.thumbnail_url} alt={selected.filename} className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <Video className="w-12 h-12 text-gray-600" />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                {!editing && (
                  <button
                    onClick={openEdit}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium hover:bg-gray-200"
                  >
                    <Pencil className="w-3 h-3" /> Edit
                  </button>
                )}
                {selected.status === "ready" && !editing && (
                  <button onClick={() => handleArchive(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 text-xs font-medium hover:bg-gray-200">
                    <Archive className="w-3 h-3" /> Archive
                  </button>
                )}
                {!editing && (
                  <button
                    onClick={() => handleDelete(selected.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-medium hover:bg-red-100"
                  >
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Client</label>
                    <input
                      type="text"
                      value={editForm.client_name}
                      onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Campaign</label>
                    <input
                      type="text"
                      value={editForm.campaign}
                      onChange={(e) => setEditForm({ ...editForm, campaign: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Asset Type</label>
                    <select
                      value={editForm.asset_type}
                      onChange={(e) => setEditForm({ ...editForm, asset_type: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    >
                      <option value="">—</option>
                      {ASSET_TYPES.map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={editForm.tags}
                      onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      Save
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
                    <div><p className="text-muted-foreground text-xs">File Size</p><p className="font-medium">{formatBytes(selected.file_size_bytes)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Duration</p><p className="font-medium">{formatDuration(selected.duration_seconds)}</p></div>
                    <div><p className="text-muted-foreground text-xs">Resolution</p><p className="font-medium">{selected.resolution || "—"}</p></div>
                    <div><p className="text-muted-foreground text-xs">MIME Type</p><p className="font-mono text-xs">{selected.mime_type}</p></div>
                    <div><p className="text-muted-foreground text-xs">Client</p><p className="font-medium">{selected.client_name || "—"}</p></div>
                    <div><p className="text-muted-foreground text-xs">Campaign</p><p className="font-medium">{selected.campaign || "—"}</p></div>
                    <div><p className="text-muted-foreground text-xs">Asset Type</p><p className="font-medium capitalize">{selected.asset_type || "—"}</p></div>
                    <div><p className="text-muted-foreground text-xs">Mux Status</p><p className="font-medium">{selected.mux_status || "Not ingested"}</p></div>
                  </div>

                  {selected.tags && selected.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {selected.tags.map((tag, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-50 rounded-full text-[10px] text-muted-foreground">{tag}</span>
                      ))}
                    </div>
                  )}

                  <div className="space-y-2 pt-4 border-t border-border">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Storage</h3>
                    <div className="flex items-center gap-2 text-xs">
                      <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-mono text-muted-foreground truncate">{selected.r2_key}</span>
                    </div>
                    {selected.mux_playback_id && (
                      <div className="text-xs">
                        <span className="text-muted-foreground">Mux Playback ID: </span>
                        <span className="font-mono">{selected.mux_playback_id}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                    <p>Uploaded: {new Date(selected.created_at).toLocaleString()}</p>
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
