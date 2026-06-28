"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Plus,
  Trash2,
  Save,
  Download,
} from "lucide-react";
import { apiFetch, ApiError, type Lead, type PaginatedResponse } from "@/lib/api";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "proposal_sent", label: "Proposal Sent" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

const STATUS_COLORS: Record<string, string> = {
  new: "bg-stevie-sky/10 text-stevie-sky",
  contacted: "bg-stevie-lavender/20 text-purple-700",
  qualified: "bg-stevie-green/10 text-stevie-green",
  proposal_sent: "bg-stevie-chartreuse/30 text-foreground",
  won: "bg-stevie-green/20 text-stevie-green",
  lost: "bg-stevie-orange/10 text-stevie-orange",
};

const REVENUE_RANGES = [
  { value: "", label: "—" },
  { value: "under_100k", label: "<$100K" },
  { value: "100k_500k", label: "$100K–$500K" },
  { value: "500k_1m", label: "$500K–$1M" },
  { value: "1m_5m", label: "$1M–$5M" },
  { value: "5m_plus", label: "$5M+" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRevenue(range: string | null) {
  if (!range) return "—";
  const found = REVENUE_RANGES.find((r) => r.value === range);
  return found?.label || range;
}

interface MyPermissions {
  role: string;
  permissions: string[];
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [perms, setPerms] = useState<MyPermissions | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "20" });
      if (status) params.set("status", status);
      if (search) params.set("search", search);

      const data = await apiFetch<PaginatedResponse<Lead>>(
        `/api/leads?${params.toString()}`
      );
      setLeads(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setLeads([]);
      setTotal(0);
      setPages(0);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Fetch permissions once so we can gate delete + bulk actions.
  useEffect(() => {
    apiFetch<MyPermissions>("/team/me/permissions")
      .then(setPerms)
      .catch(() => setPerms(null));
  }, []);

  // ═══ Real-time subscription — refetch list on any lead event so that
  // a new intake submission from the public form toasts instantly without
  // waiting for the user to refresh. ═══
  const fetchLeadsRef = useRef(fetchLeads);
  fetchLeadsRef.current = fetchLeads;
  useRealtime({
    onAny: (evt) => {
      if (!evt.event.startsWith("lead.")) return;
      fetchLeadsRef.current();
      // Surface a short-lived toast for created/qualified events only.
      const action = evt.event.split(".")[1];
      if (action === "created") {
        const name =
          (evt.payload?.name as string) ||
          (evt.payload?.email as string) ||
          "New lead";
        setToast(`📥 New lead: ${name}`);
        setTimeout(() => setToast(null), 4000);
      }
    },
  });

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  async function updateLeadStatus(leadId: string, newStatus: string) {
    try {
      const updated = await apiFetch<Lead>(`/api/leads/${leadId}`, {
        method: "PATCH",
        body: JSON.stringify({ qualification_status: newStatus }),
      });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      if (selected?.id === leadId) setSelected(updated);
    } catch {
      /* noop */
    }
  }

  const canDelete =
    perms?.permissions.includes("leads.delete") ||
    perms?.role === "admin" ||
    perms?.role === "owner";

  async function deleteLead(leadId: string) {
    if (!confirm("Delete this lead? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/leads/${leadId}`, { method: "DELETE" });
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setSelected(null);
      setToast("Lead deleted");
      setTimeout(() => setToast(null), 3000);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Failed to delete lead.";
      alert(msg);
    }
  }

  function exportCsv() {
    // Client-side export of the currently-loaded page. Keeps it simple:
    // doesn't re-fetch all pages — paginate+export server-side is a follow-up.
    const header = [
      "id",
      "created_at",
      "full_name",
      "email",
      "phone",
      "company",
      "website",
      "revenue_range",
      "qualification_status",
      "source",
      "notes",
    ];
    const rows = leads.map((l) =>
      header
        .map((h) => {
          const v = (l as unknown as Record<string, unknown>)[h];
          if (v === null || v === undefined) return "";
          const s = String(v).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ═══ Create modal ═══
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate(payload: Partial<Lead> & { email: string; full_name: string }) {
    const created = await apiFetch<Lead>("/api/leads", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setToast(`Lead created: ${created.full_name}`);
    setTimeout(() => setToast(null), 3000);
    setShowCreate(false);
    fetchLeads();
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="heading-brand text-3xl">Leads</h1>
          <p className="text-muted-foreground mt-1">
            {total} total lead{total !== 1 ? "s" : ""} from intake forms and manual entry.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={exportCsv}
            disabled={leads.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border border-border hover:bg-gray-50 disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg bg-stevie-green text-white hover:opacity-90 transition-opacity font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> New Lead
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green transition-colors"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
              className={`px-3 py-2 text-xs rounded-full border transition-colors ${
                status === opt.value
                  ? "border-stevie-green bg-stevie-green/5 text-stevie-green font-semibold"
                  : "border-border text-muted-foreground hover:border-gray-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground text-sm">
            Loading leads...
          </div>
        ) : leads.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-muted-foreground text-sm">
              {search || status
                ? "No leads match your filters."
                : "No leads yet. They\u2019ll appear here once someone fills out the intake form."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50 text-left">
                <th className="px-5 py-3 font-medium text-muted-foreground">Name</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden md:table-cell">Company</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden lg:table-cell">Revenue</th>
                <th className="px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 font-medium text-muted-foreground hidden sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => setSelected(lead)}
                  className="border-b border-border last:border-b-0 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4">
                    <div className="font-medium">{lead.full_name}</div>
                    <div className="text-xs text-muted-foreground">{lead.email}</div>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell text-muted-foreground">
                    {lead.company || "—"}
                  </td>
                  <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground">
                    {formatRevenue(lead.revenue_range)}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                        STATUS_COLORS[lead.qualification_status] ||
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {lead.qualification_status}
                    </span>
                  </td>
                  <td className="px-5 py-4 hidden sm:table-cell text-muted-foreground text-xs">
                    {formatDate(lead.created_at)}
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

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[60] bg-foreground text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* ═══ Lead Detail Drawer ═══ */}
      {selected && (
        <LeadDrawer
          lead={selected}
          canDelete={!!canDelete}
          onClose={() => setSelected(null)}
          onStatusChange={(s) => updateLeadStatus(selected.id, s)}
          onSaveNotes={async (notes) => {
            try {
              const updated = await apiFetch<Lead>(`/api/leads/${selected.id}`, {
                method: "PATCH",
                body: JSON.stringify({ notes }),
              });
              setLeads((prev) =>
                prev.map((l) => (l.id === selected.id ? updated : l))
              );
              setSelected(updated);
              setToast("Notes saved");
              setTimeout(() => setToast(null), 2500);
            } catch (e) {
              const msg =
                e instanceof ApiError ? e.message : "Failed to save notes.";
              alert(msg);
            }
          }}
          onDelete={() => deleteLead(selected.id)}
        />
      )}

      {/* ═══ Create Modal ═══ */}
      {showCreate && (
        <CreateLeadModal
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Drawer
// ═══════════════════════════════════════════════════════════════════════

function LeadDrawer({
  lead,
  canDelete,
  onClose,
  onStatusChange,
  onSaveNotes,
  onDelete,
}: {
  lead: Lead;
  canDelete: boolean;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onSaveNotes: (notes: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [notesDraft, setNotesDraft] = useState(lead.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Reset notes draft when the lead changes (switching between leads in list).
  useEffect(() => {
    setNotesDraft(lead.notes ?? "");
  }, [lead.id, lead.notes]);

  const notesDirty = notesDraft !== (lead.notes ?? "");

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-xl border-l border-border overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="heading-brand text-2xl">{lead.full_name}</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {/* Contact info */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                Contact
              </h3>
              <div className="space-y-1.5 text-sm">
                <p>{lead.email}</p>
                {lead.phone && <p>{lead.phone}</p>}
                {lead.company && <p>{lead.company}</p>}
                {lead.website && (
                  <a
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-stevie-green hover:opacity-80"
                  >
                    {lead.website.replace(/^https?:\/\//, "")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>

            {/* Revenue */}
            {lead.revenue_range && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                  Annual Revenue
                </h3>
                <p className="text-sm">{formatRevenue(lead.revenue_range)}</p>
              </div>
            )}

            {/* Status */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                Status
              </h3>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.filter((o) => o.value).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onStatusChange(opt.value)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      lead.qualification_status === opt.value
                        ? "border-stevie-green bg-stevie-green/10 text-stevie-green font-semibold"
                        : "border-border hover:border-gray-300"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Responses */}
            {lead.form_responses &&
              Object.keys(lead.form_responses).length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                    Intake Responses
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(lead.form_responses).map(([key, value]) => (
                      <div key={key}>
                        <p className="text-xs text-muted-foreground capitalize">
                          {key.replace(/_/g, " ")}
                        </p>
                        <p className="text-sm mt-0.5">
                          {Array.isArray(value)
                            ? (value as string[]).join(", ")
                            : String(value) || "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Source */}
            {lead.source && (
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase mb-2">
                  Source
                </h3>
                <p className="text-sm">{lead.source}</p>
              </div>
            )}

            {/* Notes — now editable */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
                  Notes
                </h3>
                {notesDirty && (
                  <button
                    disabled={saving}
                    onClick={async () => {
                      setSaving(true);
                      try {
                        await onSaveNotes(notesDraft);
                      } finally {
                        setSaving(false);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-xs text-stevie-green font-semibold hover:opacity-80 disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? "Saving…" : "Save"}
                  </button>
                )}
              </div>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                placeholder="Add private notes about this lead…"
                rows={4}
                className="w-full text-sm border border-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green resize-none"
              />
            </div>

            {/* Timestamps */}
            <div className="pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
              <p>Created {formatDate(lead.created_at)}</p>
              <p>Updated {formatDate(lead.updated_at)}</p>
            </div>

            {/* Danger zone */}
            {canDelete && (
              <div className="pt-4 border-t border-border">
                <button
                  onClick={onDelete}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-lg border border-stevie-orange/40 text-stevie-orange hover:bg-stevie-orange/5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Lead
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Create modal
// ═══════════════════════════════════════════════════════════════════════

function CreateLeadModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (
    payload: Partial<Lead> & { email: string; full_name: string }
  ) => Promise<void>;
}) {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    company: "",
    phone: "",
    website: "",
    revenue_range: "",
    source: "manual",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...form };
      // Drop empty optional fields so the backend keeps NULL.
      ["company", "phone", "website", "revenue_range", "notes"].forEach((k) => {
        if (!payload[k]) delete payload[k];
      });
      await onCreate(
        payload as Partial<Lead> & { email: string; full_name: string }
      );
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto bg-white rounded-2xl shadow-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="heading-brand text-xl">New Lead</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Full name *"
                  value={form.full_name}
                  onChange={(v) => setForm({ ...form, full_name: v })}
                  required
                />
                <Field
                  label="Email *"
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm({ ...form, email: v })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Company"
                  value={form.company}
                  onChange={(v) => setForm({ ...form, company: v })}
                />
                <Field
                  label="Phone"
                  value={form.phone}
                  onChange={(v) => setForm({ ...form, phone: v })}
                />
              </div>
              <Field
                label="Website"
                value={form.website}
                onChange={(v) => setForm({ ...form, website: v })}
                placeholder="https://"
              />
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Annual revenue
                </label>
                <select
                  value={form.revenue_range}
                  onChange={(e) =>
                    setForm({ ...form, revenue_range: e.target.value })
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green"
                >
                  {REVENUE_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green resize-none"
                />
              </div>
              {err && (
                <p className="text-xs text-stevie-orange bg-stevie-orange/10 rounded-lg px-3 py-2">
                  {err}
                </p>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-border bg-gray-50/50">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.email || !form.full_name}
                className="px-4 py-2 text-sm rounded-lg bg-stevie-green text-white hover:opacity-90 font-medium transition-opacity disabled:opacity-50"
              >
                {submitting ? "Creating…" : "Create Lead"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground block mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stevie-green/30 focus:border-stevie-green"
      />
    </div>
  );
}
