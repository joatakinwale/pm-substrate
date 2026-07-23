import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { PUBLIC_EVAL_VERIFICATION_KINDS } from "@pm/public-eval-analysis";
import { describe, expect, it } from "vitest";

import {
  createStateBenchDecisionManifestBridge,
  type StateBenchDecisionManifestInput,
} from "./decision-manifest.js";
import { stateBenchLearningAdapter } from "./index.js";
import {
  createStateBenchQualificationPlanning,
  type StateBenchQualificationDomain,
  type StateBenchQualificationPlanInput,
} from "./qualification-plan.js";

const PINNED_CHECKOUT = process.env["PM_STATE_BENCH_CHECKOUT"];
const integrationIt = PINNED_CHECKOUT === undefined ? it.skip : it;

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("fixture is not canonical JSON");
  return encoded;
}

function digest(label: string): string {
  return sha256(label);
}

const planning = createStateBenchQualificationPlanning({
  manifest: {
    upstreamUrl: stateBenchLearningAdapter.manifest.upstreamUrl,
    upstreamRevision: stateBenchLearningAdapter.manifest.upstreamRevision,
    packageVersion: stateBenchLearningAdapter.manifest.packageVersion,
    officialProtocolId: stateBenchLearningAdapter.manifest.officialProtocolId,
    protocolFileSha256: stateBenchLearningAdapter.manifest.protocolFileSha256,
    splitVersion: stateBenchLearningAdapter.manifest.splitVersion,
  },
  domains: stateBenchLearningAdapter.manifest.domains,
  assertVerifiedCheckout(path: string) {
    const root = resolve(path);
    const result = stateBenchLearningAdapter.verifyCheckout(root);
    if (!result.valid) throw new Error(result.issues.join("; "));
    return root;
  },
  loadSplitManifest(root: string, domain: StateBenchQualificationDomain) {
    const value = JSON.parse(
      readFileSync(
        join(root, "state_bench", "domains", domain, "splits", "train_test.json"),
        "utf8",
      ),
    ) as { splits: { train: string[]; test: string[] } };
    return { train: [...value.splits.train].sort(), test: [...value.splits.test].sort() };
  },
  sha256,
  canonical,
});

const bridge = createStateBenchDecisionManifestBridge({
  loadQualificationPlan: planning.loadQualificationPlan,
  sha256,
  canonical,
});

function qualificationInput(): StateBenchQualificationPlanInput {
  const sidecarShapeHash = digest("equal-sidecar-shape");
  return {
    planId: "state_bench_qualification_001",
    experimentId: "state_bench_public_proof_001",
    producerIdentity: "joat_labs",
    frozenAt: "2026-07-14T01:00:00.000Z",
    selectionSeed: "qualification-selection",
    qualificationTasksPerDomain: 20,
    execution: {
      agentModel: {
        modelId: "qualification-model",
        modelDigest: digest("qualification-model"),
        reasoningLevel: "high",
      },
      components: {
        systemPromptHash: digest("qualification-system"),
        toolsHash: digest("qualification-tools"),
        simulatorHash: digest("qualification-simulator"),
        judgeHash: digest("qualification-judge"),
        decodingHash: digest("qualification-decoding"),
        runnerHash: digest("qualification-runner"),
        adapterHash: digest("qualification-adapter"),
      },
      arms: {
        native: {
          interventionHash: digest("qualification-native"),
          implementationRevision: digest("native-revision"),
          sidecarShapeHash: digest("native-shape"),
          expectedToolCalls: 0,
          expectedPromptTokens: 0,
          expectedAddedLatencyMs: 0,
        },
        sham: {
          interventionHash: digest("qualification-sham"),
          implementationRevision: digest("sham-revision"),
          sidecarShapeHash,
          expectedToolCalls: 1,
          expectedPromptTokens: 200,
          expectedAddedLatencyMs: 10,
        },
        substrate: {
          interventionHash: digest("qualification-substrate"),
          implementationRevision: digest("substrate-revision"),
          sidecarShapeHash,
          expectedToolCalls: 1,
          expectedPromptTokens: 200,
          expectedAddedLatencyMs: 10,
        },
      },
      repeatLabels: ["qualification-repeat-1"],
      armRandomizationSeed: "qualification-arm-order",
      policy: {
        maxTaskAttemptsPerCell: 1,
        maxProviderAttemptsPerCall: 1,
        failedCellsCountAsStrictFailure: true,
        replacementAttempts: "forbidden",
        stoppingRule: "complete_fixed_schedule_or_invalidate",
        outcomeInspection: "after_phase_complete",
        workers: 1,
        maximumTotalCostUsd: 1_000,
        maximumWallClockMs: 86_400_000,
      },
    },
  };
}

