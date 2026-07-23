import { describe, expect, it } from "vitest";

import { stateRef } from "@pm/agent-state-core";
import type { TenantId } from "@pm/types";

import {
  buildProcedureAdmissionRecord,
  buildProcedureDefinition,
  buildProcedureRun,
  evaluateProcedureAdmission,
  ProcedureAdmissionRuntime,
  replayProcedureAdmissionHistory,
  type ProcedureAdmissionReplay,
  type ProcedureAdmissionRecord,
  type ProcedureAdmissionStore,
  type ProcedureDefinition,
  type ProcedureRunnerPort,
} from "./index.js";

const tenantId = "tenant_proc" as TenantId;
const scope = "pmgovernance/approval-gate";
const now = "2026-07-02T18:00:00.000Z";

const definition = buildProcedureDefinition({
  tenantId,
  procedureId: "proc_pi_harness_compile_mapping",
  version: 1,
  name: "Compile mapping with Pi Harness",
  authorityScope: scope,
  runnerKind: "pi_harness",
  inputContractHash: "sha256:input-contract",
  outputContractHash: "sha256:output-contract",
  allowedUse: ["mapping.compile", "adapter.generate"],
  createdAt: "2026-07-02T17:00:00.000Z",
});

const evidence = {
  ref: stateRef("source_record", "src_mapping_spec"),
  evidenceHash: "sha256:input-evidence",
  observedAt: "2026-07-02T17:50:00.000Z",
  validUntil: "2026-07-02T19:00:00.000Z",
};

const runnerEvidence = {
  ref: stateRef("event", "evt_pi_harness_runner"),
  evidenceHash: "sha256:runner-log",
  observedAt: "2026-07-02T17:55:00.000Z",
  validUntil: "2026-07-02T19:00:00.000Z",
};

const makeRun = (overrides = {}) =>
  buildProcedureRun({
    runId: "run_pi_harness_001",
    tenantId,
    procedureId: definition.procedureId,
    procedureVersion: definition.version,
    procedureDefinitionHash: definition.definitionHash,
    authorityScope: scope,
    runnerKind: "pi_harness",
    requestedBy: "agent:planner",
    startedAt: "2026-07-02T17:55:00.000Z",
    completedAt: "2026-07-02T17:56:00.000Z",
    status: "succeeded",
    inputHash: "sha256:input",
    outputHash: "sha256:output",
    inputEvidence: [evidence],
    outputEvidence: [
      {
        ref: stateRef("document", "doc_generated_tool"),
        evidenceHash: "sha256:output-evidence",
        observedAt: "2026-07-02T17:56:00.000Z",
        validUntil: "2026-07-02T19:00:00.000Z",
      },
    ],
    runnerEvidence: [runnerEvidence],
    ...overrides,
  });

const makeRecord = (
  overrides: Partial<ProcedureAdmissionRecord> = {},
): ProcedureAdmissionRecord =>
  buildProcedureAdmissionRecord({
    admissionId: "adm_proc_001",
    tenantId,
    authorityScope: scope,
    sequence: 1,
    admittedAt: now,
    admittedBy: "pm.stage-gate",
    decision: "admitted",
    run: makeRun(),
    ...overrides,
  });

class InMemoryProcedureAdmissionStore implements ProcedureAdmissionStore {
  readonly definitions = new Map<string, ProcedureDefinition>();
  readonly records: ProcedureAdmissionRecord[] = [];

  async putDefinition(definition: ProcedureDefinition): Promise<void> {
    this.definitions.set(this.key(definition), definition);
  }

