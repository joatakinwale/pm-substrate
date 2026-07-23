import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as signBytes,
  verify as verifyBytes,
} from "node:crypto";
import { TextDecoder } from "node:util";

import {
  analyzePublicEval,
  type PublicEvalAnalysisInput,
  type PublicEvalAnalysisReport,
} from "./analyze.js";
import {
  PUBLIC_EVAL_REQUIRED_CHECKS,
  parsePublicEvalSemanticObservation,
  type ParsedPublicEvalSemanticObservation,
} from "./evidence-semantics.js";
import {
  PUBLIC_EVAL_VERIFICATION_KINDS,
  hashPublicEvalJson,
  parsePublicEvalAnalysisManifest,
  parsePublicEvalAttemptArtifact,
  type PublicEvalAnalysisManifest,
  type PublicEvalAttemptArtifact,
  type PublicEvalVerificationKind,
} from "./schema.js";

const SHA256 = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;

const EVIDENCE_SCHEMA_VERSIONS: Readonly<
  Record<PublicEvalVerificationKind, string>
> = {
  attempt_set: "pm.public-eval.verification-evidence.attempt-set.v2",
  oracle_independence:
    "pm.public-eval.verification-evidence.oracle-independence.v2",
  split_leakage: "pm.public-eval.verification-evidence.split-leakage.v2",
  anti_degenerate_controls:
    "pm.public-eval.verification-evidence.anti-degenerate-controls.v2",
  restart_dynamic_state:
    "pm.public-eval.verification-evidence.restart-dynamic-state.v2",
  clean_checkout: "pm.public-eval.verification-evidence.clean-checkout.v2",
};

export interface PublicEvalTrustedVerifier {
  readonly verifierId: string;
  readonly sourceRevision: string;
  readonly ownerIdentity: string;
  readonly publicKeySpkiPem: string;
}

export interface PublicEvalDecisionTrustPolicy {
  readonly schemaVersion: "pm.public-eval.decision-trust-policy.v2";
  readonly policyId: string;
  readonly preregistrationAuthority: PublicEvalTrustedVerifier;
  readonly executionTimestampAuthority: PublicEvalTrustedVerifier;
  readonly trustedVerifiers: Readonly<
    Record<PublicEvalVerificationKind, PublicEvalTrustedVerifier>
  >;
  readonly policyHash: string;
}

export type PublicEvalDecisionTrustPolicyInput = Omit<
  PublicEvalDecisionTrustPolicy,
  "schemaVersion" | "policyHash"
>;

export interface PublicEvalVerificationEvidenceArtifact {
  readonly artifactId: string;
  readonly kind: PublicEvalVerificationKind;
  readonly mediaType: string;
  readonly contentBase64: string;
  readonly contentByteLength: number;
  readonly contentSha256: string;
}

export interface PublicEvalVerificationEvidenceClaim {
  readonly name: string;
  readonly passed: boolean;
  /** Hash of the exact bundle facts this check is asserting over. */
  readonly subjectHash: string;
  /** Content hashes of independently inspected raw records or audit output. */
  readonly observationHashes: readonly string[];
}

export interface PublicEvalVerificationEvidenceObservation {
  readonly observationId: string;
  readonly mediaType: string;
  readonly contentBase64: string;
  readonly contentByteLength: number;
  readonly contentSha256: string;
}

export interface PublicEvalVerificationEvidenceContent {
  readonly schemaVersion: string;
  readonly kind: PublicEvalVerificationKind;
  readonly experimentId: string;
  readonly manifestHash: string;
  readonly attemptSetRootHash: string;
  readonly observations: readonly PublicEvalVerificationEvidenceObservation[];
  readonly checks: readonly PublicEvalVerificationEvidenceClaim[];
}

interface ParsedPublicEvalVerificationEvidenceArtifact
  extends PublicEvalVerificationEvidenceArtifact {
  readonly content: PublicEvalVerificationEvidenceContent & {
    readonly observations: readonly ParsedPublicEvalVerificationEvidenceObservation[];
  };
}

interface ParsedPublicEvalVerificationEvidenceObservation
  extends PublicEvalVerificationEvidenceObservation {
  readonly verification: ParsedPublicEvalSemanticObservation;
}

export interface PublicEvalVerificationCheck {
  readonly name: string;
  readonly passed: boolean;
  readonly evidenceArtifactIds: readonly string[];
}

export interface PublicEvalVerificationReceipt {
  readonly schemaVersion: "pm.public-eval.verification-receipt.v2";
  readonly receiptId: string;
  readonly kind: PublicEvalVerificationKind;
  readonly experimentId: string;
  readonly manifestHash: string;
  readonly attemptSetRootHash: string;
  readonly evidenceSetRootHash: string;
  readonly verifier: {
    readonly verifierId: string;
    readonly sourceRevision: string;
    readonly ownerIdentity: string;
    readonly executionEnvironmentHash: string;
  };
  readonly checks: readonly PublicEvalVerificationCheck[];
  readonly verifiedAt: string;
  readonly signature: {
    readonly algorithm: "ed25519";
    readonly valueBase64: string;
  };
  readonly receiptHash: string;
}

export type PublicEvalVerificationReceiptInput = Omit<
  PublicEvalVerificationReceipt,
  "schemaVersion" | "signature" | "receiptHash"
>;

export interface PublicEvalPreregistrationReceipt {
  readonly schemaVersion: "pm.public-eval.preregistration-receipt.v1";
  readonly receiptId: string;
  readonly policyHash: string;
  readonly experimentId: string;
  readonly manifestHash: string;
  readonly registeredAt: string;
  readonly authority: Omit<PublicEvalTrustedVerifier, "publicKeySpkiPem">;
  readonly signature: {
    readonly algorithm: "ed25519";
    readonly valueBase64: string;
  };
  readonly receiptHash: string;
}

export type PublicEvalPreregistrationReceiptInput = Omit<
  PublicEvalPreregistrationReceipt,
  "schemaVersion" | "signature" | "receiptHash"
>;

export interface PublicEvalPreregistrationPreflight {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly policyHash: string | null;
  readonly receiptHash: string | null;
  readonly registeredAt: string | null;
}

export interface PublicEvalExecutionTimestampReceipt {
  readonly schemaVersion: "pm.public-eval.execution-timestamp-receipt.v1";
  readonly receiptId: string;
  readonly policyHash: string;
  readonly preregistrationReceiptHash: string;
  readonly experimentId: string;
  readonly manifestHash: string;
  readonly attemptId: string;
  readonly rawArtifactRootHash: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly attestedAt: string;
  readonly authority: Omit<PublicEvalTrustedVerifier, "publicKeySpkiPem">;
  readonly signature: {
    readonly algorithm: "ed25519";
    readonly valueBase64: string;
  };
  readonly receiptHash: string;
}

export type PublicEvalExecutionTimestampReceiptInput = Omit<
  PublicEvalExecutionTimestampReceipt,
  "schemaVersion" | "signature" | "receiptHash"
>;

export interface PublicEvalDecisionBundleInput {
  readonly schemaVersion: "pm.public-eval.decision-bundle-input.v3";
  readonly analysis: PublicEvalAnalysisInput;
  readonly preregistrationReceipt: unknown;
  readonly executionTimestampReceipts: readonly unknown[];
  readonly evidenceArtifacts: readonly unknown[];
  readonly verificationReceipts: readonly unknown[];
}

