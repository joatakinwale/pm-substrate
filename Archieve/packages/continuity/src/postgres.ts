import { randomUUID } from "node:crypto";
import pg from "pg";
import type { EventId, TenantId, Timestamp } from "@pm/types";
import { parseContinuityChainMergePayload } from "./chain-merge.js";
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
    const merge = parseContinuityChainMergePayload(input.payload ?? {});
    if (merge.issue !== undefined) {
      throw new Error(`continuity merge payload refused: ${merge.issue}`);
    }
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      // Lock the logical chain, not its current tail row. Row-locking the tail
      // does not serialize concurrent INSERTs: multiple transactions can all
      // read the same predecessor and then create sibling heads. The
      // transaction-scoped advisory lock makes prior-head selection + insert
      // one atomic append for this tenant/agent chain without blocking other
      // ledgers.
      await client.query(
        `SELECT pg_advisory_xact_lock(
           hashtextextended(jsonb_build_array($1::text, $2::text)::text, 0)
         )`,
        [input.tenantId, input.agentId],
      );
      const heads = await client.query<{ content_hash: string }>(
        `SELECT candidate.content_hash
           FROM continuity.checkpoints candidate
          WHERE candidate.tenant_id = $1
            AND candidate.agent_id = $2
            AND NOT EXISTS (
              SELECT 1
                FROM continuity.checkpoints child
               WHERE child.tenant_id = candidate.tenant_id
                 AND child.agent_id = candidate.agent_id
                 AND (
                   child.prior_checkpoint_hash = candidate.content_hash
                   OR EXISTS (
                     SELECT 1
                       FROM jsonb_array_elements_text(
                         CASE
                           WHEN jsonb_typeof(child.payload #> '{continuityChainMerge,mergedHeadHashes}') = 'array'
                           THEN child.payload #> '{continuityChainMerge,mergedHeadHashes}'
                           ELSE '[]'::jsonb
                         END
                       ) merged(hash)
                      WHERE merged.hash = candidate.content_hash
                   )
                 )
            )
          ORDER BY candidate.seq DESC`,
        [input.tenantId, input.agentId],
      );
      const mergeHeadHashes = merge.value?.mergedHeadHashes ?? [];
      let priorCheckpointHash: string | null;
      if (heads.rows.length <= 1) {
        if (mergeHeadHashes.length > 0) {
          throw new Error(
            "continuity merge refused: the ledger does not currently have multiple heads",
          );
        }
        priorCheckpointHash = heads.rows[0]?.content_hash ?? null;
      } else {
        const headHashes = new Set(heads.rows.map((row) => row.content_hash));
        const merged = new Set(mergeHeadHashes);
        const canonical = [...headHashes].filter((hash) => !merged.has(hash));
        const allMergedAreHeads = [...merged].every((hash) => headHashes.has(hash));
        if (
          mergeHeadHashes.length !== merged.size ||
          !allMergedAreHeads ||
          canonical.length !== 1 ||
          merged.size !== headHashes.size - 1
        ) {
          throw new Error(
            `continuity append refused: ledger has ${headHashes.size} heads; ` +
              "only an exact append-only merge may proceed",
          );
        }
        priorCheckpointHash = canonical[0]!;
      }
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
        priorCheckpointHash,
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
    // Administrative continuity verification/repair may need the complete
    // chain; ordinary callers still default to a small newest-first window.
    params.push(Math.min(query.limit ?? 100, 100_000));
    const r = await this.#pool.query<Row>(
      `SELECT id, tenant_id, agent_id, scope, kind, title, summary,
              evidence_event_ids, decision_refs, status, payload,
              created_at, content_hash, prior_checkpoint_hash
         FROM continuity.checkpoints
        WHERE ${where.join(" AND ")}
        ORDER BY seq DESC
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
        ORDER BY seq ASC`,
      [tenantId, agentId],
    );
    return verifyContinuityCheckpointChain({
      tenantId,
      agentId,
      checkpoints: r.rows.map(rowToCheckpoint),
    });
  }
}
