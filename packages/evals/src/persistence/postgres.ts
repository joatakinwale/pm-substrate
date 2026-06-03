import {
  assertEvalEvent,
  type EvalEvent,
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
}