export interface PublicEvalDecisionReport {
  readonly schemaVersion: "pm.public-eval.decision-report.v4";
  readonly experimentId: string;
  readonly manifestHash: string;
  readonly attemptSetRootHash: string;
  readonly evidenceSetRootHash: string;
  readonly trustPolicyHash: string;
  readonly analysis: PublicEvalAnalysisReport;
  readonly analysisReportHash: string;
  readonly verificationReceiptHashes: Readonly<
    Record<PublicEvalVerificationKind, string | null>
  >;
  readonly verificationSignerIdentities: Readonly<
    Record<PublicEvalVerificationKind, string | null>
  >;
  readonly evidenceEligibleUnderSuppliedPolicy: boolean;
  readonly ownerAuthorizationRequired: true;
  readonly evidenceAuthority: "signed_assertions_non_authoritative";
  readonly semanticEvidenceAuthority: "signed_structured_assertions_diagnostic_only";
  readonly semanticDerivationStatus: "adapter_specific_raw_derivation_not_implemented";
  readonly status:
    | "evidence_eligible_under_supplied_policy"
    | "not_eligible";
  readonly reasons: readonly string[];
  readonly decisionReportHash: string;
}

export function createPublicEvalDecisionTrustPolicy(
  input: PublicEvalDecisionTrustPolicyInput,
): PublicEvalDecisionTrustPolicy {
  const payload = snapshot({
    schemaVersion: "pm.public-eval.decision-trust-policy.v2" as const,
    ...input,
  }) as Omit<PublicEvalDecisionTrustPolicy, "policyHash">;
  return parsePublicEvalDecisionTrustPolicy({
    ...payload,
    policyHash: hashPublicEvalJson(payload),
  });
}

export function parsePublicEvalDecisionTrustPolicy(
  value: unknown,
): PublicEvalDecisionTrustPolicy {
  const root = record(value, "trustPolicy");
  exactKeys(
    root,
    [
      "schemaVersion",
      "policyId",
      "preregistrationAuthority",
      "executionTimestampAuthority",
      "trustedVerifiers",
      "policyHash",
    ],
    "trustPolicy",
  );
  if (root["schemaVersion"] !== "pm.public-eval.decision-trust-policy.v2") {
    throw new Error("trustPolicy.schemaVersion is invalid");
  }
  const rawVerifiers = record(
    root["trustedVerifiers"],
    "trustPolicy.trustedVerifiers",
  );
  exactKeys(
    rawVerifiers,
    PUBLIC_EVAL_VERIFICATION_KINDS,
    "trustPolicy.trustedVerifiers",
  );
  const trustedVerifiers = Object.fromEntries(
    PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => {
      const path = `trustPolicy.trustedVerifiers.${kind}`;
      const raw = record(rawVerifiers[kind], path);
      exactKeys(
        raw,
        [
          "verifierId",
          "sourceRevision",
          "ownerIdentity",
          "publicKeySpkiPem",
        ],
        path,
      );
      return [
        kind,
        {
          verifierId: portableId(raw["verifierId"], `${path}.verifierId`),
          sourceRevision: sha(
            raw["sourceRevision"],
            `${path}.sourceRevision`,
          ),
          ownerIdentity: portableId(
            raw["ownerIdentity"],
            `${path}.ownerIdentity`,
          ),
          publicKeySpkiPem: ed25519PublicKeyPem(
            raw["publicKeySpkiPem"],
            `${path}.publicKeySpkiPem`,
          ),
        },
      ];
    }),
  ) as Record<PublicEvalVerificationKind, PublicEvalTrustedVerifier>;
  const parsed: PublicEvalDecisionTrustPolicy = {
    schemaVersion: "pm.public-eval.decision-trust-policy.v2",
    policyId: portableId(root["policyId"], "trustPolicy.policyId"),
    preregistrationAuthority: parseTrustedVerifier(
      root["preregistrationAuthority"],
      "trustPolicy.preregistrationAuthority",
    ),
    executionTimestampAuthority: parseTrustedVerifier(
      root["executionTimestampAuthority"],
      "trustPolicy.executionTimestampAuthority",
    ),
    trustedVerifiers,
    policyHash: sha(root["policyHash"], "trustPolicy.policyHash"),
  };
  const expectedHash = hashPublicEvalJson(withoutKey(parsed, "policyHash"));
  if (parsed.policyHash !== expectedHash) {
    throw new Error("trustPolicy.policyHash mismatch");
  }
  return freeze(parsed);
}

export function createPublicEvalVerificationReceipt(
  input: PublicEvalVerificationReceiptInput,
  privateKeyPkcs8Pem: string,
): PublicEvalVerificationReceipt {
  const unsigned = snapshot({
    schemaVersion: "pm.public-eval.verification-receipt.v2" as const,
    ...input,
  }) as Omit<PublicEvalVerificationReceipt, "signature" | "receiptHash">;
  const privateKey = createPrivateKey(privateKeyPkcs8Pem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("verification receipt signing key must be Ed25519");
  }
  const signature = {
    algorithm: "ed25519" as const,
    valueBase64: signBytes(
      null,
      Buffer.from(hashPublicEvalJson(unsigned), "hex"),
      privateKey,
    ).toString("base64"),
  };
  const signed = { ...unsigned, signature };
  return parsePublicEvalVerificationReceipt({
    ...signed,
    receiptHash: hashPublicEvalJson(signed),
  });
}

export function parsePublicEvalVerificationReceipt(
  value: unknown,
): PublicEvalVerificationReceipt {
  const root = record(value, "verificationReceipt");
  exactKeys(
    root,
    [
      "schemaVersion",
      "receiptId",
      "kind",
      "experimentId",
      "manifestHash",
      "attemptSetRootHash",
      "evidenceSetRootHash",
      "verifier",
      "checks",
      "verifiedAt",
      "signature",
      "receiptHash",
    ],
    "verificationReceipt",
  );
  if (root["schemaVersion"] !== "pm.public-eval.verification-receipt.v2") {
    throw new Error("verificationReceipt.schemaVersion is invalid");
  }
  const kind = enumValue(
    root["kind"],
    PUBLIC_EVAL_VERIFICATION_KINDS,
    "verificationReceipt.kind",
  );
  const verifier = record(root["verifier"], "verificationReceipt.verifier");
  exactKeys(
    verifier,
    [
      "verifierId",
      "sourceRevision",
      "ownerIdentity",
      "executionEnvironmentHash",
    ],
    "verificationReceipt.verifier",
  );
  if (!Array.isArray(root["checks"])) {
    throw new Error("verificationReceipt.checks must be an array");
  }
  const checks = root["checks"].map((raw, index) => {
    const path = `verificationReceipt.checks/${index}`;
    const check = record(raw, path);
    exactKeys(check, ["name", "passed", "evidenceArtifactIds"], path);
    if (typeof check["passed"] !== "boolean") {
      throw new Error(`${path}.passed must be boolean`);
    }
    return {
      name: nonEmpty(check["name"], `${path}.name`),
      passed: check["passed"],
      evidenceArtifactIds: uniquePortableIds(
        check["evidenceArtifactIds"],
        `${path}.evidenceArtifactIds`,
      ),
    };
  });
  const names = checks.map((check) => check.name).sort(codeUnitCompare);
  const required = [...PUBLIC_EVAL_REQUIRED_CHECKS[kind]].sort(codeUnitCompare);
  if (JSON.stringify(names) !== JSON.stringify(required)) {
    throw new Error(
      `verificationReceipt ${kind} must contain exactly: ${required.join(", ")}`,
    );
  }
  const signature = record(
    root["signature"],
    "verificationReceipt.signature",
  );
  exactKeys(
    signature,
    ["algorithm", "valueBase64"],
    "verificationReceipt.signature",
  );
  if (signature["algorithm"] !== "ed25519") {
    throw new Error("verificationReceipt.signature.algorithm must be ed25519");
  }
  const parsed: PublicEvalVerificationReceipt = {
    schemaVersion: "pm.public-eval.verification-receipt.v2",
    receiptId: portableId(root["receiptId"], "verificationReceipt.receiptId"),
    kind,
    experimentId: portableId(
      root["experimentId"],
      "verificationReceipt.experimentId",
    ),
    manifestHash: sha(root["manifestHash"], "verificationReceipt.manifestHash"),
    attemptSetRootHash: sha(
      root["attemptSetRootHash"],
      "verificationReceipt.attemptSetRootHash",
    ),
    evidenceSetRootHash: sha(
      root["evidenceSetRootHash"],
      "verificationReceipt.evidenceSetRootHash",
    ),
    verifier: {
      verifierId: portableId(
        verifier["verifierId"],
        "verificationReceipt.verifier.verifierId",
      ),
      sourceRevision: sha(
        verifier["sourceRevision"],
        "verificationReceipt.verifier.sourceRevision",
      ),
      ownerIdentity: portableId(
        verifier["ownerIdentity"],
        "verificationReceipt.verifier.ownerIdentity",
      ),
      executionEnvironmentHash: sha(
        verifier["executionEnvironmentHash"],
        "verificationReceipt.verifier.executionEnvironmentHash",
      ),
    },
    checks,
    verifiedAt: timestamp(root["verifiedAt"], "verificationReceipt.verifiedAt"),
    signature: {
      algorithm: "ed25519",
      valueBase64: ed25519SignatureBase64(
        signature["valueBase64"],
        "verificationReceipt.signature.valueBase64",
      ),
    },
    receiptHash: sha(root["receiptHash"], "verificationReceipt.receiptHash"),
  };
  const expectedHash = hashPublicEvalJson(withoutKey(parsed, "receiptHash"));
  if (parsed.receiptHash !== expectedHash) {
    throw new Error(
      `verificationReceipt.receiptHash mismatch for ${parsed.receiptId}`,
    );
  }
  return freeze(parsed);
}

