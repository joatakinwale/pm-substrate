import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createPublicEvalDecisionTrustPolicy,
  createPublicEvalExecutionTimestampReceipt,
  createPublicEvalPreregistrationReceipt,
  createPublicEvalVerificationReceipt,
  evaluatePublicEvalDecisionBundle,
  publicEvalAttemptSetRoot,
  publicEvalEvidenceSetRoot,
  publicEvalVerificationSubjectHash,
  type PublicEvalDecisionBundleInput,
  type PublicEvalDecisionTrustPolicy,
  type PublicEvalExecutionTimestampReceipt,
  type PublicEvalPreregistrationReceipt,
  type PublicEvalVerificationEvidenceArtifact,
  type PublicEvalVerificationEvidenceContent,
  type PublicEvalVerificationEvidenceObservation,
  type PublicEvalVerificationReceipt,
} from "./decision.js";
import {
  PUBLIC_EVAL_ARMS,
  PUBLIC_EVAL_VERIFICATION_KINDS,
  createPublicEvalAnalysisManifest,
  createPublicEvalAttemptArtifact,
  hashPublicEvalJson,
  publicEvalArmBindingHash,
  publicEvalExecutionBindingHash,
  publicEvalExpectedArmOrder,
  publicEvalSelectionDigest,
  type PublicEvalAnalysisManifest,
  type PublicEvalArm,
  type PublicEvalAttemptArtifact,
  type PublicEvalTaskPlanEntry,
  type PublicEvalVerificationKind,
} from "./schema.js";

const FROZEN_AT = "2026-07-13T12:00:00.000Z";
const COMPLETED_AT = "2026-07-13T13:00:00.000Z";
const VERIFIED_AT = "2026-07-13T14:00:00.000Z";
const PRODUCER = "pm_eval_producer";
const VERIFIER_OWNER = "independent_verifier_org";
const SEMANTIC_DERIVATION_REASON =
  "semantic evidence is not adapter-derived from the bound manifest, attempts, analysis, and content-addressed raw records";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const PRIVATE_KEY_PEM = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString();
const PUBLIC_KEY_PEM = publicKey
  .export({ type: "spki", format: "pem" })
  .toString();

const REQUIRED_CHECKS: Readonly<
  Record<PublicEvalVerificationKind, readonly string[]>
> = {
  attempt_set: [
    "raw_artifacts_resolved",
    "attempt_hashes_recomputed",
    "usage_recomputed",
    "execution_bindings_recomputed",
    "sham_overhead_equivalence_recomputed",
    "unique_attempts_recomputed",
  ],
  oracle_independence: [
    "upstream_oracle_recomputed",
    "oracle_does_not_import_substrate_gate",
  ],
  split_leakage: [
    "eligible_universe_bound",
    "qualification_disjoint",
    "heldout_selection_recomputed",
    "canonical_task_uniqueness_recomputed",
    "replication_schedule_matched",
  ],
  anti_degenerate_controls: [
    "allow_all_rejected",
    "block_all_rejected",
    "expected_allow_passed",
    "expected_block_passed",
    "irrelevant_mutation_passed",
  ],
  restart_dynamic_state: [
    "restart_case_exercised",
    "lost_response_retry_exercised",
    "dynamic_state_case_exercised",
    "collateral_state_checked",
    "aba_checked",
    "duplicate_out_of_order_checked",
    "authority_checked",
    "concurrent_write_checked",
  ],
  clean_checkout: [
    "fresh_checkout",
    "pinned_revisions_recomputed",
    "analysis_recomputed",
    "model_identities_resolved",
    "non_model_configs_recomputed",
  ],
};

