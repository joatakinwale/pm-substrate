import arrowHedgeJsonl from "../../evals/fixtures/arrowhedge-state-review-artifacts.v1.jsonl?raw";
import evidenceAdmissionJsonl from "../../evals/fixtures/evidence-admission-reviews.v1.jsonl?raw";

export type StatusTone = "good" | "warn" | "bad" | "neutral";

export interface StateRef {
  readonly kind: string;
  readonly id: string;
  readonly label?: string;
}

export interface ArtifactWarning {
  readonly source: string;
  readonly code: string;
  readonly severity: string;
  readonly message: string;
  readonly refs?: readonly StateRef[];
}

export interface StateReviewArtifact {
  readonly artifactHash: string;
  readonly artifactId: string;
  readonly eventEnvelope: {
    readonly source: string;
    readonly subject: string;
    readonly time: string;
    readonly type: string;
  };
  readonly generatedAt: string;
  readonly metadata: {
    readonly clientSurface?: string;
    readonly evalEventIds?: readonly string[];
    readonly fixtureId?: string;
    readonly invariantClasses?: readonly string[];
    readonly provider?: string;
    readonly scenarioId?: string;
    readonly sessionId?: string;
    readonly temporalMisalignmentPhase?: string;
    readonly workflowRunId?: string;
  };
  readonly provenance?: {
    readonly associatedAgent?: string;
    readonly derivedFrom?: readonly StateRef[];
  };
  readonly relatedObjects?: readonly {
    readonly role: string;
    readonly ref: StateRef;
  }[];
  readonly review: {
    readonly currentStateView: {
      readonly viewId: string;
      readonly subject: StateRef;
      readonly sourceRefs: readonly StateRef[];
      readonly conflicts: readonly { readonly message: string }[];
      readonly workflowPosition?: string;
    };
    readonly execution: {
      readonly allowed: boolean;
      readonly blocking: boolean;
      readonly enforcementMode: string;
    };
    readonly proposedAction: {
      readonly actionType: string;
      readonly proposedAt: string;
      readonly proposedBy: string;
    };
    readonly valid: boolean;
    readonly warnings: readonly ArtifactWarning[];
  };
}

export interface EvidenceAdmissionReview {
  readonly reviewId: string;
  readonly tenantId: string;
  readonly evidence: {
    readonly evidenceId: string;
    readonly kind: string;
    readonly source: string;
    readonly subject: StateRef;
    readonly observedAt: string;
    readonly validUntil?: string;
    readonly collectedBy?: string;
    readonly clientSurface?: string;
    readonly provider?: string;
  };
  readonly evaluatedAt: string;
  readonly decision: "admitted" | "admitted_with_warnings" | "rejected";
  readonly authorityStatus: "evidence_only";
  readonly issues: readonly {
    readonly code: string;
    readonly severity: string;
    readonly path: string;
    readonly message: string;
  }[];
  readonly invariantClasses: readonly string[];
}

export interface MetricCard {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly tone: StatusTone;
}

export interface CountDatum {
  readonly key: string;
  readonly count: number;
  readonly tone: StatusTone;
}

export interface DashboardData {
  readonly artifacts: readonly StateReviewArtifact[];
  readonly admissions: readonly EvidenceAdmissionReview[];
  readonly metrics: readonly MetricCard[];
  readonly phaseCounts: readonly CountDatum[];
  readonly invariantCounts: readonly CountDatum[];
  readonly warningCounts: readonly CountDatum[];
  readonly decisionCounts: readonly CountDatum[];
  readonly evidenceKindCounts: readonly CountDatum[];
  readonly flow: {
    readonly observations: number;
    readonly stateReviews: number;
    readonly admittedEvidence: number;
    readonly rejectedEvidence: number;
    readonly writeBindings: number | null;
  };
}