export function createPublicEvalPreregistrationReceipt(
  input: PublicEvalPreregistrationReceiptInput,
  privateKeyPkcs8Pem: string,
): PublicEvalPreregistrationReceipt {
  const unsigned = snapshot({
    schemaVersion: "pm.public-eval.preregistration-receipt.v1" as const,
    ...input,
  }) as Omit<PublicEvalPreregistrationReceipt, "signature" | "receiptHash">;
  return parsePublicEvalPreregistrationReceipt(
    signStructuredReceipt(unsigned, privateKeyPkcs8Pem),
  );
}

export function parsePublicEvalPreregistrationReceipt(
  value: unknown,
): PublicEvalPreregistrationReceipt {
  const root = record(value, "preregistrationReceipt");
  exactKeys(
    root,
    [
      "schemaVersion",
      "receiptId",
      "policyHash",
      "experimentId",
      "manifestHash",
      "registeredAt",
      "authority",
      "signature",
      "receiptHash",
    ],
    "preregistrationReceipt",
  );
  if (root["schemaVersion"] !== "pm.public-eval.preregistration-receipt.v1") {
    throw new Error("preregistrationReceipt.schemaVersion is invalid");
  }
  const parsed: PublicEvalPreregistrationReceipt = {
    schemaVersion: "pm.public-eval.preregistration-receipt.v1",
    receiptId: portableId(root["receiptId"], "preregistrationReceipt.receiptId"),
    policyHash: sha(root["policyHash"], "preregistrationReceipt.policyHash"),
    experimentId: portableId(
      root["experimentId"],
      "preregistrationReceipt.experimentId",
    ),
    manifestHash: sha(root["manifestHash"], "preregistrationReceipt.manifestHash"),
    registeredAt: timestamp(root["registeredAt"], "preregistrationReceipt.registeredAt"),
    authority: parseReceiptAuthority(root["authority"], "preregistrationReceipt.authority"),
    signature: parseSignature(root["signature"], "preregistrationReceipt.signature"),
    receiptHash: sha(root["receiptHash"], "preregistrationReceipt.receiptHash"),
  };
  validateStructuredReceiptHash(parsed, "preregistrationReceipt");
  return freeze(parsed);
}

/**
 * Pre-execution gate for a frozen manifest. This verifies the Ed25519 receipt
 * against an independently supplied policy whose exact hash must arrive from
 * an out-of-band owner/CI channel. Attempt-time ordering remains a later D7
 * check because no attempt exists yet.
 */
export function verifyPublicEvalPreregistrationForExecution(
  rawManifest: unknown,
  rawReceipt: unknown,
  rawTrustPolicy: unknown,
  expectedTrustPolicyHash: string,
): PublicEvalPreregistrationPreflight {
  try {
    const manifest = parsePublicEvalAnalysisManifest(rawManifest);
    const policy = parsePublicEvalDecisionTrustPolicy(rawTrustPolicy);
    if (
      policy.policyHash !==
      sha(expectedTrustPolicyHash, "expectedTrustPolicyHash")
    ) {
      throw new Error("trust policy does not match the out-of-band pinned hash");
    }
    if (
      policy.preregistrationAuthority.ownerIdentity ===
      manifest.producerIdentity
    ) {
      throw new Error("preregistration authority owner is the experiment producer");
    }
    const receipt = parsePublicEvalPreregistrationReceipt(rawReceipt);
    validatePreregistrationReceipt(
      receipt,
      policy,
      manifest.experimentId,
      manifest.manifestHash,
    );
    if (receipt.registeredAt !== manifest.frozenAt) {
      throw new Error("preregistration receipt time does not equal manifest frozenAt");
    }
    return {
      valid: true,
      issues: [],
      policyHash: policy.policyHash,
      receiptHash: receipt.receiptHash,
      registeredAt: receipt.registeredAt,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : String(error)],
      policyHash: null,
      receiptHash: null,
      registeredAt: null,
    };
  }
}

export function createPublicEvalExecutionTimestampReceipt(
  input: PublicEvalExecutionTimestampReceiptInput,
  privateKeyPkcs8Pem: string,
): PublicEvalExecutionTimestampReceipt {
  const unsigned = snapshot({
    schemaVersion: "pm.public-eval.execution-timestamp-receipt.v1" as const,
    ...input,
  }) as Omit<PublicEvalExecutionTimestampReceipt, "signature" | "receiptHash">;
  return parsePublicEvalExecutionTimestampReceipt(
    signStructuredReceipt(unsigned, privateKeyPkcs8Pem),
  );
}

export function parsePublicEvalExecutionTimestampReceipt(
  value: unknown,
): PublicEvalExecutionTimestampReceipt {
  const root = record(value, "executionTimestampReceipt");
  exactKeys(
    root,
    [
      "schemaVersion",
      "receiptId",
      "policyHash",
      "preregistrationReceiptHash",
      "experimentId",
      "manifestHash",
      "attemptId",
      "rawArtifactRootHash",
      "startedAt",
      "completedAt",
      "attestedAt",
      "authority",
      "signature",
      "receiptHash",
    ],
    "executionTimestampReceipt",
  );
  if (
    root["schemaVersion"] !==
    "pm.public-eval.execution-timestamp-receipt.v1"
  ) {
    throw new Error("executionTimestampReceipt.schemaVersion is invalid");
  }
  const parsed: PublicEvalExecutionTimestampReceipt = {
    schemaVersion: "pm.public-eval.execution-timestamp-receipt.v1",
    receiptId: portableId(root["receiptId"], "executionTimestampReceipt.receiptId"),
    policyHash: sha(root["policyHash"], "executionTimestampReceipt.policyHash"),
    preregistrationReceiptHash: sha(
      root["preregistrationReceiptHash"],
      "executionTimestampReceipt.preregistrationReceiptHash",
    ),
    experimentId: portableId(
      root["experimentId"],
      "executionTimestampReceipt.experimentId",
    ),
    manifestHash: sha(root["manifestHash"], "executionTimestampReceipt.manifestHash"),
    attemptId: portableId(root["attemptId"], "executionTimestampReceipt.attemptId"),
    rawArtifactRootHash: sha(
      root["rawArtifactRootHash"],
      "executionTimestampReceipt.rawArtifactRootHash",
    ),
    startedAt: timestamp(root["startedAt"], "executionTimestampReceipt.startedAt"),
    completedAt: timestamp(root["completedAt"], "executionTimestampReceipt.completedAt"),
    attestedAt: timestamp(root["attestedAt"], "executionTimestampReceipt.attestedAt"),
    authority: parseReceiptAuthority(
      root["authority"],
      "executionTimestampReceipt.authority",
    ),
    signature: parseSignature(root["signature"], "executionTimestampReceipt.signature"),
    receiptHash: sha(root["receiptHash"], "executionTimestampReceipt.receiptHash"),
  };
  if (
    Date.parse(parsed.completedAt) < Date.parse(parsed.startedAt) ||
    Date.parse(parsed.attestedAt) < Date.parse(parsed.completedAt)
  ) {
    throw new Error("executionTimestampReceipt timestamps are out of order");
  }
  validateStructuredReceiptHash(parsed, "executionTimestampReceipt");
  return freeze(parsed);
}