describe("public eval D7 decision gate", () => {
  it("keeps passing signed structured assertions diagnostic-only", () => {
    const fixture = passingFixture();
    const report = decide(fixture);

    expect(report.schemaVersion).toBe("pm.public-eval.decision-report.v4");
    expect(report.status).toBe("not_eligible");
    expect(report.evidenceEligibleUnderSuppliedPolicy).toBe(false);
    expect(report.ownerAuthorizationRequired).toBe(true);
    expect(report.evidenceAuthority).toBe("signed_assertions_non_authoritative");
    expect(report.semanticEvidenceAuthority).toBe(
      "signed_structured_assertions_diagnostic_only",
    );
    expect(report.semanticDerivationStatus).toBe(
      "adapter_specific_raw_derivation_not_implemented",
    );
    expect(report).not.toHaveProperty("d7KeepEligible");
    expect(report.analysis.pairedAnalysisCriteriaPassed).toBe(true);
    expect(report.trustPolicyHash).toBe(fixture.trustPolicy.policyHash);
    expect(Object.values(report.verificationReceiptHashes)).not.toContain(null);
    expect(Object.values(report.verificationSignerIdentities)).toEqual(
      Array.from(
        { length: 6 },
        (_, index) =>
          `${VERIFIER_OWNER}/verifier_${PUBLIC_EVAL_VERIFICATION_KINDS[index]}`,
      ),
    );
    expect(report.reasons).toEqual([SEMANTIC_DERIVATION_REASON]);
  });

  it("keeps fully signed self-consistent fabricated counts ineligible", () => {
    const fixture = passingFixture();
    const attemptEvidence = decodedEvidenceContent(fixture.evidence[0]!);
    const observation = decodedCheckObservation(
      attemptEvidence,
      "raw_artifacts_resolved",
    );
    const facts = observation["facts"] as Record<string, unknown>;

    expect(fixture.bundle.analysis.attempts).toHaveLength(363);
    expect(facts["referencedArtifactCount"]).toBe(1);
    expect(facts["resolvedArtifactCount"]).toBe(1);
    expect(fixture.receipts).toHaveLength(6);

    const report = decide(fixture);
    expect(report.evidenceEligibleUnderSuppliedPolicy).toBe(false);
    expect(report.status).toBe("not_eligible");
    expect(report.semanticDerivationStatus).toBe(
      "adapter_specific_raw_derivation_not_implemented",
    );
    expect(report.reasons).toContain(SEMANTIC_DERIVATION_REASON);
  });

  it("rejects an empty evidence set instead of accepting passing analysis alone", () => {
    const fixture = passingFixture();
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          evidenceArtifacts: [],
          verificationReceipts: [],
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/evidenceArtifacts must be a non-empty array/);
  });

  it("rejects plain text, wrong kind schemas, and unresolved observation hashes", () => {
    const fixture = passingFixture();
    const first = fixture.evidence[0]!;
    const replaceFirst = (artifact: PublicEvalVerificationEvidenceArtifact) => [
      artifact,
      ...fixture.evidence.slice(1),
    ];

    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          evidenceArtifacts: replaceFirst(
            rawEvidenceArtifact("attempt_set", "not JSON evidence"),
          ),
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/valid UTF-8 JSON/);

    const wrongSchema = {
      ...decodedEvidenceContent(first),
      schemaVersion: evidenceSchema("oracle_independence"),
    };
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          evidenceArtifacts: replaceFirst(
            encodedEvidenceArtifact("attempt_set", wrongSchema),
          ),
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/content schema is invalid for attempt_set/);

    const unresolved = decodedEvidenceContent(first);
    const firstCheck = unresolved.checks[0]!;
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          evidenceArtifacts: replaceFirst(
            encodedEvidenceArtifact("attempt_set", {
              ...unresolved,
              checks: [
                {
                  ...firstCheck,
                  observationHashes: [digest("missing-observation-bytes")],
                },
                ...unresolved.checks.slice(1),
              ],
            }),
          ),
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/references missing observation/);
  });

  it("rejects banana bytes, unsupported procedures, and claim/observation disagreement", () => {
    const fixture = passingFixture();
    const original = decodedEvidenceContent(fixture.evidence[0]!);
    const checkName = "raw_artifacts_resolved";
    const semantic = decodedCheckObservation(original, checkName);
    const replaceFirst = (content: PublicEvalVerificationEvidenceContent) => [
      encodedEvidenceArtifact("attempt_set", content),
      ...fixture.evidence.slice(1),
    ];
    const decideWith = (content: PublicEvalVerificationEvidenceContent) =>
      evaluatePublicEvalDecisionBundle(
        { ...fixture.bundle, evidenceArtifacts: replaceFirst(content) },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      );

    expect(() =>
      decideWith(
        withCheckObservation(original, checkName, { banana: "yellow" }, true),
      ),
    ).toThrow(/semanticObservation keys must be exactly/);

    expect(() =>
      decideWith(
        withCheckObservation(
          original,
          checkName,
          { ...semantic, procedure: "pm.public-eval.verify.banana.v1" },
          true,
        ),
      ),
    ).toThrow(/procedure is unsupported/);

    const facts = semantic["facts"] as Record<string, unknown>;
    expect(() =>
      decideWith(
        withCheckObservation(
          original,
          checkName,
          {
            ...semantic,
            facts: { ...facts, resolvedArtifactCount: 0 },
          },
          true,
        ),
      ),
    ).toThrow(/claimed result does not match recomputed semantic observation/);
  });

  it("rejects a required check backed by a valid but irrelevant evidence artifact", () => {
    const fixture = passingFixture();
    const manifest = fixture.bundle.analysis.manifest as PublicEvalAnalysisManifest;
    const original = decodedEvidenceContent(fixture.evidence[0]!);
    const omitted = original.checks[0]!;
    const relevantObservationHashes = new Set(
      original.checks.slice(1).flatMap((check) => check.observationHashes),
    );
    const changedEvidence = [
      encodedEvidenceArtifact("attempt_set", {
        ...original,
        checks: original.checks.slice(1),
        observations: original.observations.filter((observation) =>
          relevantObservationHashes.has(observation.contentSha256),
        ),
      }),
      ...fixture.evidence.slice(1),
    ];
    const changedReceipts = receiptsFor(
      manifest,
      fixture.bundle.analysis,
      changedEvidence,
      fixture.trustPolicy,
      VERIFIER_OWNER,
    );

    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          evidenceArtifacts: changedEvidence,
          verificationReceipts: changedReceipts,
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(
      new RegExp(
        `attempt_set/${omitted.name} references irrelevant evidence`,
      ),
    );
  });

  it("binds receipts to exact attempt and evidence bytes", () => {
    const fixture = passingFixture();
    const attempts = [...fixture.bundle.analysis.attempts] as PublicEvalAttemptArtifact[];
    const first = attempts[0]!;
    const { schemaVersion: _schema, artifactHash: _hash, ...input } = first;
    attempts[0] = createPublicEvalAttemptArtifact({
      ...input,
      rawArtifactRootHash: digest("substituted-raw-artifact-tree"),
    });
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          analysis: { ...fixture.bundle.analysis, attempts },
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(
      /timestamp binding is invalid|receipt binding mismatch|evidence .* binding mismatch/,
    );

    const evidence = [...fixture.evidence];
    evidence[0] = evidenceArtifact(
      "attempt_set",
      fixture.bundle.analysis,
      "changed-evidence",
    );
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        { ...fixture.bundle, evidenceArtifacts: evidence },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/receipt binding mismatch/);
  });

  it("rejects forged signatures, unpinned policies, and unplanned verifiers", () => {
    const fixture = passingFixture();
    const first = fixture.receipts[0]!;
    const { privateKey: attackerKey } = generateKeyPairSync("ed25519");
    const attackerPem = attackerKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();
    const forged = reissueReceipt(first, {}, attackerPem);
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          verificationReceipts: [forged, ...fixture.receipts.slice(1)],
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/signature is invalid/);

    expect(() =>
      evaluatePublicEvalDecisionBundle(
        fixture.bundle,
        fixture.trustPolicy,
        digest("different-out-of-band-policy"),
      ),
    ).toThrow(/out-of-band pinned hash/);

    const wrongVerifier = reissueReceipt(first, {
      verifier: {
        ...first.verifier,
        verifierId: "verifier_post_hoc_substitution",
      },
    });
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          verificationReceipts: [wrongVerifier, ...fixture.receipts.slice(1)],
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/does not match the pinned trust policy/);
  });

  it("rejects premature receipts and fails closed on a signed check failure", () => {
    const fixture = passingFixture();
    const first = fixture.receipts[0]!;
    const premature = reissueReceipt(first, { verifiedAt: FROZEN_AT });
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          verificationReceipts: [premature, ...fixture.receipts.slice(1)],
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/receipt predates the final attempt/);

    const manifest = fixture.bundle.analysis.manifest as PublicEvalAnalysisManifest;
    const antiEvidenceIndex = fixture.evidence.findIndex(
      (artifact) => artifact.kind === "anti_degenerate_controls",
    );
    const antiContent = decodedEvidenceContent(
      fixture.evidence[antiEvidenceIndex]!,
    );
    const blockAllObservation = decodedCheckObservation(
      antiContent,
      "block_all_rejected",
    );
    const blockAllFacts = blockAllObservation["facts"] as Record<
      string,
      unknown
    >;
    const failedEvidence = [...fixture.evidence];
    failedEvidence[antiEvidenceIndex] = encodedEvidenceArtifact(
      "anti_degenerate_controls",
      withCheckObservation(
        antiContent,
        "block_all_rejected",
        {
          ...blockAllObservation,
          facts: { ...blockAllFacts, observedOutcome: "accepted" },
        },
        false,
      ),
    );
    const failed = [
      ...receiptsFor(
        manifest,
        fixture.bundle.analysis,
        failedEvidence,
        fixture.trustPolicy,
        VERIFIER_OWNER,
      ),
    ];
    const antiIndex = failed.findIndex(
      (receipt) => receipt.kind === "anti_degenerate_controls",
    );
    const anti = failed[antiIndex]!;
    failed[antiIndex] = reissueReceipt(anti, {
      checks: anti.checks.map((check) =>
        check.name === "block_all_rejected"
          ? { ...check, passed: false }
          : check,
      ),
    });
    const report = evaluatePublicEvalDecisionBundle(
      {
        ...fixture.bundle,
        evidenceArtifacts: failedEvidence,
        verificationReceipts: failed,
      },
      fixture.trustPolicy,
      fixture.trustPolicy.policyHash,
    );
    expect(report.evidenceEligibleUnderSuppliedPolicy).toBe(false);
    expect(report.reasons).toEqual([
      SEMANTIC_DERIVATION_REASON,
      "anti_degenerate_controls/block_all_rejected failed",
    ]);
  });

  it("is invariant to evidence ordering and refuses same-owner verification", () => {
    const fixture = passingFixture();
    expect(publicEvalEvidenceSetRoot([...fixture.evidence].reverse())).toBe(
      publicEvalEvidenceSetRoot(fixture.evidence),
    );

    const sameOwnerFixture = passingFixture(true, PRODUCER);
    const report = decide(sameOwnerFixture);
    expect(report.evidenceEligibleUnderSuppliedPolicy).toBe(false);
    expect(report.reasons).toHaveLength(9);
    expect(report.reasons[0]).toBe(SEMANTIC_DERIVATION_REASON);
    expect(report.reasons[1]).toMatch(/authority owner is the experiment producer/);
  });

  it("cannot replace predeclared qualification with signed post-hoc control claims", () => {
    const fixture = passingFixture(false);
    const report = decide(fixture);

    expect(report.analysis.pairedAnalysisCriteriaPassed).toBe(true);
    expect(report.evidenceEligibleUnderSuppliedPolicy).toBe(false);
    expect(report.reasons).toEqual([
      SEMANTIC_DERIVATION_REASON,
      "decision manifest has no predeclared qualification task",
    ]);
  });

  it("requires a signed pre-run anchor and one signed timestamp per attempt", () => {
    const fixture = passingFixture();
    const manifest = fixture.bundle.analysis.manifest as PublicEvalAnalysisManifest;
    const late = createPublicEvalPreregistrationReceipt(
      {
        receiptId: "late_preregistration",
        policyHash: fixture.trustPolicy.policyHash,
        experimentId: manifest.experimentId,
        manifestHash: manifest.manifestHash,
        registeredAt: COMPLETED_AT,
        authority: receiptAuthority(
          fixture.trustPolicy.preregistrationAuthority,
        ),
      },
      PRIVATE_KEY_PEM,
    );
    expect(() =>
      evaluatePublicEvalDecisionBundle(
        { ...fixture.bundle, preregistrationReceipt: late },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/not preregistered before every attempt/);

    expect(() =>
      evaluatePublicEvalDecisionBundle(
        {
          ...fixture.bundle,
          executionTimestampReceipts:
            fixture.executionTimestampReceipts.slice(1),
        },
        fixture.trustPolicy,
        fixture.trustPolicy.policyHash,
      ),
    ).toThrow(/one execution timestamp receipt per attempt/);
  });
});

