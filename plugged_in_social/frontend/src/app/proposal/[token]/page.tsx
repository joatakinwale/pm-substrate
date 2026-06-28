"use client";

export const runtime = 'edge';

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, FileSignature, Loader2 } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ProposalPublic {
  id: string;
  title: string;
  status: string;
  client_name: string;
  client_company: string | null;
  compound_phase: string | null;
  total_cents: number;
  currency: string;
  billing_interval: string;
  blocks: Array<{ type: string; title: string; content: string; order: number }>;
  signed_at: string | null;
}

const PHASE_LABELS: Record<string, string> = {
  protect: "Protect Phase",
  deepen: "Deepen Phase",
  amplify: "Amplify Phase",
};

const PHASE_COLORS: Record<string, string> = {
  protect: "bg-[#7ac9e8]/15 text-[#7ac9e8] border-[#7ac9e8]/30",
  deepen: "bg-[#d1bff2]/20 text-purple-700 border-[#d1bff2]/40",
  amplify: "bg-[#edff6b]/20 text-gray-900 border-[#edff6b]/50",
};

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 });
}

export default function PublicProposalPage() {
  const params = useParams();
  const token = params.token as string;

  const [proposal, setProposal] = useState<ProposalPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/proposals/public/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail || "Proposal not found");
        }
        return res.json();
      })
      .then((data) => {
        setProposal(data);
        if (data.signed_at) setSigned(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSign() {
    if (!confirm("By clicking confirm, you are accepting this proposal and its terms.")) return;
    setSigning(true);
    try {
      const res = await fetch(`${API_URL}/api/proposals/public/${token}/sign`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to sign");
      }
      const data = await res.json();
      setProposal(data);
      setSigned(true);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to sign proposal");
    } finally {
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#089140]" />
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-margo text-2xl mb-2">Proposal Not Found</h1>
          <p className="text-gray-500">{error || "This proposal may have expired or been removed."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <p className="font-margo text-lg tracking-tight mb-1">
            stevie<span className="text-[#089140]">.</span>
          </p>
          <h1 className="text-2xl font-bold mt-4">{proposal.title}</h1>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-gray-500 text-sm">Prepared for {proposal.client_name}</p>
            {proposal.client_company && (
              <span className="text-gray-300">|</span>
            )}
            {proposal.client_company && (
              <p className="text-gray-500 text-sm">{proposal.client_company}</p>
            )}
          </div>
          {proposal.compound_phase && (
            <span className={`inline-block mt-3 px-3 py-1 rounded-full text-xs font-semibold border ${PHASE_COLORS[proposal.compound_phase] || "bg-gray-100 border-gray-200"}`}>
              {PHASE_LABELS[proposal.compound_phase] || proposal.compound_phase}
            </span>
          )}
        </div>
      </header>

      {/* Blocks */}
      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {proposal.blocks
          .filter((b) => b.type !== "signature" && b.content)
          .map((block) => (
            <section key={block.type} className="bg-white rounded-2xl border border-gray-200 p-8">
              <p className="text-xs text-[#089140] font-semibold uppercase tracking-wider mb-2">
                {block.order}. {block.title}
              </p>
              <div className="prose prose-sm max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {block.content}
              </div>
            </section>
          ))}

        {/* Pricing */}
        {proposal.total_cents > 0 && (
          <section className="bg-white rounded-2xl border border-gray-200 p-8">
            <p className="text-xs text-[#089140] font-semibold uppercase tracking-wider mb-4">Investment</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{formatCents(proposal.total_cents)}</span>
              <span className="text-gray-500 text-lg mb-1">/{proposal.billing_interval}</span>
            </div>
          </section>
        )}

        {/* Signature / CTA */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          {signed ? (
            <div className="space-y-3">
              <CheckCircle className="w-12 h-12 text-[#089140] mx-auto" />
              <h2 className="text-xl font-bold">Proposal Accepted</h2>
              <p className="text-gray-500 text-sm">
                Thank you! Your onboarding process has been started. Check your email for next steps.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <FileSignature className="w-10 h-10 text-gray-400 mx-auto" />
              <h2 className="text-xl font-bold">Accept This Proposal</h2>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                By accepting, you agree to the strategy and investment outlined above.
                Your onboarding will begin immediately.
              </p>
              <button
                onClick={handleSign}
                disabled={signing}
                className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#089140] text-white font-semibold hover:bg-[#089140]/90 transition disabled:opacity-50"
              >
                <FileSignature className="w-4 h-4" />
                {signing ? "Processing..." : "Accept & Sign"}
              </button>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12">
        <div className="max-w-3xl mx-auto px-6 py-6 text-center">
          <p className="font-margo text-sm tracking-tight">
            stevie<span className="text-[#089140]">.</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">The Compound Method — Protect. Deepen. Amplify.</p>
        </div>
      </footer>
    </div>
  );
}