export function publicEvalAttemptSetRoot(
  analysis: PublicEvalAnalysisInput,
): string {
  const manifest = parsePublicEvalAnalysisManifest(analysis.manifest);
  const artifacts = analysis.attempts
    .map(parsePublicEvalAttemptArtifact)
    .sort((left, right) => codeUnitCompare(left.attemptId, right.attemptId))
    .map((attempt) => ({
      attemptId: attempt.attemptId,
      artifactHash: attempt.artifactHash,
      rawArtifactRootHash: attempt.rawArtifactRootHash,
      usageReceiptHash: attempt.usageReceiptHash,
      oracleReceiptHash: attempt.outcome.oracleReceiptHash,
    }));
  return hashPublicEvalJson({
    schemaVersion: "pm.public-eval.attempt-set-root.v1",
    experimentId: manifest.experimentId,
    manifestHash: manifest.manifestHash,
    artifacts,
  });
}

export function publicEvalEvidenceSetRoot(
  artifacts: readonly unknown[],
): string {
  const parsed = parseEvidenceArtifacts(artifacts);
  return hashPublicEvalJson({
    schemaVersion: "pm.public-eval.verification-evidence-set.v1",
    artifacts: parsed
      .map((artifact) => ({
        artifactId: artifact.artifactId,
        kind: artifact.kind,
        mediaType: artifact.mediaType,
        contentByteLength: artifact.contentByteLength,
        contentSha256: artifact.contentSha256,
      }))
      .sort((left, right) => codeUnitCompare(left.artifactId, right.artifactId)),
  });
}

/**
 * Recomputes the exact bundle subject an external verifier must inspect for a
 * required check. Evidence that names a check but binds another subject is
 * irrelevant and is rejected by the decision gate.
 */
export function publicEvalVerificationSubjectHash(
  analysis: PublicEvalAnalysisInput,
  kind: PublicEvalVerificationKind,
  checkName: string,
): string {
  requireKnownCheck(kind, checkName);
  const manifest = parsePublicEvalAnalysisManifest(analysis.manifest);
  const attempts = analysis.attempts.map(parsePublicEvalAttemptArtifact);
  const report =
    kind === "clean_checkout" && checkName === "analysis_recomputed"
      ? analyzePublicEval(analysis)
      : null;
  return verificationSubjectHash(
    manifest,
    attempts,
    report,
    kind,
    checkName,
  );
}

