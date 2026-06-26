import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import { validateEvalEvent } from "./schema.js";
import { buildMarketingAxisBBlockedEval } from "./marketing.js";

describe("marketing Axis B blocker eval", () => {
  it("emits a blocked eval when PluggedInSocial or authoritative fixtures are unavailable", () => {
    const event = buildMarketingAxisBBlockedEval({
      tenantId: tenantId("tnt_axis_b_blocked"),
      observedAt: timestamp("2026-06-25T04:00:00.000Z"),
    });

    expect(event.axis).toBe("marketing");
    expect(event.result).toBe("blocked");
    expect(event.evidenceRefs).toHaveLength(0);
    expect(event.substrateRefs).toHaveLength(0);
    expect(event.notes).toContain("./pluggedinsocial");
    expect(event.notes).toContain("No authoritative agency fixtures");
    expect(validateEvalEvent(event)).toEqual({ valid: true, issues: [] });
  });
});
