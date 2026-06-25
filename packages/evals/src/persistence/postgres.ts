import {
  verifyActionOutcomeEnvelopeHash,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state";
import {
  assertEvalEvent,
  type EvalEvent,
  type EvalEvidenceRef,
} from "../schema.js";

export interface EvalEventQueryResult<TRow = unknown> {
  readonly rows: readonly TRow[];
}

export interface EvalEventDbClient {
  query<TRow = unknown>(
    sql: string,
    values?: readonly unknown[],
  ): Promise<EvalEventQueryResult<TRow>>;
}

export interface ActionOutcomeEnvelopeStoreRecovery {
  readonly ref: EvalEvidenceRef;
  readonly resolved: boolean;
  readonly envelope?: ActionOutcomeEnvelope;
  readonly terminalOutcome?: ActionOutcomeEnvelope["terminalOutcome"];
  readonly outcomeHash?: string;
  readonly reason?: "missing_packet" | "invalid_outcome_hash";
}

export class PostgresEvalEventStore {
  constructor(private readonly db: EvalEventDbClient) {}

  async record(event: EvalEvent): Promise<void> {
    const validEvent = assertEvalEvent(event);
    await this.db.query(
      `INSERT INTO evals.eval_events (
         tenant_id,
         axis,
         run_id,
         scenario_id,
         agent_id,
         failure_class,
         observed_at,
         source,
         result,
         run_arm,
         paired_run_group,
         state_bench_category,
         memory_benchmark_bridge,
         mast_category,
         coordination_class,
         event
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::timestamptz, $8, $9, $10, $11, $12, $13, $14, $15, $16::jsonb)`,
      [
        validEvent.tenantId,
        validEvent.axis,
        validEvent.runId,
        validEvent.scenarioId,
        validEvent.agentId,
        validEvent.failureClass,
        validEvent.observedAt,
        validEvent.source,
        validEvent.result,
        validEvent.runArm,
        validEvent.pairedRunGroup,
        validEvent.stateBenchCategory,
        validEvent.memoryBenchmarkBridge,
        validEvent.mastCategory,
        validEvent.coordinationClass,
        validEvent,
      ],
    );
  }

  async recordMany(events: readonly EvalEvent[]): Promise<void> {
    for (const event of events) {
      await this.record(event);
    }
  }

  async listByRun(
    tenantId: EvalEvent["tenantId"],
    runId: string,
  ): Promise<readonly EvalEvent[]> {
    const result = await this.db.query<{ event: EvalEvent }>(
      `SELECT event
       FROM evals.eval_events
       WHERE tenant_id = $1 AND run_id = $2
       ORDER BY observed_at ASC, id ASC`,
      [tenantId, runId],
    );
    return result.rows.map((row) => assertEvalEvent(row.event));
  }

  async recordActionOutcomeEnvelope(
    envelope: ActionOutcomeEnvelope,
  ): Promise<void> {
    const hash = verifyActionOutcomeEnvelopeHash(envelope);
    if (!hash.valid) {
      throw new Error(
        `invalid ActionOutcomeEnvelope hash for ${envelope.actionId}: ${hash.actualHash} !== ${hash.expectedHash}`,
      );
    }

    const refs = actionOutcomeEnvelopeRefs(envelope);
    if (refs.length === 0) {
      throw new Error(
        `ActionOutcomeEnvelope ${envelope.actionId} has no action_outcome_envelope substrate ref`,
      );
    }

    for (const ref of refs) {
      const result = await this.db.query<{ envelope_ref_id: string }>(
        `INSERT INTO evals.action_outcome_envelope_packets (
           tenant_id,
           envelope_ref_id,
           action_id,
           terminal_outcome,
           outcome_hash,
           envelope
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT (tenant_id, envelope_ref_id) DO UPDATE SET
           action_id = EXCLUDED.action_id,
           terminal_outcome = EXCLUDED.terminal_outcome,
           outcome_hash = EXCLUDED.outcome_hash,
           envelope = EXCLUDED.envelope,
           updated_at = now()
         WHERE evals.action_outcome_envelope_packets.outcome_hash = EXCLUDED.outcome_hash
         RETURNING envelope_ref_id`,
        [
          envelope.tenantId,
          ref.id,
          envelope.actionId,
          envelope.terminalOutcome,
          envelope.outcomeHash,
          envelope,
        ],
      );

      if (result.rows.length !== 1) {
        throw new Error(
          `action outcome envelope ref ${ref.id} already exists with a different outcome hash`,
        );
      }
    }
  }

  async recordActionOutcomeEnvelopes(
    envelopes: readonly ActionOutcomeEnvelope[],
  ): Promise<void> {
    for (const envelope of envelopes) {
      await this.recordActionOutcomeEnvelope(envelope);
    }
  }

  async getActionOutcomeEnvelopeByRef(
    tenantId: EvalEvent["tenantId"],
    ref: EvalEvidenceRef,
  ): Promise<ActionOutcomeEnvelope | undefined> {
    if (ref.kind !== "action_outcome_envelope") return undefined;

    const result = await this.db.query<{ envelope: ActionOutcomeEnvelope }>(
      `SELECT envelope
       FROM evals.action_outcome_envelope_packets
       WHERE tenant_id = $1 AND envelope_ref_id = $2`,
      [tenantId, ref.id],
    );
    const envelope = result.rows[0]?.envelope;
    if (envelope === undefined) return undefined;

    const hash = verifyActionOutcomeEnvelopeHash(envelope);
    if (!hash.valid) {
      throw new Error(
        `stored ActionOutcomeEnvelope hash is invalid for ref ${ref.id}: ${hash.actualHash} !== ${hash.expectedHash}`,
      );
    }

    return envelope;
  }

  async resolveActionOutcomeRefs(
    event: EvalEvent,
  ): Promise<readonly ActionOutcomeEnvelopeStoreRecovery[]> {
    const recoveries: ActionOutcomeEnvelopeStoreRecovery[] = [];
    for (const ref of event.substrateRefs) {
      if (ref.kind !== "action_outcome_envelope") continue;
      const envelope = await this.getActionOutcomeEnvelopeByRef(
        event.tenantId,
        ref,
      );
      if (envelope === undefined) {
        recoveries.push({
          ref,
          resolved: false,
          reason: "missing_packet",
        });
        continue;
      }
      recoveries.push({
        ref,
        resolved: true,
        envelope,
        terminalOutcome: envelope.terminalOutcome,
        outcomeHash: envelope.outcomeHash,
      });
    }
    return recoveries;
  }
}

function actionOutcomeEnvelopeRefs(
  envelope: ActionOutcomeEnvelope,
): readonly EvalEvidenceRef[] {
  const seen = new Set<string>();
  const refs: EvalEvidenceRef[] = [];
  for (const ref of envelope.substrateRefs) {
    if (ref.kind !== "action_outcome_envelope" || seen.has(ref.id)) continue;
    seen.add(ref.id);
    refs.push({
      kind: "action_outcome_envelope",
      id: ref.id,
      ...(ref.label === undefined ? {} : { label: ref.label }),
    });
  }
  return refs;
}
