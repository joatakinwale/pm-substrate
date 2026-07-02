import { createHash } from "node:crypto";

import type { StateRef } from "@pm/agent-state-core";
import type { TenantId, Timestamp } from "@pm/types";

export const PROCEDURE_DEFINITION_SCHEMA_VERSION =
  "procedure-definition.v1" as const;
export const PROCEDURE_RUN_SCHEMA_VERSION = "procedure-run.v1" as const;
export const PROCEDURE_ADMISSION_RECORD_SCHEMA_VERSION =
  "procedure-admission-record.v1" as const;

export type ProcedureRunnerKind =
  | "pi_harness"
  | "browser_qa_harness"
  | "script"
  | "agent_harness"
  | "custom";

export type ProcedureRunStatus =
  | "succeeded"
  | "failed"
  | "blocked"
  | "cancelled";

export type ProcedureAdmissionDecision = "admitted" | "rejected";

export interface ProcedureDefinition {
  readonly schemaVersion: typeof PROCEDURE_DEFINITION_SCHEMA_VERSION;
  readonly tenantId: TenantId;
  readonly procedureId: string;
  readonly version: number;
  readonly name: string;
  readonly authorityScope: string;
  readonly runnerKind: ProcedureRunnerKind;
  readonly inputContractHash: string;
  readonly outputContractHash: string;
  readonly allowedUse: readonly string[];
  readonly createdAt: Timestamp | string;
  readonly definitionHash: string;
}

export interface ProcedureEvidenceBinding {
  readonly ref: StateRef;
  readonly evidenceHash: string;
  readonly observedAt: Timestamp | string;
  readonly validUntil?: Timestamp | string;
}

export interface ProcedureRun {
  readonly schemaVersion: typeof PROCEDURE_RUN_SCHEMA_VERSION;
  readonly runId: string;
  readonly tenantId: TenantId;
  readonly procedureId: string;
  readonly procedureVersion: number;
  readonly procedureDefinitionHash: string;
  readonly authorityScope: string;
  readonly runnerKind: ProcedureRunnerKind;
  readonly requestedBy: string;
  readonly startedAt: Timestamp | string;
  readonly completedAt: Timestamp | string;
  readonly status: ProcedureRunStatus;
  readonly inputHash: string;
  readonly outputHash?: string;
  readonly inputEvidence: readonly ProcedureEvidenceBinding[];
  readonly outputEvidence: readonly ProcedureEvidenceBinding[];
  readonly runnerEvidence: readonly ProcedureEvidenceBinding[];
  readonly runHash: string;
}

export interface ProcedureAdmissionRecord {
  readonly schemaVersion: typeof PROCEDURE_ADMISSION_RECORD_SCHEMA_VERSION;
  readonly admissionId: string;
  readonly tenantId: TenantId;
  readonly authorityScope: string;
  readonly sequence: number;
  readonly previousAdmissionHash?: string;
  readonly admittedAt: Timestamp | string;
  readonly admittedBy: string;
  readonly decision: ProcedureAdmissionDecision;
  readonly run: ProcedureRun;
  readonly admissionHash: string;
}

export type ProcedureAdmissionIssueCode =
  | "definition_not_registered"
  | "definition_hash_mismatch"
  | "run_hash_mismatch"
  | "admission_hash_mismatch"
  | "tenant_mismatch"
  | "authority_scope_mismatch"
  | "procedure_id_mismatch"
  | "runner_kind_mismatch"
  | "procedure_version_mismatch"
  | "missing_input_evidence"
  | "missing_output_hash"
  | "missing_runner_evidence"
  | "stale_input_evidence"
  | "stale_output_evidence"
  | "stale_runner_evidence"
  | "run_not_successful"
  | "sequence_gap"
  | "previous_hash_mismatch"
  | "duplicate_run"
  | "runner_not_registered"
  | "invalid_replay_history";

