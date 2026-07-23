/**
 * Sanity checks for the Tier-1 types module. These are runtime-cheap and
 * exist mainly to catch refactoring damage and accidental API removal.
 */

import { describe, expect, it } from "vitest";
import {
  capabilityId,
  edgeId,
  entityId,
  eventId,
  now,
  tenantId,
  timestamp,
  workflowId,
} from "./common.js";

describe("@pm/types branded IDs", () => {
  it("branded constructors return the underlying string", () => {
    expect(tenantId("t1") as string).toBe("t1");
    expect(entityId("e1") as string).toBe("e1");
    expect(edgeId("g1") as string).toBe("g1");
    expect(eventId("v1") as string).toBe("v1");
    expect(capabilityId("c1") as string).toBe("c1");
    expect(workflowId("w1") as string).toBe("w1");
  });

  it("now() returns an ISO-8601 timestamp", () => {
    const ts = now();
    expect(typeof (ts as unknown as string)).toBe("string");
    expect(new Date(ts as unknown as string).toString()).not.toBe("Invalid Date");
  });

  it("timestamp() roundtrips", () => {
    const ts = timestamp("2026-05-01T00:00:00.000Z");
    expect(ts as unknown as string).toBe("2026-05-01T00:00:00.000Z");
  });
});
