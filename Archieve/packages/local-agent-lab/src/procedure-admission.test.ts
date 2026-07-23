import { describe, expect, it } from "vitest";

import { stateRef } from "@pm/agent-state-core";
import {
  buildProcedureAdmissionRecord,
  buildProcedureDefinition,
  buildProcedureRun,
  evaluateProcedureAdmission,
  ProcedureAdmissionRuntime,
  replayProcedureAdmissionHistory,
  type ProcedureAdmissionRecord,
  type ProcedureAdmissionReplay,
  type ProcedureAdmissionStore,
  type ProcedureDefinition,
  type ProcedureRunnerPort,
} from "@pm/procedure-admission";
import type { TenantId } from "@pm/types";

import { pmGovernanceApprovalGateScenario } from "./scenarios/pm-governance-approval-gate.js";

const tenantId = "tenant_local_lab_proc" as TenantId;
const evaluatedAt = "2026-07-02T18:30:00.000Z";

const definition = buildProcedureDefinition({
  tenantId,
  procedureId: "proc_local_lab_pm_governance_pi_harness",
  version: 1,
  name: "Pi Harness PM-governance approval-gate check",
  authorityScope: `local-agent-lab/${pmGovernanceApprovalGateScenario.scenarioId}`,
  runnerKind: "pi_harness",
  inputContractHash: "sha256:pm-governance-approval-gate-input-contract",
  outputContractHash: "sha256:pm-governance-approval-gate-output-contract",
  allowedUse: ["pm.stage_gate.validate", "local_agent_lab.replay"],
  createdAt: "2026-07-02T18:00:00.000Z",
});

const buildRun = (runnerValidUntil = "2026-07-02T19:00:00.000Z") =>
  buildProcedureRun({
    runId: "run_local_lab_pm_governance_pi_harness_001",
    tenantId,
    procedureId: definition.procedureId,
    procedureVersion: definition.version,
    procedureDefinitionHash: definition.definitionHash,
    authorityScope: definition.authorityScope,
    runnerKind: "pi_harness",
    requestedBy: "agent:pm-governance-lab",
    startedAt: "2026-07-02T18:10:00.000Z",
    completedAt: "2026-07-02T18:11:00.000Z",
    status: "succeeded",
    inputHash: "sha256:approval-gate-input",
    outputHash: "sha256:approval-gate-output",
    inputEvidence: [
      {
        ref: stateRef(
          "document",
          `${pmGovernanceApprovalGateScenario.scenarioId}:prompt`,
        ),
        evidenceHash: "sha256:approval-gate-prompt",
        observedAt: "2026-07-02T18:09:00.000Z",
        validUntil: "2026-07-02T19:00:00.000Z",
      },
    ],
    outputEvidence: [
      {
        ref: stateRef(
          "action_outcome_envelope",
          `outcome_local_agent_lab_${pmGovernanceApprovalGateScenario.scenarioId}_substrate`,
        ),
        evidenceHash: "sha256:approval-gate-output-envelope",
        observedAt: "2026-07-02T18:11:00.000Z",
        validUntil: "2026-07-02T19:00:00.000Z",
      },
    ],
    runnerEvidence: [
      {
        ref: stateRef("event", "evt_pi_harness_pm_governance_run"),
        evidenceHash: "sha256:pi-harness-run-log",
        observedAt: "2026-07-02T18:11:00.000Z",
        validUntil: runnerValidUntil,
      },
    ],
  });

class LocalLabProcedureAdmissionStore implements ProcedureAdmissionStore {
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
        `local lab procedure admission failed: ${evaluation.issues.map((issue) => issue.code).join(",")}`,
      );
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

describe("local-agent-lab procedure admission", () => {
  it("admits a Pi Harness run for the PM-governance approval-gate only through replay", () => {
    const record = buildProcedureAdmissionRecord({
      admissionId: "adm_local_lab_pm_governance_pi_harness_001",
      tenantId,
      authorityScope: definition.authorityScope,
      sequence: 1,
      admittedAt: evaluatedAt,
      admittedBy: "local-agent-lab.procedure-admission",
      decision: "admitted",
      run: buildRun(),
    });

    const replay = replayProcedureAdmissionHistory({
      definition,
      records: [record],
      evaluatedAt,
      tenantId,
      authorityScope: definition.authorityScope,
    });

    expect(replay.valid).toBe(true);
    expect(replay.admittedRuns).toHaveLength(1);
    expect(replay.admittedRuns[0]?.authorityScope).toBe(
      `local-agent-lab/${pmGovernanceApprovalGateScenario.scenarioId}`,
    );
  });

  it("refuses stale Pi Harness runner evidence before it can support PM-governance state", () => {
    const record = buildProcedureAdmissionRecord({
      admissionId: "adm_local_lab_pm_governance_pi_harness_001",
      tenantId,
      authorityScope: definition.authorityScope,
      sequence: 1,
      admittedAt: evaluatedAt,
      admittedBy: "local-agent-lab.procedure-admission",
      decision: "admitted",
      run: buildRun("2026-07-02T18:00:00.000Z"),
    });

    const replay = replayProcedureAdmissionHistory({
      definition,
      records: [record],
      evaluatedAt,
      tenantId,
      authorityScope: definition.authorityScope,
    });

    expect(replay.valid).toBe(false);
    expect(replay.admittedRuns).toHaveLength(0);
    expect(replay.issues.map((issue) => issue.code)).toContain(
      "stale_runner_evidence",
    );
  });

  it("runs the PM-governance approval-gate through a Pi Harness runtime port before admission", async () => {
    const store = new LocalLabProcedureAdmissionStore();
    const runner: ProcedureRunnerPort = {
      runnerKind: "pi_harness",
      async run() {
        const run = buildRun();
        return {
          status: run.status,
          completedAt: run.completedAt,
          outputHash: run.outputHash,
          outputEvidence: run.outputEvidence,
          runnerEvidence: run.runnerEvidence,
        };
      },
    };
    const runtime = new ProcedureAdmissionRuntime({
      store,
      runners: [runner],
      admittedBy: "local-agent-lab.procedure-runtime",
    });

    await runtime.registerDefinition(definition);
    const result = await runtime.execute({
      tenantId,
      procedureId: definition.procedureId,
      version: definition.version,
      runId: "run_local_lab_pm_governance_pi_harness_runtime",
      requestedBy: "agent:pm-governance-lab",
      inputHash: "sha256:approval-gate-input",
      inputEvidence: [
        {
          ref: stateRef(
            "document",
            `${pmGovernanceApprovalGateScenario.scenarioId}:prompt`,
          ),
          evidenceHash: "sha256:approval-gate-prompt",
          observedAt: "2026-07-02T18:09:00.000Z",
          validUntil: "2026-07-02T19:00:00.000Z",
        },
      ],
      startedAt: "2026-07-02T18:10:00.000Z",
      evaluatedAt,
    });

    expect(result.record.decision).toBe("admitted");
    expect(result.replay.valid).toBe(true);
    expect(result.replay.admittedRuns.map((run) => run.runId)).toEqual([
      "run_local_lab_pm_governance_pi_harness_runtime",
    ]);
    expect(store.records).toHaveLength(1);
  });
});
