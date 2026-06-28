"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  FileText,
  ArrowRight,
  Shield,
  Heart,
  Zap,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { apiFetch, type PhaseDashboard, type RevenueSummary } from "@/lib/api";

const PHASE_META: Record<string, { icon: typeof Shield; color: string; bg: string; fill: string }> = {
  protect: { icon: Shield, color: "text-stevie-sky", bg: "bg-stevie-sky/10", fill: "#7ac9e8" },
  deepen: { icon: Heart, color: "text-purple-600", bg: "bg-stevie-lavender/15", fill: "#d1bff2" },
  amplify: { icon: Zap, color: "text-foreground", bg: "bg-stevie-chartreuse/20", fill: "#edff6b" },
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

function formatCentsShort(cents: number): string {
  if (cents >= 100_000_00) return `$${(cents / 100_00).toFixed(0)}k`;
  return formatCents(cents);
}

interface UmamiStatus {
  ok: boolean;
  detail: string;
  page_views: number | null;
  visitors: number | null;
}

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<RevenueSummary | null>(null);
  const [phases, setPhases] = useState<PhaseDashboard[]>([]);
  const [umamiStatus, setUmamiStatus] = useState<UmamiStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<RevenueSummary>("/api/revenue/summary").catch(() => null),
      apiFetch<PhaseDashboard[]>("/api/reports/dashboards/phases").catch(() => []),
      apiFetch<UmamiStatus>("/api/settings/umami/test").catch(() => null),
    ])
      .then(([rev, ph, umami]) => {
        setRevenue(rev);
        setPhases(ph);
        setUmamiStatus(umami);
      })
      .finally(() => setLoading(false));
  }, []);

  // Build combined monthly revenue chart data from all phases
  const monthlyMap = new Map<string, { month: string; protect: number; deepen: number; amplify: number }>();
  for (const phase of phases) {
    for (const m of phase.monthly_data) {
      const existing = monthlyMap.get(m.month) || { month: m.month, protect: 0, deepen: 0, amplify: 0 };
      existing[phase.phase as "protect" | "deepen" | "amplify"] = m.revenue_cents / 100;
      monthlyMap.set(m.month, existing);
    }
  }
  const monthlyChartData = Array.from(monthlyMap.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  // Revenue by phase for horizontal bar
  const phaseBarData = (revenue?.by_phase || []).map((p) => ({
    phase: p.phase.charAt(0).toUpperCase() + p.phase.slice(1),
    revenue: p.total_cents / 100,
    invoices: p.invoice_count,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="heading-brand text-3xl">Analytics & Reporting</h1>
          <p className="text-muted-foreground mt-1">
            Compound Method phase dashboards and client reporting.
          </p>
        </div>
        <Link
          href="/admin/analytics/reports"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
        >
          <FileText className="w-4 h-4" /> Client Reports
        </Link>
      </div>

      {/* Revenue KPI Cards */}
      {revenue && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-border p-5">
            <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
            <p className="text-2xl font-bold">{formatCents(revenue.total_revenue_cents)}</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-5">
            <p className="text-xs text-muted-foreground mb-1">MRR</p>
            <p className="text-2xl font-bold">{formatCents(revenue.mrr_cents)}</p>
            <p className="text-xs text-muted-foreground">{revenue.active_subscriptions} active subs</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-5">
            <p className="text-xs text-muted-foreground mb-1">Invoices</p>
            <p className="text-2xl font-bold">{revenue.total_invoices}</p>
            <p className="text-xs text-muted-foreground">{revenue.paid_invoices} paid</p>
          </div>
          <div className="bg-white rounded-2xl border border-border p-5">
            <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
            <p className="text-2xl font-bold">{formatCents(revenue.total_outstanding_cents)}</p>
            <p className="text-xs text-muted-foreground">{revenue.overdue_invoices} overdue</p>
          </div>
        </div>
      )}

      {/* Revenue Trend Chart */}
      {monthlyChartData.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="heading-brand text-lg mb-4">Monthly Revenue by Phase</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthlyChartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tickFormatter={(v: string) => v.slice(5)} tick={{ fontSize: 11, fill: "#999" }} />
              <YAxis tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11, fill: "#999" }} />
              <Tooltip
                formatter={(value) => [`$${Number(value).toLocaleString()}`]}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
              />
              <Bar dataKey="protect" stackId="revenue" fill="#7ac9e8" radius={[0, 0, 0, 0]} />
              <Bar dataKey="deepen" stackId="revenue" fill="#d1bff2" radius={[0, 0, 0, 0]} />
              <Bar dataKey="amplify" stackId="revenue" fill="#edff6b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Phase Dashboards */}
      <div className="space-y-6">
        <h2 className="heading-brand text-xl">Compound Method Phases</h2>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-32 mb-4" />
                <div className="h-20 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(["protect", "deepen", "amplify"] as const).map((phaseKey) => {
              const phase = phases.find((p) => p.phase === phaseKey);
              const meta = PHASE_META[phaseKey];
              const Icon = meta.icon;
              const totalRevenue = phase?.monthly_data.reduce((sum, m) => sum + m.revenue_cents, 0) || 0;
              const totalInvoices = phase?.monthly_data.reduce((sum, m) => sum + m.invoice_count, 0) || 0;

              const sparkData = (phase?.monthly_data || []).slice(-6).reverse().map((m) => ({
                month: m.month.slice(5),
                value: m.revenue_cents / 100,
              }));

              return (
                <div key={phaseKey} className="bg-white rounded-2xl border border-border overflow-hidden">
                  <div className={`px-6 py-4 ${meta.bg}`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-5 h-5 ${meta.color}`} />
                      <h3 className={`font-semibold capitalize ${meta.color}`}>{phaseKey}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {phase?.description || "No data yet"}
                    </p>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue</p>
                        <p className="text-lg font-bold">{formatCentsShort(totalRevenue)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Invoices</p>
                        <p className="text-lg font-bold">{totalInvoices}</p>
                      </div>
                    </div>

                    {/* Sparkline area chart */}
                    {sparkData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={64}>
                        <AreaChart data={sparkData}>
                          <defs>
                            <linearGradient id={`grad-${phaseKey}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={meta.fill} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={meta.fill} stopOpacity={0.05} />
                            </linearGradient>
                          </defs>
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={meta.fill}
                            strokeWidth={2}
                            fill={`url(#grad-${phaseKey})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Tag invoices with this phase to see data
                      </p>
                    )}

                    {/* Phase KPI list */}
                    {phase && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Tracked KPIs</p>
                        <div className="flex flex-wrap gap-1">
                          {phase.metrics_definition.map((m) => (
                            <span key={m.key} className="px-2 py-0.5 rounded-full bg-gray-50 text-[10px] text-muted-foreground">
                              {m.label}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Revenue by Phase bar */}
      {phaseBarData.length > 0 && (
        <div className="bg-white rounded-2xl border border-border p-6">
          <h2 className="heading-brand text-lg mb-4">Revenue by Phase</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={phaseBarData} layout="vertical" barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} tick={{ fontSize: 11, fill: "#999" }} />
              <YAxis type="category" dataKey="phase" tick={{ fontSize: 12, fill: "#666" }} width={70} />
              <Tooltip
                formatter={(value) => [`$${Number(value).toLocaleString()}`, "Revenue"]}
                contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
              />
              <Bar dataKey="revenue" fill="#089140" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/analytics/reports"
          className="flex items-center justify-between bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
        >
          <div>
            <h3 className="font-semibold">Client Reports</h3>
            <p className="text-sm text-muted-foreground mt-1">Generate and send branded reports</p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
        <Link
          href="/admin/settings"
          className={`flex items-center justify-between rounded-2xl border p-6 transition group ${
            umamiStatus?.ok
              ? "border-green-200 bg-green-50/60 hover:border-green-300"
              : "border-border bg-white hover:border-foreground/20"
          }`}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <BarChart3
                className={`w-4 h-4 shrink-0 ${
                  umamiStatus?.ok ? "text-green-700" : "text-muted-foreground"
                }`}
              />
              <h3 className="font-semibold">Umami Web Analytics</h3>
            </div>
            <p
              className={`text-sm mt-1 ${
                umamiStatus?.ok ? "text-green-800" : "text-muted-foreground"
              }`}
            >
              {umamiStatus?.detail ||
                "Check the Umami connection in Settings for traffic insights."}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