function passingFixture(
  includeQualification: boolean = true,
  verifierOwner: string = VERIFIER_OWNER,
): {
  readonly bundle: PublicEvalDecisionBundleInput;
  readonly trustPolicy: PublicEvalDecisionTrustPolicy;
  readonly evidence: readonly PublicEvalVerificationEvidenceArtifact[];
  readonly receipts: readonly PublicEvalVerificationReceipt[];
  readonly preregistrationReceipt: PublicEvalPreregistrationReceipt;
  readonly executionTimestampReceipts: readonly PublicEvalExecutionTimestampReceipt[];
} {
  const trustPolicy = policyFixture(verifierOwner);
  const qualificationComponents = components("qualification");
  const decisionComponents = components("decision");
  const rawTaskPlan = [
    ...(includeQualification ? [qualificationTask()] : []),
    ...phaseTasks("confirm", "confirmatory", "heldout"),
    ...phaseTasks("replicate", "replication", "heldout"),
  ];
  const universe = [
    ...new Set(rawTaskPlan.map((task) => task.benchmarkTaskContentHash)),
  ].sort();
  const selected = [
    ...new Set(
      rawTaskPlan
        .filter(
          (task) => task.phase === "confirmatory" && task.status === "included",
        )
        .map((task) => task.benchmarkTaskContentHash),
    ),
  ].sort();
  const selectionSeed = selectionSeedFor(
    universe,
    selected,
    "decision-heldout-selection",
  );
  const universeRoot = hashPublicEvalJson({
    schemaVersion: "pm.public-eval.eligible-universe.v1",
    taskContentHashes: universe,
  });
  const taskPlan = rawTaskPlan.map((task) => ({
    ...task,
    selectionDigest: publicEvalSelectionDigest(
      selectionSeed,
      task.benchmarkTaskContentHash,
    ),
    eligibleUniverseMembershipProof: {
      inventoryIndex: universe.indexOf(task.benchmarkTaskContentHash),
      inventoryRootHash: universeRoot,
      benchmarkTaskContentHash: task.benchmarkTaskContentHash,
    },
  }));
  const manifest = createPublicEvalAnalysisManifest({
    experimentId: "experiment_public_decision",
    producerIdentity: PRODUCER,
    benchmark: {
      benchmarkId: "benchmark_fixture",
      repositoryUrl: "https://example.com/public/benchmark-fixture.git",
      revision: digest("revision-1"),
      licenseSpdx: "MIT",
      splitId: "heldout-test",
      corpusHash: digest("fixture-corpus"),
      eligibleUniverse: {
        rootHash: universeRoot,
        taskContentHashes: universe,
        selectionAlgorithm: "sha256-rank-v1",
        selectionSeed,
        selectionCount: selected.length,
      },
    },
    execution: {
      harnessRevision: digest("fixture-harness"),
      substrateRevision: digest("fixture-substrate"),
      replicationAxis: "model",
      modelIds: {
        qualification: "fixture-model-primary",
        confirmatory: "fixture-model-primary",
        replication: "fixture-model-replication",
      },
      modelDigests: {
        qualification: digest("fixture-model-primary"),
        confirmatory: digest("fixture-model-primary"),
        replication: digest("fixture-model-replication"),
      },
      nonModelConfigHashes: {
        qualification: configHash(qualificationComponents),
        confirmatory: configHash(decisionComponents),
        replication: configHash(decisionComponents),
      },
      nonModelComponents: {
        qualification: qualificationComponents,
        confirmatory: decisionComponents,
        replication: decisionComponents,
      },
      arms: armPlans(),
      randomization: {
        algorithm: "sha256-arm-order-v1",
        seed: "decision-arm-order",
      },
    },
    decisionVerification: Object.fromEntries(
      PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => {
        const verifier = trustPolicy.trustedVerifiers[kind];
        return [
          kind,
          {
            verifierId: verifier.verifierId,
            sourceRevision: verifier.sourceRevision,
          },
        ];
      }),
    ) as PublicEvalAnalysisManifest["decisionVerification"],
    frozenAt: FROZEN_AT,
    taskPlan,
    guardrails: {
      maxFalseBlockedActionsPerAttempt: 0,
      maxCollateralWritesPerAttempt: 0,
    },
    bootstrap: {
      iterations: 10_000,
      confidenceLevel: 0.95,
      seed: "decision-test-bootstrap",
    },
    successCriteria: {
      minimumStrictCompletionLift: 0.1,
      minimumReliableTaskSuccessRate: 0.5,
      requirePositiveCiLowerBound: true,
      maximumCostUsdPerStrictSuccess: 10,
      maximumLatencyMsPerStrictSuccess: 1_000,
      maximumCostPerStrictSuccessRatio: 1.25,
      maximumLatencyPerStrictSuccessRatio: 1.25,
    },
  });
  const attempts = attemptsFor(manifest);
  const analysis = {
    schemaVersion: "pm.public-eval.analysis-input.v1" as const,
    manifest,
    attempts,
  };
  const preregistrationReceipt = createPublicEvalPreregistrationReceipt(
    {
      receiptId: "preregistration_public_decision",
      policyHash: trustPolicy.policyHash,
      experimentId: manifest.experimentId,
      manifestHash: manifest.manifestHash,
      registeredAt: manifest.frozenAt,
      authority: receiptAuthority(trustPolicy.preregistrationAuthority),
    },
    PRIVATE_KEY_PEM,
  );
  const executionTimestampReceipts = attempts.map((attempt) =>
    createPublicEvalExecutionTimestampReceipt(
      {
        receiptId: `timestamp_${attempt.attemptId}`,
        policyHash: trustPolicy.policyHash,
        preregistrationReceiptHash: preregistrationReceipt.receiptHash,
        experimentId: attempt.experimentId,
        manifestHash: attempt.manifestHash,
        attemptId: attempt.attemptId,
        rawArtifactRootHash: attempt.rawArtifactRootHash,
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        attestedAt: VERIFIED_AT,
        authority: receiptAuthority(trustPolicy.executionTimestampAuthority),
      },
      PRIVATE_KEY_PEM,
    ),
  );
  const evidence = PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) =>
    evidenceArtifact(kind, analysis),
  );
  const receipts = receiptsFor(
    manifest,
    analysis,
    evidence,
    trustPolicy,
    verifierOwner,
  );
  return {
    bundle: {
      schemaVersion: "pm.public-eval.decision-bundle-input.v3",
      analysis,
      preregistrationReceipt,
      executionTimestampReceipts,
      evidenceArtifacts: evidence,
      verificationReceipts: receipts,
    },
    trustPolicy,
    evidence,
    receipts,
    preregistrationReceipt,
    executionTimestampReceipts,
  };
}