function decisionInput(): StateBenchDecisionManifestInput {
  const sidecarShapeHash = digest("decision-sidecar-shape");
  const sourceRevision = digest("verifier-source");
  return {
    frozenAt: "2026-07-14T02:00:00.000Z",
    harnessRevision: digest("harness-revision"),
    substrateRevision: digest("substrate-revision"),
    selectionSeed: "complete-official-test-universe",
    armRandomizationSeed: "decision-arm-order",
    confirmatoryModel: {
      modelId: "confirmatory-model-a",
      modelDigest: digest("confirmatory-model-a"),
      reasoningLevel: "high",
    },
    replicationModel: {
      modelId: "replication-model-b",
      modelDigest: digest("replication-model-b"),
      reasoningLevel: "high",
    },
    decisionComponents: {
      systemPromptHash: digest("decision-system"),
      toolsHash: digest("decision-tools"),
      simulatorHash: digest("decision-simulator"),
      judgeHash: digest("decision-judge"),
      decodingHash: digest("decision-decoding"),
      runnerHash: digest("explicit-test-split-no-retry-runner"),
    },
    decisionLearningArtifactSealHash: digest("decision-artifact-seal"),
    decisionLearningExtractionProvenanceReceiptHash: digest(
      "decision-extraction-provenance",
    ),
    arms: {
      native: {
        stateMode: "native",
        interventionHash: digest("decision-native"),
        implementationRevision: digest("native-revision"),
        sidecarShapeHash: digest("native-shape"),
        expectedToolCalls: 0,
        expectedPromptTokens: 0,
        expectedAddedLatencyMs: 0,
      },
      sham: {
        stateMode: "irrelevant_sham",
        interventionHash: digest("decision-sham"),
        implementationRevision: digest("sham-revision"),
        sidecarShapeHash,
        expectedToolCalls: 1,
        expectedPromptTokens: 200,
        expectedAddedLatencyMs: 10,
      },
      substrate: {
        stateMode: "pm_substrate",
        interventionHash: digest("decision-substrate"),
        implementationRevision: digest("substrate-revision"),
        sidecarShapeHash,
        expectedToolCalls: 1,
        expectedPromptTokens: 200,
        expectedAddedLatencyMs: 10,
      },
    },
    decisionVerification: Object.fromEntries(
      PUBLIC_EVAL_VERIFICATION_KINDS.map((kind) => [
        kind,
        { verifierId: `state_bench_${kind}`, sourceRevision },
      ]),
    ) as StateBenchDecisionManifestInput["decisionVerification"],
    bootstrapSeed: "state-bench-bootstrap",
    executionLimits: {
      maximumTotalCostUsd: 20_000,
      maximumWallClockMs: 604_800_000,
    },
  };
}

