/**
 * Smoke tests for stevie-mux-ingest.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit real Mux or R2 — they validate the message contract and
 * the InvalidMessageError surface. Integration tests against Mux Dev Mode
 * + a real R2 object live in /scripts/test-mux-ingest.sh (covered in a
 * later task).
 */
import { describe, expect, it } from "vitest";
import {
  InvalidMessageError,
  validateMessage,
  type MuxIngestMessage,
} from "@stevie/shared";

describe("validateMessage(mux.asset.ingest)", () => {
  const valid: MuxIngestMessage = {
    type: "mux.asset.ingest",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "mux-ingest-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    asset_id: "aa-bb-cc",
    r2_key: "org-slug/videos/2026/05/clip.mp4",
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<MuxIngestMessage>(valid, "mux.asset.ingest")
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<MuxIngestMessage>(
        { ...valid, type: "email.notification" },
        "mux.asset.ingest"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<MuxIngestMessage>(rest, "mux.asset.ingest")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<MuxIngestMessage>(
        { ...valid, idempotency_key: "" },
        "mux.asset.ingest"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing emitted_at", () => {
    const { emitted_at: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<MuxIngestMessage>(rest, "mux.asset.ingest")
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<MuxIngestMessage>(null, "mux.asset.ingest")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<MuxIngestMessage>("string", "mux.asset.ingest")
    ).toThrow(InvalidMessageError);
  });
});
