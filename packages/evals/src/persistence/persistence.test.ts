import { describe, expect, it } from "vitest";
import type { TenantId, Timestamp } from "@pm/types";

import { evalEvidenceRef, type EvalEvent } from "../schema.js";
import { PostgresEvalEventStore } from "./postgres.js";

const event: EvalEvent = {
  tenantId: "tnt_eval" as TenantId,
  axis: "finance",
  runId: "run_arrow_001",
  agentId: "portfolio_manager",
  scenarioId: "stale-price-after-signals",
  failureClass: "stale_observation",
  observedAt: "2026-05-27T15:00:00.000Z" as Timestamp,
  source: "arrowhedge/backtest",
  evidenceRefs: [evalEvidenceRef("external_fixture", "fixtures/stale-price.json")],
  substrateRefs: [evalEvidenceRef("event", "evt_price_refresh")],
  runArm: "substrate",
  pairedRunGroup: "pair_stale_price_seed_001",
  result: "pass",
  notes: "Substrate rejected the stale decision before acceptance.",
};

describe("PostgresEvalEventStore", () => {
  it("validates and inserts eval events into evals.eval_events", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] | undefined }> = [];
    const db = {
      query: async (sql: string, values?: readonly unknown[]) => {
        calls.push({ sql, values });
        return { rows: [] };
      },
    };

    const store = new PostgresEvalEventStore(db);
    await store.record(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("INSERT INTO evals.eval_events");
    expect(calls[0]?.values).toEqual([
      event.tenantId,
      event.axis,
      event.runId,
      event.scenarioId,
      event.agentId,
      event.failureClass,
      event.observedAt,
      event.source,
      event.result,
      event.runArm,
      event.pairedRunGroup,
      event,
    ]);
  });

  it("rejects invalid events before touching the database", async () => {
    const db = {
      query: async () => {
        throw new Error("query should not run");
      },
    };
    const store = new PostgresEvalEventStore(db);

    await expect(
      store.record({
        ...event,
        runArm: undefined,
        pairedRunGroup: undefined,
      }),
    ).rejects.toThrow("invalid eval event");
  });
});
