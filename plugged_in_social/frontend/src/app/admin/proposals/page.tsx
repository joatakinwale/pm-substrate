"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Plus,
  Send,
  CheckCircle,
  Eye,
  X,
  FileSignature,
  Clock,
  ArrowRight,
} from "lucide-react";
import { apiFetch, type Proposal, type PaginatedResponse } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "signed", label: "Signed" },
  { value: "declined", label: "Declined" },
  { value: "expired", label: "Expired" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  sent: "bg-stevie-sky/10 text-stevie-sky",
  viewed: "bg-stevie-lavender/15 text-purple-700",
  signed: "bg-stevie-green/10 text-stevie-green",
  declined: "bg-stevie-orange/10 text-stevie-orange",
  expired: "bg-gray-100 text-gray-400",
};

const PHASE_PILLS: Record<string, string> = {
  protect: "bg-stevie-sky/15 text-stevie-sky",
  deepen: "bg-stevie-lavender/20 text-purple-700",
  amplify: "bg-stevie-chartreuse/20 text-foreground",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Proposal | null>(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      const data = await apiFetch<PaginatedResponse<Proposal>>(`/api/proposals?${params}`);
      setProposals(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setProposals([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-3xl">Proposals</h1>
          <p className="text-muted-foreground mt-1">{total} proposal{total !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Proposal
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setStatus(opt.value); setPage(1); }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                status === opt.value
                  ? "bg-foreground text-white"
                  : "bg-gray-100 text-muted-foreground hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-gray-50/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Title</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phase</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Views</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={7}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : proposals.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-muted-foreground" colSpan={7}>
                    <FileSignature className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    No proposals yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                proposals.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border hover:bg-gray-50/50 cursor-pointer transition"
                    onClick={() => setSelected(p)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{p.client_name}</p>
                      <p className="text-xs text-muted-foreground">{p.client_email}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[200px] truncate">{p.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[p.status] || "bg-gray-100"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatCents(p.total_cents)}</td>
                    <td className="px-4 py-3">
                      {p.compound_phase ? (
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PHASE_PILLS[p.compound_phase] || "bg-gray-100"}`}>
                          {p.compound_phase}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {p.view_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {pages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1} className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => setPage(Math.min(pages, page + 1))} disabled={page >= pages} className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Create Drawer */}
      {showCreate && <CreateProposalDrawer onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); fetchProposals(); }} />}

      {/* Detail Drawer */}
      {selected && <ProposalDrawer proposal={selected} onClose={() => setSelected(null)} onUpdate={fetchProposals} />}
    </div>
  );
}


/* ── Create Proposal Drawer ─────────────────────────────── */
function CreateProposalDrawer({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("Compound Method Strategy Proposal");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [billingInterval, setBillingInterval] = useState("month");
  const [phase, setPhase] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!clientName || !clientEmail) return;
    setSaving(true);
    try {
      await apiFetch("/api/proposals", {
        method: "POST",
        body: JSON.stringify({
          title: title || "Compound Method Strategy Proposal",
          client_name: clientName,
          client_email: clientEmail,
          client_company: clientCompany || null,
          total_cents: totalCents,
          billing_interval: billingInterval,
          compound_phase: phase || null,
          internal_notes: internalNotes || null,
        }),
      });
      onCreated();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create proposal");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="heading-brand text-xl">New Proposal</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Proposal Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Client Name *</label>
              <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Client Email *</label>
              <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Company</label>
              <input type="text" value={clientCompany} onChange={(e) => setClientCompany(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Value ($)</label>
                <input type="number" value={totalCents / 100} onChange={(e) => setTotalCents(Math.round(Number(e.target.value) * 100))} min={0} step={50} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Billing</label>
                <select value={billingInterval} onChange={(e) => setBillingInterval(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50">
                  <option value="month">Monthly</option>
                  <option value="quarter">Quarterly</option>
                  <option value="year">Yearly</option>
                  <option value="one_time">One-time</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Compound Phase</label>
              <select value={phase} onChange={(e) => setPhase(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50">
                <option value="">Select phase...</option>
                <option value="protect">Protect</option>
                <option value="deepen">Deepen</option>
                <option value="amplify">Amplify</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Internal Notes</label>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={3}
                placeholder="Private notes — never shown to the client"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Creates a proposal with the 12 Compound Method strategy blocks. You can edit each block after creation.
          </p>

          <button
            onClick={handleCreate}
            disabled={saving || !clientName || !clientEmail}
            className="w-full py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Proposal"}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ── Proposal Detail Drawer ─────────────────────────────── */
function ProposalDrawer({ proposal, onClose, onUpdate }: { proposal: Proposal; onClose: () => void; onUpdate: () => void }) {
  const [sending, setSending] = useState(false);
  const [signing, setSigning] = useState(false);
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/proposal/${proposal.share_token}`;

  async function handleSend() {
    setSending(true);
    try {
      await apiFetch(`/api/proposals/${proposal.id}/send`, { method: "POST" });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  }

  async function handleSign() {
    if (!confirm("Mark this proposal as signed? This will create an invoice and start client onboarding.")) return;
    setSigning(true);
    try {
      await apiFetch(`/api/proposals/${proposal.id}/sign`, { method: "POST" });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sign");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="heading-brand text-xl">Proposal Detail</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Client */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Client</p>
            <p className="font-medium">{proposal.client_name}</p>
            <p className="text-sm text-muted-foreground">{proposal.client_email}</p>
            {proposal.client_company && <p className="text-sm text-muted-foreground">{proposal.client_company}</p>}
          </div>

          {/* Status + Value */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[proposal.status] || "bg-gray-100"}`}>
                {proposal.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Value</p>
              <p className="text-lg font-bold">{formatCents(proposal.total_cents)}<span className="text-sm font-normal text-muted-foreground">/{proposal.billing_interval}</span></p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Views</p>
              <p className="text-lg font-bold flex items-center gap-1"><Eye className="w-4 h-4 text-muted-foreground" /> {proposal.view_count}</p>
            </div>
          </div>

          {/* Blocks preview */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Strategy Blocks ({proposal.blocks.length})</p>
            <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
              {proposal.blocks.map((block, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1.5 px-3 rounded-lg bg-gray-50">
                  <span className="w-5 h-5 rounded-full bg-stevie-green/10 text-stevie-green text-xs flex items-center justify-center font-bold">{block.order}</span>
                  <span className="flex-1">{block.title}</span>
                  {block.content ? (
                    <CheckCircle className="w-3.5 h-3.5 text-stevie-green" />
                  ) : (
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Internal notes */}
          {proposal.internal_notes && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Internal Notes</p>
              <p className="text-sm whitespace-pre-wrap bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-900">
                {proposal.internal_notes}
              </p>
            </div>
          )}

          {/* Share link */}
          {proposal.status !== "draft" && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Share Link</p>
              <div className="flex gap-2">
                <input type="text" readOnly value={shareUrl} className="flex-1 px-3 py-2 rounded-lg border border-border text-xs bg-gray-50" />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="px-3 py-2 rounded-lg border border-border text-xs hover:bg-gray-50 transition"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</p>
              <p>{formatDate(proposal.created_at)}</p>
            </div>
            {proposal.sent_at && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sent</p>
                <p>{formatDate(proposal.sent_at)}</p>
              </div>
            )}
            {proposal.signed_at && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Signed</p>
                <p>{formatDate(proposal.signed_at)}</p>
              </div>
            )}
          </div>

          {/* Edit blocks link */}
          {proposal.status === "draft" && (
            <Link
              href={`/admin/proposals/${proposal.id}/edit`}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl border border-border hover:border-foreground/20 transition group"
            >
              <span className="font-medium text-sm">Edit Strategy Blocks</span>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
            </Link>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {proposal.status === "draft" && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-full bg-stevie-sky text-white text-sm font-medium hover:bg-stevie-sky/90 transition disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> {sending ? "Sending..." : "Send to Client"}
              </button>
            )}
            {["sent", "viewed"].includes(proposal.status) && (
              <button
                onClick={handleSign}
                disabled={signing}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-full bg-stevie-green text-white text-sm font-medium hover:bg-stevie-green/90 transition disabled:opacity-50"
              >
                <FileSignature className="w-4 h-4" /> {signing ? "Processing..." : "Mark as Signed"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
