"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderOpen,
  ClipboardCheck,
  Receipt,
  FileText,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import {
  portalFetch,
  type PortalProject,
  type PortalInvoice,
} from "@/lib/portal-api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

const PHASE_COLORS: Record<string, string> = {
  protect: "bg-stevie-sky/10 text-stevie-sky",
  deepen: "bg-stevie-lavender/15 text-purple-600",
  amplify: "bg-stevie-chartreuse/20 text-foreground",
};

export default function PortalDashboard() {
  const { ready, requireAuth } = useAuthGuard();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;

    Promise.all([
      portalFetch<PortalProject[]>("/api/portal/projects").catch(() => []),
      portalFetch<PortalInvoice[]>("/api/portal/invoices").catch(() => []),
    ])
      .then(([p, i]) => {
        setProjects(p);
        setInvoices(i);
      })
      .catch(requireAuth)
      .finally(() => setLoading(false));
  }, [ready, requireAuth]);

  const totalPending = projects.reduce((sum, p) => sum + p.pending_approvals, 0);
  const unpaidInvoices = invoices.filter((i) => i.status === "open" || i.status === "past_due");
  const totalDue = unpaidInvoices.reduce((sum, i) => sum + i.amount_due_cents, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-border p-6 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-24 mb-3" />
              <div className="h-8 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="heading-brand text-3xl">Welcome back</h1>
        <p className="text-muted-foreground mt-1">
          Here's an overview of your projects and deliverables.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <FolderOpen className="w-4 h-4" />
            <span className="text-xs">Active Projects</span>
          </div>
          <p className="text-2xl font-bold">{projects.length}</p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <ClipboardCheck className="w-4 h-4" />
            <span className="text-xs">Pending Approvals</span>
          </div>
          <p className="text-2xl font-bold">
            {totalPending}
            {totalPending > 0 && (
              <span className="text-sm font-normal text-stevie-orange ml-2">
                needs attention
              </span>
            )}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-border p-5">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Receipt className="w-4 h-4" />
            <span className="text-xs">Outstanding Balance</span>
          </div>
          <p className="text-2xl font-bold">{formatCents(totalDue)}</p>
          {unpaidInvoices.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {unpaidInvoices.length} unpaid invoice{unpaidInvoices.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {/* Projects list */}
      <div className="space-y-4">
        <h2 className="heading-brand text-xl">Your Projects</h2>

        {projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-8 text-center">
            <FolderOpen className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No active projects yet. Your agency will set things up for you.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/portal/approvals?project=${project.id}`}
                className="bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{project.name}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      {project.compound_phase && (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${
                            PHASE_COLORS[project.compound_phase] || "bg-gray-100"
                          }`}
                        >
                          {project.compound_phase}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground capitalize">
                        {project.status}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                </div>

                {project.pending_approvals > 0 && (
                  <div className="mt-4 flex items-center gap-2 text-sm text-stevie-orange">
                    <AlertCircle className="w-4 h-4" />
                    {project.pending_approvals} item{project.pending_approvals > 1 ? "s" : ""} awaiting
                    your approval
                  </div>
                )}

                {project.target_date && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Target: {new Date(project.target_date).toLocaleDateString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/portal/invoices"
          className="flex items-center justify-between bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
        >
          <div className="flex items-center gap-3">
            <Receipt className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Invoices & Billing</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                View and pay outstanding invoices
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          href="/portal/proposals"
          className="flex items-center justify-between bg-white rounded-2xl border border-border p-6 hover:border-foreground/20 transition group"
        >
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Proposals</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Review strategy proposals
              </p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>
    </div>
  );
}
