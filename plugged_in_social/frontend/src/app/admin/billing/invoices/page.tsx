"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Plus,
  X,
  ArrowLeft,
} from "lucide-react";
import { apiFetch, type Invoice, type PaginatedResponse } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "open", label: "Open" },
  { value: "paid", label: "Paid" },
  { value: "past_due", label: "Past Due" },
  { value: "void", label: "Void" },
  { value: "uncollectible", label: "Uncollectible" },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  open: "bg-stevie-sky/10 text-stevie-sky",
  paid: "bg-stevie-green/10 text-stevie-green",
  past_due: "bg-stevie-orange/10 text-stevie-orange",
  void: "bg-gray-100 text-gray-400",
  uncollectible: "bg-red-50 text-red-600",
};

const PHASE_PILLS: Record<string, string> = {
  protect: "bg-stevie-sky/15 text-stevie-sky",
  deepen: "bg-stevie-lavender/20 text-purple-700",
  amplify: "bg-stevie-chartreuse/20 text-foreground",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      const data = await apiFetch<PaginatedResponse<Invoice>>(
        `/api/invoices?${params}`
      );
      setInvoices(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, search]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/billing"
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="heading-brand text-3xl">Invoices</h1>
            <p className="text-muted-foreground mt-1">
              {total} invoice{total !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <Plus className="w-4 h-4" /> New Invoice
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
              onClick={() => {
                setStatus(opt.value);
                setPage(1);
              }}
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
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Due</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Phase</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="px-4 py-3" colSpan={8}>
                      <div className="h-4 bg-gray-100 rounded animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td className="px-4 py-12 text-center text-muted-foreground" colSpan={8}>
                    No invoices found.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className="border-b border-border hover:bg-gray-50/50 cursor-pointer transition"
                    onClick={() => setSelected(inv)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{inv.client_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{inv.client_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
                          STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCents(inv.total_cents)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {inv.amount_due_cents > 0 ? formatCents(inv.amount_due_cents) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {inv.compound_phase ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            PHASE_PILLS[inv.compound_phase] || "bg-gray-100"
                          }`}
                        >
                          {inv.compound_phase}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inv.due_date)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(inv.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {inv.stripe_hosted_invoice_url && (
                        <a
                          href={inv.stripe_hosted_invoice_url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-stevie-sky hover:underline"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </td>
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
          <p className="text-sm text-muted-foreground">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page <= 1}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(Math.min(pages, page + 1))}
              disabled={page >= pages}
              className="w-9 h-9 rounded-full border border-border flex items-center justify-center disabled:opacity-30 hover:bg-gray-50 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {selected && (
        <InvoiceDrawer invoice={selected} onClose={() => setSelected(null)} onUpdate={fetchInvoices} />
      )}

      {/* Create Drawer */}
      {creating && (
        <CreateInvoiceDrawer
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            fetchInvoices();
          }}
        />
      )}
    </div>
  );
}

function CreateInvoiceDrawer({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [description, setDescription] = useState("");
  const [dueDays, setDueDays] = useState(30);
  const [phase, setPhase] = useState("");
  const [syncToStripe, setSyncToStripe] = useState(false);
  const [items, setItems] = useState<Array<{ description: string; amount_cents: number; quantity: number }>>([
    { description: "", amount_cents: 0, quantity: 1 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(idx: number, patch: Partial<{ description: string; amount_cents: number; quantity: number }>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { description: "", amount_cents: 0, quantity: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const totalCents = items.reduce((sum, it) => sum + (it.amount_cents || 0) * (it.quantity || 1), 0);

  async function handleSubmit() {
    setError(null);
    if (!clientName.trim() || !clientEmail.trim()) {
      setError("Client name and email are required.");
      return;
    }
    const cleaned = items.filter((it) => it.description.trim() && it.amount_cents > 0);
    if (cleaned.length === 0) {
      setError("Add at least one line item with a description and amount.");
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch<Invoice>("/api/invoices", {
        method: "POST",
        body: JSON.stringify({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          description: description.trim() || null,
          due_days: dueDays,
          compound_phase: phase || null,
          sync_to_stripe: syncToStripe,
          line_items: cleaned,
        }),
      });
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="heading-brand text-xl">New Invoice</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Client Name</label>
              <input
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                placeholder="Acme Inc."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Client Email</label>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                placeholder="finance@acme.com"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                placeholder="Notes visible on the invoice"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Due (days)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={dueDays}
                  onChange={(e) => setDueDays(Number(e.target.value) || 30)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">Phase</label>
                <select
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                >
                  <option value="">None</option>
                  <option value="protect">Protect</option>
                  <option value="deepen">Deepen</option>
                  <option value="amplify">Amplify</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Line Items</label>
              <button
                type="button"
                onClick={addItem}
                className="text-xs inline-flex items-center gap-1 text-stevie-sky hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-[1fr_90px_60px_24px] gap-2 items-center">
                  <input
                    value={it.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                    placeholder="Description"
                    className="px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                  />
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={it.amount_cents === 0 ? "" : (it.amount_cents / 100).toString()}
                    onChange={(e) =>
                      updateItem(i, {
                        amount_cents: Math.round(parseFloat(e.target.value || "0") * 100) || 0,
                      })
                    }
                    placeholder="Amount"
                    className="px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) || 1 })}
                    className="px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-stevie-lavender/50"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length === 1}
                    className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-30"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-right text-sm">
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-semibold">{formatCents(totalCents)}</span>
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={syncToStripe}
              onChange={(e) => setSyncToStripe(e.target.checked)}
              className="rounded"
            />
            Sync to Stripe (creates a draft invoice on Stripe)
          </label>

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Invoice"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDrawer({
  invoice,
  onClose,
  onUpdate,
}: {
  invoice: Invoice;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [sending, setSending] = useState(false);

  async function handleSend() {
    setSending(true);
    try {
      await apiFetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to send invoice");
    } finally {
      setSending(false);
    }
  }

  async function handleVoid() {
    if (!confirm("Void this invoice? This cannot be undone.")) return;
    try {
      await apiFetch(`/api/invoices/${invoice.id}/void`, { method: "POST" });
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to void invoice");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="heading-brand text-xl">Invoice Detail</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Client */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Client</p>
            <p className="font-medium">{invoice.client_name}</p>
            <p className="text-sm text-muted-foreground">{invoice.client_email}</p>
          </div>

          {/* Status + Amounts */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  STATUS_COLORS[invoice.status] || "bg-gray-100"
                }`}
              >
                {invoice.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total</p>
              <p className="text-lg font-bold">{formatCents(invoice.total_cents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Paid</p>
              <p className="font-medium text-stevie-green">{formatCents(invoice.amount_paid_cents)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Due</p>
              <p className="font-medium">{formatCents(invoice.amount_due_cents)}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Due Date</p>
              <p className="text-sm">{formatDate(invoice.due_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</p>
              <p className="text-sm">{formatDate(invoice.created_at)}</p>
            </div>
            {invoice.paid_at && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Paid At</p>
                <p className="text-sm">{formatDate(invoice.paid_at)}</p>
              </div>
            )}
          </div>

          {/* Phase */}
          {invoice.compound_phase && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Compound Method Phase
              </p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                  PHASE_PILLS[invoice.compound_phase] || "bg-gray-100"
                }`}
              >
                {invoice.compound_phase}
              </span>
            </div>
          )}

          {/* Line Items */}
          {Array.isArray(invoice.line_items) && invoice.line_items.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
                Line Items
              </p>
              <div className="space-y-2">
                {invoice.line_items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm py-1.5 border-b border-gray-100">
                    <span>
                      {item.description}
                      {item.quantity > 1 && (
                        <span className="text-muted-foreground ml-1">×{item.quantity}</span>
                      )}
                    </span>
                    <span className="font-medium">{formatCents(item.amount_cents * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description / Notes */}
          {invoice.description && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm">{invoice.description}</p>
            </div>
          )}

          {/* Stripe links */}
          <div className="flex gap-3 pt-2">
            {invoice.stripe_hosted_invoice_url && (
              <a
                href={invoice.stripe_hosted_invoice_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm hover:bg-gray-50 transition"
              >
                <ExternalLink className="w-4 h-4" /> View on Stripe
              </a>
            )}
            {invoice.stripe_invoice_pdf && (
              <a
                href={invoice.stripe_invoice_pdf}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm hover:bg-gray-50 transition"
              >
                <FileText className="w-4 h-4" /> Download PDF
              </a>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-border">
            {invoice.status === "draft" && invoice.stripe_invoice_id && (
              <button
                onClick={handleSend}
                disabled={sending}
                className="flex-1 py-2.5 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition disabled:opacity-50"
              >
                {sending ? "Sending..." : "Finalize & Send"}
              </button>
            )}
            {["draft", "open"].includes(invoice.status) && (
              <button
                onClick={handleVoid}
                className="px-4 py-2.5 rounded-full border border-stevie-orange text-stevie-orange text-sm font-medium hover:bg-stevie-orange/5 transition"
              >
                Void
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