export interface ProcedureAdmissionIssue {
  readonly code: ProcedureAdmissionIssueCode;
  readonly message: string;
  readonly path: string;
}

export interface ProcedureAdmissionEvaluation {
  readonly admissible: boolean;
  readonly issues: readonly ProcedureAdmissionIssue[];
}

export interface ProcedureAdmissionReplay {
  readonly valid: boolean;
  readonly issues: readonly ProcedureAdmissionIssue[];
  readonly admittedRuns: readonly ProcedureRun[];
  readonly rejectedRuns: readonly ProcedureRun[];
  readonly currentHeadHash?: string;
  readonly replayedToSequence: number;
}

export class ProcedureAdmissionRuntimeError extends Error {
  readonly issues: readonly ProcedureAdmissionIssue[];

  constructor(message: string, issues: readonly ProcedureAdmissionIssue[]) {
    super(message);
    this.name = "ProcedureAdmissionRuntimeError";
    this.issues = issues;
  }
}

export interface ProcedureAdmissionStore {
  putDefinition(definition: ProcedureDefinition): Promise<void>;
  getDefinition(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
  }): Promise<ProcedureDefinition | null>;
  admit(input: {
    readonly definition: ProcedureDefinition;
    readonly record: ProcedureAdmissionRecord;
    readonly evaluatedAt: Timestamp | string;
  }): Promise<void>;
  replay(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
    readonly evaluatedAt: Timestamp | string;
  }): Promise<ProcedureAdmissionReplay>;
}

export interface ProcedureRunnerInvocation {
  readonly definition: ProcedureDefinition;
  readonly tenantId: TenantId;
  readonly runId: string;
  readonly requestedBy: string;
  readonly inputHash: string;
  readonly inputEvidence: readonly ProcedureEvidenceBinding[];
  readonly startedAt: Timestamp | string;
  readonly input?: unknown;
}

export interface ProcedureRunnerResult {
  readonly status: ProcedureRunStatus;
  readonly completedAt: Timestamp | string;
  readonly outputHash?: string;
  readonly outputEvidence?: readonly ProcedureEvidenceBinding[];
  readonly runnerEvidence: readonly ProcedureEvidenceBinding[];
}

export interface ProcedureRunnerPort {
  readonly runnerKind: ProcedureRunnerKind;
  run(invocation: ProcedureRunnerInvocation): Promise<ProcedureRunnerResult>;
}

export interface ProcedureAdmissionRuntimeInput {
  readonly tenantId: TenantId;
  readonly procedureId: string;
  readonly version: number;
  readonly runId: string;
  readonly requestedBy: string;
  readonly inputHash: string;
  readonly inputEvidence: readonly ProcedureEvidenceBinding[];
  readonly input?: unknown;
  readonly startedAt?: Timestamp | string;
  readonly admittedBy?: string;
  readonly evaluatedAt?: Timestamp | string;
}

export interface ProcedureAdmissionRuntimeResult {
  readonly definition: ProcedureDefinition;
  readonly run: ProcedureRun;
  readonly record: ProcedureAdmissionRecord;
  readonly replay: ProcedureAdmissionReplay;
}

export interface ProcedureDefinitionInput
  extends Omit<ProcedureDefinition, "schemaVersion" | "definitionHash"> {}

export interface ProcedureRunInput
  extends Omit<ProcedureRun, "schemaVersion" | "runHash"> {}

export interface ProcedureAdmissionRecordInput
  extends Omit<
    ProcedureAdmissionRecord,
    "schemaVersion" | "admissionHash"
  > {}

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonicalize(v)]),
    );
  }
  return value;
};

export const procedureSha256 = (value: unknown): string =>
  createHash("sha256")
    .update(JSON.stringify(canonicalize(value)))
    .digest("hex");

export function computeProcedureDefinitionHash(
  definition: Omit<ProcedureDefinition, "definitionHash">,
): string {
  return procedureSha256(definition);
}

