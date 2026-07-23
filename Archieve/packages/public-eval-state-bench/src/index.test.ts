import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  stateBenchLearningAdapter,
  type StateBenchLearningArtifact,
  type StateBenchRetrievalIdentity,
  type StateBenchRunConfig,
} from "./index.js";

const PINNED_CHECKOUT = process.env["PM_STATE_BENCH_CHECKOUT"];
const integrationIt = PINNED_CHECKOUT === undefined ? it.skip : it;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value as Readonly<Record<string, unknown>>)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new Error("fixture value is not JSON");
  return encoded;
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function artifact(): StateBenchLearningArtifact {
  return {
    schemaVersion: "pm-state-bench-learnings.v1",
    benchmarkRevision: stateBenchLearningAdapter.manifest.upstreamRevision,
    track: "agent_learning",
    sourceSplit: "train",
    corpusSha256: stateBenchLearningAdapter.manifest.trainCorpusSha256,
    entries: [
      {
        learningId: "learning_refund_policy_v2",
        text: "Verify the return reason and refund policy before issuing a refund.",
        domain: "customer_support",
        tags: ["return", "refund", "policy"],
        sourceTrajectories: [
          "datasets/train_task_trajectories/customer_support/4-return_promo_recalculation.json",
        ],
        observedAt: "2026-07-13T00:00:00.000Z",
        status: "active",
        supersedes: ["learning_refund_policy_v1"],
      },
      {
        learningId: "learning_refund_policy_v1",
        text: "Issue refunds immediately.",
        domain: "customer_support",
        tags: ["refund"],
        sourceTrajectories: [
          "datasets/train_task_trajectories/customer_support/4-return_promo_recalculation.json",
        ],
        observedAt: "2026-07-12T00:00:00.000Z",
        status: "superseded",
      },
      ...[1, 2, 3, 4, 5].map((index) => ({
        learningId: `learning_customer_irrelevant_${index}`,
        text: `Archived unrelated calendar coordination pattern number ${index}.`,
        domain: "customer_support" as const,
        tags: ["calendar", "archived", `unrelated-${index}`],
        sourceTrajectories: [
          "datasets/train_task_trajectories/customer_support/4-return_promo_recalculation.json",
        ],
        observedAt: "2026-07-13T00:00:00.000Z",
        status: "active" as const,
      })),
      {
        learningId: "learning_travel_contact",
        text: "Confirm the passenger identity before changing a reservation.",
        domain: "travel",
        tags: ["travel", "reservation"],
        sourceTrajectories: [
          "datasets/train_task_trajectories/travel/88-challenge_change_vs_cancel_cheaper_flight.json",
        ],
        observedAt: "2026-07-13T00:00:00.000Z",
        status: "active",
      },
    ],
  };
}

function identity(overrides: Partial<StateBenchRetrievalIdentity> = {}): StateBenchRetrievalIdentity {
  return {
    experimentId: "state-bench-proof",
    configSha256: "a".repeat(64),
    runId: "state-bench-proof:confirmatory:substrate:customer_support:run-index-1",
    taskId: "7-return_restocking_waived",
    domain: "customer_support",
    modelId: "agent-model",
    ...overrides,
  };
}

function runConfig(
  arm: "native" | "sham" | "substrate",
  sealHash: string | null = null,
  extractionProvenanceHash: string | null = null,
  exactTaskIds: readonly string[] = Array.from(
    { length: 50 },
    (_, index) => `fixture-task-${String(index + 1).padStart(3, "0")}`,
  ),
): StateBenchRunConfig {
  const sidecar = arm !== "native";
  const taskIds = [...exactTaskIds].sort();
  const runLabels = [
    "run-index-1",
    "run-index-2",
    "run-index-3",
    "run-index-4",
    "run-index-5",
  ];
  return {
    schemaVersion: "pm-state-bench-run-config.v3",
    experimentId: "state-bench-proof",
    phase: "confirmatory",
    qualificationPlanHash: null,
    analysisManifestHash: "1".repeat(64),
    preregistrationReceiptHash: "2".repeat(64),
    phasePartitionHash: "3".repeat(64),
    arm,
    armInterventionHash: sha256Json({ arm, intervention: "fixture" }),
    domain: "customer_support",
    agentModel: {
      modelId: "agent-model",
      modelDigest: "4".repeat(64),
      reasoningLevel: "high",
    },
    agentClass: sidecar ? "PmSubstrateAgent" : "StateBenchAgent",
    split: "test",
    numRuns: 5,
    taskIds,
    taskSetHash: sha256Json({
      schemaVersion: "pm-state-bench-task-set.v1",
      domain: "customer_support",
      split: "test",
      taskIds,
    }),
    taskInventoryRootHash: "5".repeat(64),
    runLabels,
    repeatScheduleHash: sha256Json({
      schemaVersion: "pm-state-bench-repeat-schedule.v1",
      repeatLabels: runLabels,
    }),
    attemptScheduleHash: "6".repeat(64),
    nonModelConfigHash: "7".repeat(64),
    executionPolicyHash: "8".repeat(64),
    runtimeClosureHash: "9".repeat(64),
    retryPolicy: { maxTaskAttempts: 1, maxProviderAttempts: 1 },
    retrieveLearningsTopK: sidecar ? 3 : null,
    artifactSealHash: sidecar ? (sealHash ?? "b".repeat(64)) : null,
    extractionProvenanceHash: sidecar
      ? (extractionProvenanceHash ?? "c".repeat(64))
      : null,
  };
}