export function parseJsonl<T>(raw: string): T[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

export function loadDashboardData(): DashboardData {
  return buildDashboardData(
    parseJsonl<StateReviewArtifact>(arrowHedgeJsonl),
    parseJsonl<EvidenceAdmissionReview>(evidenceAdmissionJsonl),
  );
}

export function buildDashboardData(
  artifacts: readonly StateReviewArtifact[],
  admissions: readonly EvidenceAdmissionReview[],
): DashboardData {
  const sortedArtifacts = [...artifacts].sort((a, b) =>
    a.generatedAt.localeCompare(b.generatedAt),
  );
  const sortedAdmissions = [...admissions].sort((a, b) =>
    a.evaluatedAt.localeCompare(b.evaluatedAt),
  );
  const hashVerified = sortedArtifacts.filter(
    (artifact) => artifact.artifactHash.length === 64,
  ).length;
  const warningCount = sortedArtifacts.reduce(
    (total, artifact) => total + artifact.review.warnings.length,
    0,
  );
  const rejectedEvidence = sortedAdmissions.filter(
    (review) => review.decision === "rejected",
  ).length;
  const admittedEvidence = sortedAdmissions.filter(
    (review) => review.decision !== "rejected",
  ).length;
  const cleanArtifacts = sortedArtifacts.filter(
    (artifact) => artifact.review.valid,
  ).length;

  return {
    artifacts: sortedArtifacts,
    admissions: sortedAdmissions,
    metrics: [
      {
        id: "artifacts",
        label: "State-review artifacts",
        value: String(sortedArtifacts.length),
        detail: `${cleanArtifacts} clean, ${sortedArtifacts.length - cleanArtifacts} warning-bearing`,
        tone: sortedArtifacts.length === cleanArtifacts ? "good" : "warn",
      },
      {
        id: "replay",
        label: "Replay hashes",
        value: formatPercent(hashVerified, sortedArtifacts.length),
        detail: `${hashVerified}/${sortedArtifacts.length} artifact hashes present`,
        tone: hashVerified === sortedArtifacts.length ? "good" : "bad",
      },
      {
        id: "admission",
        label: "Evidence admissions",
        value: String(sortedAdmissions.length),
        detail: `${admittedEvidence} admitted, ${rejectedEvidence} rejected`,
        tone: rejectedEvidence > 0 ? "warn" : "good",
      },
      {
        id: "warnings",
        label: "Artifact warnings",
        value: String(warningCount),
        detail: `${Object.keys(countArtifactWarnings(sortedArtifacts)).length} warning codes`,
        tone: warningCount > 0 ? "warn" : "good",
      },
      {
        id: "binding",
        label: "Write binding stream",
        value: "Pending",
        detail: "Runtime gate exists; no replay fixture stream yet",
        tone: "neutral",
      },
    ],
    phaseCounts: sortCounts(
      countBy(sortedArtifacts, (artifact) =>
        artifact.metadata.temporalMisalignmentPhase ?? "none",
      ),
      phaseTone,
    ),
    invariantCounts: sortCounts(
      countStrings(
        sortedArtifacts.flatMap(
          (artifact) => artifact.metadata.invariantClasses ?? [],
        ),
      ),
      invariantTone,
    ),
    warningCounts: sortCounts(countArtifactWarnings(sortedArtifacts), warningTone),
    decisionCounts: sortCounts(
      countBy(sortedAdmissions, (review) => review.decision),
      decisionTone,
    ),
    evidenceKindCounts: sortCounts(
      countBy(sortedAdmissions, (review) => review.evidence.kind),
      () => "neutral",
    ),
    flow: {
      observations: sortedArtifacts.length,
      stateReviews: sortedArtifacts.length,
      admittedEvidence,
      rejectedEvidence,
      writeBindings: null,
    },
  };
}

export function shortId(id: string, size = 12): string {
  return id.length <= size ? id : `${id.slice(0, size - 3)}...`;
}

export function toneForArtifact(artifact: StateReviewArtifact): StatusTone {
  if (artifact.review.execution.blocking) return "bad";
  if (!artifact.review.valid || artifact.review.warnings.length > 0) return "warn";
  return "good";
}

export function toneForAdmission(review: EvidenceAdmissionReview): StatusTone {
  if (review.decision === "rejected") return "bad";
  if (review.decision === "admitted_with_warnings") return "warn";
  return "good";
}

export function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(11, 19);
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator === 0) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function countArtifactWarnings(
  artifacts: readonly StateReviewArtifact[],
): Record<string, number> {
  return countStrings(
    artifacts.flatMap((artifact) =>
      artifact.review.warnings.map((warning) => warning.code),
    ),
  );
}

function countStrings(values: readonly string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function countBy<T>(
  values: readonly T[],
  getKey: (value: T) => string,
): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = getKey(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function sortCounts(
  counts: Record<string, number>,
  getTone: (key: string) => StatusTone,
): CountDatum[] {
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count, tone: getTone(key) }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function phaseTone(phase: string): StatusTone {
  return phase === "none" ? "good" : "warn";
}

function invariantTone(invariant: string): StatusTone {
  return invariant.includes("authority") || invariant.includes("required")
    ? "bad"
    : "warn";
}

function warningTone(warning: string): StatusTone {
  return warning.includes("missing") || warning.includes("authority")
    ? "bad"
    : "warn";
}

function decisionTone(decision: string): StatusTone {
  if (decision === "rejected") return "bad";
  if (decision === "admitted_with_warnings") return "warn";
  return "good";
}
