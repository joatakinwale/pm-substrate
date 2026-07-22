import type {
  RunningProductionStateSidecar,
  StartProductionStateSidecarInput,
} from "./production-state-sidecar.js";
import type {
  SentinelGeneralAnthropicProviderProxy,
  StartSentinelGeneralAnthropicProviderProxyInput,
} from "./sentinel-general-provider-proxy.js";
import type {
  SentinelProductionArm,
  SentinelProductionCell,
  SentinelProductionTask,
  SentinelRuntimeClosure,
} from "./sentinel-production-plan.js";
import type {
  SentinelProductionExternalCommitmentVerification,
  SentinelProductionRuntimeInspection,
  SentinelProductionRuntimeInspectionReference,
} from "./sentinel-production-runner-evidence.js";
import type {
  SentinelProductionDiagnosticSelection,
  SentinelProductionExternalCommitment,
  SentinelProductionRuntimeBindings,
} from "./sentinel-production-runner-contracts.js";
import type {
  SentinelProductionAttemptTerminalReceipt,
  SentinelProductionSupervisorInput,
} from "./sentinel-production-supervisor.js";

export type SentinelProductionJsonValue =
  | null | boolean | number | string
  | readonly SentinelProductionJsonValue[]
  | { readonly [key: string]: SentinelProductionJsonValue };

export interface SentinelProductionCheckoutPreflight {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-checkout-preflight.v1";
  readonly checkoutPath: string;
  readonly repositoryUrl: string | null;
  readonly revision: string | null;
  readonly sourceTreeHash: string | null;
  readonly cleanTrackedAndUntracked: boolean;
  readonly ignoredArtifactRootSha256: string;
  readonly databaseRootSha256: string;
  readonly selectedScenarioRootSha256: string;
  readonly frontendInstalledTreeSha256: string;
  readonly frontendPackageLockSha256: string;
  readonly serverRequirementsSha256: string;
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly preflightSha256: string;
}

export interface SentinelProductionContinuityTenantReceipt {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-tenant.v1";
  readonly tenant: string;
  readonly createdAt: string;
  readonly initialCheckpointCount: 0;
  readonly initialCheckpointHeadSha256: null;
  readonly receiptSha256: string;
}

export interface SentinelProductionContinuityReplayExport {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-continuity-replay.v1";
  readonly tenant: string;
  readonly agentId: string;
  readonly scope: string;
  readonly exportedAt: string;
  readonly tenantRow: SentinelProductionJsonValue;
  readonly checkpoints: readonly SentinelProductionJsonValue[];
  readonly checkpointCount: number;
  readonly checkpointHeadSha256: string | null;
  readonly exportSha256: string;
}

export interface SentinelProductionArtifactIdentity {
  readonly path: string;
  readonly byteLength: number;
  readonly sha256: string;
}

export interface SentinelProductionServiceBinding {
  readonly state: {
    readonly mode: SentinelProductionArm;
    readonly origin: string;
    readonly tokenSha256: string;
    readonly evidenceBindingSha256: string;
    readonly identitySha256: string;
    readonly readyReceiptPath: string;
    readonly readyReceiptSha256: string;
    readonly initialBackendRecordCount: number;
    readonly initialBackendHeadSha256: string | null;
    readonly initialRelevantStateSha256: string;
    readonly responseDeadlineMs: number;
    readonly firstStateFresh: boolean;
  };
  readonly provider: {
    readonly origin: string;
    readonly tokenSha256: string;
    readonly readyReceiptPath: string;
    readonly readyReceiptSha256: string;
  };
  readonly continuity: {
    readonly tenant: string;
    readonly agentId: string;
    readonly scope: string;
    readonly tenantReceiptSha256: string | null;
    readonly replayExportPath: string;
    readonly replayExportSha256: string;
  };
}

