"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Send,
  Mail,
  BarChart3,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  MousePointerClick,
  Trash2,
  Clock,
} from "lucide-react";
import {
  apiFetch,
  type EmailCampaign,
  type PaginatedResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-50 text-gray-600",
  scheduled: "bg-blue-50 text-blue-700",
  sending: "bg-yellow-50 text-yellow-700",
  sent: "bg-green-50 text-green-700",
  paused: "bg-orange-50 text-orange-700",
  cancelled: "bg-red-50 text-red-700",
};

const BLOG_SUBSCRIBER_TAG = "blog-subscriber";

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function buildAudienceFilter(form: {
  audience_preset: string;
  audience_tags: string;
  audience_source: string;
}) {
  if (form.audience_preset === "blog_subscribers") {
    return {
      subscribed_only: true,
      tags: [BLOG_SUBSCRIBER_TAG],
    };
  }

  if (form.audience_preset === "custom") {
    const filter: Record<string, unknown> = { subscribed_only: true };
    const tags = parseCommaList(form.audience_tags);
    if (tags.length > 0) filter.tags = tags;
    if (form.audience_source.trim()) {
      filter.source = form.audience_source.trim();
    }
    return filter;
  }

  return { subscribed_only: true };
}

function formatAudience(audience: Record<string, unknown> | null) {
  if (!audience) return "All subscribed contacts";
  const tags = Array.isArray(audience.tags)
    ? audience.tags.filter((tag): tag is string => typeof tag === "string")
    : [];
  const source = typeof audience.source === "string" ? audience.source : "";
  if (tags.includes(BLOG_SUBSCRIBER_TAG)) return "Blog subscribers";
  if (tags.length > 0 && source) return `${tags.join(", ")} from ${source}`;
  if (tags.length > 0) return tags.join(", ");
  if (source) return `Source: ${source}`;
  return "All subscribed contacts";
}

