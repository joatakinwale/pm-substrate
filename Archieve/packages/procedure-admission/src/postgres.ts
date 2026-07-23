import pg from "pg";

import type { TenantId } from "@pm/types";

import {
  evaluateProcedureAdmission,
  replayProcedureAdmissionHistory,
  verifyProcedureDefinitionHash,
  type ProcedureAdmissionIssue,
  type ProcedureAdmissionRecord,
  type ProcedureAdmissionReplay,
  type ProcedureDefinition,
} from "./index.js";

interface DefinitionRow {
  readonly definition_hash: string;
  readonly definition: ProcedureDefinition;
}

interface AdmissionRow {
  readonly record: ProcedureAdmissionRecord;
}

export class ProcedureAdmissionStoreError extends Error {
  readonly issues: readonly ProcedureAdmissionIssue[];

  constructor(message: string, issues: readonly ProcedureAdmissionIssue[] = []) {
    super(message);
    this.name = "ProcedureAdmissionStoreError";
    this.issues = issues;
  }
}

export class PostgresProcedureAdmissionStore {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async putDefinition(definition: ProcedureDefinition): Promise<void> {
    if (!verifyProcedureDefinitionHash(definition)) {
      throw new ProcedureAdmissionStoreError(
        `invalid procedure definition hash for ${definition.procedureId}@${definition.version}`,
        [
          {
            code: "definition_hash_mismatch",
            path: "definition.definitionHash",
            message: "Procedure definition hash does not match its payload.",
          },
        ],
      );
    }

    const result = await this.#pool.query<{ definition_hash: string }>(
      `INSERT INTO procedure_admission.definitions (
         tenant_id,
         procedure_id,
         version,
         authority_scope,
         runner_kind,
         name,
         input_contract_hash,
         output_contract_hash,
         allowed_use,
         created_at,
         definition_hash,
         definition
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb)
       ON CONFLICT (tenant_id, procedure_id, version) DO UPDATE SET
         definition = procedure_admission.definitions.definition
       WHERE procedure_admission.definitions.definition_hash = EXCLUDED.definition_hash
       RETURNING definition_hash`,
      [
        definition.tenantId,
        definition.procedureId,
        definition.version,
        definition.authorityScope,
        definition.runnerKind,
        definition.name,
        definition.inputContractHash,
        definition.outputContractHash,
        JSON.stringify(definition.allowedUse),
        definition.createdAt,
        definition.definitionHash,
        JSON.stringify(definition),
      ],
    );