export interface SentinelProductionCellManifest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-cell-manifest.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly sequence: number;
  readonly blockSequence: number;
  readonly cellId: string;
  readonly phase: SentinelProductionCell["phase"];
  readonly taskId: string;
  readonly taskRole: SentinelProductionCell["taskRole"];
  readonly arm: SentinelProductionArm;
  readonly repeatId: string;
  readonly attemptId: string;
  readonly cellRoot: string;
  readonly checkoutPreflightSha256: string;
  readonly ports: { readonly state: number; readonly provider: number; readonly server: number; readonly frontend: number };
  readonly retryCount: 0;
  readonly rerunCount: 0;
  readonly replacementCount: 0;
  readonly attemptInvokedAt: string | null;
  readonly attemptStartedAt: string | null;
  readonly serviceBinding: SentinelProductionServiceBinding | null;
  readonly agentConfigPath: string;
  readonly agentConfigSha256: string | null;
  readonly supervisor: {
    readonly returned: boolean;
    readonly receiptHash: string | null;
    readonly completion: "behavioral-complete" | "infrastructure-incomplete" | null;
    readonly infrastructureStage: string | null;
    readonly infrastructureIssueSha256: string | null;
  };
  readonly stateFinalReceiptSha256: string | null;
  readonly providerFinalReceiptSha256: string | null;
  readonly runnerFailureCount: number;
  readonly infrastructureComplete: boolean;
  readonly artifactRootSha256: string;
  readonly artifacts: readonly SentinelProductionArtifactIdentity[];
}

export interface SentinelProductionCellManifestReference {
  readonly sequence: number;
  readonly cellId: string;
  readonly arm: SentinelProductionArm;
  readonly attemptId: string;
  readonly path: string;
  readonly sha256: string;
  readonly infrastructureComplete: boolean;
}

export interface SentinelProductionBlockManifest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-block-manifest.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly blockSequence: number;
  readonly taskId: string;
  readonly repeatId: string;
  readonly previousBlockManifestSha256: string;
  readonly expectedArms: readonly ["native", "sham", "plain-kv", "substrate"];
  readonly completeArmSet: boolean;
  readonly simultaneousLaunch: boolean;
  readonly maximumObservedStartSkewMs: number | null;
  readonly maximumAllowedStartSkewMs: number;
  readonly runtimeBefore: SentinelProductionRuntimeInspectionReference;
  readonly runtimeAfter: SentinelProductionRuntimeInspectionReference | null;
  readonly runtimeStable: boolean;
  readonly checkoutRootsStable: boolean;
  readonly infrastructureComplete: boolean;
  readonly modeToCell: Readonly<Record<SentinelProductionArm, SentinelProductionCellManifestReference>>;
  readonly completedAt: string;
}

export interface SentinelProductionExecutionManifest {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-execution-manifest.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly preregistrationSha256: string;
  readonly signatureSha256: string;
  readonly externalCommitmentSha256: string;
  readonly runStartedAt: string;
  readonly declaredBlockCount: number;
  readonly retainedBlockCount: number;
  readonly declaredCellCount: number;
  readonly retainedCellCount: number;
  readonly retryCount: 0;
  readonly rerunCount: 0;
  readonly replacementCount: 0;
  readonly noOutcomeInspectionDuringExecution: true;
  readonly batchComplete: boolean;
  readonly blockManifestHeadSha256: string;
  readonly runtimeInspectionHeadSha256: string;
  readonly blocks: readonly SentinelProductionManifestReference[];
  readonly finalizedAt: string;
}

export interface SentinelProductionManifestReference {
  readonly path: string;
  readonly sha256: string;
}

export interface SentinelProductionBatchResult {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-batch-result.v1";
  readonly evidenceEligible: false;
  readonly materialBenefit: false;
  readonly batchComplete: boolean;
  readonly batchRoot: string;
  readonly preregistrationSha256: string;
  readonly executionStartManifestPath: string;
  readonly executionStartManifestSha256: string;
  readonly executionFinalManifestPath: string;
  readonly executionFinalManifestSha256: string;
  readonly blockManifestHeadSha256: string;
  readonly blocks: readonly SentinelProductionManifestReference[];
  readonly cells: readonly SentinelProductionCellManifestReference[];
}

export interface SentinelProductionDiagnosticExecutionStart {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-execution-start.v1";
  readonly trustMode: "local-untrusted-diagnostic";
  readonly independent: false;
  readonly batchComplete: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly materialBenefit: false;
  readonly diagnosticExecutionId: string;
  readonly preregistrationSha256: string;
  readonly expectedPreregistrationSha256: string;
  readonly scheduleSha256: string;
  readonly expectedScheduleSha256: string;
  readonly runStartedAt: string;
  readonly phase: "qualification";
  readonly declaredBlockCount: number;
  readonly declaredCellCount: number;
  readonly selectedBlock: SentinelProductionDiagnosticSelection;
  readonly maximumArmStartSkewMs: number;
  readonly initialRuntimeInspection: SentinelProductionRuntimeInspectionReference;
  readonly checkoutPreflights: Readonly<Record<SentinelProductionArm, SentinelProductionCheckoutPreflight>>;
  readonly schedule: readonly SentinelProductionCell[];
  readonly noAutomaticRetries: true;
  readonly noCellReruns: true;
  readonly noTaskReplacements: true;
  readonly noOutcomeInspectionDuringExecution: true;
}