  async getDefinition(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
  }): Promise<ProcedureDefinition | null> {
    return this.definitions.get(this.key(input)) ?? null;
  }

  async admit(input: {
    readonly definition: ProcedureDefinition;
    readonly record: ProcedureAdmissionRecord;
    readonly evaluatedAt: string;
  }): Promise<void> {
    const evaluation = evaluateProcedureAdmission(input);
    if (!evaluation.admissible) {
      throw new Error(
        `procedure admission failed: ${evaluation.issues.map((issue) => issue.code).join(",")}`,
      );
    }
    const replay = await this.replay({
      tenantId: input.record.tenantId,
      procedureId: input.definition.procedureId,
      version: input.definition.version,
      evaluatedAt: input.evaluatedAt,
    });
    if (
      input.record.sequence !== replay.replayedToSequence + 1 ||
      input.record.previousAdmissionHash !== replay.currentHeadHash
    ) {
      throw new Error("procedure admission record does not extend head");
    }
    this.records.push(input.record);
  }

  async replay(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
    readonly evaluatedAt: string;
  }): Promise<ProcedureAdmissionReplay> {
    const definition = await this.getDefinition(input);
    if (definition === null) throw new Error("definition not found");
    return replayProcedureAdmissionHistory({
      definition,
      records: this.records.filter(
        (record) =>
          record.tenantId === input.tenantId &&
          record.authorityScope === definition.authorityScope,
      ),
      evaluatedAt: input.evaluatedAt,
      tenantId: input.tenantId,
      authorityScope: definition.authorityScope,
    });
  }

  private key(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
  }): string {
    return `${input.tenantId}/${input.procedureId}/${input.version}`;
  }
}