export function evaluatePublicEvalDecisionBundle(
  input: PublicEvalDecisionBundleInput,
  rawTrustPolicy: unknown,
  expectedTrustPolicyHash: string,
): PublicEvalDecisionReport {
  const root = record(input, "decisionBundle");
  exactKeys(
    root,
    [
      "schemaVersion",
      "analysis",
      "preregistrationReceipt",
      "executionTimestampReceipts",
      "evidenceArtifacts",
      "verificationReceipts",
    ],
    "decisionBundle",
  );
  if (root["schemaVersion"] !== "pm.public-eval.decision-bundle-input.v3") {
    throw new Error("decisionBundle.schemaVersion is invalid");
  }
  if (!Array.isArray(root["evidenceArtifacts"])) {
    throw new Error("decisionBundle.evidenceArtifacts must be an array");
  }
  if (!Array.isArray(root["executionTimestampReceipts"])) {
    throw new Error(
      "decisionBundle.executionTimestampReceipts must be an array",
    );
  }
  if (!Array.isArray(root["verificationReceipts"])) {
    throw new Error("decisionBundle.verificationReceipts must be an array");
  }
  const trustPolicy = parsePublicEvalDecisionTrustPolicy(rawTrustPolicy);
  if (
    trustPolicy.policyHash !==
    sha(expectedTrustPolicyHash, "expectedTrustPolicyHash")
  ) {
    throw new Error("trust policy does not match the out-of-band pinned hash");
  }

  const analysis = analyzePublicEval(input.analysis);
  const manifest = parsePublicEvalAnalysisManifest(input.analysis.manifest);
  const attempts = input.analysis.attempts.map(parsePublicEvalAttemptArtifact);
  const attemptSetRootHash = publicEvalAttemptSetRoot(input.analysis);
  const evidenceArtifacts = parseEvidenceArtifacts(root["evidenceArtifacts"]);
  const evidenceSetRootHash = publicEvalEvidenceSetRoot(
    root["evidenceArtifacts"],
  );
  const evidenceById = new Map(
    evidenceArtifacts.map((artifact) => [artifact.artifactId, artifact]),
  );
  for (const artifact of evidenceArtifacts) {
    if (
      artifact.content.experimentId !== manifest.experimentId ||
      artifact.content.manifestHash !== manifest.manifestHash ||
      artifact.content.attemptSetRootHash !== attemptSetRootHash
    ) {
      throw new Error(
        `decisionBundle evidence ${artifact.artifactId} binding mismatch`,
      );
    }
    for (const claim of artifact.content.checks) {
      const expectedSubjectHash = verificationSubjectHash(
        manifest,
        attempts,
        analysis,
        artifact.kind,
        claim.name,
      );
      if (claim.subjectHash !== expectedSubjectHash) {
        throw new Error(
          `decisionBundle evidence ${artifact.artifactId}/${claim.name} ` +
            "subject mismatch",
        );
      }
    }
  }
  const latestAttemptEpoch = Math.max(
    ...attempts.map((attempt) => Date.parse(attempt.completedAt)),
  );
  const preregistrationReceipt = parsePublicEvalPreregistrationReceipt(
    root["preregistrationReceipt"],
  );
  validatePreregistrationReceipt(
    preregistrationReceipt,
    trustPolicy,
    manifest.experimentId,
    manifest.manifestHash,
  );
  if (
    preregistrationReceipt.registeredAt !== manifest.frozenAt ||
    attempts.some(
      (attempt) =>
        Date.parse(attempt.startedAt) <=
        Date.parse(preregistrationReceipt.registeredAt),
    )
  ) {
    throw new Error(
      "decisionBundle manifest was not preregistered before every attempt",
    );
  }
  validateExecutionTimestampReceipts(
    root["executionTimestampReceipts"],
    attempts,
    preregistrationReceipt,
    trustPolicy,
  );
  const receipts = root["verificationReceipts"].map(
    parsePublicEvalVerificationReceipt,
  );
  const receiptByKind = new Map<
    PublicEvalVerificationKind,
    PublicEvalVerificationReceipt
  >();
  const receiptIds = new Set<string>();
  const referencedEvidenceIds = new Set<string>();
  const referencedEvidenceClaims = new Set<string>();

  for (const receipt of receipts) {
    if (receiptByKind.has(receipt.kind)) {
      throw new Error(`decisionBundle duplicates ${receipt.kind} receipt`);
    }
    if (receiptIds.has(receipt.receiptId)) {
      throw new Error(`decisionBundle duplicates receiptId ${receipt.receiptId}`);
    }
    receiptIds.add(receipt.receiptId);
    receiptByKind.set(receipt.kind, receipt);
    if (
      receipt.experimentId !== manifest.experimentId ||
      receipt.manifestHash !== manifest.manifestHash ||
      receipt.attemptSetRootHash !== attemptSetRootHash ||
      receipt.evidenceSetRootHash !== evidenceSetRootHash
    ) {
      throw new Error(`decisionBundle ${receipt.kind} receipt binding mismatch`);
    }

    const declaredVerifier = manifest.decisionVerification[receipt.kind];
    const trustedVerifier = trustPolicy.trustedVerifiers[receipt.kind];
    if (
      declaredVerifier.verifierId !== trustedVerifier.verifierId ||
      declaredVerifier.sourceRevision !== trustedVerifier.sourceRevision ||
      receipt.verifier.verifierId !== trustedVerifier.verifierId ||
      receipt.verifier.sourceRevision !== trustedVerifier.sourceRevision ||
      receipt.verifier.ownerIdentity !== trustedVerifier.ownerIdentity
    ) {
      throw new Error(
        `decisionBundle ${receipt.kind} verifier does not match the pinned trust policy`,
      );
    }
    if (!verifyReceiptSignature(receipt, trustedVerifier.publicKeySpkiPem)) {
      throw new Error(`decisionBundle ${receipt.kind} signature is invalid`);
    }
    if (Date.parse(receipt.verifiedAt) < latestAttemptEpoch) {
      throw new Error(
        `decisionBundle ${receipt.kind} receipt predates the final attempt`,
      );
    }
    for (const check of receipt.checks) {
      for (const artifactId of check.evidenceArtifactIds) {
        const artifact = evidenceById.get(artifactId);
        if (artifact === undefined) {
          throw new Error(
            `${receipt.kind}/${check.name} references missing evidence ${artifactId}`,
          );
        }
        if (artifact.kind !== receipt.kind) {
          throw new Error(
            `${receipt.kind}/${check.name} references evidence owned by ${artifact.kind}`,
          );
        }
        const claim = artifact.content.checks.find(
          (entry) => entry.name === check.name,
        );
        if (claim === undefined) {
          throw new Error(
            `${receipt.kind}/${check.name} references irrelevant evidence ${artifactId}`,
          );
        }
        if (claim.passed !== check.passed) {
          throw new Error(
            `${receipt.kind}/${check.name} evidence result mismatch`,
          );
        }
        referencedEvidenceIds.add(artifactId);
        referencedEvidenceClaims.add(`${artifactId}\u0000${check.name}`);
      }
    }
  }
  const unreferencedEvidence = evidenceArtifacts
    .map((artifact) => artifact.artifactId)
    .filter((artifactId) => !referencedEvidenceIds.has(artifactId));
  if (unreferencedEvidence.length > 0) {
    throw new Error(
      `decisionBundle contains unreferenced evidence: ${unreferencedEvidence.join(", ")}`,
    );
  }
  const unreferencedClaims = evidenceArtifacts.flatMap((artifact) =>
    artifact.content.checks
      .filter(
        (claim) =>
          !referencedEvidenceClaims.has(
            `${artifact.artifactId}\u0000${claim.name}`,
          ),
      )
      .map((claim) => `${artifact.artifactId}/${claim.name}`),
  );
  if (unreferencedClaims.length > 0) {
    throw new Error(
      `decisionBundle contains unreferenced evidence claims: ${unreferencedClaims.join(", ")}`,
    );
  }

  const reasons: string[] = [
    "semantic evidence is not adapter-derived from the bound manifest, attempts, analysis, and content-addressed raw records",
  ];
  if (
    trustPolicy.preregistrationAuthority.ownerIdentity ===
    manifest.producerIdentity
  ) {
    reasons.push("preregistration authority owner is the experiment producer");
  }
  if (
    trustPolicy.executionTimestampAuthority.ownerIdentity ===
    manifest.producerIdentity
  ) {
    reasons.push("execution timestamp authority owner is the experiment producer");
  }
  for (const kind of PUBLIC_EVAL_VERIFICATION_KINDS) {
    const receipt = receiptByKind.get(kind);
    if (receipt === undefined) {
      reasons.push(`missing ${kind} verification receipt`);
      continue;
    }
    const trustedVerifier = trustPolicy.trustedVerifiers[kind];
    if (trustedVerifier.ownerIdentity === manifest.producerIdentity) {
      reasons.push(`${kind} verifier owner is the experiment producer`);
    }
    for (const check of receipt.checks) {
      if (!check.passed) reasons.push(`${kind}/${check.name} failed`);
    }
  }
  const qualificationTasks = manifest.taskPlan.filter(
    (task) => task.phase === "qualification" && task.status === "included",
  );
  if (qualificationTasks.length === 0) {
    reasons.push("decision manifest has no predeclared qualification task");
  }
  if (!analysis.confirmatoryPassed) reasons.push("confirmatory analysis failed");
  if (!analysis.replicationPassed) reasons.push("replication analysis failed");
  if (!analysis.pairedAnalysisCriteriaPassed) {
    reasons.push("paired analysis criteria did not pass in both decision phases");
  }

  const analysisReportHash = hashPublicEvalJson(analysis);
  const verificationReceiptHashes = Object.fromEntries(
    PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => [
      kind,
      receiptByKind.get(kind)?.receiptHash ?? null,
    ]),
  ) as Record<PublicEvalVerificationKind, string | null>;
  const verificationSignerIdentities = Object.fromEntries(
    PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => {
      const receipt = receiptByKind.get(kind);
      return [
        kind,
        receipt === undefined
          ? null
          : `${receipt.verifier.ownerIdentity}/${receipt.verifier.verifierId}`,
      ];
    }),
  ) as Record<PublicEvalVerificationKind, string | null>;
  const payload = {
    schemaVersion: "pm.public-eval.decision-report.v4" as const,
    experimentId: manifest.experimentId,
    manifestHash: manifest.manifestHash,
    attemptSetRootHash,
    evidenceSetRootHash,
    trustPolicyHash: trustPolicy.policyHash,
    analysis,
    analysisReportHash,
    verificationReceiptHashes,
    verificationSignerIdentities,
    // Structured assertions remain useful diagnostics, but their signer-authored
    // facts are not an authority bridge to raw benchmark execution. An
    // adapter-specific derivation procedure must replace this fail-closed
    // status before conditional eligibility can become reachable.
    evidenceEligibleUnderSuppliedPolicy: false,
    ownerAuthorizationRequired: true as const,
    evidenceAuthority: "signed_assertions_non_authoritative" as const,
    semanticEvidenceAuthority:
      "signed_structured_assertions_diagnostic_only" as const,
    semanticDerivationStatus:
      "adapter_specific_raw_derivation_not_implemented" as const,
    status: "not_eligible" as const,
    reasons,
  };
  return freeze({
    ...payload,
    decisionReportHash: hashPublicEvalJson(payload),
  });
}

function validatePreregistrationReceipt(
  receipt: PublicEvalPreregistrationReceipt,
  policy: PublicEvalDecisionTrustPolicy,
  experimentId: string,
  manifestHash: string,
): void {
  const authority = policy.preregistrationAuthority;
  if (
    receipt.policyHash !== policy.policyHash ||
    receipt.experimentId !== experimentId ||
    receipt.manifestHash !== manifestHash ||
    !receiptAuthorityMatches(receipt.authority, authority) ||
    !verifyStructuredReceiptSignature(receipt, authority.publicKeySpkiPem)
  ) {
    throw new Error("decisionBundle preregistration receipt binding is invalid");
  }
}

