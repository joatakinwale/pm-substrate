import { describe, expect, it } from "vitest";
import { entityId, tenantId, timestamp } from "@pm/types";

import { buildAdapterStateProofEvalPair } from "./adapter-proof.js";
import { analyzeEvalEvents } from "./metrics.js";

describe("adapter state-proof evals", () => {
  it("emits a paired representation-loss eval for source-to-projection onboarding", () => {
    const pair = buildAdapterStateProofEvalPair({
      tenantId: tenantId("tnt_adapter_eval"),
      observedAt: timestamp("2026-06-03T16:00:00.000Z"),
      agentId: "adapter_proof_agent",
      runIdPrefix: "run_adapter_state_proof",
      scenarioId: "agency-source-row-onboarding",
      source: "packages/profile-agency/src/adapter-state-proof.integration.test.ts",
      sourceRecords: [
        {
          sourceRecordId: "org_acme",
          graphNodeId: entityId("00000000-0000-4000-8000-00000000a001"),
          adapterEventId: "evt_org_acme",
          concrete: "ClientOrg",
        },
        {
          sourceRecordId: "proj_brand",
          graphNodeId: entityId("00000000-0000-4000-8000-00000000a002"),
          adapterEventId: "evt_proj_brand",
          concrete: "Project",
        },
      ],
      projectionId: "adapter_state_proof_projection",
    });

    expect(pair.summary).toEqual({
      scenarioId: "agency-source-row-onboarding",
      failureClass: "representation_loss",
      coordinationClass: "derived_projection",
      baselineResult: "fail",
      substrateResult: "pass",
      sourceRecordCount: 2,
      substrateRefCount: 5,
      improvement: 1,
    });

    const [baseline, substrate] = pair.events;
    expect(baseline).toMatchObject({
      axis: "marketing",
      runArm: "baseline",
      pairedRunGroup: "pair_agency-source-row-onboarding",
      failureClass: "representation_loss",
      result: "fail",
    });
    expect(substrate).toMatchObject({
      axis: "marketing",
      runArm: "substrate",
      pairedRunGroup: "pair_agency-source-row-onboarding",
      failureClass: "representation_loss",
      result: "pass",
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge: "knowledge_update",
      mastCategory: "task_verification",
      coordinationClass: "derived_projection",
    });
    expect(substrate.substrateRefs).toEqual([
      { kind: "graph_node", id: "00000000-0000-4000-8000-00000000a001", label: "ClientOrg" },
      { kind: "event", id: "evt_org_acme", label: "adapter.entity_mapped" },
      { kind: "graph_node", id: "00000000-0000-4000-8000-00000000a002", label: "Project" },
      { kind: "event", id: "evt_proj_brand", label: "adapter.entity_mapped" },
      { kind: "projection", id: "adapter_state_proof_projection", label: "adapter state projection" },
    ]);

    const metrics = analyzeEvalEvents(pair.events);
    expect(metrics).toMatchObject({
      totalEvents: 2,
      completePairedGroups: 1,
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 1,
    });
    expect(metrics.byFailureClass["representation_loss"]).toMatchObject({
      events: 2,
      pairedGroups: 1,
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(metrics.byCoordinationClass["derived_projection"]).toMatchObject({
      events: 2,
      pairedGroups: 1,
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 1,
      substratePasses: 1,
    });
  });
});
