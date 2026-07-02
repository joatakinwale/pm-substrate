"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import type {
  Lead,
  Booking,
  Proposal,
  PaginatedResponse,
  OrganizationSettings,
} from "@/lib/api";

/**
 * Admin Dashboard — Phase 1 overview.
 *
 * Converted from a server component to a client component to keep the
 * admin/* tree out of edge-function-per-route territory. The previous
 * server-rendered version forced every admin page to be an edge
 * function under @cloudflare/next-on-pages, which pushed the bundle
 * over Pages' 25 MiB limit (~30 functions × ~1.7 MB each). Data
 * fetching now happens in useEffect via the existing apiFetch helper,
 * which already attaches the Supabase JWT from the browser session —
 * no functional change to the API contract or auth model.
 *
 * Auth gating is unchanged: middleware.ts redirects unauthed
 * /admin/* requests to /login BEFORE this page mounts.
 *
 * FE-33: Lead/Booking/PaginatedResponse come from `@/lib/api` (the
 * canonical API types that match backend schemas).
 */

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-stevie-sky/10 text-stevie-sky",
  contacted: "bg-stevie-lavender/20 text-purple-700",
  qualified: "bg-stevie-green/10 text-stevie-green",
  proposal_sent: "bg-stevie-chartreuse/30 text-foreground",
  won: "bg-stevie-green/20 text-stevie-green",
  lost: "bg-stevie-orange/10 text-stevie-orange",
};

interface InboxItem {
  id: string;
  project_id: string | null;
  type: "task" | "post" | "report" | "orchestration_task";
  task_type?: string;
  title: string;
  agent: string;
  status: string;
  created_at: string;
}

interface DashboardData {
  firstName: string;
  recentLeads: Lead[];
  totalLeads: number;
  upcomingBookings: Booking[];
  totalBookings: number;
  signedProposals: number;
  qualifiedLeads: number;
  dashboardIntro: string | null;
  inboxItems: InboxItem[];
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [inboxError, setInboxError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const firstName =
        (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0] ||
        user?.email?.split("@")[0] ||
        "there";

      // Each fetch is wrapped so a single backend hiccup doesn't blank
      // the whole dashboard — same graceful-degradation behaviour as the
      // previous server-rendered version (FE-28 logic preserved).
      const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
        try {
          return await p;
        } catch {
          return null;
        }
      };

      const [
        leadsData,
        bookingsData,
        signedProposalsData,
        qualifiedLeadsData,
        settingsData,
        inboxData,
      ] = await Promise.all([
        safe(
          apiFetch<PaginatedResponse<Lead>>("/api/leads?per_page=5&page=1")
        ),
        safe(
          apiFetch<PaginatedResponse<Booking>>(
            "/api/bookings?per_page=5&status=scheduled"
          )
        ),
        safe(
          apiFetch<PaginatedResponse<Proposal>>(
            "/api/proposals?status=signed&per_page=1"
          )
        ),
        safe(
          apiFetch<PaginatedResponse<Lead>>(
            "/api/leads?status=qualified&per_page=1"
          )
        ),
        safe(apiFetch<OrganizationSettings>("/api/settings")),
        safe(apiFetch<{ items: InboxItem[] }>("/api/virtual-agency/inbox")),
      ]);

      if (cancelled) return;

      const intro =
        (settingsData?.settings?.dashboard_intro as string | undefined) ?? null;

      setInboxError(null);
      setData({
        firstName,
        recentLeads: leadsData?.items ?? [],
        totalLeads: leadsData?.total ?? 0,
        upcomingBookings: bookingsData?.items ?? [],
        totalBookings: bookingsData?.total ?? 0,
        signedProposals: signedProposalsData?.total ?? 0,
        qualifiedLeads: qualifiedLeadsData?.total ?? 0,
        dashboardIntro: intro && intro.trim() ? intro : null,
        inboxItems: inboxData?.items ?? [],
      });
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleApprove(item: InboxItem) {
    setApprovingId(item.id);
    setInboxError(null);

    try {
      await apiFetch(`/api/virtual-agency/inbox/${item.type}/${item.id}/approve`, {
        method: "POST",
      });
      setData((current) =>
        current
          ? {
              ...current,
              inboxItems: current.inboxItems.filter(
                (existing) => existing.id !== item.id
              ),
            }
          : current
      );
    } catch {
      setInboxError("Could not approve that item right now.");
    } finally {
      setApprovingId(null);
    }
  }

