import { createHash } from "node:crypto";
import {
  appendFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  toolSandboxVerticalSlice,
  type ToolSandboxArm,
  type ToolSandboxAttemptReceipt,
} from "./index.js";
import {
  assessToolSandboxPublicEvalAttemptEligibility,
  convertToolSandboxRawVerificationToPublicEvalAttemptArtifacts,
  verifyRawMatchedBatch,
  type ToolSandboxRawMatchedBatchVerificationInput,
  type ToolSandboxRawVerifierDependencies,
} from "./verify-matched.js";

const upstreamPass = JSON.parse(
  readFileSync(new URL("../fixtures/upstream-pass.json", import.meta.url), "utf8"),
) as unknown;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonicalStringify(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => compareCodeUnits(left, right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalStringify(entry)}`)
      .join(",")}}`;
  }
  throw new Error("fixture value is not JSON");
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(canonicalStringify(value)).digest("hex");
}

function hashBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function rehashVerification(value: Record<string, unknown>): void {
  const { verificationHash: _oldHash, ...body } = value;
  value["verificationHash"] = hashJson(body);
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function inventory(root: string, outputRoot: string): Array<{ path: string; sha256: string }> {
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  return files
    .sort()
    .map((path) => ({ path: relative(outputRoot, path), sha256: hashBytes(readFileSync(path)) }));
}

function armOrder(seed: string): ToolSandboxArm[] {
  return (["native", "sham", "substrate"] as const)
    .map((arm) => ({
      arm,
      key: hashJson({
        domain: "pm.public-eval.toolsandbox-arm-order.v1",
        seed,
        arm,
      }),
    }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.key, right.key) ||
        compareCodeUnits(left.arm, right.arm),
    )
    .map(({ arm }) => arm);
}

interface MutableAttempt {
  order: number;
  arm: ToolSandboxArm;
  attemptId: string;
  invocation: Record<string, unknown>;
  resultSummaryPath: string;
  metadataPath: string;
  boundaryTracePath: string | null;
  boundaryTraceSha256: string | null;
  providerSessionRestartCount: number;
  receiptPath: string;
  receipt: ToolSandboxAttemptReceipt;
  rawArtifacts: Array<{ path: string; sha256: string }>;
}

interface MutableBatch extends Record<string, unknown> {
  schemaVersion: "pm.public-eval.toolsandbox-matched-batch.v2";
  manifestHash: string;
  batchId: string;
  evaluationTrack: "restart_lost_response_derivative";
  headlineEligible: false;
  checkoutPath: string;
  corpusVerification: {
    revision: string;
    corpusHash: string;
    fileCount: number;
  };
  randomization: { seed: string; armOrder: ToolSandboxArm[] };
  execution: {
    agentModel: string;
    userSimulatorModel: string;
    toolBackend: "DEFAULT";
    seed: "42";
    maxTurns: 30;
  };
  attempts: MutableAttempt[];
  summary: unknown;
  batchHash: string;
}

interface Fixture {
  readonly root: string;
  readonly outputRoot: string;
  readonly checkoutPath: string;
  input: ToolSandboxRawMatchedBatchVerificationInput;
  batch: MutableBatch;
  readonly dependencies: ToolSandboxRawVerifierDependencies;
  rewriteBatch(): void;
  refreshRawInventory(): void;
  cleanup(): void;
}

function makeFixture(): Fixture {
  const root = mkdtempSync(resolve(tmpdir(), "toolsandbox-raw-verifier-"));
  const outputRoot = resolve(root, "output");
  const checkoutPath = resolve(root, "checkout");
  mkdirSync(outputRoot);
  mkdirSync(checkoutPath);
  const seed = "fixture-randomization-seed";
  const order = armOrder(seed);
  const execution = {
    agentModel: "FixtureAgent",
    userSimulatorModel: "FixtureUser",
    toolBackend: "DEFAULT",
    seed: "42",
    maxTurns: 30,
  } as const;
  const batchId = "fixture-batch-001";
  const runnerPath = resolve(
    new URL("../upstream/matched_runner.py", import.meta.url).pathname,
  );
  const receipts: ToolSandboxAttemptReceipt[] = [];
  const attempts: MutableAttempt[] = [];

  for (const [index, arm] of order.entries()) {
    const attemptId = `${batchId}-${arm}-001`;
    const armRoot = `${String(index + 1).padStart(2, "0")}-${arm}`;
    const armDirectory = resolve(outputRoot, armRoot);
    const trajectoryDirectory = resolve(
      armDirectory,
      "trajectories",
      toolSandboxVerticalSlice.manifest.benchmark.scenario,
    );
    mkdirSync(trajectoryDirectory, { recursive: true });
    const resultSummaryPath = resolve(armDirectory, "result_summary.json");
    const metadataPath = resolve(armDirectory, "arm-run-metadata.json");
    const stdoutPath = resolve(armDirectory, "runner.stdout.log");
    const stderrPath = resolve(armDirectory, "runner.stderr.log");
    const completedAt = `2026-07-13T18:00:0${index}.000Z`;
    const faultEvidence = {
      status: "trigger_not_reached" as const,
      reason: "fixture never reached the scheduled target side effect",
    };
    const internalOutcome = {
      admittedActionCount: 0,
      blockedActionCount: 0,
      haltedByInternalBlock: false,
      blockReasonCodes: [],
    };
    const metadata = {
      schemaVersion: "pm.public-eval.toolsandbox-arm-run.v2",
      arm,
      evaluationTrack: "restart_lost_response_derivative",
      attemptId,
      execution,
      completedAt,
      resultSummaryPath,
      boundaryTracePath: resolve(armDirectory, "boundary.jsonl"),
      internalOutcome,
      faultEvidence,
      providerSessionRestartCount: 0,
    };
    writeJson(resultSummaryPath, upstreamPass);
    writeJson(metadataPath, metadata);
    writeFileSync(
      stdoutPath,
      `fixture stdout\nPM_TOOL_SANDBOX_ARM_METADATA=${JSON.stringify(metadata)}\n`,
    );
    writeFileSync(stderrPath, "fixture stderr\n");
    writeJson(resolve(trajectoryDirectory, "execution_context.json"), {
      _dbs: {
        SANDBOX: [
          {
            sandbox_message_index: 0,
            sender: "SYSTEM",
            recipient: "AGENT",
            content: "fixture trajectory",
          },
        ],
        MESSAGING: [],
      },
    });
    writeFileSync(resolve(trajectoryDirectory, "pretty_print.txt"), "fixture trajectory\n");
    const receipt = toolSandboxVerticalSlice.createReceipt({
      batchId,
      attemptId,
      arm,
      evaluationTrack: "restart_lost_response_derivative",
      completedAt,
      execution,
      faultEvidence,
      internalOutcome,
      upstreamResultSummary: upstreamPass,
    });
    receipts.push(receipt);
    const receiptPath = resolve(armDirectory, `pm-receipt-${receipt.receiptHash}.json`);
    writeJson(receiptPath, receipt);
    attempts.push({
      order: index + 1,
      arm,
      attemptId,
      invocation: {
        executable: "/fixture/python",
        arguments: [runnerPath],
        cwd: checkoutPath,
        exitCode: 0,
        runnerSha256: toolSandboxVerticalSlice.manifest.localHarness.runnerSha256,
        stdoutPath: relative(outputRoot, stdoutPath),
        stdoutSha256: hashBytes(readFileSync(stdoutPath)),
        stderrPath: relative(outputRoot, stderrPath),
        stderrSha256: hashBytes(readFileSync(stderrPath)),
      },
      resultSummaryPath: relative(outputRoot, resultSummaryPath),
      metadataPath: relative(outputRoot, metadataPath),
      boundaryTracePath: null,
      boundaryTraceSha256: null,
      providerSessionRestartCount: 0,
      receiptPath: relative(outputRoot, receiptPath),
      receipt,
      rawArtifacts: inventory(armDirectory, outputRoot),
    });
  }

  const body = {
    schemaVersion: "pm.public-eval.toolsandbox-matched-batch.v2" as const,
    manifestHash: toolSandboxVerticalSlice.manifest.manifestHash,
    batchId,
    evaluationTrack: "restart_lost_response_derivative" as const,
    headlineEligible: false as const,
    checkoutPath,
    corpusVerification: {
      revision: toolSandboxVerticalSlice.manifest.benchmark.revision,
      corpusHash: toolSandboxVerticalSlice.manifest.benchmark.corpus.hash,
      fileCount: toolSandboxVerticalSlice.manifest.benchmark.corpus.files.length,
    },
    randomization: { seed, armOrder: order },
    execution,
    attempts,
    summary: toolSandboxVerticalSlice.verifyReceiptSet(receipts),
  };
  const batch: MutableBatch = { ...body, batchHash: hashJson(body) };
  let batchPath = resolve(outputRoot, `pm-matched-batch-${batch.batchHash}.json`);
  writeJson(batchPath, batch);
  const fixture: Fixture = {
    root,
    outputRoot,
    checkoutPath,
    input: { batchPath, outputRoot, checkoutPath },
    batch,
    dependencies: {
      verifyPinnedCleanCheckout: () => ({
        revision: toolSandboxVerticalSlice.manifest.benchmark.revision,
        corpusHash: toolSandboxVerticalSlice.manifest.benchmark.corpus.hash,
        fileCount: toolSandboxVerticalSlice.manifest.benchmark.corpus.files.length,
      }),
    },
    rewriteBatch() {
      rmSync(batchPath, { force: true });
      const { batchHash: _oldHash, ...nextBody } = batch;
      batch.batchHash = hashJson(nextBody);
      batchPath = resolve(outputRoot, `pm-matched-batch-${batch.batchHash}.json`);
      writeJson(batchPath, batch);
      fixture.input = { ...fixture.input, batchPath };
    },
    refreshRawInventory() {
      for (const attempt of batch.attempts) {
        const armDirectory = resolve(
          outputRoot,
          `${String(attempt.order).padStart(2, "0")}-${attempt.arm}`,
        );
        attempt.rawArtifacts = inventory(armDirectory, outputRoot);
        const stdout = attempt.rawArtifacts.find(
          (entry) => entry.path === attempt.invocation["stdoutPath"],
        );
        const stderr = attempt.rawArtifacts.find(
          (entry) => entry.path === attempt.invocation["stderrPath"],
        );
        attempt.invocation["stdoutSha256"] = stdout?.sha256;
        attempt.invocation["stderrSha256"] = stderr?.sha256;
        if (attempt.boundaryTracePath !== null) {
          attempt.boundaryTraceSha256 = attempt.rawArtifacts.find(
            (entry) => entry.path === attempt.boundaryTracePath,
          )?.sha256 ?? null;
        }
      }
    },
    cleanup() {
      rmSync(root, { recursive: true, force: true });
    },
  };
  return fixture;
}

function addValidBoundaryTrace(fixture: Fixture, arm: "sham" | "substrate"): void {
  const attempt = fixture.batch.attempts.find((candidate) => candidate.arm === arm);
  if (attempt === undefined) throw new Error(`fixture has no ${arm} attempt`);
  const armRoot = `${String(attempt.order).padStart(2, "0")}-${arm}`;
  const armDirectory = resolve(fixture.outputRoot, armRoot);
  const statePath = resolve(armDirectory, "boundary-state.json");
  const tracePath = resolve(armDirectory, "boundary.jsonl");
  const arguments_ = { name: "fixture contact" };
  const fingerprint = hashJson({ toolName: "search_contacts", arguments: arguments_ });
  const proposalId = `${attempt.attemptId}:proposal:1`;
  const toolCallId = "fixture-call-001";
  const irrelevantState = {
    paddingRef: `sham-padding:${attempt.attemptId}`,
    paddingValue: "state intentionally unrelated to the proposed tool action",
  };
  const initialStateBody = {
    schemaVersion: "pm.public-eval.toolsandbox-boundary-state.v1",
    arm,
    attemptId: attempt.attemptId,
    sequence: 0,
    irrelevantState,
    delivered: {},
    decisions: [],
    outcomes: [],
  };
  const decisionBody = {
    schemaVersion: "pm.public-eval.toolsandbox-tool-decision.v1",
    proposalId,
    arm,
    decision: "allow",
    responseForAgent: null,
    fingerprint,
    review: {
      valid: true,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "blocking",
        reason: "blocking_policy_passed",
        warningCount: 0,
      },
      warnings: [],
    },
    stateHashBefore: hashJson(initialStateBody),
  };
  const decision = { ...decisionBody, decisionHash: hashJson(decisionBody) };
  const decisionRecord = {
    proposalId,
    toolCallId,
    toolName: "search_contacts",
    fingerprint,
    decision: "allow" as const,
    decisionHash: decision.decisionHash,
  };
  const outcomeRequest = {
    schemaVersion: "pm.public-eval.toolsandbox-tool-outcome.v1",
    arm,
    attemptId: attempt.attemptId,
    statePath,
    proposalId,
    toolCallId,
    toolName: "search_contacts",
    arguments: arguments_,
    succeeded: true,
    responseHash: "1".repeat(64),
    observedAt: "2026-07-13T18:00:01.000Z",
  };
  const outcomeBody = {
    proposalId,
    toolCallId,
    toolName: "search_contacts",
    fingerprint,
    succeeded: true,
    responseHash: outcomeRequest.responseHash,
    observedAt: outcomeRequest.observedAt,
  };
  const outcomeHash = hashJson(outcomeBody);
  const finalStateBody = {
    schemaVersion: "pm.public-eval.toolsandbox-boundary-state.v1",
    arm,
    attemptId: attempt.attemptId,
    sequence: 2,
    irrelevantState,
    delivered: {},
    decisions: [decisionRecord],
    outcomes: [{ ...outcomeBody, outcomeHash }],
  };
  const outcomeResponse = {
    schemaVersion: "pm.public-eval.toolsandbox-tool-outcome-receipt.v1",
    proposalId,
    fingerprint,
    targetSideEffectReceiptHash: outcomeHash,
    stateHash: hashJson(finalStateBody),
  };
  const trace = [
    {
      command: "admit-tool",
      request: {
        schemaVersion: "pm.public-eval.toolsandbox-tool-proposal.v1",
        arm,
        evaluationTrack: fixture.batch.evaluationTrack,
        attemptId: attempt.attemptId,
        sessionId: "session-001",
        statePath,
        toolCallId,
        toolName: "search_contacts",
        arguments: arguments_,
        proposedAt: "2026-07-13T18:00:00.500Z",
      },
      response: decision,
    },
    {
      command: "record-tool-outcome",
      request: outcomeRequest,
      response: outcomeResponse,
    },
  ];
  writeFileSync(tracePath, `${trace.map((entry) => JSON.stringify(entry)).join("\n")}\n`);
  writeJson(statePath, {
    ...finalStateBody,
    stateHash: hashJson(finalStateBody),
  });

  const metadataPath = resolve(fixture.outputRoot, attempt.metadataPath);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
    completedAt: string;
    faultEvidence: { status: "trigger_not_reached"; reason: string };
    internalOutcome: {
      admittedActionCount: number;
      blockedActionCount: number;
      haltedByInternalBlock: boolean;
      blockReasonCodes: string[];
    };
  };
  metadata.internalOutcome.admittedActionCount = 1;
  writeJson(metadataPath, metadata);
  writeFileSync(
    resolve(fixture.outputRoot, attempt.invocation["stdoutPath"] as string),
    `fixture stdout\nPM_TOOL_SANDBOX_ARM_METADATA=${JSON.stringify(metadata)}\n`,
  );
  rmSync(resolve(fixture.outputRoot, attempt.receiptPath));
  const receipt = toolSandboxVerticalSlice.createReceipt({
    batchId: fixture.batch.batchId,
    attemptId: attempt.attemptId,
    arm,
    evaluationTrack: fixture.batch.evaluationTrack,
    completedAt: metadata.completedAt,
    execution: fixture.batch.execution,
    faultEvidence: metadata.faultEvidence,
    internalOutcome: metadata.internalOutcome,
    upstreamResultSummary: upstreamPass,
  });
  const receiptPath = resolve(armDirectory, `pm-receipt-${receipt.receiptHash}.json`);
  writeJson(receiptPath, receipt);
  attempt.receipt = receipt;
  attempt.receiptPath = relative(fixture.outputRoot, receiptPath);
  attempt.boundaryTracePath = relative(fixture.outputRoot, tracePath);
  fixture.batch.summary = toolSandboxVerticalSlice.verifyReceiptSet(
    fixture.batch.attempts.map((candidate) => candidate.receipt),
  );
  fixture.refreshRawInventory();
  fixture.rewriteBatch();
}

