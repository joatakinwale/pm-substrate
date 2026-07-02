import { describe, expect, it } from "vitest";

import { stateRef } from "@pm/agent-state-core";
import {
  buildProcedureAdmissionRecord,
  buildProcedureDefinition,
  buildProcedureRun,
  replayProcedureAdmissionHistory,
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
});