function validateExecutionTimestampReceipts(
  rawReceipts: readonly unknown[],
  attempts: readonly ReturnType<typeof parsePublicEvalAttemptArtifact>[],
  preregistration: PublicEvalPreregistrationReceipt,
  policy: PublicEvalDecisionTrustPolicy,
): void {
  const receipts = rawReceipts.map(parsePublicEvalExecutionTimestampReceipt);
  const byAttempt = new Map<string, PublicEvalExecutionTimestampReceipt>();
  const receiptIds = new Set<string>();
  for (const receipt of receipts) {
    if (receiptIds.has(receipt.receiptId) || byAttempt.has(receipt.attemptId)) {
      throw new Error("decisionBundle duplicates an execution timestamp receipt");
    }
    receiptIds.add(receipt.receiptId);
    byAttempt.set(receipt.attemptId, receipt);
  }
  if (receipts.length !== attempts.length) {
    throw new Error("decisionBundle requires one execution timestamp receipt per attempt");
  }
  const authority = policy.executionTimestampAuthority;
  for (const attempt of attempts) {
    const receipt = byAttempt.get(attempt.attemptId);
    if (
      receipt === undefined ||
      receipt.policyHash !== policy.policyHash ||
      receipt.preregistrationReceiptHash !== preregistration.receiptHash ||
      receipt.experimentId !== attempt.experimentId ||
      receipt.manifestHash !== attempt.manifestHash ||
      receipt.rawArtifactRootHash !== attempt.rawArtifactRootHash ||
      receipt.startedAt !== attempt.startedAt ||
      receipt.completedAt !== attempt.completedAt ||
      Date.parse(receipt.startedAt) <= Date.parse(preregistration.registeredAt) ||
      !receiptAuthorityMatches(receipt.authority, authority) ||
      !verifyStructuredReceiptSignature(receipt, authority.publicKeySpkiPem)
    ) {
      throw new Error(
        `decisionBundle execution timestamp binding is invalid for ${attempt.attemptId}`,
      );
    }
  }
}

function signStructuredReceipt<T extends object>(
  unsigned: T,
  privateKeyPkcs8Pem: string,
): T & {
  readonly signature: { readonly algorithm: "ed25519"; readonly valueBase64: string };
  readonly receiptHash: string;
} {
  const privateKey = createPrivateKey(privateKeyPkcs8Pem);
  if (privateKey.asymmetricKeyType !== "ed25519") {
    throw new Error("receipt signing key must be Ed25519");
  }
  const signature = {
    algorithm: "ed25519" as const,
    valueBase64: signBytes(
      null,
      Buffer.from(hashPublicEvalJson(unsigned), "hex"),
      privateKey,
    ).toString("base64"),
  };
  const signed = { ...unsigned, signature };
  return { ...signed, receiptHash: hashPublicEvalJson(signed) };
}

function parseReceiptAuthority(
  value: unknown,
  path: string,
): Omit<PublicEvalTrustedVerifier, "publicKeySpkiPem"> {
  const authority = record(value, path);
  exactKeys(
    authority,
    ["verifierId", "sourceRevision", "ownerIdentity"],
    path,
  );
  return {
    verifierId: portableId(authority["verifierId"], `${path}.verifierId`),
    sourceRevision: sha(authority["sourceRevision"], `${path}.sourceRevision`),
    ownerIdentity: portableId(authority["ownerIdentity"], `${path}.ownerIdentity`),
  };
}

function parseSignature(
  value: unknown,
  path: string,
): { readonly algorithm: "ed25519"; readonly valueBase64: string } {
  const signature = record(value, path);
  exactKeys(signature, ["algorithm", "valueBase64"], path);
  if (signature["algorithm"] !== "ed25519") {
    throw new Error(`${path}.algorithm must be ed25519`);
  }
  return {
    algorithm: "ed25519",
    valueBase64: ed25519SignatureBase64(
      signature["valueBase64"],
      `${path}.valueBase64`,
    ),
  };
}

function validateStructuredReceiptHash(
  receipt: { readonly receiptHash: string },
  path: string,
): void {
  if (receipt.receiptHash !== hashPublicEvalJson(withoutKey(receipt, "receiptHash"))) {
    throw new Error(`${path}.receiptHash mismatch`);
  }
}

function receiptAuthorityMatches(
  actual: Omit<PublicEvalTrustedVerifier, "publicKeySpkiPem">,
  expected: PublicEvalTrustedVerifier,
): boolean {
  return (
    actual.verifierId === expected.verifierId &&
    actual.sourceRevision === expected.sourceRevision &&
    actual.ownerIdentity === expected.ownerIdentity
  );
}

function verifyStructuredReceiptSignature(
  receipt: {
    readonly signature: { readonly valueBase64: string };
    readonly receiptHash: string;
  },
  publicKeySpkiPem: string,
): boolean {
  const { signature, receiptHash: _receiptHash, ...unsigned } = receipt;
  return verifyBytes(
    null,
    Buffer.from(hashPublicEvalJson(unsigned), "hex"),
    createPublicKey(publicKeySpkiPem),
    Buffer.from(signature.valueBase64, "base64"),
  );
}

function requireKnownCheck(
  kind: PublicEvalVerificationKind,
  checkName: string,
): void {
  if (!PUBLIC_EVAL_REQUIRED_CHECKS[kind].includes(checkName)) {
    throw new Error(`${kind} has no required check ${checkName}`);
  }
}

