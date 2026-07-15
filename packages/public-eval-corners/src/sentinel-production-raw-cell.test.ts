import { describe, expect, it } from "vitest";

import {
  deriveSentinelRawCellMeasurement,
  type SentinelRawCellVerification,
} from "./sentinel-production-raw-cell.js";

function verifiedCell(overrides: {
  readonly rawComplete?: boolean;
  readonly success?: boolean;
  readonly contact?: boolean;
} = {}): SentinelRawCellVerification {
  const contact = overrides.contact ?? true;
  return {
    rawComplete: overrides.rawComplete ?? true,
    cell: {
      cellId: "registration:qualification:repeat-01:microhub-relative:substrate",
      taskId: "microhub-relative",
      taskRole: "state-retention-relative",
      arm: "substrate",
      repeatId: "repeat-01",
    },
    task: { role: "state-retention-relative", conditionAtSeconds: 565.42 },
    uninterpretedResult: {
      success: overrides.success ?? true,
      contact_get_time: contact ? 566 : null,
      contact_post_time: contact ? 567 : null,
      contact_message: contact ? "observed condition" : null,
    },
    provider: { totalInputTokens: 100, totalOutputTokens: 20, totalLatencyMs: 50 },
    supervisor: { attemptDurationMs: 630_000 },
  } as unknown as SentinelRawCellVerification;
}

describe("Sentinel raw cell outcome derivation", () => {
  it("does not derive any caller/upstream outcome before raw completion", () => {
    expect(() => deriveSentinelRawCellMeasurement(verifiedCell({ rawComplete: false })))
      .toThrow(/not eligible for outcome derivation/iu);
  });

  it("rejects an upstream success boolean contradicted by raw contact evidence", () => {
    expect(() => deriveSentinelRawCellMeasurement(verifiedCell({ success: true, contact: false })))
      .toThrow(/claims success without a post-condition raw contact/iu);
  });

  it("derives the exact upstream strict success only after raw completion", () => {
    const measurement = deriveSentinelRawCellMeasurement(verifiedCell());
    expect(measurement.behavioralSuccess).toBe(true);
    expect(measurement.arm).toBe("substrate");
    expect(measurement.providerInputTokens).toBe(100);
  });
});
