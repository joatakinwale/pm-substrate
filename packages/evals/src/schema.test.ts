import { describe, expect, it } from "vitest";
import type { TenantId, Timestamp } from "@pm/types";

import {
  EVAL_AXES,
  FAILURE_CLASSES,
  RUN_ARMS,
  assertEvalEvent,
  evalEvidenceRef,
  evalEvent,
  isEvalEvent,
  validateEvalEvent,
} from "./schema.js";

const baseEvent = {
  tenantId: "tnt_eval" as TenantId,
  axis: "finance",
  runId: "run_arrow_001",
  agentId: "portfolio_manager",
  scenarioId: "stale-price-after-signals",
  failureClass: "stale_observation",
  observedAt: "2026-05-27T15:00:00.000Z" as Timestamp,
  source: "arrowhedge/backtest",
  evidenceRefs: [
    evalEvidenceRef("event", "evt_price_refresh"),
    evalEvidenceRef("external_fixture", "fixtures/arrowhedge/stale-price.json"),
  ],
  substrateRefs: [
    evalEvidenceRef("graph_node", "node_portfolio_state"),
    evalEvidenceRef("workflow_run", "wf_research_run"),
  ],
  runArm: "baseline",
  pairedRunGroup: "pair_stale_price_seed_001",
  result: "fail",
  notes: "Portfolio decision used an analyst signal created before the price refresh.",
} as const;

describe("eval event schema", () => {
  it("exports the canonical axes and failure classes", () => {
    expect(EVAL_AXES).toEqual(["finance", "marketing", "local_lab"]);
    expect(RUN_ARMS).toEqual(["baseline", "substrate"]);
    expect(FAILURE_CLASSES).toContain("partial_observation");
    expect(FAILURE_CLASSES).toContain("continuity_break");
  });

  it("accepts a valid state-failure eval event", () => {
    const result = validateEvalEvent(baseEvent);
    expect(result).toEqual({ valid: true, issues: [] });
    expect(isEvalEvent(baseEvent)).toBe(true);
    expect(assertEvalEvent(baseEvent)).toEqual(baseEvent);
  });

  it("collects shape and enum issues without short-circuiting", () => {
    const result = validateEvalEvent({
      ...baseEvent,
      tenantId: "",
      axis: "unknown",
      failureClass: "generic_bug",
      observedAt: "not-a-date",
      result: "maybe",
      evidenceRefs: [{ kind: "event", id: "" }],
      substrateRefs: [{ kind: "bad_ref", id: "x" }],
      notes: "",
    });

    expect(result.valid).toBe(false);
    expect(result.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining([
        "/tenantId",
        "/axis",
        "/failureClass",
        "/observedAt",
        "/result",
        "/evidenceRefs/0/id",
        "/substrateRefs/0/kind",
        "/notes",
      ]),
    );
  });

  it("requires evidence and substrate references for pass/fail results", () => {
    const result = validateEvalEvent({
      ...baseEvent,
      evidenceRefs: [],
      substrateRefs: [],
      result: "pass",
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          path: "/evidenceRefs",
          message: "pass/fail eval events require at least one evidence reference",
        },
        {
          path: "/substrateRefs",
          message: "pass/fail eval events require at least one substrate reference",
        },
      ]),
    );
  });

  it("allows blocked events to name the missing evidence in notes", () => {
    const event = evalEvent({
      ...baseEvent,
      result: "blocked",
      evidenceRefs: [],
      substrateRefs: [],
      notes: "Blocked: PluggedInSocial local clone is missing, so source schema evidence is unavailable.",
    });

    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });

  it("requires paired-run grouping for finance events", () => {
    const result = validateEvalEvent({
      ...baseEvent,
      runArm: undefined,
      pairedRunGroup: "",
    });

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        {
          path: "/runArm",
          message: "finance eval events require runArm baseline|substrate",
        },
        {
          path: "/pairedRunGroup",
          message: "finance eval events require non-empty pairedRunGroup",
        },
      ]),
    );
  });

  it("keeps marketing and local_lab events backwards-compatible without grouping", () => {
    const result = validateEvalEvent({
      ...baseEvent,
      axis: "marketing",
      runArm: undefined,
      pairedRunGroup: undefined,
      scenarioId: "publish-after-client-approval-revoked",
    });

    expect(result).toEqual({ valid: true, issues: [] });
  });

  it("validates optional confidence bands when present", () => {
    const valid = validateEvalEvent({
      ...baseEvent,
      confidenceBand: {
        low: -0.65,
        high: -0.42,
        method: "bootstrap",
      },
    });

    expect(valid).toEqual({ valid: true, issues: [] });

    const invalid = validateEvalEvent({
      ...baseEvent,
      confidenceBand: {
        low: "bad",
        high: 0.1,
        method: "coin_flip",
      },
    });

    expect(invalid.valid).toBe(false);
    expect(invalid.issues.map((i) => i.path)).toEqual(
      expect.arrayContaining([
        "/confidenceBand/low",
        "/confidenceBand/method",
      ]),
    );
  });
});
