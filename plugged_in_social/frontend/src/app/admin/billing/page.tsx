"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { apiFetch, type RevenueSummary } from "@/lib/api";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const PHASE_COLORS: Record<string, string> = {
  protect: "bg-stevie-sky/15 text-stevie-sky border-stevie-sky/30",
  deepen: "bg-stevie-lavender/20 text-purple-700 border-stevie-lavender/40",
  amplify: "bg-stevie-chartreuse/20 text-foreground border-stevie-chartreuse/50",
};

const PHASE_LABELS: Record<string, string> = {
  protect: "Protect",
  deepen: "Deepen",
  amplify: "Amplify",
};

export default function BillingDashboard() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<RevenueSummary>("/api/revenue/summary")
      .then(setSummary)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="heading-brand text-3xl">Billing</h1>
          <p className="text-muted-foreground mt-1">Revenue and financial overview.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-200 rounded w-32" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !summary) {
    // Fallback with zeros when API unavailable
    const s: RevenueSummary = summary ?? {
      total_revenue_cents: 0,
      total_outstanding_cents: 0,
      total_invoices: 0,
      paid_invoices: 0,
      overdue_invoices: 0,
      mrr_cents: 0,
      active_subscriptions: 0,
      by_phase: [],
    };

    return <DashboardContent summary={s} />;
  }

  return <DashboardContent summary={summary} />;
}

function DashboardContent({ summary }: { summary: RevenueSummary }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-3xl">Billing</h1>
          <p className="text-muted-foreground mt-1">Revenue and financial overview.</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/billing/invoices"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm font-medium hover:bg-gray-50 transition"
          >
            <FileText className="w-4 h-4" />
            Invoices
          </Link>
          <Link
            href="/admin/billing/subscriptions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
          >
            <CreditCard className="w-4 h-4" />
            Subscriptions
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Revenue"
          value={formatCents(summary.total_revenue_cents)}
          icon={<DollarSign className="w-5 h-5" />}
          color="bg-stevie-green/10 text-stevie-green"
        />
        <StatCard
          label="Monthly Recurring"
          value={formatCents(summary.mrr_cents)}
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-stevie-lavender/15 text-purple-700"
          sub={`${summary.active_subscriptions} active`}
        />
        <StatCard
          label="Outstanding"
          value={formatCents(summary.total_outstanding_cents)}
          icon={<FileText className="w-5 h-5" />}
          color="bg-stevie-chartreuse/20 text-foreground"
          sub={`${summary.total_invoices - summary.paid_invoices} unpaid`}
        />
        <StatCard
          label="Overdue"
          value={String(summary.overdue_invoices)}
          icon={<AlertCircle className="w-5 h-5" />}
          color={
            summary.overdue_invoices > 0
              ? "bg-stevie-orange/10 text-stevie-orange"
              : "bg-gray-100 text-muted-foreground"
          }
        />
      </div>

      {/* Revenue by Compound Method Phase */}
      <div className="bg-white rounded-2xl border border-border p-6">
        <h2 className="heading-brand text-lg mb-4">Revenue by Compound Method Phase</h2>
        {summary.by_phase.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No phase-tagged revenue yet. Tag invoices with a Compound Method phase to see
            revenue segmentation here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.by_phase.map((phase) => (
              <div
                key={phase.phase}
                className={`rounded-xl border p-5 ${PHASE_COLORS[phase.phase] || "bg-gray-50 border-border"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider mb-1">
                  {PHASE_LABELS[phase.phase] || phase.phase}
                </p>
                <p className="text-2xl font-bold">{formatCents(phase.total_cents)}</p>
                <p className="text-xs mt-1 opacity-70">
                  {phase.invoice_count} invoice{phase.invoice_count !== 1 ? "s" : ""}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/billing/invoices"
          className="flex items-center justify-between bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
        >
          <div>
            <h3 className="font-semibold">Invoices</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.total_invoices} total &middot; {summary.paid_invoices} paid
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href="/admin/billing/subscriptions"
          className="flex items-center justify-between bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
        >
          <div>
            <h3 className="font-semibold">Subscriptions</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.active_subscriptions} active &middot;{" "}
              {formatCents(summary.mrr_cents)}/mo
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  sub,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
          {icon}
        </span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
