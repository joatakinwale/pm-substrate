"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  X,
  ArrowLeft,
  Calendar,
} from "lucide-react";
import { apiFetch, type Subscription, type PaginatedResponse } from "@/lib/api";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "past_due", label: "Past Due" },
  { value: "trialing", label: "Trialing" },
  { value: "canceled", label: "Canceled" },
  { value: "incomplete", label: "Incomplete" },
  { value: "paused", label: "Paused" },
];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-stevie-green/10 text-stevie-green",
  past_due: "bg-stevie-orange/10 text-stevie-orange",
  trialing: "bg-stevie-sky/10 text-stevie-sky",
  canceled: "bg-gray-100 text-gray-500",
  incomplete: "bg-yellow-50 text-yellow-700",
  paused: "bg-stevie-lavender/15 text-purple-700",
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

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [phase, setPhase] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Subscription | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: "25" });
      if (status) params.set("status", status);
      if (phase) params.set("compound_phase", phase);
      if (search) params.set("search", search);
      const data = await apiFetch<PaginatedResponse<Subscription>>(
        `/api/subscriptions?${params}`
      );
      setSubs(data.items);
      setTotal(data.total);
      setPages(data.pages);
    } catch {
      setSubs([]);
    } finally {
      setLoading(false);
    }
  }, [page, status, phase, search]);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

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
      <div className="flex items-center gap-3">
        <Link
          href="/admin/billing"
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="heading-brand text-3xl">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">
            {total} subscription{total !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search clients or plans..."
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

      {/* Phase filter row */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Phase:</span>
        {[
          { value: "", label: "All" },
          { value: "protect", label: "Protect" },
          { value: "deepen", label: "Deepen" },
          { value: "amplify", label: "Amplify" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              setPhase(opt.value);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition ${
              phase === opt.value
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

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-32 mb-3" />
                <div className="h-6 bg-gray-200 rounded w-20 mb-4" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            ))
          : subs.length === 0
          ? (
              <div className="col-span-full bg-white rounded-2xl border border-border p-12 text-center">
                <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No subscriptions found.</p>
              </div>
            )
          : subs.map((sub) => (
              <div
                key={sub.id}
                onClick={() => setSelected(sub)}
                className="bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 cursor-pointer transition"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold">{sub.client_name || "Unnamed"}</p>
                    <p className="text-xs text-muted-foreground">{sub.client_email}</p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[sub.status] || "bg-gray-100"
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                <p className="text-2xl font-bold mb-1">
                  {formatCents(sub.amount_cents)}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{sub.interval}
                  </span>
                </p>

                {sub.plan_name && (
                  <p className="text-sm text-muted-foreground mb-2">{sub.plan_name}</p>
                )}

                <div className="flex items-center gap-2 mt-3">
                  {sub.compound_phase && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
                        PHASE_PILLS[sub.compound_phase] || "bg-gray-100"
                      }`}
                    >
                      {sub.compound_phase}
                    </span>
                  )}
                  {sub.current_period_end && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Renews {formatDate(sub.current_period_end)}
                    </span>
                  )}
                </div>
              </div>
            ))}
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
        <SubscriptionDrawer sub={selected} onClose={() => setSelected(null)} onUpdate={fetchSubs} />
      )}
    </div>
  );
}

function SubscriptionDrawer({
  sub,
  onClose,
  onUpdate,
}: {
  sub: Subscription;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [canceling, setCanceling] = useState(false);

  async function handleCancel(immediate: boolean) {
    const msg = immediate
      ? "Cancel immediately? The client will lose access right away."
      : "Cancel at period end? The client keeps access until the current period ends.";
    if (!confirm(msg)) return;

    setCanceling(true);
    try {
      await apiFetch(
        `/api/subscriptions/${sub.id}/cancel?immediate=${immediate}`,
        { method: "POST" }
      );
      onUpdate();
      onClose();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to cancel subscription");
    } finally {
      setCanceling(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="heading-brand text-xl">Subscription Detail</h2>
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
            <p className="font-medium">{sub.client_name}</p>
            <p className="text-sm text-muted-foreground">{sub.client_email}</p>
          </div>

          {/* Plan & Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  STATUS_COLORS[sub.status] || "bg-gray-100"
                }`}
              >
                {sub.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount</p>
              <p className="text-lg font-bold">
                {formatCents(sub.amount_cents)}
                <span className="text-sm font-normal text-muted-foreground">/{sub.interval}</span>
              </p>
            </div>
          </div>

          {sub.plan_name && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plan</p>
              <p className="text-sm">{sub.plan_name}</p>
            </div>
          )}

          {/* Phase */}
          {sub.compound_phase && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                Compound Method Phase
              </p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                  PHASE_PILLS[sub.compound_phase] || "bg-gray-100"
                }`}
              >
                {sub.compound_phase}
              </span>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Period</p>
              <p className="text-sm">
                {formatDate(sub.current_period_start)} — {formatDate(sub.current_period_end)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Created</p>
              <p className="text-sm">{formatDate(sub.created_at)}</p>
            </div>
            {sub.trial_end && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Trial End</p>
                <p className="text-sm">{formatDate(sub.trial_end)}</p>
              </div>
            )}
            {sub.canceled_at && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Canceled At</p>
                <p className="text-sm">{formatDate(sub.canceled_at)}</p>
              </div>
            )}
          </div>

          {/* Stripe IDs */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border">
            <p>Stripe Sub: {sub.stripe_subscription_id}</p>
            <p>Stripe Customer: {sub.stripe_customer_id}</p>
            {sub.stripe_price_id && <p>Price: {sub.stripe_price_id}</p>}
          </div>

          {/* Actions */}
          {sub.status === "active" && (
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                onClick={() => handleCancel(false)}
                disabled={canceling}
                className="flex-1 py-2.5 rounded-full border border-border text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel at Period End
              </button>
              <button
                onClick={() => handleCancel(true)}
                disabled={canceling}
                className="px-4 py-2.5 rounded-full border border-stevie-orange text-stevie-orange text-sm font-medium hover:bg-stevie-orange/5 transition disabled:opacity-50"
              >
                Cancel Now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
