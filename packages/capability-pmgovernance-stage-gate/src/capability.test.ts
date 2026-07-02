import { describe, expect, it } from "vitest";
import { PM_STAGE_GATE_CAPABILITY } from "./capability.js";

describe("PM_STAGE_GATE_CAPABILITY", () => {
  it("declares the approval subscription and the typed v1 emit", () => {
    expect(PM_STAGE_GATE_CAPABILITY.subscribesTo.map((s) => s.pattern)).toEqual([
      "pm.approval.approved",
    ]);
    expect(PM_STAGE_GATE_CAPABILITY.emits.map((e) => e.schema.type)).toEqual([
      "pm.workitem.advanced",
    ]);
    expect(PM_STAGE_GATE_CAPABILITY.readsEdges).toEqual([
      "pmgovernance/requests",
    ]);
  });

  it("writes only WorkItem.state and owns it", () => {
    expect(PM_STAGE_GATE_CAPABILITY.writesInterfaces).toEqual([
      { interface: "Engagement", fields: ["state"], ownership: "owner" },
    ]);
  });
});