function policyFixture(ownerIdentity: string): PublicEvalDecisionTrustPolicy {
  return createPublicEvalDecisionTrustPolicy({
    policyId: `policy_${ownerIdentity}`,
    preregistrationAuthority: {
      verifierId: "preregistration_authority",
      sourceRevision: digest("preregistration-authority-source"),
      ownerIdentity,
      publicKeySpkiPem: PUBLIC_KEY_PEM,
    },
    executionTimestampAuthority: {
      verifierId: "execution_timestamp_authority",
      sourceRevision: digest("execution-timestamp-authority-source"),
      ownerIdentity,
      publicKeySpkiPem: PUBLIC_KEY_PEM,
    },
    trustedVerifiers: Object.fromEntries(
      PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => [
        kind,
        {
          verifierId: `verifier_${kind}`,
          sourceRevision: digest(`verifier-source:${kind}`),
          ownerIdentity,
          publicKeySpkiPem: PUBLIC_KEY_PEM,
        },
      ]),
    ) as PublicEvalDecisionTrustPolicy["trustedVerifiers"],
  });
}

function qualificationTask(): PublicEvalTaskPlanEntry {
  return taskPlanEntry(
    "qualification-probe",
    "qualification-probe",
    "qualification",
    ["seed-0"],
  );
}