describe("STATE-Bench full-test decision manifest bridge", () => {
  integrationIt("bridges only the exact complete test set into confirmation and replication", () => {
    const qualification = planning.createQualificationPlan(
      PINNED_CHECKOUT!,
      qualificationInput(),
    );
    const result = bridge.createBridge(PINNED_CHECKOUT!, qualification, decisionInput());
    expect(result.protocolBinding.split).toBe("test");
    expect(result.protocolBinding.upstreamTaskSelection).toEqual({
      selectionMode: "exact_verified_test_task_id_per_cell",
      exactTaskOption: "--tasks",
      parserSplitSentinel: ["--split", "all"],
      parserSplitSentinelSemantics:
        "upstream_parser_compatibility_only_not_train_plus_test_dataset_selection",
      directSplitSelection:
        "forbidden_upstream_rejects_tasks_with_split_train_or_test",
      testInventoryAuthority:
        "verified_qualification_plan_test_inventory_exactly_50_tasks_per_domain",
    });
    expect(result.protocolBinding.executionPolicyHash).toBe(
      sha256(
        canonical({
          schemaVersion: "pm-state-bench-decision-execution-policy.v2",
          split: "test",
          upstreamTaskSelection: result.protocolBinding.upstreamTaskSelection,
          maxTaskAttemptsPerCell: 1,
          maxProviderAttemptsPerCall: 1,
          failedPlannedCells: "strict_failure_no_replacement",
          stoppingRule: "complete_fixed_schedule_or_invalidate",
          outcomeInspection: "after_phase_complete",
          workers: 1,
          maximumTotalCostUsd: 20_000,
          maximumWallClockMs: 604_800_000,
        }),
      ),
    );
    expect(result.protocolBinding.repeatSemantics).toMatch(/no_sampling_seed/u);
    expect(result.protocolBinding.taskClustersPerPhase).toBe(150);
    expect(result.protocolBinding.armTriplesPerPhase).toBe(750);
    expect(result.protocolBinding.finalTrajectorySlotsPerPhase).toBe(2250);
    expect(result.analysisManifest.taskPlan).toHaveLength(300);
    expect(
      result.analysisManifest.taskPlan.filter((task) => task.phase === "qualification"),
    ).toHaveLength(0);
    expect(result.analysisManifest.benchmark.eligibleUniverse.selectionCount).toBe(150);
    expect(result.analysisManifest.benchmark.eligibleUniverse.taskContentHashes).toHaveLength(150);
    expect(
      bridge.taskIdsFor(
        PINNED_CHECKOUT!,
        qualification,
        result,
        "confirmatory",
        "travel",
      ),
    ).toHaveLength(50);
    expect(bridge.verifyBridge(PINNED_CHECKOUT!, qualification, result)).toEqual({
      valid: true,
      issues: [],
    });
  });

  integrationIt("rejects any substituted held-out task, environment, or phase schedule", () => {
    const qualification = planning.createQualificationPlan(
      PINNED_CHECKOUT!,
      qualificationInput(),
    );
    const result = bridge.createBridge(PINNED_CHECKOUT!, qualification, decisionInput());
    const taskMutation = structuredClone(result);
    taskMutation.analysisManifest.taskPlan[0]!.benchmarkTaskContentHash = digest("substitute");
    expect(
      bridge.verifyBridge(PINNED_CHECKOUT!, qualification, taskMutation).issues.join(" "),
    ).toMatch(/does not recompute/u);
    const environmentMutation = structuredClone(result);
    environmentMutation.analysisManifest.taskPlan[0]!.initialEnvironmentSnapshotHash =
      digest("substitute-environment");
    expect(
      bridge.verifyBridge(PINNED_CHECKOUT!, qualification, environmentMutation).issues.join(" "),
    ).toMatch(/does not recompute/u);
    const repeatMutation = structuredClone(result);
    repeatMutation.analysisManifest.taskPlan[0]!.predeclaredSeeds = ["claimed-provider-seed"];
    expect(
      bridge.verifyBridge(PINNED_CHECKOUT!, qualification, repeatMutation).issues.join(" "),
    ).toMatch(/does not recompute/u);
  });

  integrationIt("rejects direct-split claims and changed parser sentinels", () => {
    const qualification = planning.createQualificationPlan(
      PINNED_CHECKOUT!,
      qualificationInput(),
    );
    const result = bridge.createBridge(PINNED_CHECKOUT!, qualification, decisionInput());
    const directSplit = structuredClone(result) as unknown as {
      protocolBinding: { upstreamTaskSelection: { selectionMode: string } };
    };
    directSplit.protocolBinding.upstreamTaskSelection.selectionMode = "direct_split_test";
    expect(
      bridge.verifyBridge(PINNED_CHECKOUT!, qualification, directSplit),
    ).toMatchObject({ valid: false });

    const changedSentinel = structuredClone(result) as unknown as {
      protocolBinding: { upstreamTaskSelection: { parserSplitSentinel: string[] } };
    };
    changedSentinel.protocolBinding.upstreamTaskSelection.parserSplitSentinel = [
      "--split",
      "test",
    ];
    expect(
      bridge.verifyBridge(PINNED_CHECKOUT!, qualification, changedSentinel),
    ).toMatchObject({ valid: false });
  });

  integrationIt("rejects same-model replication and pre-qualification freezing", () => {
    const qualification = planning.createQualificationPlan(
      PINNED_CHECKOUT!,
      qualificationInput(),
    );
    const sameModel = decisionInput();
    sameModel.replicationModel.modelId = sameModel.confirmatoryModel.modelId;
    expect(() => bridge.createBridge(PINNED_CHECKOUT!, qualification, sameModel)).toThrow(
      /distinct replication model/u,
    );
    const early = decisionInput();
    early.frozenAt = qualification.frozenAt;
    expect(() => bridge.createBridge(PINNED_CHECKOUT!, qualification, early)).toThrow(
      /after the technical qualification plan/u,
    );
  });

  integrationIt("binds both decision learning-evidence identities into the manifest", () => {
    const qualification = planning.createQualificationPlan(
      PINNED_CHECKOUT!,
      qualificationInput(),
    );
    const baseline = bridge.createBridge(
      PINNED_CHECKOUT!,
      qualification,
      decisionInput(),
    );
    const changedSealInput = structuredClone(decisionInput());
    changedSealInput.decisionLearningArtifactSealHash = digest(
      "different-decision-artifact-seal",
    );
    const changedSeal = bridge.createBridge(
      PINNED_CHECKOUT!,
      qualification,
      changedSealInput,
    );
    const changedProvenanceInput = structuredClone(decisionInput());
    changedProvenanceInput.decisionLearningExtractionProvenanceReceiptHash = digest(
      "different-decision-extraction-provenance",
    );
    const changedProvenance = bridge.createBridge(
      PINNED_CHECKOUT!,
      qualification,
      changedProvenanceInput,
    );

    for (const changed of [changedSeal, changedProvenance]) {
      expect(changed.analysisManifest.manifestHash).not.toBe(
        baseline.analysisManifest.manifestHash,
      );
      expect(changed.bridgeHash).not.toBe(baseline.bridgeHash);
      expect(changed.protocolBinding.expectedRuntimeClosureHash).not.toBe(
        baseline.protocolBinding.expectedRuntimeClosureHash,
      );
      expect(
        changed.analysisManifest.execution.nonModelConfigHashes.confirmatory,
      ).not.toBe(
        baseline.analysisManifest.execution.nonModelConfigHashes.confirmatory,
      );
    }
  });

  integrationIt("derives phase-bound configs and rejects caller-substituted identities", () => {
    const qualification = planning.createQualificationPlan(
      PINNED_CHECKOUT!,
      qualificationInput(),
    );
    const decision = bridge.createBridge(
      PINNED_CHECKOUT!,
      qualification,
      decisionInput(),
    );
    const qualificationConfig = stateBenchLearningAdapter.createBoundRunConfig(
      PINNED_CHECKOUT!,
      qualification,
      null,
      {
        phase: "qualification",
        arm: "native",
        domain: "travel",
        preregistrationReceiptHash: null,
        artifactSealHash: null,
        extractionProvenanceHash: null,
      },
    );
    expect(qualificationConfig.taskIds).toHaveLength(20);
    expect(qualificationConfig.split).toBe("train");
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        null,
        qualificationConfig,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(
      stateBenchLearningAdapter.preflightExecution(
        PINNED_CHECKOUT!,
        qualificationConfig,
        qualification,
        null,
        null,
        null,
        null,
      ),
    ).toMatchObject({
      valid: true,
      authorityStatus: "technical_qualification_ineligible",
    });
    const qualificationSidecarConfig =
      stateBenchLearningAdapter.createBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        null,
        {
          phase: "qualification",
          arm: "substrate",
          domain: "travel",
          preregistrationReceiptHash: null,
          artifactSealHash: digest("technical-qualification-artifact-seal"),
          extractionProvenanceHash: digest(
            "technical-qualification-extraction-provenance",
          ),
        },
      );
    expect(qualificationSidecarConfig.artifactSealHash).toBe(
      digest("technical-qualification-artifact-seal"),
    );
    expect(qualificationSidecarConfig.extractionProvenanceHash).toBe(
      digest("technical-qualification-extraction-provenance"),
    );
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        null,
        qualificationSidecarConfig,
      ),
    ).toEqual({ valid: true, issues: [] });

    const decisionConfig = stateBenchLearningAdapter.createBoundRunConfig(
      PINNED_CHECKOUT!,
      qualification,
      decision,
      {
        phase: "confirmatory",
        arm: "substrate",
        domain: "customer_support",
        preregistrationReceiptHash: digest("external-preregistration"),
      },
    );
    expect(decisionConfig.taskIds).toHaveLength(50);
    expect(decisionConfig.split).toBe("test");
    expect(decisionConfig.runLabels).toEqual(decision.protocolBinding.repeatLabels);
    expect(decisionConfig.agentModel.reasoningLevel).toBe("high");
    expect(decisionConfig.artifactSealHash).toBe(
      decision.decisionInput.decisionLearningArtifactSealHash,
    );
    expect(decisionConfig.extractionProvenanceHash).toBe(
      decision.decisionInput.decisionLearningExtractionProvenanceReceiptHash,
    );
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        decision,
        decisionConfig,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(
      stateBenchLearningAdapter.preflightExecution(
        PINNED_CHECKOUT!,
        decisionConfig,
        qualification,
        decision,
        null,
        null,
        null,
      ),
    ).toMatchObject({ valid: false, authorityStatus: "not_ready" });

    const alias = structuredClone(decisionConfig);
    alias.agentModel.modelId = "caller-reported-alias";
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        decision,
        alias,
      ).issues.join(" "),
    ).toMatch(/not exactly derived/u);
    const intervention = structuredClone(decisionConfig);
    intervention.armInterventionHash = digest("wrong-intervention");
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        decision,
        intervention,
      ).issues.join(" "),
    ).toMatch(/not exactly derived/u);
    const artifact = structuredClone(decisionConfig);
    artifact.artifactSealHash = digest("caller-substituted-artifact");
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        decision,
        artifact,
      ).issues.join(" "),
    ).toMatch(/not exactly derived/u);
    const provenance = structuredClone(decisionConfig);
    provenance.extractionProvenanceHash = digest("caller-substituted-provenance");
    expect(
      stateBenchLearningAdapter.verifyBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        decision,
        provenance,
      ).issues.join(" "),
    ).toMatch(/not exactly derived/u);
    expect(() =>
      stateBenchLearningAdapter.createBoundRunConfig(
        PINNED_CHECKOUT!,
        qualification,
        decision,
        {
          phase: "confirmatory",
          arm: "substrate",
          domain: "customer_support",
          preregistrationReceiptHash: digest("external-preregistration"),
          artifactSealHash: digest("caller-substituted-artifact"),
          extractionProvenanceHash: digest("caller-substituted-provenance"),
        } as never,
      ),
    ).toThrow(/derives learning artifact.*forbids caller-supplied/u);

    const nativeDecisionConfig = stateBenchLearningAdapter.createBoundRunConfig(
      PINNED_CHECKOUT!,
      qualification,
      decision,
      {
        phase: "replication",
        arm: "native",
        domain: "travel",
        preregistrationReceiptHash: digest("external-preregistration"),
      },
    );
    expect(nativeDecisionConfig.artifactSealHash).toBeNull();
    expect(nativeDecisionConfig.extractionProvenanceHash).toBeNull();
  });
});
