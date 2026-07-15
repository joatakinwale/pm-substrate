import type {
  ActionProposalReview,
  EvidenceAuthorityStatus,
} from "@pm/agent-state-core";

import type { ToolSandboxSidecarRuntimeClosure } from "./runtime-closure.js";

export type ToolSandboxArm = "native" | "sham" | "substrate";
export type ToolSandboxEvaluationTrack =
  | "official_headline"
  | "restart_lost_response_derivative";

export interface ToolSandboxExecutionBinding {
  readonly agentModel: string;
  readonly userSimulatorModel: string;
  readonly toolBackend: string;
  readonly seed: string;
  readonly maxTurns: number;
}

export type ToolSandboxFaultEvidence =
  | {
      readonly status: "applied";
      readonly targetCallId: string;
      readonly targetSideEffectReceiptHash: string;
      readonly restartedAgentSessionId: string;
      readonly appliedAtTurn: number;
    }
  | {
      readonly status: "trigger_not_reached";
      readonly reason: string;
    };

export interface ToolSandboxInternalOutcome {
  readonly admittedActionCount: number;
  readonly blockedActionCount: number;
  readonly haltedByInternalBlock: boolean;
  readonly blockReasonCodes: readonly string[];
}

export interface ToolSandboxAttemptInput {
  readonly batchId: string;
  readonly attemptId: string;
  readonly arm: ToolSandboxArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly completedAt: string;
  readonly execution: ToolSandboxExecutionBinding;
  readonly faultEvidence?: ToolSandboxFaultEvidence;
  readonly internalOutcome: ToolSandboxInternalOutcome;
  readonly upstreamResultSummary: unknown;
}

export interface ToolSandboxAttemptReceipt {
  readonly schemaVersion: "pm.public-eval.toolsandbox-receipt.v2";
  readonly manifestHash: string;
  readonly batchId: string;
  readonly attemptId: string;
  readonly arm: ToolSandboxArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly headlineEligible: boolean;
  readonly completedAt: string;
  readonly execution: ToolSandboxExecutionBinding;
  readonly intervention:
    | { readonly kind: "none" }
    | {
        readonly kind: "scheduled_fault";
        readonly faultId: string;
        readonly targetTool: string;
        readonly trigger: string;
        readonly effect: string;
        readonly evidence: ToolSandboxFaultEvidence;
      };
  readonly internalOutcome: ToolSandboxInternalOutcome;
  readonly upstream: {
    readonly repositoryUrl: string;
    readonly revision: string;
    readonly scenario: string;
    readonly corpusHash: string;
    readonly resultSummaryHash: string;
    readonly resultSummary: unknown;
  };
  readonly oracleOutcome: {
    readonly owner: string;
    readonly score: number;
    readonly milestoneSimilarity: number;
    readonly minefieldSimilarity: number;
    readonly strictTaskSuccess: boolean;
    readonly milestoneMapping: Readonly<
      Record<string, readonly [number, number]>
    >;
    readonly minefieldMapping: Readonly<
      Record<string, readonly [number, number]>
    >;
    readonly internalBlocksAffectTaskSuccess: false;
    readonly resultScope:
      | "official_unchanged_scenario"
      | "official_oracle_on_derived_trajectory";
  };
  readonly receiptHash: string;
}

export interface ToolSandboxReceiptSetSummary {
  readonly schemaVersion: "pm.public-eval.toolsandbox-batch-summary.v2";
  readonly manifestHash: string;
  readonly batchId: string;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly headlineEligible: boolean;
  readonly authorityStatus: EvidenceAuthorityStatus;
  readonly attempts: readonly {
    readonly attemptId: string;
    readonly arm: ToolSandboxArm;
    readonly faultApplied: boolean;
    readonly oracleScore: number;
    readonly strictTaskSuccess: boolean;
    readonly blockedActionCount: number;
    readonly haltedByInternalBlock: boolean;
  }[];
}

export interface ToolSandboxHeadlineQualificationInput {
  readonly checkoutPath: string;
  readonly pythonExecutable: string;
  readonly outputRoot: string;
  readonly agent: string;
  readonly user: string;
  readonly preferredToolBackend: "DEFAULT";
  readonly scriptedStdin?: readonly string[];
  readonly timeoutMs?: number;
  readonly attempt: Omit<
    ToolSandboxAttemptInput,
    | "evaluationTrack"
    | "faultEvidence"
    | "upstreamResultSummary"
    | "completedAt"
  >;
}