function phaseTasks(
  prefix: string,
  phase: "confirmatory" | "replication",
  canonicalPrefix: string,
): readonly PublicEvalTaskPlanEntry[] {
  return Array.from({ length: 20 }, (_, index) =>
    taskPlanEntry(
      `${prefix}-${index}`,
      `${canonicalPrefix}-${index}`,
      phase,
      ["seed-0", "seed-1", "seed-2"],
    ),
  );
}

function attemptsFor(
  manifest: PublicEvalAnalysisManifest,
): readonly PublicEvalAttemptArtifact[] {
  return manifest.taskPlan.flatMap((task) =>
    task.status === "included"
      ? task.predeclaredSeeds.flatMap((seed, repeatIndex) =>
          PUBLIC_EVAL_ARMS.map((arm) =>
            attemptFor(manifest, task, repeatIndex, seed, arm),
          ),
        )
      : [],
  );
}

function attemptFor(
  manifest: PublicEvalAnalysisManifest,
  task: Extract<PublicEvalTaskPlanEntry, { readonly status: "included" }>,
  repeatIndex: number,
  seed: string,
  arm: PublicEvalArm,
): PublicEvalAttemptArtifact {
  const decisionPhase = task.phase !== "qualification";
  const armOrderPosition = publicEvalExpectedArmOrder(
    manifest,
    task,
    repeatIndex,
  ).indexOf(arm);
  const startedAt = new Date(
    Date.parse(COMPLETED_AT) + armOrderPosition * 1_000,
  ).toISOString();
  return createPublicEvalAttemptArtifact({
    manifestHash: manifest.manifestHash,
    experimentId: manifest.experimentId,
    benchmarkId: manifest.benchmark.benchmarkId,
    benchmarkRevision: manifest.benchmark.revision,
    harnessRevision: manifest.execution.harnessRevision,
    substrateRevision: manifest.execution.substrateRevision,
    modelId: manifest.execution.modelIds[task.phase],
    modelDigest: manifest.execution.modelDigests[task.phase],
    nonModelConfigHash: manifest.execution.nonModelConfigHashes[task.phase],
    phase: task.phase,
    taskId: task.taskId,
    repeatIndex,
    seed,
    arm,
    armInterventionHash: manifest.execution.arms[arm].interventionHash,
    armBindingHash: publicEvalArmBindingHash(
      manifest,
      task,
      repeatIndex,
      arm,
    ),
    armOrderPosition,
    initialEnvironmentSnapshotHash: task.initialEnvironmentSnapshotHash,
    attemptGroupId: `group_${task.taskId}_${repeatIndex}`,
    attemptId: `attempt_${task.taskId}_${repeatIndex}_${arm}`,
    executionBindingHash: publicEvalExecutionBindingHash(
      manifest,
      task,
      repeatIndex,
    ),
    startedAt,
    completedAt: new Date(Date.parse(startedAt) + 500).toISOString(),
    rawArtifactRootHash: digest(`${task.taskId}:${seed}:${arm}:raw`),
    usageReceiptHash: digest(`${task.taskId}:${seed}:${arm}:usage`),
    outcome: {
      strictTaskSuccess: decisionPhase
        ? arm === "substrate" || Number(task.canonicalTaskId.split("-").at(-1)) < 10
        : arm !== "sham",
      oracleReceiptHash: digest(`${task.taskId}:${seed}:${arm}:oracle`),
      blockedActionCount: arm === "substrate" ? 1 : 0,
      falseBlockedActionCount: 0,
      collateralWriteCount: 0,
      costUsd: 1,
      latencyMs: 100,
    },
  });
}