function qualificationRunConfig(
  arm: "native" | "sham" | "substrate" = "native",
): StateBenchRunConfig {
  const base = runConfig(arm);
  const taskIds = ["fixture-train-task"];
  const runLabels = ["repeat-1"];
  return {
    ...base,
    phase: "qualification",
    qualificationPlanHash: "a".repeat(64),
    analysisManifestHash: null,
    preregistrationReceiptHash: null,
    split: "train",
    numRuns: 1,
    taskIds,
    taskSetHash: sha256Json({
      schemaVersion: "pm-state-bench-task-set.v1",
      domain: "customer_support",
      split: "train",
      taskIds,
    }),
    runLabels,
    repeatScheduleHash: sha256Json({
      schemaVersion: "pm-state-bench-repeat-schedule.v1",
      repeatLabels: runLabels,
    }),
    retryPolicy: { maxTaskAttempts: 3, maxProviderAttempts: 2 },
  };
}

function writeArtifact(directory: string, value: StateBenchLearningArtifact = artifact()): string {
  const path = join(directory, "learnings.json");
  writeFileSync(path, JSON.stringify(value));
  return path;
}

function writeOfficialNativeFixture(
  checkout: string,
): { resultsPath: string; configPath: string } {
  const directory = mkdtempSync(join(tmpdir(), "pm-state-bench-official-"));
  const resultsPath = join(directory, "results");
  const configPath = join(directory, "run-config.json");
  const split = JSON.parse(
    readFileSync(
      join(
        checkout,
        "state_bench/domains/customer_support/splits/train_test.json",
      ),
      "utf8",
    ),
  ) as { splits: { test: string[] } };
  const config = runConfig("native", null, null, split.splits.test);
  writeFileSync(configPath, JSON.stringify(config));
  const protocol = JSON.parse(
    readFileSync(
      join(checkout, "state_bench/configs/eval_protocols/gpt54.json"),
      "utf8",
    ),
  ) as {
    simulator: { prompt_hashes: Record<string, string> };
    judge: { prompt_hashes: Record<string, string> };
  };
  const judgePromptHashes = Object.fromEntries(
    Object.entries(protocol.judge.prompt_hashes)
      .filter(([key]) => key.startsWith("customer_support/"))
      .map(([key, value]) => [key.slice("customer_support/".length), value]),
  );
  for (let runIndex = 1; runIndex <= 5; runIndex += 1) {
    const runDirectory = join(resultsPath, `run${runIndex}`);
    mkdirSync(runDirectory, { recursive: true });
    for (const taskId of split.splits.test) {
      writeFileSync(
        join(runDirectory, `${taskId}.json`),
        JSON.stringify({
          task_id: taskId,
          user_id: "fixture-user",
          task_summary: "Verifier fixture only",
          conversation: [{ role: "user", content: "fixture" }],
          state_diff: { created: {}, modified: {}, deleted: {} },
          state_requirements_met: 1,
          task_requirements_met: 1,
          task_completion_pass: 1,
          evaluation_protocol_id: "state_bench_v0.8.0_gpt54",
          simulator_model: "gpt-5.4",
          simulator_prompt_hash:
            protocol.simulator.prompt_hashes[
              "customer_support/user_sim_base.md"
            ],
          agent_name: "StateBenchAgent",
          agent_model: { model_name: "agent-model", reasoning_level: "high" },
          scoring_protocol_id: "state_bench_v0.8.0_gpt54",
          judge_model: "gpt-5.4",
          judge_reasoning_effort: "high",
          judge_prompt_hashes: judgePromptHashes,
        }),
      );
    }
  }
  writeFileSync(
    join(resultsPath, "metrics.json"),
    JSON.stringify({
      benchmark_version: "0.8.0",
      evaluation_protocol_id: "state_bench_v0.8.0_gpt54",
      num_runs: 5,
      agent_model: { model_name: "agent-model", reasoning_level: "high" },
      metrics: {
        "task_completion_pass@1": 1,
        "task_completion_pass^5": 1,
      },
    }),
  );
  writeFileSync(
    join(resultsPath, "failures.json"),
    JSON.stringify({
      schemaVersion: "pm-state-bench-failures.v1",
      records: [],
    }),
  );
  return { resultsPath, configPath };
}