describe("@pm/procedure-admission", () => {
  it("replays an admitted Pi Harness run into operational procedure state", () => {
    const record = makeRecord();
    const replay = replayProcedureAdmissionHistory({
      definition,
      records: [record],
      evaluatedAt: now,
      tenantId,
      authorityScope: scope,
    });

    expect(replay.valid).toBe(true);
    expect(replay.admittedRuns).toHaveLength(1);
    expect(replay.admittedRuns[0]?.runId).toBe("run_pi_harness_001");
    expect(replay.currentHeadHash).toBe(record.admissionHash);
  });

  it("rejects a successful run that omits its output hash", () => {
    const record = makeRecord({ run: makeRun({ outputHash: undefined }) });
    const evaluation = evaluateProcedureAdmission({
      definition,
      record,
      evaluatedAt: now,
    });

    expect(evaluation.admissible).toBe(false);
    expect(evaluation.issues.map((i) => i.code)).toContain(
      "missing_output_hash",
    );
  });

  it("does not admit failed runs as operational state", () => {
    const record = makeRecord({ run: makeRun({ status: "failed" }) });
    const replay = replayProcedureAdmissionHistory({
      definition,
      records: [record],
      evaluatedAt: now,
      tenantId,
      authorityScope: scope,
    });

    expect(replay.valid).toBe(false);
    expect(replay.admittedRuns).toHaveLength(0);
    expect(replay.rejectedRuns).toHaveLength(1);
    expect(replay.issues.map((i) => i.code)).toContain("run_not_successful");
  });

  it("rejects stale input evidence before it can authorize admission", () => {
    const record = makeRecord({
      run: makeRun({
        inputEvidence: [
          {
            ...evidence,
            validUntil: "2026-07-02T17:00:00.000Z",
          },
        ],
      }),
    });
    const evaluation = evaluateProcedureAdmission({
      definition,
      record,
      evaluatedAt: now,
    });

    expect(evaluation.admissible).toBe(false);
    expect(evaluation.issues.map((i) => i.code)).toContain(
      "stale_input_evidence",
    );
  });

  it("detects tampered runs by recomputing the run hash", () => {
    const run = makeRun();
    const record = makeRecord({
      run: { ...run, outputHash: "sha256:tampered-output" },
    });
    const evaluation = evaluateProcedureAdmission({
      definition,
      record,
      evaluatedAt: now,
    });

    expect(evaluation.admissible).toBe(false);
    expect(evaluation.issues.map((i) => i.code)).toContain("run_hash_mismatch");
  });

  it("rejects a run whose procedure id does not match the definition", () => {
    const record = makeRecord({
      run: makeRun({ procedureId: "proc_wrong_identity" }),
    });
    const evaluation = evaluateProcedureAdmission({
      definition,
      record,
      evaluatedAt: now,
    });

    expect(evaluation.admissible).toBe(false);
    expect(evaluation.issues.map((i) => i.code)).toContain(
      "procedure_id_mismatch",
    );
  });

  it("detects tampered admission records by recomputing the admission hash", () => {
    const record = makeRecord();
    const evaluation = evaluateProcedureAdmission({
      definition,
      record: { ...record, decision: "rejected" },
      evaluatedAt: now,
    });

    expect(evaluation.admissible).toBe(false);
    expect(evaluation.issues.map((i) => i.code)).toContain(
      "admission_hash_mismatch",
    );
  });

  it("detects replay chain gaps and previous-head mismatches", () => {
    const first = makeRecord();
    const second = buildProcedureAdmissionRecord({
      admissionId: "adm_proc_002",
      tenantId,
      authorityScope: scope,
      sequence: 3,
      previousAdmissionHash: "sha256:not-the-first-head",
      admittedAt: now,
      admittedBy: "pm.stage-gate",
      decision: "admitted",
      run: makeRun({ runId: "run_pi_harness_002" }),
    });

    const replay = replayProcedureAdmissionHistory({
      definition,
      records: [first, second],
      evaluatedAt: now,
      tenantId,
      authorityScope: scope,
    });

    expect(replay.valid).toBe(false);
    expect(replay.issues.map((i) => i.code)).toContain("sequence_gap");
    expect(replay.issues.map((i) => i.code)).toContain(
      "previous_hash_mismatch",
    );
  });

  it("keeps explicitly rejected runs out of operational state", () => {
    const record = makeRecord({ decision: "rejected" });
    const replay = replayProcedureAdmissionHistory({
      definition,
      records: [record],
      evaluatedAt: now,
      tenantId,
      authorityScope: scope,
    });

    expect(replay.valid).toBe(true);
    expect(replay.admittedRuns).toHaveLength(0);
    expect(replay.rejectedRuns).toHaveLength(1);
  });

  it("executes a Pi Harness runner through runtime admission and replays the admitted projection", async () => {
    const store = new InMemoryProcedureAdmissionStore();
    const runner: ProcedureRunnerPort = {
      runnerKind: "pi_harness",
      async run(invocation) {
        expect(invocation.definition.definitionHash).toBe(
          definition.definitionHash,
        );
        return {
          status: "succeeded",
          completedAt: "2026-07-02T17:56:00.000Z",
          outputHash: "sha256:runtime-output",
          outputEvidence: [
            {
              ref: stateRef("document", "doc_runtime_output"),
              evidenceHash: "sha256:runtime-output-evidence",
              observedAt: "2026-07-02T17:56:00.000Z",
              validUntil: "2026-07-02T19:00:00.000Z",
            },
          ],
          runnerEvidence: [runnerEvidence],
        };
      },
    };
    const runtime = new ProcedureAdmissionRuntime({
      store,
      runners: [runner],
      admittedBy: "procedure-admission.runtime-test",
    });

    await runtime.registerDefinition(definition);
    const result = await runtime.execute({
      tenantId,
      procedureId: definition.procedureId,
      version: definition.version,
      runId: "run_pi_harness_runtime_001",
      requestedBy: "agent:planner",
      inputHash: "sha256:runtime-input",
      inputEvidence: [evidence],
      startedAt: "2026-07-02T17:55:00.000Z",
      evaluatedAt: now,
    });

    expect(result.record.sequence).toBe(1);
    expect(result.replay.valid).toBe(true);
    expect(result.replay.admittedRuns.map((run) => run.runId)).toEqual([
      "run_pi_harness_runtime_001",
    ]);
    expect(store.records).toHaveLength(1);
  });

  it("keeps stale runner output from a runtime port out of operational state", async () => {
    const store = new InMemoryProcedureAdmissionStore();
    const runtime = new ProcedureAdmissionRuntime({
      store,
      runners: [
        {
          runnerKind: "pi_harness",
          async run() {
            return {
              status: "succeeded",
              completedAt: "2026-07-02T17:56:00.000Z",
              outputHash: "sha256:runtime-output",
              runnerEvidence: [
                {
                  ...runnerEvidence,
                  validUntil: "2026-07-02T17:59:00.000Z",
                },
              ],
            };
          },
        },
      ],
    });

    await runtime.registerDefinition(definition);
    await expect(
      runtime.execute({
        tenantId,
        procedureId: definition.procedureId,
        version: definition.version,
        runId: "run_pi_harness_runtime_stale",
        requestedBy: "agent:planner",
        inputHash: "sha256:runtime-input",
        inputEvidence: [evidence],
        startedAt: "2026-07-02T17:55:00.000Z",
        evaluatedAt: now,
      }),
    ).rejects.toThrow(/stale_runner_evidence/);
    expect(store.records).toHaveLength(0);
  });
});