function evidenceArtifact(
  kind: PublicEvalVerificationKind,
  analysis: PublicEvalDecisionBundleInput["analysis"],
  observationLabel: string = "independent-observation",
): PublicEvalVerificationEvidenceArtifact {
  const manifest = analysis.manifest as PublicEvalAnalysisManifest;
  const observations = REQUIRED_CHECKS[kind].map((name) => {
    const subjectHash = publicEvalVerificationSubjectHash(
      analysis,
      kind,
      name,
    );
    return semanticObservation(
      kind,
      name,
      subjectHash,
      passingObservationFacts(kind, name, observationLabel),
    );
  });
  const content = {
    schemaVersion: evidenceSchema(kind),
    kind,
    experimentId: manifest.experimentId,
    manifestHash: manifest.manifestHash,
    attemptSetRootHash: publicEvalAttemptSetRoot(analysis),
    observations,
    checks: REQUIRED_CHECKS[kind].map((name, index) => ({
      name,
      passed: true,
      subjectHash: publicEvalVerificationSubjectHash(analysis, kind, name),
      observationHashes: [observations[index]!.contentSha256],
    })),
  };
  return encodedEvidenceArtifact(kind, content);
}

function semanticObservation(
  kind: PublicEvalVerificationKind,
  checkName: string,
  subjectHash: string,
  facts: Readonly<Record<string, unknown>>,
): PublicEvalVerificationEvidenceObservation {
  const bytes = Buffer.from(
    canonicalJson({
      schemaVersion: `pm.public-eval.verification-observation.${kind.replaceAll("_", "-")}.v1`,
      kind,
      checkName,
      subjectHash,
      procedure: `pm.public-eval.verify.${kind.replaceAll("_", "-")}.${checkName.replaceAll("_", "-")}.v1`,
      facts,
    }),
    "utf8",
  );
  return {
    observationId: `observation_${kind}_${checkName}`,
    mediaType: "application/json",
    contentBase64: bytes.toString("base64"),
    contentByteLength: bytes.byteLength,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function passingObservationFacts(
  kind: PublicEvalVerificationKind,
  checkName: string,
  observationLabel: string,
): Readonly<Record<string, unknown>> {
  const count = observationLabel === "independent-observation" ? 1 : 2;
  const marker = digest(`${observationLabel}:${kind}:${checkName}`);

  if (kind === "attempt_set") {
    if (checkName === "raw_artifacts_resolved") {
      return {
        referencedArtifactCount: count,
        resolvedArtifactCount: count,
        missingArtifactHashes: [],
      };
    }
    if (checkName === "attempt_hashes_recomputed") {
      return {
        attemptCount: count,
        matchingAttemptHashCount: count,
        mismatchedAttemptIds: [],
      };
    }
    if (checkName === "usage_recomputed") {
      return {
        attemptCount: count,
        matchingUsageCount: count,
        mismatchedAttemptIds: [],
      };
    }
    if (checkName === "execution_bindings_recomputed") {
      return {
        attemptCount: count,
        matchingExecutionBindingCount: count,
        mismatchedAttemptIds: [],
      };
    }
    if (checkName === "sham_overhead_equivalence_recomputed") {
      return {
        comparisonCount: count,
        equivalentComparisonCount: count,
        mismatchedDimensions: [],
      };
    }
    if (checkName === "unique_attempts_recomputed") {
      return {
        attemptCount: count,
        uniqueAttemptIdCount: count,
        duplicateAttemptIds: [],
      };
    }
  }

  if (kind === "oracle_independence") {
    if (checkName === "upstream_oracle_recomputed") {
      return {
        attemptCount: count,
        matchingOracleOutcomeCount: count,
        mismatchedAttemptIds: [],
      };
    }
    return { sourceFileCount: count, forbiddenImportMatches: [] };
  }

  if (kind === "split_leakage") {
    if (checkName === "eligible_universe_bound") {
      return {
        declaredUniverseCount: count,
        observedUniverseCount: count,
        expectedUniverseRootHash: marker,
        observedUniverseRootHash: marker,
        missingTaskContentHashes: [],
        unexpectedTaskContentHashes: [],
      };
    }
    if (checkName === "qualification_disjoint") {
      return {
        qualificationTaskContentHashes: [digest(`${marker}:qualification`)],
        decisionTaskContentHashes: [digest(`${marker}:decision`)],
      };
    }
    if (checkName === "heldout_selection_recomputed") {
      return {
        expectedTaskContentHashes: [marker],
        observedTaskContentHashes: [marker],
      };
    }
    if (checkName === "canonical_task_uniqueness_recomputed") {
      return { canonicalTaskIds: [`canonical-${marker.slice(0, 16)}`] };
    }
    return {
      confirmatoryScheduleHashes: [marker],
      replicationScheduleHashes: [marker],
    };
  }

  if (kind === "anti_degenerate_controls") {
    if (checkName === "allow_all_rejected" || checkName === "block_all_rejected") {
      return { caseCount: count, observedOutcome: "rejected", failingCaseIds: [] };
    }
    return { caseCount: count, passingCaseCount: count, failedCaseIds: [] };
  }

  if (kind === "restart_dynamic_state") {
    return { caseCount: count, passingCaseCount: count, failedCaseIds: [] };
  }

  if (checkName === "fresh_checkout") {
    return {
      checkoutCreated: true,
      dirtyPathCount: 0,
      untrackedPathCount: 0,
      expectedSourceTreeHash: marker,
      observedSourceTreeHash: marker,
    };
  }
  if (checkName === "pinned_revisions_recomputed") {
    return {
      expectedRevisionHashes: [marker],
      observedRevisionHashes: [marker],
    };
  }
  if (checkName === "analysis_recomputed") {
    return {
      expectedAnalysisReportHash: marker,
      observedAnalysisReportHash: marker,
    };
  }
  if (checkName === "model_identities_resolved") {
    return {
      declaredModelCount: count,
      resolvedModelCount: count,
      unresolvedModelIds: [],
    };
  }
  return {
    declaredConfigCount: count,
    recomputedConfigCount: count,
    mismatchedConfigIds: [],
  };
}

function encodedEvidenceArtifact(
  kind: PublicEvalVerificationKind,
  content: unknown,
): PublicEvalVerificationEvidenceArtifact {
  const bytes = Buffer.from(canonicalJson(content), "utf8");
  return {
    artifactId: `evidence_${kind}`,
    kind,
    mediaType: "application/json",
    contentBase64: bytes.toString("base64"),
    contentByteLength: bytes.byteLength,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function rawEvidenceArtifact(
  kind: PublicEvalVerificationKind,
  content: string,
): PublicEvalVerificationEvidenceArtifact {
  const bytes = Buffer.from(content, "utf8");
  return {
    artifactId: `evidence_${kind}`,
    kind,
    mediaType: "application/json",
    contentBase64: bytes.toString("base64"),
    contentByteLength: bytes.byteLength,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function decodedEvidenceContent(
  artifact: PublicEvalVerificationEvidenceArtifact,
): PublicEvalVerificationEvidenceContent {
  return JSON.parse(
    Buffer.from(artifact.contentBase64, "base64").toString("utf8"),
  ) as PublicEvalVerificationEvidenceContent;
}

function decodedCheckObservation(
  content: PublicEvalVerificationEvidenceContent,
  checkName: string,
): Record<string, unknown> {
  const check = content.checks.find((entry) => entry.name === checkName);
  if (check === undefined || check.observationHashes.length !== 1) {
    throw new Error(`fixture check ${checkName} does not have one observation`);
  }
  const observation = content.observations.find(
    (entry) => entry.contentSha256 === check.observationHashes[0],
  );
  if (observation === undefined) {
    throw new Error(`fixture check ${checkName} observation is missing`);
  }
  return JSON.parse(
    Buffer.from(observation.contentBase64, "base64").toString("utf8"),
  ) as Record<string, unknown>;
}

function withCheckObservation(
  content: PublicEvalVerificationEvidenceContent,
  checkName: string,
  semanticContent: unknown,
  claimedPassed: boolean,
): PublicEvalVerificationEvidenceContent {
  const check = content.checks.find((entry) => entry.name === checkName);
  if (check === undefined || check.observationHashes.length !== 1) {
    throw new Error(`fixture check ${checkName} does not have one observation`);
  }
  const priorHash = check.observationHashes[0]!;
  const prior = content.observations.find(
    (entry) => entry.contentSha256 === priorHash,
  );
  if (prior === undefined) {
    throw new Error(`fixture check ${checkName} observation is missing`);
  }
  const bytes = Buffer.from(canonicalJson(semanticContent), "utf8");
  const replacement: PublicEvalVerificationEvidenceObservation = {
    observationId: prior.observationId,
    mediaType: "application/json",
    contentBase64: bytes.toString("base64"),
    contentByteLength: bytes.byteLength,
    contentSha256: createHash("sha256").update(bytes).digest("hex"),
  };
  return {
    ...content,
    observations: content.observations.map((observation) =>
      observation.contentSha256 === priorHash ? replacement : observation,
    ),
    checks: content.checks.map((entry) =>
      entry.name === checkName
        ? {
            ...entry,
            passed: claimedPassed,
            observationHashes: [replacement.contentSha256],
          }
        : entry,
    ),
  };
}

function receiptsFor(
  manifest: PublicEvalAnalysisManifest,
  analysis: PublicEvalDecisionBundleInput["analysis"],
  evidence: readonly PublicEvalVerificationEvidenceArtifact[],
  policy: PublicEvalDecisionTrustPolicy,
  ownerIdentity: string,
): readonly PublicEvalVerificationReceipt[] {
  const attemptSetRootHash = publicEvalAttemptSetRoot(analysis);
  const evidenceSetRootHash = publicEvalEvidenceSetRoot(evidence);
  return PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => {
    const verifier = policy.trustedVerifiers[kind];
    return createPublicEvalVerificationReceipt(
      {
        receiptId: `receipt_${kind}`,
        kind,
        experimentId: manifest.experimentId,
        manifestHash: manifest.manifestHash,
        attemptSetRootHash,
        evidenceSetRootHash,
        verifier: {
          verifierId: verifier.verifierId,
          sourceRevision: verifier.sourceRevision,
          ownerIdentity,
          executionEnvironmentHash: digest(`verification-env:${kind}`),
        },
        checks: REQUIRED_CHECKS[kind].map((name) => ({
          name,
          passed: true,
          evidenceArtifactIds: [`evidence_${kind}`],
        })),
        verifiedAt: VERIFIED_AT,
      },
      PRIVATE_KEY_PEM,
    );
  });
}

function reissueReceipt(
  receipt: PublicEvalVerificationReceipt,
  overrides: Partial<
    Omit<
      PublicEvalVerificationReceipt,
      "schemaVersion" | "signature" | "receiptHash"
    >
  >,
  signingKey: string = PRIVATE_KEY_PEM,
): PublicEvalVerificationReceipt {
  const {
    schemaVersion: _schema,
    signature: _signature,
    receiptHash: _hash,
    ...input
  } = receipt;
  return createPublicEvalVerificationReceipt(
    { ...input, ...overrides },
    signingKey,
  );
}

function decide(fixture: ReturnType<typeof passingFixture>) {
  return evaluatePublicEvalDecisionBundle(
    fixture.bundle,
    fixture.trustPolicy,
    fixture.trustPolicy.policyHash,
  );
}

function evidenceSchema(kind: PublicEvalVerificationKind): string {
  return `pm.public-eval.verification-evidence.${kind.replaceAll("_", "-")}.v2`;
}

function selectionSeedFor(
  universe: readonly string[],
  selected: readonly string[],
  prefix: string,
): string {
  const expected = [...selected].sort();
  for (let index = 0; index < 100_000; index += 1) {
    const seed = `${prefix}-${index}`;
    const actual = [...universe]
      .sort((left, right) => {
        const leftRank = publicEvalSelectionDigest(seed, left);
        const rightRank = publicEvalSelectionDigest(seed, right);
        return leftRank < rightRank ? -1 : leftRank > rightRank ? 1 : 0;
      })
      .slice(0, expected.length)
      .sort();
    if (JSON.stringify(actual) === JSON.stringify(expected)) return seed;
  }
  throw new Error("test fixture could not derive deterministic selection seed");
}

function canonicalJson(value: unknown): string {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "string" ||
    typeof value === "number"
  ) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  throw new Error(`unsupported test JSON value ${typeof value}`);
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function components(label: string) {
  return {
    systemPromptHash: digest(`${label}:system-prompt`),
    toolsHash: digest(`${label}:tools`),
    simulatorHash: digest(`${label}:simulator`),
    judgeHash: digest(`${label}:judge`),
    decodingHash: digest(`${label}:decoding`),
    runnerHash: digest(`${label}:runner`),
  };
}

function configHash(value: ReturnType<typeof components>): string {
  return hashPublicEvalJson({
    schemaVersion: "pm.public-eval.non-model-config.v1",
    ...value,
  });
}

function taskPlanEntry(
  taskId: string,
  canonicalTaskId: string,
  phase: "qualification" | "confirmatory" | "replication",
  predeclaredSeeds: readonly string[],
): PublicEvalTaskPlanEntry {
  const benchmarkTaskContentHash = digest(`benchmark-task:${canonicalTaskId}`);
  return {
    taskId,
    canonicalTaskId,
    benchmarkTaskLocator: `task/${canonicalTaskId}`,
    benchmarkTaskContentHash,
    taskContentHash: benchmarkTaskContentHash,
    variant: "original",
    mutationHash: null,
    phase,
    predeclaredSeeds,
    selectionDigest: digest("filled-by-fixture"),
    eligibleUniverseMembershipProof: {
      inventoryIndex: 0,
      inventoryRootHash: digest("filled-by-fixture"),
      benchmarkTaskContentHash,
    },
    initialEnvironmentSnapshotHash: digest(`environment:${canonicalTaskId}`),
    status: "included",
  };
}

function armPlans(): PublicEvalAnalysisManifest["execution"]["arms"] {
  const sharedSidecar = digest("decision-equal-overhead-sidecar");
  return {
    native: {
      stateMode: "native",
      interventionHash: digest("arm:native"),
      implementationRevision: digest("arm:native:implementation"),
      sidecarShapeHash: digest("arm:native:no-sidecar"),
      expectedToolCalls: 0,
      expectedPromptTokens: 0,
      expectedAddedLatencyMs: 0,
    },
    sham: {
      stateMode: "irrelevant_sham",
      interventionHash: digest("arm:sham"),
      implementationRevision: digest("arm:sham:implementation"),
      sidecarShapeHash: sharedSidecar,
      expectedToolCalls: 1,
      expectedPromptTokens: 128,
      expectedAddedLatencyMs: 25,
    },
    substrate: {
      stateMode: "pm_substrate",
      interventionHash: digest("arm:substrate"),
      implementationRevision: digest("arm:substrate:implementation"),
      sidecarShapeHash: sharedSidecar,
      expectedToolCalls: 1,
      expectedPromptTokens: 128,
      expectedAddedLatencyMs: 25,
    },
  };
}

function receiptAuthority(verifier: {
  readonly verifierId: string;
  readonly sourceRevision: string;
  readonly ownerIdentity: string;
}) {
  return {
    verifierId: verifier.verifierId,
    sourceRevision: verifier.sourceRevision,
    ownerIdentity: verifier.ownerIdentity,
  };
}