export function buildProcedureDefinition(
  input: ProcedureDefinitionInput,
): ProcedureDefinition {
  const withoutHash = {
    schemaVersion: PROCEDURE_DEFINITION_SCHEMA_VERSION,
    ...input,
  };
  return {
    ...withoutHash,
    definitionHash: computeProcedureDefinitionHash(withoutHash),
  };
}

export function verifyProcedureDefinitionHash(
  definition: ProcedureDefinition,
): boolean {
  return (
    definition.definitionHash ===
    computeProcedureDefinitionHash({
      ...definition,
      definitionHash: undefined,
    } as Omit<ProcedureDefinition, "definitionHash">)
  );
}

export function computeProcedureRunHash(
  run: Omit<ProcedureRun, "runHash">,
): string {
  return procedureSha256(run);
}

export function buildProcedureRun(input: ProcedureRunInput): ProcedureRun {
  const withoutHash = {
    schemaVersion: PROCEDURE_RUN_SCHEMA_VERSION,
    ...input,
  };
  return {
    ...withoutHash,
    runHash: computeProcedureRunHash(withoutHash),
  };
}

export function verifyProcedureRunHash(run: ProcedureRun): boolean {
  return (
    run.runHash ===
    computeProcedureRunHash({
      ...run,
      runHash: undefined,
    } as Omit<ProcedureRun, "runHash">)
  );
}

export function computeProcedureAdmissionHash(
  record: Omit<ProcedureAdmissionRecord, "admissionHash">,
): string {
  return procedureSha256(record);
}

export function buildProcedureAdmissionRecord(
  input: ProcedureAdmissionRecordInput,
): ProcedureAdmissionRecord {
  const withoutHash = {
    schemaVersion: PROCEDURE_ADMISSION_RECORD_SCHEMA_VERSION,
    ...input,
  };
  return {
    ...withoutHash,
    admissionHash: computeProcedureAdmissionHash(withoutHash),
  };
}

export function verifyProcedureAdmissionRecordHash(
  record: ProcedureAdmissionRecord,
): boolean {
  return (
    record.admissionHash ===
    computeProcedureAdmissionHash({
      ...record,
      admissionHash: undefined,
    } as Omit<ProcedureAdmissionRecord, "admissionHash">)
  );
}