describe("stateBenchLearningAdapter", () => {
  it("routes substrate retrieval through the real core observation boundary", () => {
    const result = stateBenchLearningAdapter.retrieve(artifact(), {
      query: "Please handle a return refund under policy",
      topK: 3,
      arm: "substrate",
      requestedAt: "2026-07-13T01:00:00.000Z",
      identity: identity(),
    });

    expect(result.learnings[0]).toContain("Verify the return reason");
    expect(result.learnings).not.toContain("Issue refunds immediately.");
    expect(result.audit.mode).toBe("substrate_core_observation");
    expect(result.audit.observationBoundaryInvoked).toBe(true);
    expect(result.audit.observationContractValid).toBe(true);
    expect(result.audit.observationContractId).toBeTruthy();
    expect(result.audit.sourceLearningIds).toContain("learning_refund_policy_v2");
    expect(result.audit.sourceLearningIds).toHaveLength(3);
  });

  it("runs sham through the same core path over disjoint irrelevant train state", () => {
    const request = {
      query: "Please handle a return refund under policy",
      topK: 3 as const,
      requestedAt: "2026-07-13T01:00:00.000Z",
      identity: identity(),
    };
    const substrate = stateBenchLearningAdapter.retrieve(artifact(), {
      ...request,
      arm: "substrate",
    });
    const sham = stateBenchLearningAdapter.retrieve(artifact(), {
      ...request,
      arm: "sham",
    });

    expect(sham.audit.mode).toBe("irrelevant_train_state_core_observation");
    expect(sham.audit.observationBoundaryInvoked).toBe(true);
    expect(sham.audit.observationContractValid).toBe(true);
    expect(sham.audit.observationContractId).toBeTruthy();
    expect(sham.audit.sourceLearningIds).toHaveLength(3);
    expect(
      sham.audit.sourceLearningIds.some((id) => substrate.audit.sourceLearningIds.includes(id)),
    ).toBe(false);
    expect(sham.audit.measurement).toMatchObject({
      tokenUnit: "utf8_byte_token.v1",
      costUsd: 0,
    });
    expect(sham.audit.measurement.queryTokens).toBe(
      substrate.audit.measurement.queryTokens,
    );
    expect(sham.audit.measurement.outputTokens).toBeGreaterThan(0);
    expect(sham.audit.measurement.latencyMs).toBeGreaterThan(0);
    expect(sham.learnings).not.toEqual(substrate.learnings);
  });

  it("rejects traversal, cross-domain, held-out, and unknown artifact fields", () => {
    const directory = mkdtempSync(join(tmpdir(), "pm-state-bench-artifact-"));
    const base = artifact();
    const variants = [
      "datasets/train_task_trajectories/customer_support/../tasks/test.json",
      "datasets/train_task_trajectories/travel/88-challenge_change_vs_cancel_cheaper_flight.json",
      "state_bench/domains/customer_support/tasks/7-return_restocking_waived.json",
    ];
    for (const source of variants) {
      const path = writeArtifact(directory, {
        ...base,
        entries: [{ ...base.entries[0]!, sourceTrajectories: [source] }],
      });
      expect(() => stateBenchLearningAdapter.loadArtifact(path)).toThrow();
    }
    const path = join(directory, "unknown-field.json");
    writeFileSync(path, JSON.stringify({ ...base, taskOracle: "held-out" }));
    expect(() => stateBenchLearningAdapter.loadArtifact(path)).toThrow(
      /unsupported fields/u,
    );
  });

  integrationIt("recomputes and seals the exact pinned 300-file train corpus", () => {
    const checkout = PINNED_CHECKOUT!;
    expect(stateBenchLearningAdapter.verifyCheckout(checkout)).toEqual({
      valid: true,
      issues: [],
    });
    const directory = mkdtempSync(join(tmpdir(), "pm-state-bench-seal-"));
    const artifactPath = writeArtifact(directory);
    const seal = stateBenchLearningAdapter.createTrainArtifactSeal(
      checkout,
      artifactPath,
    );
    expect(seal.corpus.fileCount).toBe(300);
    expect(seal.corpus.treeSha256).toBe(
      stateBenchLearningAdapter.manifest.trainCorpusSha256,
    );
    expect(seal.citedSources).toHaveLength(2);
    expect(
      stateBenchLearningAdapter.verifyTrainArtifactSeal(
        checkout,
        artifactPath,
        seal,
      ),
    ).toEqual({ valid: true, issues: [] });

    const unverified = artifact();
    const leakedPath = writeArtifact(directory, {
      ...unverified,
      entries: [
        {
          ...unverified.entries[0]!,
          supersedes: [],
          sourceTrajectories: [
            "datasets/train_task_trajectories/customer_support/7-return_restocking_waived.json",
          ],
        },
      ],
    });
    expect(() =>
      stateBenchLearningAdapter.createTrainArtifactSeal(checkout, leakedPath),
    ).toThrow(/not a real pinned training trajectory/u);
  });

  it("predeclares exact extractor and procedure bytes with model-digest or deterministic identity", () => {
    const directory = mkdtempSync(join(tmpdir(), "pm-state-bench-pipeline-"));
    const extractorSourcePath = join(directory, "extractor.ts");
    const promptPath = join(directory, "prompt.md");
    const toolsPath = join(directory, "tools.json");
    const decodingPath = join(directory, "decoding.json");
    const pipelineManifestPath = join(directory, "pipeline.json");
    writeFileSync(extractorSourcePath, "export const extract = () => [];\n");
    writeFileSync(promptPath, "Extract only from the supplied train trajectory.\n");
    writeFileSync(toolsPath, JSON.stringify({ tools: [] }));
    writeFileSync(decodingPath, JSON.stringify({ temperature: 0 }));

    const manifest = stateBenchLearningAdapter.createExtractionPipelineManifest({
      manifestId: "state-bench-deterministic-v1",
      declaredAt: "2026-07-13T00:00:00.000Z",
      extractorKind: "deterministic",
      extractorSourceRevision: "git:0123456789abcdef",
      extractorSourcePath,
      deterministicExtractorId: "fixture-extractor-v1",
      promptPath,
      toolsPath,
      decodingPath,
    });
    writeFileSync(pipelineManifestPath, JSON.stringify(manifest));
    const pipelineFiles = {
      pipelineManifestPath,
      extractorSourcePath,
      promptPath,
      toolsPath,
      decodingPath,
    };
    expect(
      stateBenchLearningAdapter.verifyExtractionPipelineManifest(
        pipelineFiles,
        manifest,
      ),
    ).toEqual({ valid: true, issues: [] });
    expect(manifest.dataAccessPolicy).toEqual({
      allowedBenchmarkSourcePrefix: "datasets/train_task_trajectories/",
      additionalBenchmarkInputs: [],
      heldOutPaths: "forbidden",
      oraclePaths: "forbidden",
    });

    writeFileSync(promptPath, "mutated after declaration\n");
    expect(
      stateBenchLearningAdapter.verifyExtractionPipelineManifest(
        pipelineFiles,
        manifest,
      ).valid,
    ).toBe(false);
    expect(() =>
      stateBenchLearningAdapter.createExtractionPipelineManifest({
        manifestId: "state-bench-model-v1",
        declaredAt: "2026-07-13T00:00:00.000Z",
        extractorKind: "model",
        extractorSourceRevision: "git:0123456789abcdef",
        extractorSourcePath,
        modelId: "provider-model-v1",
        promptPath,
        toolsPath,
        decodingPath,
      }),
    ).toThrow(/modelDigest/u);
  });

  integrationIt("reopens per-entry raw records and seals byte/procedure provenance only", () => {
    const checkout = PINNED_CHECKOUT!;
    const directory = mkdtempSync(join(tmpdir(), "pm-state-bench-extraction-"));
    const artifactPath = writeArtifact(directory);
    const artifactSealPath = join(directory, "artifact.seal.json");
    writeFileSync(
      artifactSealPath,
      JSON.stringify(
        stateBenchLearningAdapter.createTrainArtifactSeal(checkout, artifactPath),
      ),
    );
    const extractorSourcePath = join(directory, "extractor.ts");
    const promptPath = join(directory, "prompt.md");
    const toolsPath = join(directory, "tools.json");
    const decodingPath = join(directory, "decoding.json");
    writeFileSync(extractorSourcePath, "export const extract = () => [];\n");
    writeFileSync(promptPath, "Only cited train bytes are inputs.\n");
    writeFileSync(toolsPath, JSON.stringify({ tools: [] }));
    writeFileSync(decodingPath, JSON.stringify({ temperature: 0 }));
    const pipelineManifestPath = join(directory, "pipeline.json");
    const manifest = stateBenchLearningAdapter.createExtractionPipelineManifest({
      manifestId: "state-bench-extraction-fixture-v1",
      declaredAt: "2026-07-13T00:00:00.000Z",
      extractorKind: "deterministic",
      extractorSourceRevision: "git:0123456789abcdef",
      extractorSourcePath,
      deterministicExtractorId: "fixture-extractor-v1",
      promptPath,
      toolsPath,
      decodingPath,
    });
    writeFileSync(pipelineManifestPath, JSON.stringify(manifest));
    const rawRecordsPath = join(directory, "records");
    mkdirSync(rawRecordsPath);
    for (const [index, entry] of artifact().entries.entries()) {
      const rawOutputPath = join(directory, `raw-${index + 1}.txt`);
      writeFileSync(rawOutputPath, `raw extraction output for ${entry.learningId}\n`);
      const record = stateBenchLearningAdapter.createRawExtractionRecord({
        checkoutPath: checkout,
        artifactPath,
        pipelineManifestPath,
        extractorSourcePath,
        promptPath,
        toolsPath,
        decodingPath,
        learningId: entry.learningId,
        sequence: index + 1,
        recordedAt: `2026-07-13T00:00:0${index + 1}.000Z`,
        rawOutputPath,
      });
      writeFileSync(
        join(
          rawRecordsPath,
          `${String(index + 1).padStart(4, "0")}-${entry.learningId}.json`,
        ),
        JSON.stringify(record),
      );
    }
    const input = {
      checkoutPath: checkout,
      artifactPath,
      artifactSealPath,
      pipelineManifestPath,
      extractorSourcePath,
      promptPath,
      toolsPath,
      decodingPath,
      rawRecordsPath,
    };
    const receipt =
      stateBenchLearningAdapter.createExtractionProvenanceReceipt(input);
    expect(receipt.evidenceClass).toBe(
      "training_extraction_byte_and_procedure_provenance",
    );
    expect(receipt.claimBoundary).toContain("not_semantic_truth");
    expect(receipt.rawRecords.fileCount).toBe(artifact().entries.length);
    expect(receipt.sourcePolicy.heldOutOrOraclePathsDeclared).toBe(false);
    expect(
      stateBenchLearningAdapter.verifyExtractionProvenanceReceipt(input, receipt),
    ).toEqual({ valid: true, issues: [] });

    const firstPath = join(
      rawRecordsPath,
      "0001-learning_refund_policy_v2.json",
    );
    const firstRecord = JSON.parse(readFileSync(firstPath, "utf8")) as {
      citedTrainBytes: { bytesBase64: string }[];
    };
    firstRecord.citedTrainBytes[0]!.bytesBase64 = Buffer.from("held-out substitute").toString(
      "base64",
    );
    writeFileSync(firstPath, JSON.stringify(firstRecord));
    expect(
      stateBenchLearningAdapter.verifyExtractionProvenanceReceipt(input, receipt).issues.join(
        " ",
      ),
    ).toMatch(/bytes do not match pinned train data/u);
  });

  it("makes native no-retrieval and sidecar treatment semantics structural in config", () => {
    expect(stateBenchLearningAdapter.parseRunConfig(runConfig("native"))).toEqual(
      runConfig("native"),
    );
    expect(stateBenchLearningAdapter.parseRunConfig(runConfig("sham"))).toEqual(
      runConfig("sham"),
    );
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("native"),
        agentClass: "PmSubstrateAgent",
        retrieveLearningsTopK: 3,
      }),
    ).toThrow(/requires agentClass StateBenchAgent/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("substrate"),
        artifactSealHash: null,
      }),
    ).toThrow(/artifactSealHash/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("substrate"),
        extractionProvenanceHash: null,
      }),
    ).toThrow(/extractionProvenanceHash/u);
    expect(() =>
      stateBenchLearningAdapter.assertRunArtifactCoverage(
        artifact(),
        runConfig("substrate"),
      ),
    ).not.toThrow();
  });

  it("makes phase partitions, manifests, task sets, repeats, and retries structural", () => {
    const qualification = qualificationRunConfig();
    expect(stateBenchLearningAdapter.parseRunConfig(qualification)).toEqual(
      qualification,
    );
    expect(stateBenchLearningAdapter.officialRunId(qualification, 1)).toBe(
      "state-bench-proof:qualification:native:customer_support:repeat-1",
    );
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("native"),
        schemaVersion: "pm-state-bench-run-config.v2",
      }),
    ).toThrow(/unsupported run config schemaVersion/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("native"),
        phase: "qualification",
        split: "train",
      }),
    ).toThrow(/qualification requires qualificationPlanHash/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...qualification,
        analysisManifestHash: "d".repeat(64),
      }),
    ).toThrow(/forbids decision manifest/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("native"),
        taskSetHash: "e".repeat(64),
      }),
    ).toThrow(/taskSetHash does not match/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...runConfig("native"),
        retryPolicy: { maxTaskAttempts: 2, maxProviderAttempts: 1 },
      }),
    ).toThrow(/retry policies must retain one task and provider attempt/u);
  });

  it("treats run labels as a hashed repeat schedule, not provider seeds", () => {
    const config = runConfig("native");
    expect(stateBenchLearningAdapter.officialRunId(config, 5)).toContain(
      ":confirmatory:native:customer_support:run-index-5",
    );
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...config,
        runLabels: [
          "run-index-2",
          "run-index-1",
          "run-index-3",
          "run-index-4",
          "run-index-5",
        ],
      }),
    ).toThrow(/ordered logical runLabels/u);
    expect(() =>
      stateBenchLearningAdapter.parseRunConfig({
        ...config,
        repeatScheduleHash: "f".repeat(64),
      }),
    ).toThrow(/ordered logical runLabels/u);
  });

  it("creates arm-bound hash-chained audit records without sham source leakage", () => {
    const config = runConfig("sham");
    const configHash = stateBenchLearningAdapter.runConfigSha256(config);
    const request = {
      query: "refund policy",
      topK: 3 as const,
      arm: "sham" as const,
      requestedAt: "2026-07-13T01:00:00.000Z",
      identity: identity({
        configSha256: configHash,
        runId: stateBenchLearningAdapter.officialRunId(config, 1),
      }),
    };
    const response = stateBenchLearningAdapter.retrieve(artifact(), request);
    const session = stateBenchLearningAdapter.createAuditSession(
      config,
      1,
      "2026-07-13T01:00:00.000Z",
    );
    const record = stateBenchLearningAdapter.createAuditRetrieval(
      session.recordHash,
      1,
      request,
      response,
      "2026-07-13T01:00:01.000Z",
    );
    expect(record.previousHash).toBe(session.recordHash);
    expect(record.mode).toBe("irrelevant_train_state_core_observation");
    expect(record.observationBoundaryInvoked).toBe(true);
    expect(record.sourceLearningIds).toHaveLength(3);
    expect(record.measurement.outputTokens).toBeGreaterThan(0);
    expect(() =>
      stateBenchLearningAdapter.createAuditRetrieval(
        session.recordHash,
        1,
        request,
        {
          ...response,
          audit: { ...response.audit, observationBoundaryInvoked: false },
        },
        "2026-07-13T01:00:01.000Z",
      ),
    ).toThrow(/treatment evidence/u);
  });

  it("requires the exact official metric identity, not a gpt54-looking suffix", () => {
    const valid = {
      benchmark_version: "0.8.0",
      evaluation_protocol_id: "state_bench_v0.8.0_gpt54",
      num_runs: 5,
      agent_model: { model_name: "agent-model", reasoning_level: "high" },
      metrics: {
        "task_completion_pass@1": 0.6,
        "task_completion_pass^5": 0.2,
      },
    };
    expect(stateBenchLearningAdapter.verifyOfficialMetrics(valid).valid).toBe(true);
    expect(
      stateBenchLearningAdapter.verifyOfficialMetrics({
        ...valid,
        benchmark_version: "9.9.9",
        evaluation_protocol_id: "lookalike_gpt54",
      }).issues,
    ).toEqual([
      "benchmark_version must equal 0.8.0",
      "evaluation_protocol_id must equal state_bench_v0.8.0_gpt54",
    ]);
  });

  integrationIt("classifies hand-authored perfect scores as conformance only", () => {
    const checkout = PINNED_CHECKOUT!;
    const fixture = writeOfficialNativeFixture(checkout);
    const input = {
      checkoutPath: checkout,
      resultsPath: fixture.resultsPath,
      configPath: fixture.configPath,
    };
    const receipt = stateBenchLearningAdapter.collectOutputConformanceReceipt(input);
    expect(receipt.evidenceClass).toBe(
      "official_output_shape_and_procedure_conformance_only",
    );
    expect(receipt.authorityStatus).toBe(
      "ineligible_for_efficacy_or_public_eval_attempt",
    );
    expect(receipt.eligibility.publicEvalAttemptEligible).toBe(false);
    expect(receipt.eligibility.missingVerifiedEvidence).toContain(
      "agent_provider_raw_response_receipts",
    );
    expect(receipt.eligibility.missingVerifiedEvidence).toContain(
      "provider_request_ids_usage_cost_latency_and_exact_bytes",
    );
    expect(receipt.identity.arm).toBe("native");
    expect(receipt.treatment.retrieval).toBe("none");
    expect(receipt.rawOutputs.fileCount).toBe(252);
    expect(receipt.identity.taskIds).toHaveLength(50);
    expect(receipt.identity.runIds).toHaveLength(5);
    expect(
      stateBenchLearningAdapter.verifyOutputConformanceReceipt(input, receipt),
    ).toEqual({ valid: true, issues: [] });
    expect(() =>
      stateBenchLearningAdapter.convertConformanceReceiptToPublicEvalAttemptArtifact(
        receipt,
      ),
    ).toThrow(/ineligible for PublicEvalAttemptArtifact conversion/u);

    const firstTask = receipt.identity.taskIds[0]!;
    const path = join(fixture.resultsPath, "run1", `${firstTask}.json`);
    const trajectory = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    trajectory["conversation"] = [
      {
        role: "assistant",
        tool_calls: [
          {
            name: "retrieve_learnings",
            arguments: { query: "leaked", top_k: 3 },
            result: { learnings: ["leaked"] },
          },
        ],
      },
    ];
    writeFileSync(path, JSON.stringify(trajectory));
    expect(() => stateBenchLearningAdapter.collectOutputConformanceReceipt(input)).toThrow(
      /native trajectory called retrieve_learnings/u,
    );
  });

  integrationIt("rejects hidden results and symbolic-link inventory substitution", () => {
    const checkout = PINNED_CHECKOUT!;
    const hidden = writeOfficialNativeFixture(checkout);
    writeFileSync(join(hidden.resultsPath, ".debug-output.json"), "{}");
    expect(() =>
      stateBenchLearningAdapter.collectOutputConformanceReceipt({
        checkoutPath: checkout,
        resultsPath: hidden.resultsPath,
        configPath: hidden.configPath,
      }),
    ).toThrow(/results root inventory/u);

    const selective = writeOfficialNativeFixture(checkout);
    mkdirSync(join(selective.resultsPath, "run6"));
    expect(() =>
      stateBenchLearningAdapter.collectOutputConformanceReceipt({
        checkoutPath: checkout,
        resultsPath: selective.resultsPath,
        configPath: selective.configPath,
      }),
    ).toThrow(/results root inventory/u);

    const linked = writeOfficialNativeFixture(checkout);
    const failuresPath = join(linked.resultsPath, "failures.json");
    const external = join(linked.resultsPath, "..", "external-failures.json");
    writeFileSync(external, JSON.stringify({ schemaVersion: "pm-state-bench-failures.v1", records: [] }));
    unlinkSync(failuresPath);
    symlinkSync(external, failuresPath);
    expect(() =>
      stateBenchLearningAdapter.collectOutputConformanceReceipt({
        checkoutPath: checkout,
        resultsPath: linked.resultsPath,
        configPath: linked.configPath,
      }),
    ).toThrow(/symbolic link/u);
  });
});