    if (result.rowCount !== 1) {
      throw new ProcedureAdmissionStoreError(
        `procedure definition conflict for ${definition.procedureId}@${definition.version}`,
      );
    }
  }

  async getDefinition(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
  }): Promise<ProcedureDefinition | null> {
    const result = await this.#pool.query<DefinitionRow>(
      `SELECT definition_hash, definition
         FROM procedure_admission.definitions
        WHERE tenant_id = $1 AND procedure_id = $2 AND version = $3`,
      [input.tenantId, input.procedureId, input.version],
    );
    return result.rows[0]?.definition ?? null;
  }

  async admit(input: {
    readonly definition: ProcedureDefinition;
    readonly record: ProcedureAdmissionRecord;
    readonly evaluatedAt: string;
  }): Promise<void> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const storedDefinition = await client.query<DefinitionRow>(
        `SELECT definition_hash, definition
           FROM procedure_admission.definitions
          WHERE tenant_id = $1 AND procedure_id = $2 AND version = $3
          FOR SHARE`,
        [
          input.definition.tenantId,
          input.definition.procedureId,
          input.definition.version,
        ],
      );
      const storedDefinitionRow = storedDefinition.rows[0];
      if (storedDefinitionRow === undefined) {
        throw new ProcedureAdmissionStoreError(
          `procedure definition not registered for ${input.definition.procedureId}@${input.definition.version}`,
          [
            {
              code: "definition_not_registered",
              path: "definition",
              message:
                "Procedure admission requires a stored procedure definition.",
            },
          ],
        );
      }
      if (
        storedDefinitionRow.definition_hash !==
          input.definition.definitionHash ||
        storedDefinitionRow.definition.definitionHash !==
          input.definition.definitionHash
      ) {
        throw new ProcedureAdmissionStoreError(
          `procedure definition hash does not match stored definition for ${input.definition.procedureId}@${input.definition.version}`,
          [
            {
              code: "definition_hash_mismatch",
              path: "definition.definitionHash",
              message:
                "Procedure admission definition must match the stored definition hash.",
            },
          ],
        );
      }
      const evaluation = evaluateProcedureAdmission({
        definition: input.definition,
        record: input.record,
        evaluatedAt: input.evaluatedAt,
      });
      if (!evaluation.admissible) {
        throw new ProcedureAdmissionStoreError(
          `procedure admission ${input.record.admissionId} failed evaluation`,
          evaluation.issues,
        );
      }
      const latest = await client.query<{
        sequence: number;
        admission_hash: string;
      }>(
        `SELECT sequence, admission_hash
           FROM procedure_admission.admission_records
          WHERE tenant_id = $1 AND authority_scope = $2
          ORDER BY sequence DESC
          LIMIT 1
          FOR UPDATE`,
        [input.record.tenantId, input.record.authorityScope],
      );
      const latestRow = latest.rows[0];
      const expectedSequence = (latestRow?.sequence ?? 0) + 1;
      const expectedPreviousHash = latestRow?.admission_hash;

      const chainIssues: ProcedureAdmissionIssue[] = [];
      if (input.record.sequence !== expectedSequence) {
        chainIssues.push({
          code: "sequence_gap",
          path: "record.sequence",
          message: `Expected sequence ${expectedSequence}, got ${input.record.sequence}.`,
        });
      }
      if (input.record.previousAdmissionHash !== expectedPreviousHash) {
        chainIssues.push({
          code: "previous_hash_mismatch",
          path: "record.previousAdmissionHash",
          message: "Admission record does not match the current stored head.",
        });
      }
      if (chainIssues.length > 0) {
        throw new ProcedureAdmissionStoreError(
          `procedure admission ${input.record.admissionId} is not current`,
          chainIssues,
        );
      }

      await client.query(
        `INSERT INTO procedure_admission.admission_records (
           tenant_id,
           authority_scope,
           sequence,
           admission_id,
           procedure_id,
           procedure_version,
           run_id,
           decision,
           admitted_at,
           admitted_by,
           previous_admission_hash,
           admission_hash,
           run_hash,
           record
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
        [
          input.record.tenantId,
          input.record.authorityScope,
          input.record.sequence,
          input.record.admissionId,
          input.record.run.procedureId,
          input.record.run.procedureVersion,
          input.record.run.runId,
          input.record.decision,
          input.record.admittedAt,
          input.record.admittedBy,
          input.record.previousAdmissionHash ?? null,
          input.record.admissionHash,
          input.record.run.runHash,
          JSON.stringify(input.record),
        ],
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async listAdmissionRecords(input: {
    readonly tenantId: TenantId;
    readonly authorityScope: string;
  }): Promise<readonly ProcedureAdmissionRecord[]> {
    const result = await this.#pool.query<AdmissionRow>(
      `SELECT record
         FROM procedure_admission.admission_records
        WHERE tenant_id = $1 AND authority_scope = $2
        ORDER BY sequence ASC`,
      [input.tenantId, input.authorityScope],
    );
    return result.rows.map((row) => row.record);
  }

  async replay(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
    readonly evaluatedAt: string;
  }): Promise<ProcedureAdmissionReplay> {
    const definition = await this.getDefinition(input);
    if (definition === null) {
      throw new ProcedureAdmissionStoreError(
        `procedure definition not found for ${input.procedureId}@${input.version}`,
      );
    }
    const records = await this.listAdmissionRecords({
      tenantId: input.tenantId,
      authorityScope: definition.authorityScope,
    });
    return replayProcedureAdmissionHistory({
      definition,
      records,
      evaluatedAt: input.evaluatedAt,
      tenantId: input.tenantId,
      authorityScope: definition.authorityScope,
    });
  }
}