export function evaluateProcedureAdmission(input: {
  readonly definition: ProcedureDefinition;
  readonly record: ProcedureAdmissionRecord;
  readonly evaluatedAt: Timestamp | string;
}): ProcedureAdmissionEvaluation {
  const issues: ProcedureAdmissionIssue[] = [];
  const { definition, record } = input;
  const { run } = record;

  pushUnless(issues, verifyProcedureDefinitionHash(definition), {
    code: "definition_hash_mismatch",
    path: "definition.definitionHash",
    message: "Procedure definition hash does not match its payload.",
  });
  pushUnless(issues, verifyProcedureRunHash(run), {
    code: "run_hash_mismatch",
    path: "record.run.runHash",
    message: "Procedure run hash does not match its payload.",
  });
  pushUnless(issues, verifyProcedureAdmissionRecordHash(record), {
    code: "admission_hash_mismatch",
    path: "record.admissionHash",
    message: "Procedure admission hash does not match its payload.",
  });
  pushUnless(issues, definition.tenantId === run.tenantId, {
    code: "tenant_mismatch",
    path: "definition.tenantId",
    message: "Procedure definition tenant must match procedure run tenant.",
  });
  pushUnless(issues, record.tenantId === run.tenantId, {
    code: "tenant_mismatch",
    path: "record.tenantId",
    message: "Admission tenant must match procedure run tenant.",
  });
  pushUnless(issues, record.authorityScope === run.authorityScope, {
    code: "authority_scope_mismatch",
    path: "record.authorityScope",
    message: "Admission authority scope must match procedure run scope.",
  });
  pushUnless(issues, definition.authorityScope === run.authorityScope, {
    code: "authority_scope_mismatch",
    path: "definition.authorityScope",
    message: "Procedure definition scope must match procedure run scope.",
  });
  pushUnless(issues, definition.runnerKind === run.runnerKind, {
    code: "runner_kind_mismatch",
    path: "run.runnerKind",
    message: "Procedure run runner kind must match the definition.",
  });
  pushUnless(issues, definition.procedureId === run.procedureId, {
    code: "procedure_id_mismatch",
    path: "run.procedureId",
    message: "Procedure run id must match the definition procedure id.",
  });
  pushUnless(issues, definition.version === run.procedureVersion, {
    code: "procedure_version_mismatch",
    path: "run.procedureVersion",
    message: "Procedure run version must match the definition version.",
  });
  pushUnless(
    issues,
    definition.definitionHash === run.procedureDefinitionHash,
    {
      code: "definition_hash_mismatch",
      path: "run.procedureDefinitionHash",
      message: "Procedure run must bind the exact procedure definition hash.",
    },
  );

  if (record.decision === "admitted") {
    pushUnless(issues, run.status === "succeeded", {
      code: "run_not_successful",
      path: "run.status",
      message: "Only succeeded procedure runs can be admitted as operational.",
    });
    pushUnless(issues, run.inputEvidence.length > 0, {
      code: "missing_input_evidence",
      path: "run.inputEvidence",
      message: "Admitted procedure runs require input evidence.",
    });
    pushUnless(issues, run.outputHash !== undefined && run.outputHash !== "", {
      code: "missing_output_hash",
      path: "run.outputHash",
      message: "Admitted successful procedure runs require an output hash.",
    });
    pushUnless(issues, run.runnerEvidence.length > 0, {
      code: "missing_runner_evidence",
      path: "run.runnerEvidence",
      message: "Admitted procedure runs require runner evidence.",
    });
  }

  pushFreshnessIssues(issues, run.inputEvidence, input.evaluatedAt, "input");
  pushFreshnessIssues(issues, run.outputEvidence, input.evaluatedAt, "output");
  pushFreshnessIssues(issues, run.runnerEvidence, input.evaluatedAt, "runner");

  return { admissible: issues.length === 0, issues };
}

export function replayProcedureAdmissionHistory(input: {
  readonly definition: ProcedureDefinition;
  readonly records: readonly ProcedureAdmissionRecord[];
  readonly evaluatedAt: Timestamp | string;
  readonly tenantId: TenantId;
  readonly authorityScope: string;
}): ProcedureAdmissionReplay {
  const issues: ProcedureAdmissionIssue[] = [];
  const admittedRuns: ProcedureRun[] = [];
  const rejectedRuns: ProcedureRun[] = [];
  const seenRunIds = new Set<string>();
  let previousHash: string | undefined;
  let expectedSequence = 1;

  for (const record of input.records) {
    if (record.sequence !== expectedSequence) {
      issues.push({
        code: "sequence_gap",
        path: `records[${expectedSequence - 1}].sequence`,
        message: `Expected sequence ${expectedSequence}, got ${record.sequence}.`,
      });
    }
    if (record.previousAdmissionHash !== previousHash) {
      issues.push({
        code: "previous_hash_mismatch",
        path: `records[${expectedSequence - 1}].previousAdmissionHash`,
        message: "Admission record does not point to the previous head hash.",
      });
    }
    if (record.tenantId !== input.tenantId) {
      issues.push({
        code: "tenant_mismatch",
        path: `records[${expectedSequence - 1}].tenantId`,
        message: "Admission record tenant does not match replay tenant.",
      });
    }
    if (record.authorityScope !== input.authorityScope) {
      issues.push({
        code: "authority_scope_mismatch",
        path: `records[${expectedSequence - 1}].authorityScope`,
        message: "Admission record scope does not match replay scope.",
      });
    }
    if (seenRunIds.has(record.run.runId)) {
      issues.push({
        code: "duplicate_run",
        path: `records[${expectedSequence - 1}].run.runId`,
        message: "Procedure run ids must be unique in a replay history.",
      });
    }
    seenRunIds.add(record.run.runId);

    const evaluation = evaluateProcedureAdmission({
      definition: input.definition,
      record,
      evaluatedAt: input.evaluatedAt,
    });
    issues.push(...evaluation.issues);
    if (record.decision === "admitted" && evaluation.admissible) {
      admittedRuns.push(record.run);
    } else {
      rejectedRuns.push(record.run);
    }

    previousHash = record.admissionHash;
    expectedSequence++;
  }

  return {
    valid: issues.length === 0,
    issues,
    admittedRuns,
    rejectedRuns,
    ...(previousHash !== undefined ? { currentHeadHash: previousHash } : {}),
    replayedToSequence: expectedSequence - 1,
  };
}

