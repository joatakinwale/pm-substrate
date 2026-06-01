import { describe, expect, it } from "vitest";
import { normalizeCapability } from "@pm/registry";

import {
  FINANCE_RESEARCH_INGEST_CAPABILITY,
  FINANCE_RESEARCH_EVENT_TYPES,
} from "./capability.js";

describe("FINANCE_RESEARCH_INGEST_CAPABILITY", () => {
  it("declares the Axis A event types as typed v1 emits", () => {
    expect(FINANCE_RESEARCH_EVENT_TYPES).toEqual([
      "analyst.signal.created",
      "risk.state.validated",
      "portfolio.decision.proposed",
      "portfolio.decision.accepted",
      "workflow.blocked.stale_state",
    ]);

    const normalized = normalizeCapability(FINANCE_RESEARCH_INGEST_CAPABILITY);
    expect(normalized.untyped).toBe(false);
    expect(normalized.emits.map((e) => e.schema.type)).toEqual(
      FINANCE_RESEARCH_EVENT_TYPES,
    );
    for (const emit of normalized.emits) {
      expect(emit.schema.version).toEqual({ major: 1, minor: 0, patch: 0 });
      expect(emit.schema.schemaPath).toMatch(/^schemas\/.+\.v1\.json$/);
    }
  });

  it("keeps ingest profile-bound without requiring substrate writes", () => {
    expect(FINANCE_RESEARCH_INGEST_CAPABILITY.readsInterfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ interface: "Engagement", required: true }),
        expect.objectContaining({ interface: "Event", required: true }),
        expect.objectContaining({ interface: "Resource", required: false }),
        expect.objectContaining({ interface: "Document", required: false }),
      ]),
    );
    expect(FINANCE_RESEARCH_INGEST_CAPABILITY.writesInterfaces).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          interface: "Event",
          fields: expect.arrayContaining(["kind", "occurredAt"]),
          ownership: "contributor",
        }),
      ]),
    );
    expect(FINANCE_RESEARCH_INGEST_CAPABILITY.requiredPermissions).toEqual([
      "finance-research.ingest.write",
    ]);
  });
});