export interface ToolSandboxQualificationArtifact {
  readonly schemaVersion: "pm.public-eval.toolsandbox-qualification.v1";
  readonly evaluationTrack: "official_headline";
  readonly headlineEligible: true;
  readonly checkoutPath: string;
  readonly corpusVerification: {
    readonly revision: string;
    readonly corpusHash: string;
    readonly fileCount: number;
  };
  readonly invocation: {
    readonly executable: string;
    readonly arguments: readonly string[];
    readonly cwd: string;
    readonly exitCode: 0;
    readonly stdoutSha256: string;
    readonly stderrSha256: string;
  };
  readonly resultSummaryPath: string;
  readonly receipt: ToolSandboxAttemptReceipt;
  readonly qualificationHash: string;
}

export type ToolSandboxBoundaryArm = "sham" | "substrate";

export interface ToolSandboxToolProposalInput {
  readonly schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1";
  readonly arm: ToolSandboxBoundaryArm;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly attemptId: string;
  readonly sessionId: string;
  readonly statePath: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly proposedAt: string;
}

export interface ToolSandboxToolProposalDecision {
  readonly schemaVersion: "pm.public-eval.toolsandbox-tool-decision.v1";
  readonly proposalId: string;
  readonly arm: ToolSandboxBoundaryArm;
  readonly decision: "allow" | "block";
  readonly responseForAgent: string | null;
  readonly fingerprint: string;
  readonly review: Pick<
    ActionProposalReview,
    "valid" | "execution" | "warnings"
  >;
  readonly stateHashBefore: string;
  readonly decisionHash: string;
}

export interface ToolSandboxToolOutcomeInput {
  readonly schemaVersion: "pm.public-eval.toolsandbox-tool-outcome.v1";
  readonly arm: ToolSandboxBoundaryArm;
  readonly attemptId: string;
  readonly statePath: string;
  readonly proposalId: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly arguments: Readonly<Record<string, unknown>>;
  readonly succeeded: boolean;
  readonly responseHash: string;
  readonly observedAt: string;
}

export interface ToolSandboxMatchedBatchInput {
  readonly checkoutPath: string;
  readonly pythonExecutable: string;
  readonly nodeExecutable: string;
  readonly outputRoot: string;
  readonly batchId: string;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly agent: string;
  readonly user: string;
  readonly preferredToolBackend: "DEFAULT";
  readonly randomizationSeed: string;
  /** Deterministic stdin lines for the upstream Cli user role. */
  readonly scriptedStdin?: readonly string[];
  readonly timeoutMs?: number;
}

export interface ToolSandboxMatchedBatchArtifact {
  readonly schemaVersion: "pm.public-eval.toolsandbox-matched-batch.v3";
  readonly manifestHash: string;
  readonly batchId: string;
  readonly evaluationTrack: ToolSandboxEvaluationTrack;
  readonly headlineEligible: boolean;
  readonly checkoutPath: string;
  readonly corpusVerification: {
    readonly revision: string;
    readonly corpusHash: string;
    readonly fileCount: number;
  };
  readonly randomization: {
    readonly seed: string;
    readonly armOrder: readonly ToolSandboxArm[];
  };
  readonly execution: ToolSandboxExecutionBinding;
  readonly scriptedStdin: readonly string[];
  readonly attempts: readonly {
    readonly order: number;
    readonly arm: ToolSandboxArm;
    readonly attemptId: string;
    readonly invocation: {
      readonly executable: string;
      readonly arguments: readonly string[];
      readonly cwd: string;
      readonly exitCode: 0;
      readonly runnerSha256: string;
      readonly stdoutPath: string;
      readonly stdoutSha256: string;
      readonly stderrPath: string;
      readonly stderrSha256: string;
    };
    readonly resultSummaryPath: string;
    readonly metadataPath: string;
    readonly boundaryTracePath: string | null;
    readonly boundaryTraceSha256: string | null;
    readonly boundarySidecar: null | {
      readonly readyPath: string;
      readonly finalReceiptPath: string;
      readonly auditPath: string;
      readonly operationLedgerPath: string;
      readonly stdoutPath: string;
      readonly stderrPath: string;
      readonly launch: {
        readonly pid: number;
        readonly ppid: number;
        readonly tokenSha256: string;
        readonly nodePath: string;
        readonly nodeSha256: string;
        readonly entryPath: string;
        readonly entrySha256: string;
        readonly runtimeModuleClosure: ToolSandboxSidecarRuntimeClosure;
      };
    };
    readonly providerProcessTracePath: string;
    readonly providerProcessTraceSha256: string;
    readonly providerSessionRestartCount: number;
    readonly receiptPath: string;
    readonly receipt: ToolSandboxAttemptReceipt;
    readonly rawArtifacts: readonly {
      readonly path: string;
      readonly sha256: string;
    }[];
  }[];
  readonly summary: ToolSandboxReceiptSetSummary;
  readonly batchHash: string;
}