function verificationSubjectHash(
  manifest: PublicEvalAnalysisManifest,
  attempts: readonly PublicEvalAttemptArtifact[],
  analysisReport: PublicEvalAnalysisReport | null,
  kind: PublicEvalVerificationKind,
  checkName: string,
): string {
  requireKnownCheck(kind, checkName);
  const orderedAttempts = [...attempts].sort((left, right) =>
    codeUnitCompare(left.attemptId, right.attemptId),
  );
  const orderedTasks = [...manifest.taskPlan].sort((left, right) =>
    codeUnitCompare(left.taskId, right.taskId),
  );
  const attemptView = (
    select: (attempt: PublicEvalAttemptArtifact) => unknown,
  ): readonly unknown[] => orderedAttempts.map(select);
  const taskView = (phases?: readonly string[]): readonly unknown[] =>
    orderedTasks
      .filter((task) => phases === undefined || phases.includes(task.phase))
      .map((task) => ({
        taskId: task.taskId,
        phase: task.phase,
        status: task.status,
        canonicalTaskId: task.canonicalTaskId,
        benchmarkTaskContentHash: task.benchmarkTaskContentHash,
        taskContentHash: task.taskContentHash,
        variant: task.variant,
        mutationHash: task.mutationHash,
        predeclaredSeeds: task.predeclaredSeeds,
        initialEnvironmentSnapshotHash: task.initialEnvironmentSnapshotHash,
      }));
  let subject: unknown;
  if (kind === "attempt_set") {
    const subjects: Record<string, unknown> = {
      raw_artifacts_resolved: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        rawArtifactRootHash: attempt.rawArtifactRootHash,
      })),
      attempt_hashes_recomputed: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        artifactHash: attempt.artifactHash,
      })),
      usage_recomputed: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        usageReceiptHash: attempt.usageReceiptHash,
        costUsd: attempt.outcome.costUsd,
        latencyMs: attempt.outcome.latencyMs,
      })),
      execution_bindings_recomputed: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        executionBindingHash: attempt.executionBindingHash,
        armBindingHash: attempt.armBindingHash,
        armInterventionHash: attempt.armInterventionHash,
        armOrderPosition: attempt.armOrderPosition,
      })),
      sham_overhead_equivalence_recomputed: {
        sham: manifest.execution.arms.sham,
        substrate: manifest.execution.arms.substrate,
      },
      unique_attempts_recomputed: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        attemptGroupId: attempt.attemptGroupId,
        taskId: attempt.taskId,
        repeatIndex: attempt.repeatIndex,
        seed: attempt.seed,
        arm: attempt.arm,
      })),
    };
    subject = subjects[checkName];
  } else if (kind === "oracle_independence") {
    subject =
      checkName === "upstream_oracle_recomputed"
        ? attemptView((attempt) => ({
            attemptId: attempt.attemptId,
            oracleReceiptHash: attempt.outcome.oracleReceiptHash,
            strictTaskSuccess: attempt.outcome.strictTaskSuccess,
          }))
        : {
            judgeHashes: manifest.execution.nonModelComponents,
            verifierPlan: manifest.decisionVerification.oracle_independence,
          };
  } else if (kind === "split_leakage") {
    const subjects: Record<string, unknown> = {
      eligible_universe_bound: {
        benchmarkId: manifest.benchmark.benchmarkId,
        splitId: manifest.benchmark.splitId,
        corpusHash: manifest.benchmark.corpusHash,
        eligibleUniverse: manifest.benchmark.eligibleUniverse,
      },
      qualification_disjoint: taskView(),
      heldout_selection_recomputed: {
        eligibleUniverse: manifest.benchmark.eligibleUniverse,
        decisionTasks: taskView(["confirmatory", "replication"]),
      },
      canonical_task_uniqueness_recomputed: taskView(),
      replication_schedule_matched: taskView([
        "confirmatory",
        "replication",
      ]),
    };
    subject = subjects[checkName];
  } else if (kind === "anti_degenerate_controls") {
    subject = {
      qualificationAndDerivativeTasks: orderedTasks
        .filter(
          (task) => task.phase === "qualification" || task.variant === "derivative",
        )
        .map((task) => task.taskId),
      attemptRootsAndOutcomes: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        rawArtifactRootHash: attempt.rawArtifactRootHash,
        outcome: attempt.outcome,
      })),
      verifierPlan: manifest.decisionVerification.anti_degenerate_controls,
    };
  } else if (kind === "restart_dynamic_state") {
    subject = {
      taskInterventions: taskView(),
      attemptRoots: attemptView((attempt) => ({
        attemptId: attempt.attemptId,
        rawArtifactRootHash: attempt.rawArtifactRootHash,
      })),
      verifierPlan: manifest.decisionVerification.restart_dynamic_state,
    };
  } else {
    const subjects: Record<string, unknown> = {
      fresh_checkout: {
        repositoryUrl: manifest.benchmark.repositoryUrl,
        benchmarkRevision: manifest.benchmark.revision,
        harnessRevision: manifest.execution.harnessRevision,
        substrateRevision: manifest.execution.substrateRevision,
      },
      pinned_revisions_recomputed: {
        benchmarkRevision: manifest.benchmark.revision,
        harnessRevision: manifest.execution.harnessRevision,
        substrateRevision: manifest.execution.substrateRevision,
      },
      analysis_recomputed:
        analysisReport === null ? null : hashPublicEvalJson(analysisReport),
      model_identities_resolved: {
        modelIds: manifest.execution.modelIds,
        modelDigests: manifest.execution.modelDigests,
      },
      non_model_configs_recomputed: {
        hashes: manifest.execution.nonModelConfigHashes,
        components: manifest.execution.nonModelComponents,
      },
    };
    subject = subjects[checkName];
  }
  if (subject === undefined || subject === null) {
    throw new Error(`cannot compute verification subject for ${kind}/${checkName}`);
  }
  return hashPublicEvalJson({
    schemaVersion: "pm.public-eval.verification-subject.v1",
    kind,
    checkName,
    manifestHash: manifest.manifestHash,
    subject,
  });
}

function parseEvidenceArtifacts(
  value: unknown,
): readonly ParsedPublicEvalVerificationEvidenceArtifact[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("evidenceArtifacts must be a non-empty array");
  }
  const seen = new Set<string>();
  return value.map((raw, index) => {
    const path = `evidenceArtifacts/${index}`;
    const artifact = record(raw, path);
    exactKeys(
      artifact,
      [
        "artifactId",
        "kind",
        "mediaType",
        "contentBase64",
        "contentByteLength",
        "contentSha256",
      ],
      path,
    );
    const artifactId = portableId(artifact["artifactId"], `${path}.artifactId`);
    if (seen.has(artifactId)) {
      throw new Error(`evidenceArtifacts duplicates artifactId ${artifactId}`);
    }
    seen.add(artifactId);
    const contentBase64 = canonicalBase64(
      artifact["contentBase64"],
      `${path}.contentBase64`,
    );
    const bytes = Buffer.from(contentBase64, "base64");
    const contentByteLength = integer(
      artifact["contentByteLength"],
      `${path}.contentByteLength`,
      1,
    );
    if (bytes.byteLength !== contentByteLength) {
      throw new Error(`${path}.contentByteLength mismatch`);
    }
    const contentSha256 = sha(
      artifact["contentSha256"],
      `${path}.contentSha256`,
    );
    const actualHash = hashBytes(bytes);
    if (actualHash !== contentSha256) {
      throw new Error(`${path}.contentSha256 mismatch`);
    }
    const kind = enumValue(
      artifact["kind"],
      PUBLIC_EVAL_VERIFICATION_KINDS,
      `${path}.kind`,
    );
    if (artifact["mediaType"] !== "application/json") {
      throw new Error(`${path}.mediaType must be application/json`);
    }
    let text: string;
    let decoded: unknown;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      decoded = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`${path} content must be valid UTF-8 JSON`);
    }
    if (canonicalJsonString(decoded) !== text) {
      throw new Error(`${path} content must use canonical JSON encoding`);
    }
    const content = record(decoded, `${path}.content`);
    exactKeys(
      content,
      [
        "schemaVersion",
        "kind",
        "experimentId",
        "manifestHash",
        "attemptSetRootHash",
        "observations",
        "checks",
      ],
      `${path}.content`,
    );
    if (content["schemaVersion"] !== EVIDENCE_SCHEMA_VERSIONS[kind]) {
      throw new Error(`${path} content schema is invalid for ${kind}`);
    }
    if (content["kind"] !== kind) {
      throw new Error(`${path} content kind does not match artifact kind`);
    }
    if (
      !Array.isArray(content["observations"]) ||
      content["observations"].length === 0
    ) {
      throw new Error(`${path}.content.observations must be a non-empty array`);
    }
    const observationIds = new Set<string>();
    const observationHashes = new Set<string>();
    const observations = content["observations"].map(
      (rawObservation, observationIndex) => {
        const observationPath =
          `${path}.content.observations/${observationIndex}`;
        const observation = record(rawObservation, observationPath);
        exactKeys(
          observation,
          [
            "observationId",
            "mediaType",
            "contentBase64",
            "contentByteLength",
            "contentSha256",
          ],
          observationPath,
        );
        const observationId = portableId(
          observation["observationId"],
          `${observationPath}.observationId`,
        );
        if (observationIds.has(observationId)) {
          throw new Error(`${path}.content observations duplicate ${observationId}`);
        }
        observationIds.add(observationId);
        const observationBase64 = canonicalBase64(
          observation["contentBase64"],
          `${observationPath}.contentBase64`,
        );
        const observationBytes = Buffer.from(observationBase64, "base64");
        const observationByteLength = integer(
          observation["contentByteLength"],
          `${observationPath}.contentByteLength`,
          1,
        );
        if (observationBytes.byteLength !== observationByteLength) {
          throw new Error(`${observationPath}.contentByteLength mismatch`);
        }
        const observationSha256 = sha(
          observation["contentSha256"],
          `${observationPath}.contentSha256`,
        );
        if (hashBytes(observationBytes) !== observationSha256) {
          throw new Error(`${observationPath}.contentSha256 mismatch`);
        }
        if (observationHashes.has(observationSha256)) {
          throw new Error(`${path}.content observations duplicate content`);
        }
        observationHashes.add(observationSha256);
        const mediaType = nonEmpty(
          observation["mediaType"],
          `${observationPath}.mediaType`,
        );
        const verification = parsePublicEvalSemanticObservation(
          observationBytes,
          mediaType,
          kind,
          observationPath,
        );
        return {
          observationId,
          mediaType,
          contentBase64: observationBase64,
          contentByteLength: observationByteLength,
          contentSha256: observationSha256,
          verification,
        };
      },
    );
    const observationByHash = new Map(
      observations.map((observation) => [
        observation.contentSha256,
        observation,
      ]),
    );
    if (!Array.isArray(content["checks"]) || content["checks"].length === 0) {
      throw new Error(`${path}.content.checks must be a non-empty array`);
    }
    const checkNames = new Set<string>();
    const checks = content["checks"].map((rawCheck, checkIndex) => {
      const checkPath = `${path}.content.checks/${checkIndex}`;
      const check = record(rawCheck, checkPath);
      exactKeys(
        check,
        ["name", "passed", "subjectHash", "observationHashes"],
        checkPath,
      );
      const name = nonEmpty(check["name"], `${checkPath}.name`);
      requireKnownCheck(kind, name);
      if (checkNames.has(name)) {
        throw new Error(`${path}.content checks duplicate ${name}`);
      }
      checkNames.add(name);
      if (typeof check["passed"] !== "boolean") {
        throw new Error(`${checkPath}.passed must be boolean`);
      }
      const resolvedObservationHashes = uniqueShas(
        check["observationHashes"],
        `${checkPath}.observationHashes`,
      );
      if (resolvedObservationHashes.length !== 1) {
        throw new Error(
          `${checkPath}.observationHashes must contain exactly one semantic observation`,
        );
      }
      for (const observationHash of resolvedObservationHashes) {
        if (!observationHashes.has(observationHash)) {
          throw new Error(
            `${checkPath} references missing observation ${observationHash}`,
          );
        }
      }
      const subjectHash = sha(check["subjectHash"], `${checkPath}.subjectHash`);
      const semanticObservation = observationByHash.get(
        resolvedObservationHashes[0]!,
      );
      if (semanticObservation === undefined) {
        throw new Error(`${checkPath} has no semantic observation`);
      }
      if (semanticObservation.verification.checkName !== name) {
        throw new Error(
          `${checkPath} semantic observation is for ${semanticObservation.verification.checkName}`,
        );
      }
      if (semanticObservation.verification.subjectHash !== subjectHash) {
        throw new Error(`${checkPath} semantic observation subject mismatch`);
      }
      if (semanticObservation.verification.passed !== check["passed"]) {
        throw new Error(
          `${checkPath} claimed result does not match recomputed semantic observation`,
        );
      }
      return {
        name,
        passed: check["passed"],
        subjectHash,
        observationHashes: resolvedObservationHashes,
      };
    });
    const referencedObservationHashes = new Set(
      checks.flatMap((check) => check.observationHashes),
    );
    const unreferencedObservations = observations.filter(
      (observation) =>
        !referencedObservationHashes.has(observation.contentSha256),
    );
    if (unreferencedObservations.length > 0) {
      throw new Error(`${path}.content contains unreferenced observations`);
    }
    return freeze({
      artifactId,
      kind,
      mediaType: "application/json",
      contentBase64,
      contentByteLength,
      contentSha256,
      content: {
        schemaVersion: EVIDENCE_SCHEMA_VERSIONS[kind],
        kind,
        experimentId: portableId(
          content["experimentId"],
          `${path}.content.experimentId`,
        ),
        manifestHash: sha(
          content["manifestHash"],
          `${path}.content.manifestHash`,
        ),
        attemptSetRootHash: sha(
          content["attemptSetRootHash"],
          `${path}.content.attemptSetRootHash`,
        ),
        observations,
        checks,
      },
    });
  });
}

