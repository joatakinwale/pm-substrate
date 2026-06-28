"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Search,
  Send,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Shield,
  Heart,
  Zap,
  Trash2,
} from "lucide-react";
import {
  apiFetch,
  type ClientReport,
  type PaginatedResponse,
} from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  generated: "bg-blue-50 text-blue-700",
  draft: "bg-gray-50 text-gray-600",
  sent: "bg-green-50 text-green-700",
  viewed: "bg-purple-50 text-purple-700",
};

const PHASE_META: Record<string, { icon: typeof Shield; color: string }> = {
  protect: { icon: Shield, color: "text-stevie-sky" },
  deepen: { icon: Heart, color: "text-purple-600" },
  amplify: { icon: Zap, color: "text-foreground" },
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

export default function ClientReportsPage() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Drawer
  const [selected, setSelected] = useState<ClientReport | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [createForm, setCreateForm] = useState({
    title: "",
    client_name: "",
    client_email: "",
    cadence: "monthly",
    compound_phase: "",
    period_start: "",
    period_end: "",
    internal_notes: "",
  });
  const [creating, setCreating] = useState(false);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "20" });
    if (statusFilter) params.set("status", statusFilter);
    try {
      const data = await apiFetch<PaginatedResponse<ClientReport>>(
        `/api/reports?${params}`
      );
      setReports(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreate = async () => {
    if (!createForm.title || !createForm.period_start || !createForm.period_end) return;
    setCreating(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          ...createForm,
          compound_phase: createForm.compound_phase || null,
        }),
      });
      setShowCreate(false);
      setCreateForm({
        title: "",
        client_name: "",
        client_email: "",
        cadence: "monthly",
        compound_phase: "",
        period_start: "",
        period_end: "",
        internal_notes: "",
      });
      fetchReports();
    } catch {
      /* empty */
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (id: string) => {
    try {
      await apiFetch(`/api/reports/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "sent" }),
      });
      fetchReports();
      if (selected?.id === id) {
        setSelected((prev) =>
          prev ? { ...prev, status: "sent", sent_at: new Date().toISOString() } : null
        );
      }
    } catch {
      /* empty */
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this report? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/reports/${id}`, { method: "DELETE" });
      setSelected(null);
      fetchReports();
    } catch {
      /* empty */
    }
  };

  const filtered = reports.filter(
    (r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.client_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/analytics"
            className="p-2 rounded-full hover:bg-gray-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="heading-brand text-2xl">Client Reports</h1>
            <p className="text-muted-foreground text-sm">
              {total} report{total !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Report
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
          />
        </div>
        <div className="flex gap-2">
          {["generated", "draft", "sent", "viewed"].map((s) => (
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

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Report</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Phase</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td colSpan={6} className="px-4 py-4">
                    <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                  </td>
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  No reports found
                </td>
              </tr>
            ) : (
              filtered.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => setSelected(report)}
                  className="border-b border-border/50 hover:bg-gray-50 cursor-pointer transition"
                >
                  <td className="px-4 py-3 font-medium">{report.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {report.client_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    {report.compound_phase ? (
                      <span className="capitalize text-xs font-medium">
                        {report.compound_phase}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {report.period_start} → {report.period_end}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        STATUS_COLORS[report.status] || "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {new Date(report.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Page {page} of {pages}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page === pages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setSelected(null)}
          />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg truncate">{selected.title}</h2>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Status + actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    STATUS_COLORS[selected.status] || "bg-gray-50 text-gray-600"
                  }`}
                >
                  {selected.status}
                </span>
                {selected.status === "generated" && (
                  <button
                    onClick={() => handleSend(selected.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-foreground text-white text-xs font-medium hover:bg-foreground/90"
                  >
                    <Send className="w-3 h-3" /> Send
                  </button>
                )}
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>

              {/* Client info */}
              <div className="space-y-3">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Client
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Name</p>
                    <p className="font-medium">{selected.client_name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Email</p>
                    <p className="font-medium">{selected.client_email || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Period */}
              <div className="space-y-3">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Period
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Start</p>
                    <p className="font-medium">{selected.period_start}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">End</p>
                    <p className="font-medium">{selected.period_end}</p>
                  </div>
                </div>
                {selected.compound_phase && (
                  <div>
                    <p className="text-muted-foreground text-xs">Compound Phase</p>
                    <p className="font-medium capitalize">{selected.compound_phase}</p>
                  </div>
                )}
              </div>

              {/* Metrics Snapshot */}
              {selected.metrics_snapshot && Object.keys(selected.metrics_snapshot).length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Metrics Snapshot
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {selected.metrics_snapshot.total_invoices !== undefined && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground">Invoices</p>
                        <p className="text-lg font-bold">
                          {selected.metrics_snapshot.total_invoices as number}
                        </p>
                      </div>
                    )}
                    {selected.metrics_snapshot.revenue_cents !== undefined && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground">Revenue</p>
                        <p className="text-lg font-bold">
                          {formatCents(selected.metrics_snapshot.revenue_cents as number)}
                        </p>
                      </div>
                    )}
                    {selected.metrics_snapshot.active_subscriptions !== undefined && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground">Active Subs</p>
                        <p className="text-lg font-bold">
                          {selected.metrics_snapshot.active_subscriptions as number}
                        </p>
                      </div>
                    )}
                    {selected.metrics_snapshot.mrr_cents !== undefined && (
                      <div className="bg-gray-50 rounded-xl p-3">
                        <p className="text-[10px] text-muted-foreground">MRR</p>
                        <p className="text-lg font-bold">
                          {formatCents(selected.metrics_snapshot.mrr_cents as number)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Sections */}
              {selected.sections && selected.sections.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Sections
                  </h3>
                  <div className="space-y-2">
                    {selected.sections.map((s: { type: string; title: string }, i: number) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm"
                      >
                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{s.title}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {s.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal notes (never sent to client) */}
              {selected.internal_notes && (
                <div className="space-y-2">
                  <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Internal Notes
                  </h3>
                  <p className="text-sm whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-900">
                    {selected.internal_notes}
                  </p>
                </div>
              )}

              {/* Share link */}
              <div className="space-y-2">
                <h3 className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                  Share
                </h3>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    value={`${window.location.origin}/report/${selected.share_token}`}
                    className="flex-1 px-3 py-2 bg-gray-50 rounded-lg text-xs border border-border"
                  />
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/report/${selected.share_token}`
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-gray-100 text-xs hover:bg-gray-200 transition"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {/* Dates */}
              <div className="text-xs text-muted-foreground space-y-1 pt-4 border-t border-border">
                <p>Created: {new Date(selected.created_at).toLocaleString()}</p>
                {selected.sent_at && (
                  <p>Sent: {new Date(selected.sent_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Drawer ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/20"
            onClick={() => setShowCreate(false)}
          />
          <div className="relative w-full max-w-lg bg-white h-full overflow-y-auto shadow-xl animate-in slide-in-from-right">
            <div className="sticky top-0 bg-white border-b border-border px-6 py-4 flex items-center justify-between z-10">
              <h2 className="font-semibold text-lg">New Report</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="p-1.5 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1">Title *</label>
                <input
                  value={createForm.title}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  placeholder="March 2026 Performance Report"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Client Name</label>
                  <input
                    value={createForm.client_name}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, client_name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Client Email</label>
                  <input
                    type="email"
                    value={createForm.client_email}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, client_email: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Period Start *</label>
                  <input
                    type="date"
                    value={createForm.period_start}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, period_start: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Period End *</label>
                  <input
                    type="date"
                    value={createForm.period_end}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, period_end: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Cadence</label>
                  <select
                    value={createForm.cadence}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, cadence: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 bg-white"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Compound Phase
                  </label>
                  <select
                    value={createForm.compound_phase}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, compound_phase: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 bg-white"
                  >
                    <option value="">All Phases</option>
                    <option value="protect">Protect</option>
                    <option value="deepen">Deepen</option>
                    <option value="amplify">Amplify</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1">
                  Internal Notes
                </label>
                <textarea
                  value={createForm.internal_notes}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, internal_notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-foreground/10 resize-none"
                />
              </div>

              <button
                onClick={handleCreate}
                disabled={creating || !createForm.title || !createForm.period_start || !createForm.period_end}
                className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition"
              >
                {creating ? "Generating..." : "Generate Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
