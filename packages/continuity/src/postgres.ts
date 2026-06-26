import { randomUUID } from "node:crypto";
import pg from "pg";
import type { EventId, TenantId, Timestamp } from "@pm/types";
import { checkpointHash } from "./hash.js";
import type {
  CheckpointQuery,
  CheckpointStatus,
  ContinuityCheckpoint,
  ContinuityLedger,
  ContinuityVerificationReport,
  RecordCheckpointInput,
} from "./interfaces.js";
import { verifyContinuityCheckpointChain } from "./verify.js";

interface Row {
  id: string;
  tenant_id: string;
  agent_id: string;
  scope: string;
  kind: ContinuityCheckpoint["kind"];
  title: string;
  summary: string;
  evidence_event_ids: string[];
  decision_refs: string[];
  status: CheckpointStatus;
  payload: Record<string, unknown>;
  created_at: Date;
  content_hash: string;
  prior_checkpoint_hash: string | null;
}

const rowToCheckpoint = (r: Row): ContinuityCheckpoint => ({
  id: r.id,
  tenantId: r.tenant_id as TenantId,
  agentId: r.agent_id,
  scope: r.scope,
  kind: r.kind,
  title: r.title,
  summary: r.summary,
  evidenceEventIds: (r.evidence_event_ids ?? []) as EventId[],
  decisionRefs: r.decision_refs ?? [],
  status: r.status,
  payload: r.payload ?? {},
  createdAt: r.created_at.toISOString() as Timestamp,
  contentHash: r.content_hash,
  priorCheckpointHash: r.prior_checkpoint_hash,
});

export class PostgresContinuityLedger implements ContinuityLedger {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async record(input: RecordCheckpointInput): Promise<ContinuityCheckpoint> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const prior = await client.query<{ content_hash: string }>(
        `SELECT content_hash
           FROM continuity.checkpoints
          WHERE tenant_id = $1 AND agent_id = $2
          ORDER BY created_at DESC, id DESC
          LIMIT 1
          FOR UPDATE`,
        [input.tenantId, input.agentId],
      );
      const id = `chk_${randomUUID()}`;
      const createdAt = new Date().toISOString() as Timestamp;
      const draft: Omit<ContinuityCheckpoint, "contentHash"> = {
        id,
        tenantId: input.tenantId,
        agentId: input.agentId,
        scope: input.scope,
        kind: input.kind,
        title: input.title,
        summary: input.summary,
        evidenceEventIds: input.evidenceEventIds ?? [],
        decisionRefs: input.decisionRefs ?? [],
        status: input.status ?? "open",
        payload: input.payload ?? {},
        createdAt,
        priorCheckpointHash: prior.rows[0]?.content_hash ?? null,
      };
      const contentHash = checkpointHash(draft);
      const r = await client.query<Row>(
        `INSERT INTO continuity.checkpoints
          (id, tenant_id, agent_id, scope, kind, title, summary,
           evidence_event_ids, decision_refs, status, payload, created_at,
           content_hash, prior_checkpoint_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13,$14)
         RETURNING id, tenant_id, agent_id, scope, kind, title, summary,
                   evidence_event_ids, decision_refs, status, payload,
                   created_at, content_hash, prior_checkpoint_hash`,
        [
          id,
          input.tenantId,
          input.agentId,
          input.scope,
          input.kind,
          input.title,
          input.summary,
          input.evidenceEventIds ?? [],
          input.decisionRefs ?? [],
          input.status ?? "open",
          JSON.stringify(input.payload ?? {}),
          createdAt,
          contentHash,
          draft.priorCheckpointHash,
        ],
      );
      await client.query("COMMIT");
      return rowToCheckpoint(r.rows[0]!);
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async get(tenantId: TenantId, id: string): Promise<ContinuityCheckpoint | null> {
    const r = await this.#pool.query<Row>(
      `SELECT id, tenant_id, agent_id, scope, kind, title, summary,
              evidence_event_ids, decision_refs, status, payload,
              created_at, content_hash, prior_checkpoint_hash
         FROM continuity.checkpoints
        WHERE tenant_id = $1 AND id = $2
        LIMIT 1`,
      [tenantId, id],
    );
    return r.rows[0] ? rowToCheckpoint(r.rows[0]) : null;
  }

  async list(query: CheckpointQuery): Promise<readonly ContinuityCheckpoint[]> {
    const params: unknown[] = [query.tenantId];
    const where = ["tenant_id = $1"];
    if (query.agentId) { params.push(query.agentId); where.push(`agent_id = $${params.length}`); }
    if (query.scope) { params.push(query.scope); where.push(`scope = $${params.length}`); }
    if (query.kind) { params.push(query.kind); where.push(`kind = $${params.length}`); }
    if (query.status) { params.push(query.status); where.push(`status = $${params.length}`); }
    params.push(Math.min(query.limit ?? 100, 1000));
    const r = await this.#pool.query<Row>(
      `SELECT id, tenant_id, agent_id, scope, kind, title, summary,
              evidence_event_ids, decision_refs, status, payload,
              created_at, content_hash, prior_checkpoint_hash
         FROM continuity.checkpoints
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC, id DESC
        LIMIT $${params.length}`,
      params,
    );
    return r.rows.map(rowToCheckpoint);
  }

  async verify(tenantId: TenantId, agentId: string): Promise<ContinuityVerificationReport> {
    const r = await this.#pool.query<Row>(
      `SELECT id, tenant_id, agent_id, scope, kind, title, summary,
              evidence_event_ids, decision_refs, status, payload,
              created_at, content_hash, prior_checkpoint_hash
         FROM continuity.checkpoints
        WHERE tenant_id = $1 AND agent_id = $2
        ORDER BY created_at ASC, id ASC`,
      [tenantId, agentId],
    );
    return verifyContinuityCheckpointChain({
      tenantId,
      agentId,
      checkpoints: r.rows.map(rowToCheckpoint),
    });
  }
}