export default function EmailCampaignsPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<EmailCampaign | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    subject: "",
    preview_text: "",
    from_name: "",
    from_email: "",
    reply_to: "",
    html_body: "",
    scheduled_at: "",
    compound_phase: "",
    audience_preset: "all_subscribed",
    audience_tags: "",
    audience_source: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const data = await apiFetch<PaginatedResponse<EmailCampaign>>(
        `/api/email/campaigns?${params}`
      );
      setCampaigns(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchCampaigns();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchCampaigns]);

  const handleCreate = async () => {
    if (!createForm.name) return;
    setCreating(true);
    try {
      await apiFetch("/api/email/campaigns", {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          subject: createForm.subject || null,
          preview_text: createForm.preview_text || null,
          from_name: createForm.from_name || null,
          from_email: createForm.from_email || null,
          reply_to: createForm.reply_to || null,
          html_body: createForm.html_body || null,
          scheduled_at: createForm.scheduled_at
            ? new Date(createForm.scheduled_at).toISOString()
            : null,
          compound_phase: createForm.compound_phase || null,
          audience_filter: buildAudienceFilter(createForm),
        }),
      });
      setShowCreate(false);
      setCreateForm({
        name: "",
        subject: "",
        preview_text: "",
        from_name: "",
        from_email: "",
        reply_to: "",
        html_body: "",
        scheduled_at: "",
        compound_phase: "",
        audience_preset: "all_subscribed",
        audience_tags: "",
        audience_source: "",
      });
      fetchCampaigns();
    } catch {
      /* empty */
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await apiFetch(`/api/email/campaigns/${id}/send`, { method: "POST" });
      fetchCampaigns();
      setSelected(null);
    } catch {
      /* empty */
    }
  };

  const handleSchedule = async (id: string) => {
    try {
      await apiFetch(`/api/email/campaigns/${id}/schedule`, { method: "POST" });
      fetchCampaigns();
      setSelected(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to schedule");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this draft campaign? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/email/campaigns/${id}`, { method: "DELETE" });
      fetchCampaigns();
      setSelected(null);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  const filtered = campaigns.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-2xl">Email Campaigns</h1>
          <p className="text-muted-foreground text-sm">{total} campaign{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
        <div className="flex gap-2">
          {["draft", "scheduled", "sending", "sent"].map((s) => (
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

      {/* Campaign cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-5 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-3 opacity-40" />
          <p>No campaigns found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => (
            <div
              key={campaign.id}
              onClick={() => setSelected(campaign)}
              className="bg-white rounded-2xl border border-border p-5 hover:border-foreground/20 cursor-pointer transition group"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-sm truncate flex-1">{campaign.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ml-2 shrink-0 ${
                    STATUS_COLORS[campaign.status] || "bg-gray-50 text-gray-600"
                  }`}
                >
                  {campaign.status}
                </span>
              </div>
              {campaign.subject && (
                <p className="text-xs text-muted-foreground mb-3 truncate">{campaign.subject}</p>
              )}
              {campaign.status === "sent" && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Sent</p>
                    <p className="text-sm font-bold">{campaign.total_sent}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Opens</p>
                    <p className="text-sm font-bold">{campaign.total_opened}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-[10px] text-muted-foreground">Clicks</p>
                    <p className="text-sm font-bold">{campaign.total_clicked}</p>
                  </div>
                </div>
              )}
              {campaign.compound_phase && (
                <p className="text-[10px] text-muted-foreground mt-2 capitalize">
                  {campaign.compound_phase} phase
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                {formatAudience(campaign.audience_filter)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
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
              <h2 className="font-semibold text-lg truncate">{selected.name}</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selected.status] || "bg-gray-50 text-gray-600"}`}>{selected.status}</span>
                {selected.status === "draft" && (
                  <>
                    <button onClick={() => handleSend(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground text-white text-xs font-medium hover:bg-foreground/90">
                      <Send className="w-3 h-3" /> Send Now
                    </button>
                    {selected.scheduled_at && (
                      <button onClick={() => handleSchedule(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-stevie-sky text-stevie-sky text-xs font-medium hover:bg-stevie-sky/5">
                        <Clock className="w-3 h-3" /> Schedule
                      </button>
                    )}
                    <button onClick={() => handleDelete(selected.id)} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-stevie-orange text-stevie-orange text-xs font-medium hover:bg-stevie-orange/5">
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </>
                )}
              </div>

              <div className="space-y-3">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-muted-foreground text-xs">Subject</p><p className="font-medium">{selected.subject || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">From</p><p className="font-medium">{selected.from_name || "—"}</p></div>
                  <div><p className="text-muted-foreground text-xs">Recipients</p><p className="font-medium">{selected.recipient_count}</p></div>
                  <div><p className="text-muted-foreground text-xs">Phase</p><p className="font-medium capitalize">{selected.compound_phase || "—"}</p></div>
                  <div className="col-span-2"><p className="text-muted-foreground text-xs">Audience</p><p className="font-medium">{formatAudience(selected.audience_filter)}</p></div>
                </div>
              </div>

              {selected.status === "sent" && (
                <div className="space-y-3">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Performance</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <Eye className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{selected.total_opened}</p>
                      <p className="text-[10px] text-muted-foreground">Opens</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <MousePointerClick className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{selected.total_clicked}</p>
                      <p className="text-[10px] text-muted-foreground">Clicks</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <BarChart3 className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                      <p className="text-lg font-bold">{selected.total_bounced}</p>
                      <p className="text-[10px] text-muted-foreground">Bounced</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border">
                <p>Created: {new Date(selected.created_at).toLocaleString()}</p>
                {selected.sent_at && <p>Sent: {new Date(selected.sent_at).toLocaleString()}</p>}
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
              <h2 className="font-semibold text-lg">New Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Campaign Name *</label>
                <input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="April Newsletter" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Subject Line</label>
                <input value={createForm.subject} onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="Your monthly update from Stevie" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Preview Text</label>
                <input value={createForm.preview_text} onChange={(e) => setCreateForm({ ...createForm, preview_text: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="Shown after the subject in inbox previews" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">From Name</label>
                  <input value={createForm.from_name} onChange={(e) => setCreateForm({ ...createForm, from_name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="Stevie Social" />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">From Email</label>
                  <input value={createForm.from_email} onChange={(e) => setCreateForm({ ...createForm, from_email: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="hello@stevie.social" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Reply To</label>
                <input value={createForm.reply_to} onChange={(e) => setCreateForm({ ...createForm, reply_to: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10" placeholder="team@stevie.social (optional)" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">HTML Body</label>
                <textarea
                  value={createForm.html_body}
                  onChange={(e) => setCreateForm({ ...createForm, html_body: e.target.value })}
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  placeholder="<h1>Hello {{first_name}}</h1>…"
                />
                <p className="text-[11px] text-muted-foreground mt-1">Use &#123;&#123;first_name&#125;&#125; and other merge tags.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Schedule For</label>
                  <input
                    type="datetime-local"
                    value={createForm.scheduled_at}
                    onChange={(e) => setCreateForm({ ...createForm, scheduled_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Compound Phase</label>
                  <select value={createForm.compound_phase} onChange={(e) => setCreateForm({ ...createForm, compound_phase: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 bg-white">
                    <option value="">All</option>
                    <option value="protect">Protect</option>
                    <option value="deepen">Deepen</option>
                    <option value="amplify">Amplify</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Audience</label>
                <select
                  value={createForm.audience_preset}
                  onChange={(e) => setCreateForm({ ...createForm, audience_preset: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 bg-white"
                >
                  <option value="all_subscribed">All subscribed contacts</option>
                  <option value="blog_subscribers">Blog subscribers</option>
                  <option value="custom">Custom tags/source</option>
                </select>
              </div>
              {createForm.audience_preset === "custom" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Tags</label>
                    <input
                      value={createForm.audience_tags}
                      onChange={(e) => setCreateForm({ ...createForm, audience_tags: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                      placeholder="newsletter, customer"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Source</label>
                    <input
                      value={createForm.audience_source}
                      onChange={(e) => setCreateForm({ ...createForm, audience_source: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                      placeholder="blog_launch"
                    />
                  </div>
                </div>
              )}
              <button onClick={handleCreate} disabled={creating || !createForm.name} className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition">
                {creating ? "Creating..." : "Create Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