function replaceWithConsistentUnexpectedBlock(fixture: Fixture, arm: "sham" | "substrate"): void {
  const attempt = fixture.batch.attempts.find((candidate) => candidate.arm === arm)!;
  const tracePath = resolve(fixture.outputRoot, attempt.boundaryTracePath!);
  const first = JSON.parse(readFileSync(tracePath, "utf8").split("\n")[0]!) as {
    request: Record<string, unknown>;
    response: Record<string, unknown> & {
      review: { valid: boolean; execution: Record<string, unknown>; warnings: unknown[] };
    };
  };
  first.response.decision = "block";
  first.response.responseForAgent = "Fixture deliberately retained an unexpected block.";
  first.response.review.valid = false;
  first.response.review.execution.allowed = false;
  first.response.review.execution.blocking = true;
  first.response.review.execution.reason = "fixture_unexpected_block";
  first.response.review.warnings = [
    { code: "UNEXPECTED_BLOCK", message: "counterevidence must remain verifiable" },
  ];
  const { decisionHash: _oldHash, ...decisionBody } = first.response;
  first.response.decisionHash = hashJson(decisionBody);
  writeFileSync(tracePath, `${JSON.stringify(first)}\n`);

  const statePath = resolve(String(first.request.statePath));
  const previousState = JSON.parse(readFileSync(statePath, "utf8")) as Record<string, unknown>;
  const decision = {
    proposalId: first.response.proposalId,
    toolCallId: first.request.toolCallId,
    toolName: first.request.toolName,
    fingerprint: first.response.fingerprint,
    decision: "block",
    decisionHash: first.response.decisionHash,
  };
  const stateBody = {
    schemaVersion: previousState.schemaVersion,
    arm: previousState.arm,
    attemptId: previousState.attemptId,
    sequence: 1,
    irrelevantState: previousState.irrelevantState,
    delivered: {},
    decisions: [decision],
    outcomes: [],
  };
  writeJson(statePath, { ...stateBody, stateHash: hashJson(stateBody) });

  const metadataPath = resolve(fixture.outputRoot, attempt.metadataPath);
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
  metadata.internalOutcome = {
    admittedActionCount: 0,
    blockedActionCount: 1,
    haltedByInternalBlock: false,
    blockReasonCodes: ["UNEXPECTED_BLOCK"],
  };
  writeJson(metadataPath, metadata);
  writeFileSync(
    resolve(fixture.outputRoot, String(attempt.invocation["stdoutPath"])),
    `fixture stdout\nPM_TOOL_SANDBOX_ARM_METADATA=${JSON.stringify(metadata)}\n`,
  );
  rmSync(resolve(fixture.outputRoot, attempt.receiptPath));
  const receipt = toolSandboxVerticalSlice.createReceipt({
    batchId: fixture.batch.batchId,
    attemptId: attempt.attemptId,
    arm,
    evaluationTrack: fixture.batch.evaluationTrack,
    completedAt: String(metadata.completedAt),
    execution: fixture.batch.execution,
    faultEvidence: metadata.faultEvidence as ToolSandboxAttemptReceipt["faultEvidence"],
    internalOutcome: metadata.internalOutcome as ToolSandboxAttemptReceipt["internalOutcome"],
    upstreamResultSummary: upstreamPass,
  });
  const receiptPath = resolve(tracePath, `../pm-receipt-${receipt.receiptHash}.json`);
  writeJson(receiptPath, receipt);
  attempt.receipt = receipt;
  attempt.receiptPath = relative(fixture.outputRoot, receiptPath);
  fixture.batch.summary = toolSandboxVerticalSlice.verifyReceiptSet(
    fixture.batch.attempts.map((candidate) => candidate.receipt),
  );
  fixture.refreshRawInventory();
  fixture.rewriteBatch();
}