export class ProcedureAdmissionRuntime {
  readonly #store: ProcedureAdmissionStore;
  readonly #runners: ReadonlyMap<ProcedureRunnerKind, ProcedureRunnerPort>;
  readonly #clock: () => Timestamp | string;
  readonly #admittedBy: string;

  constructor(input: {
    readonly store: ProcedureAdmissionStore;
    readonly runners: readonly ProcedureRunnerPort[];
    readonly clock?: () => Timestamp | string;
    readonly admittedBy?: string;
  }) {
    this.#store = input.store;
    this.#runners = new Map(
      input.runners.map((runner) => [runner.runnerKind, runner]),
    );
    this.#clock = input.clock ?? (() => new Date().toISOString());
    this.#admittedBy = input.admittedBy ?? "procedure-admission.runtime";
  }

  async registerDefinition(
    input: ProcedureDefinitionInput | ProcedureDefinition,
  ): Promise<ProcedureDefinition> {
    const definition =
      "schemaVersion" in input && "definitionHash" in input
        ? input
        : buildProcedureDefinition(input);
    await this.#store.putDefinition(definition);
    return definition;
  }

  async getDefinition(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
  }): Promise<ProcedureDefinition | null> {
    return this.#store.getDefinition(input);
  }

  async replay(input: {
    readonly tenantId: TenantId;
    readonly procedureId: string;
    readonly version: number;
    readonly evaluatedAt: Timestamp | string;
  }): Promise<ProcedureAdmissionReplay> {
    return this.#store.replay(input);
  }

  async execute(
    input: ProcedureAdmissionRuntimeInput,
  ): Promise<ProcedureAdmissionRuntimeResult> {
    const definition = await this.#store.getDefinition({
      tenantId: input.tenantId,
      procedureId: input.procedureId,
      version: input.version,
    });
    if (definition === null) {
      throw new ProcedureAdmissionRuntimeError(
        `procedure definition not registered for ${input.procedureId}@${input.version}`,
        [
          {
            code: "definition_not_registered",
            path: "definition",
            message:
              "Procedure execution requires a stored procedure definition.",
          },
        ],
      );
    }

    const runner = this.#runners.get(definition.runnerKind);
    if (runner === undefined) {
      throw new ProcedureAdmissionRuntimeError(
        `procedure runner not registered for kind ${definition.runnerKind}`,
        [
          {
            code: "runner_not_registered",
            path: "definition.runnerKind",
            message:
              "Procedure execution requires a registered runner for the definition runner kind.",
          },
        ],
      );
    }

    const startedAt = input.startedAt ?? this.#clock();
    const result = await runner.run({
      definition,
      tenantId: input.tenantId,
      runId: input.runId,
      requestedBy: input.requestedBy,
      inputHash: input.inputHash,
      inputEvidence: input.inputEvidence,
      startedAt,
      input: input.input,
    });
    const evaluatedAt = input.evaluatedAt ?? result.completedAt;
    const previousReplay = await this.#store.replay({
      tenantId: input.tenantId,
      procedureId: definition.procedureId,
      version: definition.version,
      evaluatedAt,
    });
    if (!previousReplay.valid) {
      throw new ProcedureAdmissionRuntimeError(
        `procedure admission history is not replay-valid for ${definition.procedureId}@${definition.version}`,
        [
          {
            code: "invalid_replay_history",
            path: "replay",
            message:
              "Procedure runtime refuses to append onto an invalid admission history.",
          },
          ...previousReplay.issues,
        ],
      );
    }

    const run = buildProcedureRun({
      runId: input.runId,
      tenantId: input.tenantId,
      procedureId: definition.procedureId,
      procedureVersion: definition.version,
      procedureDefinitionHash: definition.definitionHash,
      authorityScope: definition.authorityScope,
      runnerKind: definition.runnerKind,
      requestedBy: input.requestedBy,
      startedAt,
      completedAt: result.completedAt,
      status: result.status,
      inputHash: input.inputHash,
      ...(result.outputHash !== undefined
        ? { outputHash: result.outputHash }
        : {}),
      inputEvidence: input.inputEvidence,
      outputEvidence: result.outputEvidence ?? [],
      runnerEvidence: result.runnerEvidence,
    });
    const sequence = previousReplay.replayedToSequence + 1;
    const decision: ProcedureAdmissionDecision =
      result.status === "succeeded" ? "admitted" : "rejected";
    const record = buildProcedureAdmissionRecord({
      admissionId: buildProcedureAdmissionId({
        tenantId: input.tenantId,
        authorityScope: definition.authorityScope,
        runId: input.runId,
        procedureDefinitionHash: definition.definitionHash,
      }),
      tenantId: input.tenantId,
      authorityScope: definition.authorityScope,
      sequence,
      ...(previousReplay.currentHeadHash !== undefined
        ? { previousAdmissionHash: previousReplay.currentHeadHash }
        : {}),
      admittedAt: evaluatedAt,
      admittedBy: input.admittedBy ?? this.#admittedBy,
      decision,
      run,
    });

    await this.#store.admit({
      definition,
      record,
      evaluatedAt,
    });
    const replay = await this.#store.replay({
      tenantId: input.tenantId,
      procedureId: definition.procedureId,
      version: definition.version,
      evaluatedAt,
    });
    return { definition, run, record, replay };
  }
}

