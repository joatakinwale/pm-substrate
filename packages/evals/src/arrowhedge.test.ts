import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import { buildArrowHedgeStateEvalSuite } from "./arrowhedge.js";
import {
  analyzeAdapterOperationalMetrics,
  analyzeEvalEvents,
} from "./metrics.js";

describe("ArrowHedge state eval suite", () => {
  it("emits paired evals for the five ArrowHedge adapter failure scenarios", () => {
    const suite = buildArrowHedgeStateEvalSuite({
      tenantId: tenantId("tnt_arrowhedge_eval"),
      observedAt: timestamp("2026-06-03T16:30:00.000Z"),
      runIdPrefix: "run_arrowhedge_axis_a",
      source: "packages/capability-finance-research-ingest/src/arrowhedge.test.ts",
      sourceRecordIds: [
        "ticker:AAPL",
        "risk:risk_aapl_1400",
        "decision:dec_aapl_buy_120",
      ],
      substrateRefs: {
        graphNodeIds: [
          "00000000-0000-4000-8000-00000000f001",
          "00000000-0000-4000-8000-00000000f002",
        ],
        eventIds: ["evt_signal", "evt_risk", "evt_decision"],
        projectionIds: ["arrowhedge_cop"],
      },
      operationalSamples: [
        {
          adapterStartedAt: timestamp("2026-06-03T16:29:58.000Z"),
          firstValidEventAt: timestamp("2026-06-03T16:30:00.000Z"),
          mappingAttempts: 9,
          mappingRejections: 1,
          stateComparisons: 3,
          stateDisagreements: 1,
        },
      ],
    });

    expect(suite.summaries.map((summary) => summary.failureClass)).toEqual([
      "representation_loss",
      "source_authority_conflict",
      "stale_observation",
      "workflow_invalidation",
      "capability_contract_violation",
    ]);
    expect(suite.events).toHaveLength(10);

    const metrics = analyzeEvalEvents(suite.events);
    expect(metrics).toMatchObject({
      pairedGroups: 5,
      completePairedGroups: 5,
      baselineFailures: 5,
      substrateFailures: 1,
      failureReduction: 4,
      authorityGatePassRate: 0.75,
    });
    expect(metrics.byFailureClass["capability_contract_violation"]).toMatchObject({
      baselineFailures: 1,
      substrateFailures: 1,
      failureReduction: 0,
    });
    expect(metrics.byFailureClass["representation_loss"]).toMatchObject({
      failureReduction: 1,
      substratePasses: 1,
    });

    const operational = analyzeAdapterOperationalMetrics(
      suite.events,
      suite.operationalSamples,
    );
    expect(operational).toEqual({
      adapterTimeToFirstValidEventMs: 2000,
      mappingRejectionRate: 1 / 9,
      stateDisagreementRate: 1 / 3,
      authorityGatePassRate: 0.75,
      authorityGatePasses: 3,
      authorityGateFailures: 1,
    });
  });
});
