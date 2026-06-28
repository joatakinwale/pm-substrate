"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Copy,
  X,
  ChevronLeft,
  ChevronRight,
  Mic,
  Trash2,
  Star,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import {
  apiFetch,
  type AIContentRequestItem,
  type AIProviderStatus,
  type BrandVoiceProfile,
  type PaginatedResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-gray-50 text-gray-600",
  queued: "bg-gray-50 text-gray-600",
  generating: "bg-yellow-50 text-yellow-700",
  retrying: "bg-yellow-50 text-yellow-700",
  completed: "bg-green-50 text-green-700",
  approved: "bg-blue-50 text-blue-700",
  rejected: "bg-red-50 text-red-600",
  failed: "bg-red-50 text-red-700",
};

const CONTENT_TYPES = [
  { value: "caption", label: "Social Caption" },
  { value: "blog_post", label: "Blog Post" },
  { value: "email_copy", label: "Email Copy" },
  { value: "hashtags", label: "Hashtags" },
  { value: "script", label: "Video Script" },
];

const ACTIVE_GENERATION_STATUSES = new Set([
  "pending",
  "queued",
  "generating",
  "retrying",
]);

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function AIContentPage() {
  const [requests, setRequests] = useState<AIContentRequestItem[]>([]);
  const [voices, setVoices] = useState<BrandVoiceProfile[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AIContentRequestItem | null>(null);
  const [selectedVoice, setSelectedVoice] = useState<BrandVoiceProfile | null>(null);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showCreateVoice, setShowCreateVoice] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [feedbackNote, setFeedbackNote] = useState("");
  const [providerStatus, setProviderStatus] = useState<AIProviderStatus | null>(null);

  const [genForm, setGenForm] = useState({
    content_type: "caption",
    prompt: "",
    brand_voice_id: "",
    platform: "",
    model: "auto",
  });
  const [modelMode, setModelMode] = useState<"auto" | "preset" | "custom">("auto");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const [voiceForm, setVoiceForm] = useState({
    name: "",
    client_name: "",
    tone_descriptors: "",
    use_words: "",
    avoid_words: "",
    example_pieces: "",
    guardrails: "",
  });
  const [creatingVoice, setCreatingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (options?: { showLoading?: boolean }) => {
    const showLoading = options?.showLoading ?? true;
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("content_type", typeFilter);
    await Promise.resolve();
    if (showLoading) setLoading(true);
    try {
      setLoadError(null);
      const [contentData, voicesData, providerStatusData] = await Promise.all([
        apiFetch<PaginatedResponse<AIContentRequestItem>>(`/api/ai/content?${params}`),
        apiFetch<BrandVoiceProfile[]>("/api/ai/brand-voices"),
        apiFetch<AIProviderStatus>("/api/ai/content/provider-status").catch(() => null),
      ]);
      setRequests(contentData.items);
      setTotal(contentData.total);
      setPages(contentData.pages);
      setVoices(voicesData);
      setProviderStatus(providerStatusData);
    } catch (err) {
      setLoadError(errorMessage(err, "Could not load AI content."));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    const initialFetchTimer = setTimeout(() => {
      void fetchData();
    }, 0);
    return () => clearTimeout(initialFetchTimer);
  }, [fetchData]);

  // Poll while anything is generating
  useEffect(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const hasGenerating = requests.some((r) =>
      ACTIVE_GENERATION_STATUSES.has(r.status),
    );
    if (hasGenerating) {
      pollTimerRef.current = setTimeout(() => {
        void fetchData({ showLoading: false });
      }, 4000);
    }
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [requests, fetchData]);

  const handleGenerate = async () => {
    if (!genForm.prompt.trim()) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      await apiFetch("/api/ai/content/generate", {
        method: "POST",
        body: JSON.stringify({
          ...genForm,
          // If custom mode but no model typed yet, fall back to auto
          model: genForm.model || "auto",
          brand_voice_id: genForm.brand_voice_id || null,
          platform: genForm.platform || null,
        }),
      });
      setShowGenerate(false);
      setGenForm({ content_type: "caption", prompt: "", brand_voice_id: "", platform: "", model: "auto" });
      setModelMode("auto");
      void fetchData();
    } catch (err) {
      setGenerateError(
        errorMessage(err, "Could not queue AI generation. Check worker configuration."),
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleFeedback = async (id: string, rating: number, note?: string) => {
    try {
      setFeedbackError(null);
      await apiFetch(`/api/ai/content/${id}/feedback`, {
        method: "POST",
        body: JSON.stringify({ rating, feedback_note: note || null }),
      });
      void fetchData();
      setFeedbackNote("");
    } catch (err) {
      setFeedbackError(errorMessage(err, "Could not save feedback."));
    }
  };

  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleRetry = async (id: string) => {
    setRetrying(true);
    setRetryError(null);
    try {
      const updated = await apiFetch<AIContentRequestItem>(
        `/api/ai/content/${id}/retry`,
        { method: "POST" },
      );
      setSelected(updated);
      void fetchData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Retry failed — check worker config";
      setRetryError(message);
    } finally {
      setRetrying(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm("Delete this content request? This cannot be undone.")) return;
    setDeleting(true);
    setRetryError(null);
    try {
      await apiFetch(`/api/ai/content/${id}`, { method: "DELETE" });
      setSelected(null);
      void fetchData();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Delete failed";
      setRetryError(message);
    } finally {
      setDeleting(false);
    }
  };

  const csvToList = (v: string) => v.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  const csvToLines = (v: string) => v.split(/\n|\|/).map((s) => s.trim()).filter((s) => s.length > 0);

  const handleCreateVoice = async () => {
    if (!voiceForm.name) return;
    setCreatingVoice(true);
    setVoiceError(null);
    try {
      const use_words = csvToList(voiceForm.use_words);
      const avoid_words = csvToList(voiceForm.avoid_words);
      const vocabulary_preferences =
        use_words.length || avoid_words.length ? { use: use_words, avoid: avoid_words } : null;
      await apiFetch("/api/ai/brand-voices", {
        method: "POST",
        body: JSON.stringify({
          name: voiceForm.name,
          client_name: voiceForm.client_name || null,
          tone_descriptors: csvToList(voiceForm.tone_descriptors),
          vocabulary_preferences,
          example_pieces: csvToLines(voiceForm.example_pieces),
          guardrails: csvToLines(voiceForm.guardrails),
        }),
      });
      setShowCreateVoice(false);
      setVoiceForm({
        name: "",
        client_name: "",
        tone_descriptors: "",
        use_words: "",
        avoid_words: "",
        example_pieces: "",
        guardrails: "",
      });
      void fetchData();
    } catch (err) {
      setVoiceError(errorMessage(err, "Could not create brand voice."));
    } finally {
      setCreatingVoice(false);
    }
  };

  const handleDeleteVoice = async (id: string) => {
    if (!confirm("Delete this brand voice profile?")) return;
    try {
      setVoiceError(null);
      await apiFetch(`/api/ai/brand-voices/${id}`, { method: "DELETE" });
      setSelectedVoice(null);
      void fetchData();
    } catch (err) {
      setVoiceError(errorMessage(err, "Could not delete brand voice."));
    }
  };

  const handleToggleDefault = async (voice: BrandVoiceProfile) => {
    try {
      setVoiceError(null);
      await apiFetch(`/api/ai/brand-voices/${voice.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_default: !voice.is_default }),
      });
      void fetchData();
      setSelectedVoice(null);
    } catch (err) {
      setVoiceError(errorMessage(err, "Could not update brand voice."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">AI Content</h1>
          <p className="text-muted-foreground text-sm">
            {voices.length} voice profile{voices.length !== 1 ? "s" : ""} · {total} generation{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => {
            setGenerateError(null);
            setShowGenerate(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Sparkles className="w-4 h-4" /> Generate Content
        </button>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      )}

      {providerStatus && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">AI provider routing</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${providerStatus.queue_configured ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  Queue {providerStatus.queue_configured ? "ready" : "not configured"}
                </span>
              </div>
              {providerStatus.warnings.slice(0, 2).map((warning) => (
                <p key={warning} className="text-xs leading-relaxed">
                  {warning}
                </p>
              ))}
              <p className="break-all font-mono text-[10px] text-amber-800">
                Auto {genForm.content_type}: {(providerStatus.content_type_chains[genForm.content_type]?.models || [providerStatus.default_model]).join(" -> ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Brand Voice Profiles */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Brand Voice Profiles</h2>
          <button
            onClick={() => {
              setVoiceError(null);
              setShowCreateVoice(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-medium hover:bg-purple-100 transition"
          >
            <Plus className="w-3 h-3" /> New Voice
          </button>
        </div>
        {voices.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No brand voices defined yet. Click &quot;New Voice&quot; to create one.
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1">
            {voices.map((voice) => (
              <button
                type="button"
                key={voice.id}
                onClick={() => {
                  setVoiceError(null);
                  setSelectedVoice(voice);
                }}
                className="bg-white rounded-2xl border border-border p-4 min-w-[200px] shrink-0 text-left hover:border-foreground/20 transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Mic className="w-4 h-4 text-purple-500" />
                  <h3 className="font-semibold text-sm">{voice.name}</h3>
                  {voice.is_default && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[9px] font-semibold">Default</span>}
                </div>
                {voice.client_name && <p className="text-xs text-muted-foreground">{voice.client_name}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {voice.tone_descriptors.slice(0, 3).map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-gray-50 rounded text-[9px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Type:</span>
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            className="px-3 py-1 rounded-full text-xs border border-border bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10"
          >
            <option value="">All</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Status:</span>
          {[
            { value: "", label: "All" },
            { value: "queued", label: "Queued" },
            { value: "generating", label: "Generating" },
            { value: "retrying", label: "Retrying" },
            { value: "completed", label: "Completed" },
            { value: "approved", label: "Approved" },
            { value: "rejected", label: "Rejected" },
            { value: "failed", label: "Failed" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1); }}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition ${
                statusFilter === opt.value
                  ? "bg-foreground text-white"
                  : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void fetchData()}
          className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Content requests */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-2" />
              <div className="h-12 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No content generated yet</p>
          <p className="text-xs mt-1">Click &quot;Generate Content&quot; to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div
              key={req.id}
              onClick={() => {
                setRetryError(null);
                setFeedbackError(null);
                setSelected(req);
              }}
              className="bg-white rounded-2xl border border-border p-5 hover:border-foreground/20 cursor-pointer transition"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-semibold capitalize">{req.content_type.replace(/_/g, " ")}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[req.status]}`}>{req.status}</span>
                  {req.platform && <span className="text-[10px] text-muted-foreground capitalize">{req.platform}</span>}
                </div>
                <div className="flex items-center gap-1">
                  {req.rating === 5 && <ThumbsUp className="w-3.5 h-3.5 text-green-500" />}
                  {req.rating === 1 && <ThumbsDown className="w-3.5 h-3.5 text-red-500" />}
                </div>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1 mb-1">{req.prompt}</p>
              {req.generated_content && (
                <p className="text-sm line-clamp-2">{req.generated_content}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                {req.model} · {req.input_tokens + req.output_tokens} tokens · {req.latency_ms}ms
              </p>
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
              <h2 className="font-semibold text-lg capitalize">{selected.content_type.replace(/_/g, " ")}</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status]}`}>{selected.status}</span>
                {selected.platform && <span className="text-xs text-muted-foreground capitalize">{selected.platform}</span>}
                {(selected.status === "queued" || selected.status === "failed" || selected.status === "pending") && (
                  <button
                    onClick={() => handleRetry(selected.id)}
                    disabled={retrying || deleting}
                    className="ml-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-foreground text-white text-xs font-medium hover:bg-foreground/90 disabled:opacity-50 transition"
                  >
                    <RefreshCw className={`w-3 h-3 ${retrying ? "animate-spin" : ""}`} />
                    {retrying ? "Retrying…" : "Retry"}
                  </button>
                )}
                {selected.status !== "generating" && (
                  <button
                    onClick={() => handleDeleteRequest(selected.id)}
                    disabled={retrying || deleting}
                    className={`${selected.status === "queued" || selected.status === "failed" || selected.status === "pending" ? "" : "ml-auto"} inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium disabled:opacity-50 transition`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleting ? "Deleting…" : "Delete"}
                  </button>
                )}
              </div>

              {retryError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {retryError}
                </div>
              )}

              {selected.error_message && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="font-semibold mb-1">Last error</p>
                  <p className="whitespace-pre-wrap">{selected.error_message}</p>
                </div>
              )}

              <div><h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Prompt</h3><p className="text-sm bg-gray-50 rounded-lg p-3">{selected.prompt}</p></div>

              {selected.generated_content && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Generated Content</h3>
                    <button onClick={() => navigator.clipboard.writeText(selected.generated_content || "")} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-xs hover:bg-gray-200 transition"><Copy className="w-3 h-3" /> Copy</button>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap">{selected.generated_content}</div>
                </div>
              )}

              {selected.status === "completed" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <p className="text-xs text-muted-foreground">Rate this output:</p>
                    <button onClick={() => handleFeedback(selected.id, 5, feedbackNote)} className={`p-2 rounded-lg ${selected.rating === 5 ? "bg-green-100" : "hover:bg-gray-100"}`}><ThumbsUp className={`w-4 h-4 ${selected.rating === 5 ? "text-green-600" : "text-muted-foreground"}`} /></button>
                    <button onClick={() => handleFeedback(selected.id, 1, feedbackNote)} className={`p-2 rounded-lg ${selected.rating === 1 ? "bg-red-100" : "hover:bg-gray-100"}`}><ThumbsDown className={`w-4 h-4 ${selected.rating === 1 ? "text-red-600" : "text-muted-foreground"}`} /></button>
                    {selected.feedback_note && (
                      <span className="text-[10px] text-muted-foreground italic truncate">
                        Previous note: {selected.feedback_note}
                      </span>
                    )}
                  </div>
                  {feedbackError && (
                    <p className="text-xs text-red-600">{feedbackError}</p>
                  )}
                  <textarea
                    value={feedbackNote}
                    onChange={(e) => setFeedbackNote(e.target.value)}
                    rows={2}
                    placeholder="Optional feedback note (why it worked / didn't)..."
                    className="w-full px-3 py-2 rounded-lg border border-border text-xs focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm pt-4 border-t border-border">
                <div><p className="text-muted-foreground text-xs">Model</p><p className="font-mono text-xs">{selected.model}</p></div>
                <div><p className="text-muted-foreground text-xs">Latency</p><p>{selected.latency_ms}ms</p></div>
                <div><p className="text-muted-foreground text-xs">Tokens</p><p>{selected.input_tokens} in / {selected.output_tokens} out</p></div>
                <div><p className="text-muted-foreground text-xs">Cost</p><p>${(selected.cost_cents / 100).toFixed(4)}</p></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Detail Drawer */}
      {selectedVoice && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setSelectedVoice(null)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-500" />
                <h2 className="font-semibold text-lg">{selectedVoice.name}</h2>
              </div>
              <button onClick={() => setSelectedVoice(null)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 flex-wrap">
                {selectedVoice.is_default && (
                  <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-[11px] font-semibold">Default</span>
                )}
                <button
                  onClick={() => handleToggleDefault(selectedVoice)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-medium transition"
                >
                  <Star className="w-3 h-3" />
                  {selectedVoice.is_default ? "Unset default" : "Set as default"}
                </button>
                <button
                  onClick={() => handleDeleteVoice(selectedVoice.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
              {voiceError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {voiceError}
                </div>
              )}
              {selectedVoice.client_name && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Client</p>
                  <p className="text-sm font-medium">{selectedVoice.client_name}</p>
                </div>
              )}
              {selectedVoice.tone_descriptors.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Tone</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedVoice.tone_descriptors.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 rounded-full text-xs">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedVoice.vocabulary_preferences && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Vocabulary</p>
                  {Array.isArray(selectedVoice.vocabulary_preferences?.use) &&
                    (selectedVoice.vocabulary_preferences.use as string[]).length > 0 && (
                    <div>
                      <p className="text-[11px] text-green-700 mb-1">Use:</p>
                      <div className="flex flex-wrap gap-1">
                        {(selectedVoice.vocabulary_preferences.use as string[]).map((w, i) => (
                          <span key={i} className="px-2 py-0.5 bg-green-50 text-green-800 rounded-full text-xs">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {Array.isArray(selectedVoice.vocabulary_preferences?.avoid) &&
                    (selectedVoice.vocabulary_preferences.avoid as string[]).length > 0 && (
                    <div>
                      <p className="text-[11px] text-red-700 mb-1">Avoid:</p>
                      <div className="flex flex-wrap gap-1">
                        {(selectedVoice.vocabulary_preferences.avoid as string[]).map((w, i) => (
                          <span key={i} className="px-2 py-0.5 bg-red-50 text-red-700 rounded-full text-xs">{w}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {selectedVoice.example_pieces.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Examples</p>
                  <div className="space-y-2">
                    {selectedVoice.example_pieces.map((ex, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-2 text-xs italic">&quot;{ex}&quot;</div>
                    ))}
                  </div>
                </div>
              )}
              {selectedVoice.guardrails.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Guardrails</p>
                  <ul className="space-y-1 text-xs list-disc list-inside">
                    {selectedVoice.guardrails.map((g, i) => (
                      <li key={i}>{g}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedVoice.system_prompt && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Compiled System Prompt</p>
                  <pre className="bg-gray-50 rounded-lg p-3 text-[11px] font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">{selectedVoice.system_prompt}</pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voice Create Drawer */}
      {showCreateVoice && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowCreateVoice(false)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">New Brand Voice</h2>
              <button onClick={() => setShowCreateVoice(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Voice Name *</label>
                <input value={voiceForm.name} onChange={(e) => setVoiceForm({ ...voiceForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="Bright & Playful" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Client Name</label>
                <input value={voiceForm.client_name} onChange={(e) => setVoiceForm({ ...voiceForm, client_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="Acme Yoga Co" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tone Descriptors</label>
                <input value={voiceForm.tone_descriptors} onChange={(e) => setVoiceForm({ ...voiceForm, tone_descriptors: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="warm, witty, grounded" />
                <p className="text-[11px] text-muted-foreground mt-1">Comma-separated.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1 text-green-700">Use Words</label>
                  <input value={voiceForm.use_words} onChange={(e) => setVoiceForm({ ...voiceForm, use_words: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="aligned, intentional" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1 text-red-700">Avoid Words</label>
                  <input value={voiceForm.avoid_words} onChange={(e) => setVoiceForm({ ...voiceForm, avoid_words: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="synergy, disrupt" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Example Pieces</label>
                <textarea value={voiceForm.example_pieces} onChange={(e) => setVoiceForm({ ...voiceForm, example_pieces: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none" placeholder="One example per line (or separated by |)" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Guardrails</label>
                <textarea value={voiceForm.guardrails} onChange={(e) => setVoiceForm({ ...voiceForm, guardrails: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none" placeholder="No medical claims. Never capitalize product names. One rule per line." />
              </div>
              <button onClick={handleCreateVoice} disabled={creatingVoice || !voiceForm.name} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                {creatingVoice ? "Creating..." : "Create Brand Voice"}
              </button>
              {voiceError && (
                <p className="text-xs text-red-600">{voiceError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Drawer */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowGenerate(false)} />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">Generate Content</h2>
              <button onClick={() => setShowGenerate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Content Type</label>
                <select value={genForm.content_type} onChange={(e) => setGenForm({ ...genForm, content_type: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10">
                  {CONTENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Brand Voice</label>
                <select value={genForm.brand_voice_id} onChange={(e) => setGenForm({ ...genForm, brand_voice_id: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10">
                  <option value="">No brand voice</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}{v.client_name ? ` (${v.client_name})` : ""}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Platform</label>
                <select value={genForm.platform} onChange={(e) => setGenForm({ ...genForm, platform: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10">
                  <option value="">General</option>
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="youtube">YouTube</option>
                  <option value="facebook">Facebook</option>
                  <option value="x">X / Twitter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Model</label>
                <select
                  value={
                    modelMode === "custom"
                      ? "__custom__"
                      : modelMode === "preset"
                        ? genForm.model
                        : "auto"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "auto") {
                      // Backend resolves the chain from content_type +
                      // per-org config + AI_MODEL_<TYPE> env. Length > 1
                      // triggers the Universal Endpoint fallback path.
                      setModelMode("auto");
                      setGenForm({ ...genForm, model: "auto" });
                    } else if (v === "__custom__") {
                      setModelMode("custom");
                      setGenForm({ ...genForm, model: "" });
                    } else {
                      setModelMode("preset");
                      setGenForm({ ...genForm, model: v });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-foreground/10"
                >
                  <option value="auto">Auto — Workers AI first + fallback (recommended)</option>
                  <optgroup label="Cloudflare Workers AI (preferred while provider billing is unstable)">
                    <option value="@cf/meta/llama-3.1-8b-instruct">Llama 3.1 8B Instruct</option>
                    <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B FP8 Fast</option>
                    <option value="@cf/meta/llama-4-scout-17b-16e-instruct">Llama 4 Scout 17B</option>
                    <option value="@cf/openai/gpt-oss-120b">GPT-OSS 120B</option>
                    <option value="@cf/openai/gpt-oss-20b">GPT-OSS 20B</option>
                  </optgroup>
                  <optgroup label="Google AI Studio">
                    <option value="gemini-3-pro-preview">Gemini 3.1 Pro Preview</option>
                    <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash — cheap</option>
                  </optgroup>
                  <optgroup label="Anthropic — current">
                    <option value="claude-opus-4-7">Claude Opus 4.7 — highest quality</option>
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6 — balanced</option>
                    <option value="claude-haiku-4-5">Claude Haiku 4.5 — fastest</option>
                  </optgroup>
                  <optgroup label="Anthropic — legacy">
                    <option value="claude-opus-4-6">Claude Opus 4.6</option>
                    <option value="claude-sonnet-4-5">Claude Sonnet 4.5</option>
                    <option value="claude-opus-4-5">Claude Opus 4.5</option>
                  </optgroup>
                  <optgroup label="OpenAI">
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o mini — cheap</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="o3-mini">o3-mini — reasoning</option>
                  </optgroup>
                  <option value="__custom__">Custom model id…</option>
                </select>
                {modelMode === "custom" && (
                    <input
                      type="text"
                      value={genForm.model}
                      onChange={(e) => setGenForm({ ...genForm, model: e.target.value })}
                      placeholder="e.g. claude-3-7-sonnet-20250219 or @cf/qwen/qwen2.5-coder-32b-instruct"
                      className="mt-2 w-full px-3 py-2 rounded-lg border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-foreground/10"
                    />
                  )}
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Auto routes by content type with Workers AI first, then
                  provider fallback where configured. Pick a specific model to
                  override.
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Prompt *</label>
                <textarea value={genForm.prompt} onChange={(e) => setGenForm({ ...genForm, prompt: e.target.value })} rows={6} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none" placeholder="Write a caption about our new spring collection. Focus on community and alignment with nature..." />
              </div>
              {generateError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {generateError}
                </div>
              )}
              <button onClick={handleGenerate} disabled={generating || !genForm.prompt.trim()} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                {generating ? "Queueing..." : "Queue generation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