export const buildProcedureAdmissionId = (input: {
  readonly tenantId: TenantId;
  readonly authorityScope: string;
  readonly runId: string;
  readonly procedureDefinitionHash: string;
}): string => `adm_${procedureSha256(input).slice(0, 32)}`;

const pushUnless = (
  issues: ProcedureAdmissionIssue[],
  ok: boolean,
  issue: ProcedureAdmissionIssue,
) => {
  if (!ok) issues.push(issue);
};

const pushFreshnessIssues = (
  issues: ProcedureAdmissionIssue[],
  evidence: readonly ProcedureEvidenceBinding[],
  evaluatedAt: Timestamp | string,
  lane: "input" | "output" | "runner",
) => {
  const evaluated = new Date(evaluatedAt).getTime();
  evidence.forEach((binding, index) => {
    if (
      binding.validUntil !== undefined &&
      new Date(binding.validUntil).getTime() < evaluated
    ) {
      issues.push({
        code:
          lane === "input"
            ? "stale_input_evidence"
            : lane === "output"
              ? "stale_output_evidence"
              : "stale_runner_evidence",
        path: `run.${lane}Evidence[${index}].validUntil`,
        message: `${lane} evidence expired before admission evaluation.`,
      });
    }
  });
};

export {
  PostgresProcedureAdmissionStore,
  ProcedureAdmissionStoreError,
} from "./postgres.js";