function verifyReceiptSignature(
  receipt: PublicEvalVerificationReceipt,
  publicKeySpkiPem: string,
): boolean {
  const { signature, receiptHash: _receiptHash, ...unsigned } = receipt;
  return verifyBytes(
    null,
    Buffer.from(hashPublicEvalJson(unsigned), "hex"),
    createPublicKey(publicKeySpkiPem),
    Buffer.from(signature.valueBase64, "base64"),
  );
}

function parseTrustedVerifier(
  value: unknown,
  path: string,
): PublicEvalTrustedVerifier {
  const raw = record(value, path);
  exactKeys(
    raw,
    ["verifierId", "sourceRevision", "ownerIdentity", "publicKeySpkiPem"],
    path,
  );
  return {
    verifierId: portableId(raw["verifierId"], `${path}.verifierId`),
    sourceRevision: sha(raw["sourceRevision"], `${path}.sourceRevision`),
    ownerIdentity: portableId(raw["ownerIdentity"], `${path}.ownerIdentity`),
    publicKeySpkiPem: ed25519PublicKeyPem(
      raw["publicKeySpkiPem"],
      `${path}.publicKeySpkiPem`,
    ),
  };
}

function ed25519PublicKeyPem(value: unknown, path: string): string {
  const pem = nonEmpty(value, path);
  let key;
  try {
    key = createPublicKey(pem);
  } catch {
    throw new Error(`${path} must be a valid public key`);
  }
  if (key.asymmetricKeyType !== "ed25519") {
    throw new Error(`${path} must be an Ed25519 public key`);
  }
  const canonical = key.export({ type: "spki", format: "pem" }).toString();
  if (pem !== canonical) {
    throw new Error(`${path} must use canonical SPKI PEM encoding`);
  }
  return canonical;
}

function ed25519SignatureBase64(value: unknown, path: string): string {
  const parsed = canonicalBase64(value, path);
  if (Buffer.from(parsed, "base64").byteLength !== 64) {
    throw new Error(`${path} must contain a 64-byte Ed25519 signature`);
  }
  return parsed;
}

function canonicalBase64(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  const bytes = Buffer.from(parsed, "base64");
  if (bytes.toString("base64") !== parsed) {
    throw new Error(`${path} must be canonical base64`);
  }
  return parsed;
}

function uniquePortableIds(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }
  const parsed = value.map((entry, index) =>
    portableId(entry, `${path}/${index}`),
  );
  if (new Set(parsed).size !== parsed.length) {
    throw new Error(`${path} must contain unique artifact IDs`);
  }
  return parsed;
}

function uniqueShas(value: unknown, path: string): readonly string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${path} must be a non-empty array`);
  }
  const parsed = value.map((entry, index) => sha(entry, `${path}/${index}`));
  if (new Set(parsed).size !== parsed.length) {
    throw new Error(`${path} must contain unique content hashes`);
  }
  return parsed;
}

function hashBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  path: string,
): void {
  const actual = Object.keys(value).sort(codeUnitCompare);
  const sorted = [...expected].sort(codeUnitCompare);
  if (JSON.stringify(actual) !== JSON.stringify(sorted)) {
    throw new Error(`${path} keys must be exactly ${sorted.join(", ")}`);
  }
}

function nonEmpty(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value;
}

function portableId(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  if (!ID.test(parsed)) throw new Error(`${path} is not a portable identifier`);
  return parsed;
}

function sha(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  if (!SHA256.test(parsed)) throw new Error(`${path} must be lowercase SHA-256`);
  return parsed;
}

function integer(value: unknown, path: string, minimum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${path} must be a safe integer >= ${minimum}`);
  }
  return value as number;
}

function timestamp(value: unknown, path: string): string {
  const parsed = nonEmpty(value, path);
  const epoch = Date.parse(parsed);
  if (!Number.isFinite(epoch) || new Date(epoch).toISOString() !== parsed) {
    throw new Error(`${path} must be a normalized ISO-8601 timestamp`);
  }
  return parsed;
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  path: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new Error(`${path} has unsupported value ${JSON.stringify(value)}`);
  }
  return value as T;
}

function withoutKey<T extends object, K extends keyof T>(
  value: T,
  key: K,
): Omit<T, K> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function canonicalJsonString(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non-finite JSON number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJsonString).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => codeUnitCompare(left, right))
      .map(
        ([key, entry]) =>
          `${JSON.stringify(key)}:${canonicalJsonString(entry)}`,
      )
      .join(",")}}`;
  }
  throw new Error(`unsupported JSON value ${typeof value}`);
}

function freeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  for (const child of Object.values(value)) freeze(child);
  return value;
}

function codeUnitCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
