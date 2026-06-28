/**
 * Smoke tests for stevie-stripe-sync.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit real Stripe — they validate the message contract and
 * the ack/retry decision tree. Integration tests against Stripe Test Mode
 * live in /scripts/test-stripe-sync.sh (covered in a later task).
 */
import { describe, expect, it } from "vitest";
import {
  InvalidMessageError,
  validateMessage,
  type StripeSyncMessage,
} from "@stevie/shared";

describe("validateMessage(stripe.invoice.sync)", () => {
  const valid: StripeSyncMessage = {
    type: "stripe.invoice.sync",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "stripe-sync-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    invoice_id: "aa-bb-cc",
    stripe_invoice_id: "in_1ABCDEF",
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<StripeSyncMessage>(valid, "stripe.invoice.sync")
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<StripeSyncMessage>(
        { ...valid, type: "email.notification" },
        "stripe.invoice.sync"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<StripeSyncMessage>(rest, "stripe.invoice.sync")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<StripeSyncMessage>(
        { ...valid, idempotency_key: "" },
        "stripe.invoice.sync"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<StripeSyncMessage>(null, "stripe.invoice.sync")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<StripeSyncMessage>("string", "stripe.invoice.sync")
    ).toThrow(InvalidMessageError);
  });
});
