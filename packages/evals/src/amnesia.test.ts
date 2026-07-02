import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  PostgresContinuityLedger,
  checkpointHash,
  type ContinuityCheckpoint,
  type ContinuityLedger,
  type RecordCheckpointInput,
} from "@pm/continuity";
import { tenantId as asTenantId, type TenantId } from "@pm/types";

import { AMNESIA_DEFAULT_FACTS, measureAmnesiaResume } from "./amnesia.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

/**
 * In-memory ledger for the pure-unit arm: honest hash chain, optional fact
 * dropping so partial recall is MEASURED (a degraded store yields a degraded
 * number, not a scripted verdict).
 */
class MemoryLedger implements ContinuityLedger {
  #rows: ContinuityCheckpoint[] = [];
  #dropTitles: Set<string>;
  constructor(dropTitles: readonly string[] = []) {
    this.#dropTitles = new Set(dropTitles);
  }
  async record(input: RecordCheckpointInput): Promise<ContinuityCheckpoint> {
    const prior = this.#rows[this.#rows.length - 1];
    const base = {
      id: `cp_${this.#rows.length + 1}`,
      tenantId: input.tenantId,
      agentId: input.agentId,
      scope: input.scope,
      kind: input.kind,
      title: input.title,
      summary: input.summary,
      evidenceEventIds: input.evidenceEventIds ?? [],
      decisionRefs: input.decisionRefs ?? [],
      status: input.status ?? ("open" as const),
      payload: input.payload ?? {},
      createdAt: new Date(
        Date.UTC(2026, 6, 2, 0, 0, this.#rows.length),
      ).toISOString() as never,
      priorCheckpointHash: prior?.contentHash ?? null,
    };
    const row: ContinuityCheckpoint = {
      ...base,
      contentHash: checkpointHash(base),
    };
    if (!this.#dropTitles.has(input.title)) this.#rows.push(row);
    return row;
  }
  async list(q: {
    kind?: string;
    status?: string;
  }): Promise<readonly ContinuityCheckpoint[]> {
    return this.#rows.filter(
      (r) =>
        (q.kind === undefined || r.kind === q.kind) &&
        (q.status === undefined || r.status === q.status),
    );
  }
  async get(): Promise<ContinuityCheckpoint | null> {
    return null;
  }
}

describe("amnesia resume measurement (pure)", () => {
  const tenant = asTenantId("tnt_amnesia_unit");

  it("measures full recall through an intact in-memory ledger", async () => {
    const m = await measureAmnesiaResume({
      tenantId: tenant,
      agentId: "agent_amnesia",
      scope: "amnesia-eval",
      facts: AMNESIA_DEFAULT_FACTS,
      ledger: new MemoryLedger(),
    });
    expect(m.factCount).toBe(5);
    expect(m.baselineRecallRate).toBe(0);
    expect(m.substrateRecallRate).toBe(1);
    expect(m.missingFactTitles).toEqual([]);
    expect(m.chainValid).toBe(true);
  });

  it("measures partial recall when the store degrades (nothing hardcoded)", async () => {
    const dropped = AMNESIA_DEFAULT_FACTS[1]!.title;
    const m = await measureAmnesiaResume({
      tenantId: tenant,
      agentId: "agent_amnesia",
      scope: "amnesia-eval",
      facts: AMNESIA_DEFAULT_FACTS,
      ledger: new MemoryLedger([dropped]),
    });
    expect(m.substrateRecalledFactCount).toBe(4);
    expect(m.substrateRecallRate).toBeCloseTo(4 / 5);
    expect(m.missingFactTitles).toEqual([dropped]);
  });
});

describeIfDb("amnesia resume measurement (Postgres)", () => {
  let pool: pg.Pool;
  let tenant: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenant = `tnt_amnesia_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenant],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM continuity.checkpoints WHERE tenant_id = $1`, [
      tenant,
    ]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenant]);
    await pool.end();
  });

  it("headline number: substrate arm recovers 5/5 facts with a valid chain", async () => {
    const m = await measureAmnesiaResume({
      tenantId: tenant,
      agentId: "agent_amnesia_db",
      scope: "amnesia-eval-db",
      facts: AMNESIA_DEFAULT_FACTS,
      ledger: new PostgresContinuityLedger(pool),
    });
    expect(m.substrateRecallRate).toBe(1);
    expect(m.baselineRecallRate).toBe(0);
    expect(m.chainValid).toBe(true);
    expect(m.chainErrors).toEqual([]);
  });
});