export interface SentinelProductionDiagnosticExecutionFinal {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-execution-final.v1";
  readonly trustMode: "local-untrusted-diagnostic";
  readonly independent: false;
  readonly batchComplete: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly materialBenefit: false;
  readonly diagnosticInfrastructureComplete: boolean;
  readonly diagnosticExecutionId: string;
  readonly preregistrationSha256: string;
  readonly scheduleSha256: string;
  readonly runStartedAt: string;
  readonly declaredBlockCount: number;
  readonly retainedBlockCount: 1;
  readonly declaredCellCount: number;
  readonly retainedCellCount: 4;
  readonly retryCount: 0;
  readonly rerunCount: 0;
  readonly replacementCount: 0;
  readonly noOutcomeInspectionDuringExecution: true;
  readonly blockManifestHeadSha256: string;
  readonly runtimeInspectionHeadSha256: string;
  readonly selectedBlock: SentinelProductionDiagnosticSelection;
  readonly blocks: readonly [SentinelProductionManifestReference];
  readonly finalizedAt: string;
}

export interface SentinelProductionDiagnosticResult {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-local-diagnostic-result.v1";
  readonly trustMode: "local-untrusted-diagnostic";
  readonly independent: false;
  readonly batchComplete: false;
  readonly evidenceEligible: false;
  readonly analysisEligible: false;
  readonly materialBenefit: false;
  readonly diagnosticInfrastructureComplete: boolean;
  readonly diagnosticExecutionId: string;
  readonly batchRoot: string;
  readonly preregistrationSha256: string;
  readonly scheduleSha256: string;
  readonly executionStartManifestPath: string;
  readonly executionStartManifestSha256: string;
  readonly executionFinalManifestPath: string;
  readonly executionFinalManifestSha256: string;
  readonly blockManifestHeadSha256: string;
  readonly selectedBlock: SentinelProductionDiagnosticSelection;
  readonly blocks: readonly [SentinelProductionManifestReference];
  readonly cells: readonly [
    SentinelProductionCellManifestReference, SentinelProductionCellManifestReference,
    SentinelProductionCellManifestReference, SentinelProductionCellManifestReference,
  ];
}

export interface SentinelProductionRunnerDependencies {
  readonly now: () => string;
  readonly verifyExternalCommitmentRecord: (
    commitment: SentinelProductionExternalCommitment,
  ) => Promise<SentinelProductionExternalCommitmentVerification>;
  readonly inspectRuntime: (
    bindings: SentinelProductionRuntimeBindings,
    declared: SentinelRuntimeClosure,
  ) => SentinelProductionRuntimeInspection;
  readonly inspectCheckout: (
    checkoutPath: string,
    selectedTasks: readonly SentinelProductionTask[],
    plannedRuntime: SentinelRuntimeClosure,
  ) => SentinelProductionCheckoutPreflight;
  readonly allocatePorts: (count: number, excluded: ReadonlySet<number>) => Promise<readonly number[]>;
  readonly deriveAttemptId: (preregistrationSha256: string, cellId: string) => string;
  readonly diagnosticExecutionId: () => string;
  readonly opaqueToken: () => string;
  readonly opaqueIdentity: (kind: "tenant" | "agent" | "scope") => string;
  readonly retainScenarioDefinition: (
    checkoutPath: string, task: SentinelProductionTask, targetPath: string,
  ) => SentinelProductionArtifactIdentity;
  readonly createContinuityTenant: (input: {
    readonly databaseUrl: string; readonly tenant: string; readonly createdAt: string;
  }) => Promise<SentinelProductionContinuityTenantReceipt>;
  readonly exportContinuityReplay: (input: {
    readonly databaseUrl: string; readonly tenant: string; readonly agentId: string;
    readonly scope: string; readonly exportedAt: string;
  }) => Promise<SentinelProductionContinuityReplayExport>;
  readonly startStateSidecar: (input: StartProductionStateSidecarInput) => Promise<RunningProductionStateSidecar>;
  readonly startProviderProxy: (
    input: StartSentinelGeneralAnthropicProviderProxyInput,
  ) => Promise<SentinelGeneralAnthropicProviderProxy>;
  readonly superviseAttempt: (
    input: SentinelProductionSupervisorInput,
  ) => Promise<SentinelProductionAttemptTerminalReceipt>;
}
