import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { stateRef } from "@pm/agent-state-core";
import type { TenantId } from "@pm/types";

import {
  buildProcedureAdmissionRecord,
  buildProcedureDefinition,
  buildProcedureRun,
  PostgresProcedureAdmissionStore,
  ProcedureAdmissionStoreError,
} from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("PostgresProcedureAdmissionStore", () => {
  let pool: pg.Pool;
  let store: PostgresProcedureAdmissionStore;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    store = new PostgresProcedureAdmissionStore(pool);
    tenantId = `tnt_proc_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM procedure_admission.admission_records WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(
      `DELETE FROM procedure_admission.definitions WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  const makeDefinition = () =>
    buildProcedureDefinition({
      tenantId,
      procedureId: "proc_pg_pi_harness",
      version: 1,
      name: "Postgres Pi Harness admission",
      authorityScope: "pmgovernance/postgres-procedure-admission",
      runnerKind: "pi_harness",
      inputContractHash: "sha256:pg-input-contract",
      outputContractHash: "sha256:pg-output-contract",
      allowedUse: ["pm.stage_gate.validate"],
      createdAt: "2026-07-02T20:00:00.000Z",
    });

  const makeRun = (
    definition = makeDefinition(),
    overrides: Record<string, unknown> = {},
  ) =>
    buildProcedureRun({
      runId: "run_pg_pi_harness_001",
      tenantId,
      procedureId: definition.procedureId,
      procedureVersion: definition.version,
      procedureDefinitionHash: definition.definitionHash,
      authorityScope: definition.authorityScope,
      runnerKind: definition.runnerKind,
      requestedBy: "agent:postgres-test",
      startedAt: "2026-07-02T20:01:00.000Z",
      completedAt: "2026-07-02T20:02:00.000Z",
      status: "succeeded",
      inputHash: "sha256:pg-input",
      outputHash: "sha256:pg-output",
      inputEvidence: [
        {
          ref: stateRef("document", "doc_pg_input"),
          evidenceHash: "sha256:pg-input-evidence",
          observedAt: "2026-07-02T20:01:00.000Z",
          validUntil: "2026-07-02T21:00:00.000Z",
        },
      ],
      outputEvidence: [
        {
          ref: stateRef("document", "doc_pg_output"),
          evidenceHash: "sha256:pg-output-evidence",
          observedAt: "2026-07-02T20:02:00.000Z",
          validUntil: "2026-07-02T21:00:00.000Z",
        },
      ],
      runnerEvidence: [
        {
          ref: stateRef("event", "evt_pg_runner"),
          evidenceHash: "sha256:pg-runner-evidence",
          observedAt: "2026-07-02T20:02:00.000Z",
          validUntil: "2026-07-02T21:00:00.000Z",
        },
      ],
      ...overrides,
    });

  it("stores a definition, admits a run, and replays current operational procedure state", async () => {
    const definition = makeDefinition();
    await store.putDefinition(definition);
    const stored = await store.getDefinition({
      tenantId,
      procedureId: definition.procedureId,
      version: definition.version,
    });
    expect(stored?.definitionHash).toBe(definition.definitionHash);

    const record = buildProcedureAdmissionRecord({
      admissionId: "adm_pg_pi_harness_001",
      tenantId,
      authorityScope: definition.authorityScope,
      sequence: 1,
      admittedAt: "2026-07-02T20:03:00.000Z",
      admittedBy: "procedure-admission.postgres-test",
      decision: "admitted",
      run: makeRun(definition),
    });
    await store.admit({
      definition,
      record,
      evaluatedAt: "2026-07-02T20:03:00.000Z",
    });

    const replay = await store.replay({
      tenantId,
      procedureId: definition.procedureId,
      version: definition.version,
      evaluatedAt: "2026-07-02T20:03:00.000Z",
    });
    expect(replay.valid).toBe(true);
    expect(replay.admittedRuns.map((run) => run.runId)).toEqual([
      "run_pg_pi_harness_001",
    ]);
    expect(replay.currentHeadHash).toBe(record.admissionHash);
  });

  it("refuses stale runner evidence before durable admission", async () => {
    const definition = makeDefinition();
    await store.putDefinition(definition);
    const staleRecord = buildProcedureAdmissionRecord({
      admissionId: "adm_pg_pi_harness_stale",
      tenantId,
      authorityScope: definition.authorityScope,
      sequence: 2,
      previousAdmissionHash: (
        await store.replay({
          tenantId,
          procedureId: definition.procedureId,
          version: definition.version,
          evaluatedAt: "2026-07-02T20:03:00.000Z",
        })
      ).currentHeadHash,
      admittedAt: "2026-07-02T20:04:00.000Z",
      admittedBy: "procedure-admission.postgres-test",
      decision: "admitted",
      run: makeRun(definition, {
        runId: "run_pg_pi_harness_stale",
        runnerEvidence: [
          {
            ref: stateRef("event", "evt_pg_runner_stale"),
            evidenceHash: "sha256:pg-runner-stale",
            observedAt: "2026-07-02T19:00:00.000Z",
            validUntil: "2026-07-02T19:30:00.000Z",
          },
        ],
      }),
    });

    await expect(
      store.admit({
        definition,
        record: staleRecord,
        evaluatedAt: "2026-07-02T20:04:00.000Z",
      }),
    ).rejects.toMatchObject({
      name: "ProcedureAdmissionStoreError",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "stale_runner_evidence" }),
      ]),
    });
  });

  it("refuses non-current admission records instead of forking the stored head", async () => {
    const definition = makeDefinition();
    await store.putDefinition(definition);
    const fork = buildProcedureAdmissionRecord({
      admissionId: "adm_pg_pi_harness_fork",
      tenantId,
      authorityScope: definition.authorityScope,
      sequence: 3,
      previousAdmissionHash: "sha256:not-current-head",
      admittedAt: "2026-07-02T20:05:00.000Z",
      admittedBy: "procedure-admission.postgres-test",
      decision: "admitted",
      run: makeRun(definition, { runId: "run_pg_pi_harness_fork" }),
    });

    await expect(
      store.admit({
        definition,
        record: fork,
        evaluatedAt: "2026-07-02T20:05:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ProcedureAdmissionStoreError);
  });

  it("refuses admission before the procedure definition is durably registered", async () => {
    const definition = buildProcedureDefinition({
      tenantId,
      procedureId: "proc_pg_unregistered",
      version: 1,
      name: "Unregistered procedure",
      authorityScope: "pmgovernance/postgres-procedure-admission-unregistered",
      runnerKind: "pi_harness",
      inputContractHash: "sha256:unregistered-input-contract",
      outputContractHash: "sha256:unregistered-output-contract",
      allowedUse: ["pm.stage_gate.validate"],
      createdAt: "2026-07-02T20:10:00.000Z",
    });
    const record = buildProcedureAdmissionRecord({
      admissionId: "adm_pg_pi_harness_unregistered",
      tenantId,
      authorityScope: definition.authorityScope,
      sequence: 1,
      admittedAt: "2026-07-02T20:11:00.000Z",
      admittedBy: "procedure-admission.postgres-test",
      decision: "admitted",
      run: makeRun(definition, {
        runId: "run_pg_pi_harness_unregistered",
      }),
    });

    await expect(
      store.admit({
        definition,
        record,
        evaluatedAt: "2026-07-02T20:11:00.000Z",
      }),
    ).rejects.toMatchObject({
      name: "ProcedureAdmissionStoreError",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "definition_not_registered" }),
      ]),
    });
  });

  it("refuses admission when the caller definition differs from the stored definition", async () => {
    const storedDefinition = buildProcedureDefinition({
      tenantId,
      procedureId: "proc_pg_definition_conflict",
      version: 1,
      name: "Stored procedure",
      authorityScope: "pmgovernance/postgres-procedure-admission-conflict",
      runnerKind: "pi_harness",
      inputContractHash: "sha256:conflict-input-contract",
      outputContractHash: "sha256:conflict-output-contract",
      allowedUse: ["pm.stage_gate.validate"],
      createdAt: "2026-07-02T20:12:00.000Z",
    });
    await store.putDefinition(storedDefinition);
    const callerDefinition = buildProcedureDefinition({
      tenantId,
      procedureId: storedDefinition.procedureId,
      version: storedDefinition.version,
      name: storedDefinition.name,
      authorityScope: storedDefinition.authorityScope,
      runnerKind: storedDefinition.runnerKind,
      inputContractHash: storedDefinition.inputContractHash,
      outputContractHash: storedDefinition.outputContractHash,
      allowedUse: ["pm.stage_gate.validate", "pm.stage_gate.override"],
      createdAt: storedDefinition.createdAt,
    });
    const record = buildProcedureAdmissionRecord({
      admissionId: "adm_pg_pi_harness_definition_conflict",
      tenantId,
      authorityScope: callerDefinition.authorityScope,
      sequence: 1,
      admittedAt: "2026-07-02T20:13:00.000Z",
      admittedBy: "procedure-admission.postgres-test",
      decision: "admitted",
      run: makeRun(callerDefinition, {
        runId: "run_pg_pi_harness_definition_conflict",
      }),
    });

    await expect(
      store.admit({
        definition: callerDefinition,
        record,
        evaluatedAt: "2026-07-02T20:13:00.000Z",
      }),
    ).rejects.toMatchObject({
      name: "ProcedureAdmissionStoreError",
      issues: expect.arrayContaining([
        expect.objectContaining({ code: "definition_hash_mismatch" }),
      ]),
    });
  });
});