  const firstName = data?.firstName ?? "there";
  const totalLeads = data?.totalLeads ?? 0;
  const totalBookings = data?.totalBookings ?? 0;
  const signedProposals = data?.signedProposals ?? 0;
  const qualifiedLeads = data?.qualifiedLeads ?? 0;
  const recentLeads = data?.recentLeads ?? [];
  const upcomingBookings = data?.upcomingBookings ?? [];
  const inboxItems = data?.inboxItems ?? [];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="heading-brand text-3xl">
          Hey, {loading ? "…" : firstName}.
        </h1>
        <p className="text-muted-foreground mt-1">
          Here&apos;s your Virtual Agency inbox and what&apos;s happening with your leads.
        </p>
        {data?.dashboardIntro && (
          <div className="mt-4 p-4 rounded-2xl border border-border bg-stevie-chartreuse/10 text-sm whitespace-pre-wrap">
            {data.dashboardIntro}
          </div>
        )}
      </div>

      
      {/* Agent Inbox */}
      <div className="bg-white rounded-2xl border border-border p-5 mb-8 border-l-4 border-l-stevie-lavender">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Agent Inbox</h2>
          <span className="text-sm bg-stevie-lavender/20 text-purple-700 px-2 py-0.5 rounded-full font-medium">
            {inboxItems.length} Pending Approvals
          </span>
        </div>
        {loading ? (
          <div className="h-10 bg-gray-50 rounded animate-pulse" />
        ) : inboxItems.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <p>You&apos;re all caught up!</p>
            <p className="mt-1">No proposals or tasks currently need your approval.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {inboxError && (
              <p className="text-sm text-red-600">{inboxError}</p>
            )}
            {inboxItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Proposed by {item.agent} • {item.type}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleApprove(item)}
                  disabled={approvingId === item.id}
                  className="text-sm bg-black text-white px-4 py-1.5 rounded-full hover:bg-gray-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {approvingId === item.id ? "Approving…" : "Review & Approve"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Leads", value: totalLeads, sub: "All time" },
          { label: "Upcoming Bookings", value: totalBookings, sub: "Scheduled" },
          { label: "Signed Proposals", value: signedProposals, sub: "Converted" },
          { label: "Qualified Pipeline", value: qualifiedLeads, sub: "Active leads" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-border p-5"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="heading-brand text-3xl mt-1">
              {loading ? (
                <span className="inline-block h-8 w-12 bg-gray-100 rounded animate-pulse" />
              ) : stat.value > 0 ? (
                String(stat.value)
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent leads */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Leads</h2>
            <Link
              href="/admin/leads"
              className="text-sm text-stevie-green hover:opacity-80 transition-opacity"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-50 rounded animate-pulse"
                />
              ))}
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No leads yet.</p>
              <p className="mt-1">
                They&apos;ll appear here once someone fills out the{" "}
                <Link href="/intake" className="text-stevie-green underline">
                  intake form
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {recentLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href="/admin/leads"
                  className="flex items-center justify-between py-3 border-b border-border last:border-b-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {lead.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {lead.company || lead.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                        STATUS_COLORS[lead.qualification_status] ||
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {lead.qualification_status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(lead.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming bookings */}
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Upcoming Bookings</h2>
            <Link
              href="/admin/bookings"
              className="text-sm text-stevie-green hover:opacity-80 transition-opacity"
            >
              View all
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-50 rounded animate-pulse"
                />
              ))}
            </div>
          ) : upcomingBookings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              <p>No upcoming bookings.</p>
              <p className="mt-1">
                Bookings from{" "}
                <Link href="/book" className="text-stevie-green underline">
                  Cal.com
                </Link>{" "}
                will sync here via webhook.
              </p>
            </div>
          ) : (
            <div className="space-y-0">
              {upcomingBookings.map((booking) => (
                <Link
                  key={booking.id}
                  href="/admin/bookings"
                  className="flex items-center justify-between py-3 border-b border-border last:border-b-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {booking.attendee_name || booking.attendee_email || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {booking.event_type || "Strategy Call"}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-sm font-medium">
                      {formatDate(booking.scheduled_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime(booking.scheduled_at)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
