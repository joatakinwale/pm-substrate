import type {
  SentinelExternalTrustAnchor,
  SentinelProductionPreregistration,
  SentinelProductionSignature,
} from "./sentinel-production-plan.js";
import type { SentinelRuntimeClosurePaths } from "./sentinel-runtime-closure.js";

export interface SentinelProductionRuntimeBindings {
  readonly paths: SentinelRuntimeClosurePaths;
}

export interface SentinelProductionCheckoutSet {
  readonly native: string;
  readonly sham: string;
  readonly "plain-kv": string;
  readonly substrate: string;
}

export interface SentinelProductionExecutionInput {
  readonly preregistration: SentinelProductionPreregistration;
  readonly checkouts: SentinelProductionCheckoutSet;
  readonly batchRoot: string;
  readonly attemptRegistryRoot: string;
  readonly runtime: SentinelProductionRuntimeBindings;
  /** Passed only to continuity-backed state services and never serialized. */
  readonly databaseUrl: string;
  /** Passed only to the provider proxy and never serialized. */
  readonly anthropicApiKey: string;
}

export interface SentinelProductionExternalCommitment {
  readonly schemaVersion: "pm.public-eval-corners.sentinel-production-external-commitment.v1";
  readonly medium: "independent-append-only-external-record";
  readonly commitmentId: string;
  readonly committedAt: string;
  readonly custodianId: string;
  readonly custodianOwnerId: string;
  readonly independent: true;
  readonly locator: string;
  readonly expectedPreregistrationSha256: string;
  readonly expectedAuthorityId: string;
  readonly expectedAuthorityPublicKeySha256: string;
  readonly receiptSha256: string;
}

export interface SentinelProductionRunInput extends SentinelProductionExecutionInput {
  readonly signature: SentinelProductionSignature;
  readonly trustAnchor: SentinelExternalTrustAnchor;
  readonly externalCommitment: SentinelProductionExternalCommitment;
}

/**
 * Local-only input. The expected hashes disclose operator intent but are not an
 * external trust anchor and can never authorize analysis or efficacy claims.
 */
export interface SentinelProductionDiagnosticRunInput
  extends SentinelProductionExecutionInput {
  readonly expectedPreregistrationSha256: string;
  readonly expectedScheduleSha256: string;
}

export interface SentinelProductionDiagnosticSelection {
  readonly blockSequence: number;
  readonly taskId: string;
  readonly repeatId: string;
  readonly cellIds: readonly [string, string, string, string];
}
