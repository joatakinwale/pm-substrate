"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle2,
  Clock,
  Eye,
  Send,
} from "lucide-react";
import { portalFetch, type PortalProposal } from "@/lib/portal-api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });
}

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; label: string; color: string; bg: string }> = {
  sent: { icon: Send, label: "Sent", color: "text-stevie-sky", bg: "bg-stevie-sky/10" },
  viewed: { icon: Eye, label: "Viewed", color: "text-purple-600", bg: "bg-stevie-lavender/15" },
  signed: { icon: CheckCircle2, label: "Signed", color: "text-stevie-green", bg: "bg-stevie-green/10" },
};

export default function PortalProposalsPage() {
  const { ready, requireAuth } = useAuthGuard();
  const [proposals, setProposals] = useState<PortalProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;

    portalFetch<PortalProposal[]>("/api/portal/proposals")
      .then(setProposals)
      .catch(requireAuth)
      .finally(() => setLoading(false));
  }, [ready, requireAuth]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-2/3 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-brand text-3xl">Proposals</h1>
        <p className="text-muted-foreground mt-1">
          Review strategy proposals from your agency team.
        </p>
      </div>

      {proposals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <FileText className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No proposals yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const style = STATUS_STYLES[proposal.status] || STATUS_STYLES.sent;
            const Icon = style.icon;
            const isExpanded = expanded === proposal.id;

            return (
              <div
                key={proposal.id}
                className="bg-white rounded-2xl border border-border overflow-hidden"
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : proposal.id)}
                  className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${style.bg}`}>
                      <Icon className={`w-5 h-5 ${style.color}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{proposal.title}</h3>
                      <div className="flex items-center gap-3 mt-1">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${style.bg} ${style.color}`}
                        >
                          {style.label}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(proposal.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-semibold">
                      {formatCents(proposal.total_monthly_cents)}/mo
                    </p>
                    {proposal.total_setup_cents > 0 && (
                      <p className="text-xs text-muted-foreground">
                        + {formatCents(proposal.total_setup_cents)} setup
                      </p>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-6 pb-6 border-t border-border">
                    <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Investment</p>
                        <p className="font-semibold text-lg mt-0.5">
                          {formatCents(proposal.total_monthly_cents)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Setup Fee</p>
                        <p className="font-semibold text-lg mt-0.5">
                          {formatCents(proposal.total_setup_cents)}
                        </p>
                      </div>
                    </div>

                    {proposal.sent_at && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Sent on {new Date(proposal.sent_at).toLocaleString()}
                      </p>
                    )}
                    {proposal.signed_at && (
                      <p className="mt-1 text-xs text-stevie-green">
                        Signed on {new Date(proposal.signed_at).toLocaleString()}
                      </p>
                    )}

                    <p className="mt-4 text-xs text-muted-foreground">
                      Contact your agency representative to discuss details or request changes.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
