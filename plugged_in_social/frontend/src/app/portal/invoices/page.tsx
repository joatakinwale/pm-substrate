"use client";

import { useEffect, useState } from "react";
import {
  Receipt,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
} from "lucide-react";
import { portalFetch, type PortalInvoice } from "@/lib/portal-api";
import { useAuthGuard } from "@/lib/use-auth-guard";

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

const STATUS_STYLES: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
  paid: { icon: CheckCircle2, color: "text-stevie-green", bg: "bg-stevie-green/10" },
  open: { icon: Clock, color: "text-stevie-sky", bg: "bg-stevie-sky/10" },
  past_due: { icon: AlertCircle, color: "text-stevie-orange", bg: "bg-stevie-orange/10" },
  draft: { icon: Clock, color: "text-muted-foreground", bg: "bg-gray-100" },
  void: { icon: AlertCircle, color: "text-muted-foreground", bg: "bg-gray-100" },
};

export default function PortalInvoicesPage() {
  const { ready, requireAuth } = useAuthGuard();
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;

    portalFetch<PortalInvoice[]>("/api/portal/invoices")
      .then(setInvoices)
      .catch(requireAuth)
      .finally(() => setLoading(false));
  }, [ready, requireAuth]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl border p-6 animate-pulse">
            <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
            <div className="h-4 bg-gray-100 rounded w-1/4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="heading-brand text-3xl">Invoices</h1>
        <p className="text-muted-foreground mt-1">
          View your billing history and pay outstanding invoices.
        </p>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <Receipt className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No invoices yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const style = STATUS_STYLES[invoice.status] || STATUS_STYLES.draft;
            const Icon = style.icon;

            return (
              <div
                key={invoice.id}
                className="bg-white rounded-2xl border border-border p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${style.bg}`}>
                      <Icon className={`w-5 h-5 ${style.color}`} />
                    </div>
                    <div>
                      <p className="font-semibold">{formatCents(invoice.total_cents)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full capitalize ${style.bg} ${style.color}`}
                        >
                          {invoice.status.replace("_", " ")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(invoice.created_at).toLocaleDateString()}
                        </span>
                        {invoice.due_date && invoice.status !== "paid" && (
                          <span className="text-xs text-muted-foreground">
                            Due {new Date(invoice.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {invoice.paid_at && (
                          <span className="text-xs text-stevie-green">
                            Paid {new Date(invoice.paid_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {invoice.amount_due_cents > 0 && (
                      <span className="text-sm font-medium">
                        {formatCents(invoice.amount_due_cents)} due
                      </span>
                    )}
                    {invoice.stripe_hosted_invoice_url && invoice.status !== "paid" && (
                      <a
                        href={invoice.stripe_hosted_invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition"
                      >
                        Pay Now <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
