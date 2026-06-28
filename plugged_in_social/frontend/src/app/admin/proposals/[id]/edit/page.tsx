"use client";

// Required for next-on-pages: dynamic [id] routes can't be statically
// prerendered (the ID isn't known at build time), so they must run as
// edge functions. The other 22 admin pages are static, so this is one
// of only ~4 edge functions in the whole bundle — well under Pages' 25 MiB.
export const runtime = 'edge';

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Save } from "lucide-react";
import { apiFetch, ApiError, type Proposal, type ProposalBlock } from "@/lib/api";
import { useEditing } from "@/lib/use-editing";
import EditingBanner from "@/components/EditingBanner";

const BLOCK_ICONS: Record<string, string> = {
  executive_summary: "📋",
  brand_positioning: "🎯",
  audience_segments: "👥",
  content_pillars: "🏛️",
  platform_strategy: "📱",
  phased_framework: "🔄",
  guardrails: "🛡️",
  email_strategy: "📧",
  kpis: "📊",
  sample_calendar: "📅",
  summary_pricing: "💰",
  signature: "✍️",
};

export default function ProposalEditorPage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = params.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeBlock, setActiveBlock] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Lightweight stale-save toast — fired when /block PATCH returns a
  // 409. Backend version-conflict shape isn't wired here yet; see TODO
  // in handleSave.
  const [staleToast, setStaleToast] = useState<{ by: string } | null>(null);

  // "Currently editing" presence for this proposal route.
  const { othersEditing } = useEditing("proposal", proposalId);

  const fetchProposal = useCallback(async () => {
    try {
      const data = await apiFetch<Proposal>(`/api/proposals/${proposalId}`);
      setProposal(data);
      if (!activeBlock && data.blocks.length > 0) {
        setActiveBlock(data.blocks[0].type);
        setEditContent(data.blocks[0].content || "");
      }
    } catch {
      router.push("/admin/proposals");
    } finally {
      setLoading(false);
    }
  }, [proposalId, router, activeBlock]);

  useEffect(() => {
    fetchProposal();
  }, [fetchProposal]);

  function selectBlock(block: ProposalBlock) {
    setActiveBlock(block.type);
    setEditContent(block.content || "");
    setSaved(false);
  }

  async function handleSave() {
    if (!activeBlock || !proposal) return;
    setSaving(true);
    try {
      const updated = await apiFetch<Proposal>(`/api/proposals/${proposal.id}/block`, {
        method: "PATCH",
        body: JSON.stringify({ block_type: activeBlock, content: editContent }),
      });
      setProposal(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        // TODO: backend 409 conflict on stale save — once the API ships
        // {detail: "stale", last_modified_by, last_modified_at}, pull the
        // editor's name out of the body and surface it here.
        const body = err.body as
          | { last_modified_by?: { full_name?: string; email?: string } }
          | null
          | undefined;
        const by =
          body?.last_modified_by?.full_name ||
          body?.last_modified_by?.email ||
          "another editor";
        setStaleToast({ by });
      } else {
        alert(err instanceof Error ? err.message : "Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  if (loading || !proposal) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentBlock = proposal.blocks.find((b) => b.type === activeBlock);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/proposals"
          className="w-8 h-8 rounded-full border border-border flex items-center justify-center hover:bg-gray-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="heading-brand text-2xl">{proposal.title}</h1>
          <p className="text-sm text-muted-foreground">
            {proposal.client_name} &middot; {proposal.blocks.filter((b) => b.content).length}/{proposal.blocks.length} blocks completed
          </p>
        </div>
      </div>

      {/* Live collaboration signals */}
      {staleToast && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm">
          <span className="flex-1">
            This was changed by{" "}
            <span className="font-semibold">{staleToast.by}</span> — reload?
          </span>
          <button
            onClick={() => {
              setStaleToast(null);
              fetchProposal();
            }}
            className="px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 transition"
          >
            Reload
          </button>
          <button
            onClick={() => setStaleToast(null)}
            className="text-amber-700 hover:text-amber-900 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
      <EditingBanner editors={othersEditing} />

      {/* Editor layout */}
      <div className="flex gap-4 h-[calc(100vh-200px)]">
        {/* Block sidebar */}
        <div className="w-64 shrink-0 bg-white rounded-2xl border border-border overflow-y-auto p-2">
          {proposal.blocks.map((block) => (
            <button
              key={block.type}
              onClick={() => selectBlock(block)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition ${
                activeBlock === block.type
                  ? "bg-stevie-green/10 text-stevie-green font-medium"
                  : "hover:bg-gray-50 text-muted-foreground"
              }`}
            >
              <span className="text-base">{BLOCK_ICONS[block.type] || "📄"}</span>
              <span className="flex-1 truncate">{block.title}</span>
              {block.content ? (
                <Check className="w-3.5 h-3.5 text-stevie-green shrink-0" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-gray-200 shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Content editor */}
        <div className="flex-1 bg-white rounded-2xl border border-border flex flex-col overflow-hidden">
          {currentBlock && (
            <>
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="font-semibold">
                    {BLOCK_ICONS[currentBlock.type]} {currentBlock.title}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Block {currentBlock.order} of 12
                  </p>
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                    saved
                      ? "bg-stevie-green/10 text-stevie-green"
                      : "bg-foreground text-white hover:bg-foreground/90"
                  } disabled:opacity-50`}
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                  ) : saved ? (
                    <><Check className="w-4 h-4" /> Saved</>
                  ) : (
                    <><Save className="w-4 h-4" /> Save Block</>
                  )}
                </button>
              </div>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder={`Write the ${currentBlock.title.toLowerCase()} content here...\n\nUse rich text formatting. This content will be displayed in the client-facing proposal view.`}
                className="flex-1 p-6 text-sm resize-none focus:outline-none font-[inherit] leading-relaxed"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
