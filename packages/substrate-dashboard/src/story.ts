/**
 * Story view — the plain-English answer to "what am I looking at?"
 *
 * Turns the raw state-review artifacts into a narrative a human reads top to
 * bottom and immediately understands: an AI agent ran a 4-step decision loop;
 * the substrate checked each step against the latest verified state; it caught
 * the broken steps and let the clean one through. No jargon tiles, no
 * coincidental-looking counts — just the story.
 */

import type { DashboardData, StateReviewArtifact } from "./data.js";

interface StepStory {
  step: number;
  title: string;
  agentDid: string;
  verdict: "passed" | "blocked";
  problem: string | null;
  warningCount: number;
  topReasons: { label: string; count: number }[];
}

// Map cryptic warning codes to plain English.
const CODE_LABELS: Record<string, string> = {
  stale_read_ref: "used stale market data",
  current_view_conflict: "conflicted with the current verified state",
  freshness_window_current: "risk data was past its freshness window",
  workflow_position_mismatch: "was at the wrong step in the workflow",
  conflicts_declared: "had declared conflicts",
  authority_mismatch: "used data from the wrong authority/source",
  projection_version_mismatch: "read an outdated version of the data",
  missing_read_ref: "was missing a required data reference",
  missing_sources_declared: "did not declare its data sources",
  required_source_refs_present: "was missing required source references",
  workflow_position_matches: "workflow position check",
};

// Turn an artifact id into a human step title.
function stepTitle(id: string): string {
  if (id.includes("clean_current")) return "Refresh risk on fresh data";
  if (id.includes("observation_to_action")) return "Turn an observation into a trade action";
  if (id.includes("action_to_feedback")) return "Record feedback from an action";
  if (id.includes("feedback_to_observation")) return "Fold feedback back into observations";
  return id;
}

function plainProblem(art: StateReviewArtifact): string | null {
  const w = art.review.warnings;
  if (w.length === 0) return null;
  // Prefer the first human message the fixture provides.
  const msg = w.find((x) => x.message && x.message.trim().length > 0)?.message;
  return msg ?? "The substrate flagged this step.";
}

function topReasons(art: StateReviewArtifact): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const w of art.review.warnings) {
    const label = CODE_LABELS[w.code] ?? w.code.replaceAll("_", " ");
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function buildSteps(data: DashboardData): StepStory[] {
  const order = [
    "clean_current",
    "observation_to_action",
    "action_to_feedback",
    "feedback_to_observation",
  ];
  const sorted = [...data.artifacts].sort(
    (a, b) =>
      order.findIndex((k) => a.artifactId.includes(k)) -
      order.findIndex((k) => b.artifactId.includes(k)),
  );
  return sorted.map((art, i) => {
    const blocked = !art.review.valid || art.review.warnings.length > 0;
    return {
      step: i + 1,
      title: stepTitle(art.artifactId),
      agentDid: art.review.proposedAction?.actionType ?? "proposed an action",
      verdict: blocked ? "blocked" : "passed",
      problem: plainProblem(art),
      warningCount: art.review.warnings.length,
      topReasons: topReasons(art),
    };
  });
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderStory(root: HTMLElement, data: DashboardData): void {
  const steps = buildSteps(data);
  const total = steps.length;
  const blocked = steps.filter((s) => s.verdict === "blocked").length;
  const passed = total - blocked;

  const stepCards = steps
    .map((s) => {
      const toneClass = s.verdict === "passed" ? "story-pass" : "story-block";
      const badge =
        s.verdict === "passed"
          ? `<span class="story-badge pass">✓ ALLOWED</span>`
          : `<span class="story-badge block">✕ BLOCKED</span>`;
      const reasons = s.topReasons.length
        ? `<ul class="story-reasons">${s.topReasons
            .map(
              (r) =>
                `<li>${esc(r.label)}${r.count > 1 ? ` <span class="story-x">×${r.count}</span>` : ""}</li>`,
            )
            .join("")}</ul>`
        : "";
      const problem = s.problem
        ? `<p class="story-problem">“${esc(s.problem)}”</p>`
        : `<p class="story-ok">Fresh data, no conflicts — the agent was allowed to proceed.</p>`;
      return `
        <div class="story-step ${toneClass}">
          <div class="story-step-head">
            <span class="story-step-num">Step ${s.step}</span>
            ${badge}
          </div>
          <h3 class="story-step-title">${esc(s.title)}</h3>
          ${problem}
          ${reasons}
          ${s.warningCount > 0 ? `<div class="story-step-foot">${s.warningCount} substrate warning${s.warningCount === 1 ? "" : "s"} on this step</div>` : ""}
        </div>`;
    })
    .join("");

  root.innerHTML = `
    <div class="story-wrap">
      <header class="story-header">
        <h1>What happened</h1>
        <p class="story-lede">
          An AI trading agent ran a <strong>${total}-step decision loop</strong> on AAPL.
          The substrate checked every step against the latest verified state before allowing it.
        </p>
      </header>

      <div class="story-headline">
        <div class="story-hl-card story-hl-pass">
          <span class="story-hl-num">${passed}</span>
          <span class="story-hl-label">step allowed</span>
          <span class="story-hl-sub">fresh data, no conflicts</span>
        </div>
        <div class="story-hl-card story-hl-block">
          <span class="story-hl-num">${blocked}</span>
          <span class="story-hl-label">steps blocked</span>
          <span class="story-hl-sub">caught acting on stale / wrong / missing data</span>
        </div>
      </div>

      <p class="story-takeaway">
        <strong>The point:</strong> without the substrate, all ${total} steps would have executed —
        including the ${blocked} built on bad data. The substrate stopped the bad ${blocked}
        and let the ${passed} clean one through. <em>That is the safety layer, in one screen.</em>
      </p>

      <h2 class="story-section">Step by step</h2>
      <div class="story-steps">${stepCards}</div>

      <p class="story-foot">
        Source: ${total} state-review artifacts in the ArrowHedge replay corpus.
        Each “blocked” step carries the exact substrate warnings that stopped it.
      </p>
    </div>`;
}