describe("raw matched-batch verifier", () => {
  it("reopens the raw tree but refuses to promote a perfect summary over a one-row trajectory", () => {
    const fixture = makeFixture();
    try {
      const trajectoryPath = fixture.batch.attempts[0]!.rawArtifacts.find((entry) =>
        entry.path.endsWith("execution_context.json"),
      )!.path;
      const trajectory = JSON.parse(
        readFileSync(resolve(fixture.outputRoot, trajectoryPath), "utf8"),
      ) as { _dbs: { SANDBOX: unknown[]; MESSAGING: unknown[] } };
      expect(trajectory._dbs.SANDBOX).toHaveLength(1);
      expect(trajectory._dbs.MESSAGING).toHaveLength(0);

      const verified = verifyRawMatchedBatch(fixture.input, fixture.dependencies);
      expect(verified.attempts.map((attempt) => attempt.arm).sort()).toEqual([
        "native",
        "sham",
        "substrate",
      ]);
      expect(verified.attempts.every((attempt) => attempt.faultStatus === "trigger_not_reached")).toBe(true);
      expect(verified.claimBoundary).toMatchObject({
        artifactIntegrityAndConformanceOnly: true,
        independentSigner: false,
        efficacyFinding: false,
      });
      expect(
        verified.attempts.every(
          (attempt) =>
            attempt.trajectoryStructureVerified &&
            !attempt.upstreamOracleRecomputedFromRawTrajectory,
        ),
      ).toBe(true);
      expect(verified.attempts.every((attempt) => attempt.reportedStrictTaskSuccess)).toBe(
        true,
      );
      expect(verified.executionBoundary).toEqual({
        substrateTreatment: "direct_agent_state_core_peripheral_adapter",
        invocationPath: "toolsandbox_python_runner_to_package_cli",
        realHttpMcpSidecarProtocolExercised: false,
        verifiedRealSidecarProtocolReceipt: false,
        restartSemantics: "provider_role_reinstantiation_in_same_python_process",
      });
      expect(verified.inventory.fileCount).toBe(22);
      expect(verified.verificationHash).toMatch(/^[a-f0-9]{64}$/u);
    } finally {
      fixture.cleanup();
    }
  });

  it("fails closed instead of converting current raw verification into public-eval attempts", () => {
    const fixture = makeFixture();
    try {
      const verified = verifyRawMatchedBatch(fixture.input, fixture.dependencies);
      const eligibility = assessToolSandboxPublicEvalAttemptEligibility(verified);
      expect(eligibility.publicEvalAttemptArtifactEligible).toBe(false);
      expect(eligibility.source).toMatchObject({
        rawVerificationSchema: "pm.public-eval.toolsandbox-raw-verification.v2",
        rawVerificationHash: verified.verificationHash,
        verifierV2TrajectoryStructureContentResolved: true,
      });
      expect(eligibility.executionBoundary).toEqual(verified.executionBoundary);
      expect(eligibility.missingContentResolvedEvidence).toEqual([
        "provider_raw_request_bytes",
        "provider_raw_response_bytes",
        "provider_request_ids",
        "provider_usage_tokens",
        "provider_cost_usd",
        "provider_latency_ms",
        "exact_benchmark_task_bytes",
        "exact_benchmark_oracle_bytes",
        "upstream_oracle_recomputation_from_raw_trajectory",
        "verified_real_http_or_mcp_sidecar_protocol_receipt",
        "independent_verifier_signature_and_external_trust_anchor",
      ]);
      expect(() =>
        convertToolSandboxRawVerificationToPublicEvalAttemptArtifacts(verified),
      ).toThrow(/ineligible for PublicEvalAttemptArtifact conversion/u);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects caller-authored provider evidence and forged sidecar claims", () => {
    const fixture = makeFixture();
    try {
      const verified = verifyRawMatchedBatch(fixture.input, fixture.dependencies);
      const injected = structuredClone(verified) as unknown as Record<string, unknown>;
      injected["providerEvidence"] = {
        requestId: "caller-authored",
        usage: { totalTokens: 1 },
        costUsd: 0,
        latencyMs: 1,
      };
      rehashVerification(injected);
      expect(() =>
        assessToolSandboxPublicEvalAttemptEligibility(injected),
      ).toThrow(/missing or unexpected fields/u);

      const forged = structuredClone(verified) as unknown as Record<string, unknown>;
      const boundary = forged["executionBoundary"] as Record<string, unknown>;
      boundary["realHttpMcpSidecarProtocolExercised"] = true;
      boundary["verifiedRealSidecarProtocolReceipt"] = true;
      rehashVerification(forged);
      expect(() =>
        assessToolSandboxPublicEvalAttemptEligibility(forged),
      ).toThrow(/direct core peripheral adapter/u);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects detached self-hashed v3 summaries before eligibility assessment", () => {
    const forgedBody = {
      schemaVersion: "pm.public-eval.toolsandbox-raw-verification.v3",
      verifier: {
        id: "@pm/public-eval-toolsandbox:raw-matched-batch-verifier",
        revision: "v3",
        mode: "independent_recomputation_from_raw_artifacts",
      },
      attempts: [],
      executionBoundary: {
        realHttpMcpSidecarProtocolExercised: true,
        actualOsProcessRestartObserved: true,
      },
    };
    const forged = {
      ...forgedBody,
      verificationHash: hashJson(forgedBody),
    };
    expect(() =>
      assessToolSandboxPublicEvalAttemptEligibility(forged),
    ).toThrow(/detached raw-verification\.v3 summaries are diagnostic only/u);
  });

  it("rejects changed bytes plus missing or extra output-root inventory", () => {
    const changed = makeFixture();
    try {
      const target = resolve(
        changed.outputRoot,
        changed.batch.attempts[0]!.rawArtifacts.find((entry) =>
          entry.path.endsWith("pretty_print.txt"),
        )!.path,
      );
      appendFileSync(target, "changed after receipt\n");
      expect(() => verifyRawMatchedBatch(changed.input, changed.dependencies)).toThrow(
        /hash does not match bytes|bytes changed/,
      );
    } finally {
      changed.cleanup();
    }

    const extra = makeFixture();
    try {
      writeFileSync(resolve(extra.outputRoot, "unlisted.txt"), "extra");
      expect(() => verifyRawMatchedBatch(extra.input, extra.dependencies)).toThrow(
        /inventory mismatch/,
      );
    } finally {
      extra.cleanup();
    }

    const missing = makeFixture();
    try {
      const target = missing.batch.attempts[0]!.rawArtifacts.find((entry) =>
        entry.path.endsWith("runner.stderr.log"),
      )!;
      rmSync(resolve(missing.outputRoot, target.path));
      expect(() => verifyRawMatchedBatch(missing.input, missing.dependencies)).toThrow(
        /hash does not match bytes|missing/,
      );
    } finally {
      missing.cleanup();
    }
  });

  it("recomputes boundary trace/state hashes and rejects a semantically changed trace", () => {
    const fixture = makeFixture();
    try {
      addValidBoundaryTrace(fixture, "substrate");
      const verified = verifyRawMatchedBatch(fixture.input, fixture.dependencies);
      expect(
        verified.attempts.find((attempt) => attempt.arm === "substrate")
          ?.boundaryTraceEntryCount,
      ).toBe(2);

      const attempt = fixture.batch.attempts.find(
        (candidate) => candidate.arm === "substrate",
      )!;
      const tracePath = resolve(fixture.outputRoot, attempt.boundaryTracePath!);
      const lines = readFileSync(tracePath, "utf8").trim().split("\n");
      const first = JSON.parse(lines[0]!) as { response: { decision: string } };
      first.response.decision = "block";
      lines[0] = JSON.stringify(first);
      writeFileSync(tracePath, `${lines.join("\n")}\n`);
      fixture.refreshRawInventory();
      fixture.rewriteBatch();
      expect(() => verifyRawMatchedBatch(fixture.input, fixture.dependencies)).toThrow(
        /boundary decision does not replay|boundary review contradicts replayed decision|boundary decision hash does not recompute/,
      );
    } finally {
      fixture.cleanup();
    }

    const selfConsistentForgery = makeFixture();
    try {
      addValidBoundaryTrace(selfConsistentForgery, "substrate");
      const attempt = selfConsistentForgery.batch.attempts.find(
        (candidate) => candidate.arm === "substrate",
      )!;
      const tracePath = resolve(
        selfConsistentForgery.outputRoot,
        attempt.boundaryTracePath!,
      );
      const entries = readFileSync(tracePath, "utf8")
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line) as Record<string, unknown>);
      const first = entries[0] as {
        response: Record<string, unknown> & { decisionHash: string; stateHashBefore: string };
      };
      first.response.stateHashBefore = "f".repeat(64);
      const { decisionHash: _oldDecisionHash, ...forgedDecisionBody } = first.response;
      first.response.decisionHash = hashJson(forgedDecisionBody);

      const statePath = resolve(
        selfConsistentForgery.outputRoot,
        `${String(attempt.order).padStart(2, "0")}-substrate/boundary-state.json`,
      );
      const state = JSON.parse(readFileSync(statePath, "utf8")) as {
        decisions: Array<{ decisionHash: string }>;
        stateHash: string;
        [key: string]: unknown;
      };
      state.decisions[0]!.decisionHash = first.response.decisionHash;
      const { stateHash: _oldStateHash, ...forgedStateBody } = state;
      state.stateHash = hashJson(forgedStateBody);
      const second = entries[1] as {
        response: Record<string, unknown> & { stateHash: string };
      };
      second.response.stateHash = state.stateHash;
      writeJson(statePath, state);
      writeFileSync(
        tracePath,
        `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\n`,
      );
      selfConsistentForgery.refreshRawInventory();
      selfConsistentForgery.rewriteBatch();
      expect(() =>
        verifyRawMatchedBatch(
          selfConsistentForgery.input,
          selfConsistentForgery.dependencies,
        ),
      ).toThrow(/does not replay from prior state/);
    } finally {
      selfConsistentForgery.cleanup();
    }
  });

  it("retains a self-consistent unexpected sham block as counterevidence", () => {
    const fixture = makeFixture();
    try {
      addValidBoundaryTrace(fixture, "sham");
      replaceWithConsistentUnexpectedBlock(fixture, "sham");
      const verified = verifyRawMatchedBatch(fixture.input, fixture.dependencies);
      const sham = verified.attempts.find((attempt) => attempt.arm === "sham");
      expect(fixture.batch.attempts.find((attempt) => attempt.arm === "sham")?.receipt.internalOutcome).toEqual({
        admittedActionCount: 0,
        blockedActionCount: 1,
        haltedByInternalBlock: false,
        blockReasonCodes: ["UNEXPECTED_BLOCK"],
      });
      expect(sham?.boundaryTraceEntryCount).toBe(1);
    } finally {
      fixture.cleanup();
    }
  });

  it("rejects path escapes and arbitrary embedded receipts even when the batch hash is recomputed", () => {
    const escaped = makeFixture();
    try {
      escaped.batch.attempts[0]!.rawArtifacts[0]!.path = "../outside.json";
      escaped.rewriteBatch();
      expect(() => verifyRawMatchedBatch(escaped.input, escaped.dependencies)).toThrow(
        /without escapes|escapes its matched arm/,
      );
    } finally {
      escaped.cleanup();
    }

    const invented = makeFixture();
    try {
      const mutableReceipt = structuredClone(invented.batch.attempts[0]!.receipt);
      const receipt = mutableReceipt as unknown as {
        oracleOutcome: { score: number };
      };
      receipt.oracleOutcome.score = 0.125;
      invented.batch.attempts[0]!.receipt = mutableReceipt;
      invented.rewriteBatch();
      expect(() => verifyRawMatchedBatch(invented.input, invented.dependencies)).toThrow(
        /arbitrary embedded receipt/,
      );
    } finally {
      invented.cleanup();
    }
  });

  it("rejects raw arm/config mismatch and a fault claimed only by an embedded receipt", () => {
    const mismatched = makeFixture();
    try {
      const attempt = mismatched.batch.attempts[0]!;
      const metadataPath = resolve(mismatched.outputRoot, attempt.metadataPath);
      const metadata = JSON.parse(readFileSync(metadataPath, "utf8")) as {
        execution: { agentModel: string };
      };
      metadata.execution.agentModel = "DifferentAgent";
      writeJson(metadataPath, metadata);
      const stdoutPath = resolve(
        mismatched.outputRoot,
        attempt.invocation["stdoutPath"] as string,
      );
      writeFileSync(
        stdoutPath,
        `fixture stdout\nPM_TOOL_SANDBOX_ARM_METADATA=${JSON.stringify(metadata)}\n`,
      );
      mismatched.refreshRawInventory();
      mismatched.rewriteBatch();
      expect(() => verifyRawMatchedBatch(mismatched.input, mismatched.dependencies)).toThrow(
        /arm\/config mismatch/,
      );
    } finally {
      mismatched.cleanup();
    }

    const inventedFault = makeFixture();
    try {
      const attempt = inventedFault.batch.attempts[0]!;
      attempt.receipt = toolSandboxVerticalSlice.createReceipt({
        batchId: inventedFault.batch.batchId,
        attemptId: attempt.attemptId,
        arm: attempt.arm,
        evaluationTrack: "restart_lost_response_derivative",
        completedAt: "2026-07-13T18:00:00.000Z",
        execution: inventedFault.batch.execution,
        faultEvidence: {
          status: "applied",
          targetCallId: "invented-call",
          targetSideEffectReceiptHash: "a".repeat(64),
          restartedAgentSessionId: "session-002",
          appliedAtTurn: 10,
        },
        internalOutcome: {
          admittedActionCount: 0,
          blockedActionCount: 0,
          haltedByInternalBlock: false,
          blockReasonCodes: [],
        },
        upstreamResultSummary: upstreamPass,
      });
      inventedFault.rewriteBatch();
      expect(() => verifyRawMatchedBatch(inventedFault.input, inventedFault.dependencies)).toThrow(
        /claims a fault not supported by raw metadata/,
      );
    } finally {
      inventedFault.cleanup();
    }
  });

  it("rejects corpus/checkpoint substitution before accepting raw artifacts", () => {
    const fixture = makeFixture();
    try {
      fixture.batch.corpusVerification.corpusHash = "f".repeat(64);
      fixture.rewriteBatch();
      expect(() => verifyRawMatchedBatch(fixture.input, fixture.dependencies)).toThrow(
        /corpus binding/,
      );
    } finally {
      fixture.cleanup();
    }
  });
});
