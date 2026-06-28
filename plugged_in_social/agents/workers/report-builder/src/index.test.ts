/**
 * Smoke tests for stevie-report-builder.
 *
 * Two layers:
 *   1. Message-contract validation (validateMessage).
 *   2. The retry-classification decision tree, exercised via a mocked
 *      BackendClient (the only collaborator — there's no third-party API
 *      to stub here, unlike stripe-sync's Stripe leg).
 *
 * End-to-end tests against a real FastAPI dev server live in
 * /scripts/test-report-builder.sh (covered in a later task).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type ReportBuildMessage,
} from "@stevie/shared";
import {
  BackendCallError,
  BackendClient,
} from "@stevie/backend-client";

// ── Contract validation ─────────────────────────────────────

describe("validateMessage(report.build)", () => {
  const valid: ReportBuildMessage = {
    type: "report.build",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "report-build-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    client_report_id: "aa-bb-cc",
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<ReportBuildMessage>(valid, "report.build")
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<ReportBuildMessage>(
        { ...valid, type: "stripe.invoice.sync" },
        "report.build"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<ReportBuildMessage>(rest, "report.build")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<ReportBuildMessage>(
        { ...valid, idempotency_key: "" },
        "report.build"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<ReportBuildMessage>(null, "report.build")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<ReportBuildMessage>("string", "report.build")
    ).toThrow(InvalidMessageError);
  });
});

// ── Retry-classification decision tree ──────────────────────
//
// We exercise the queue() handler as if CF Queues delivered a single message,
// with the BackendClient.renderReport mocked. We assert msg.ack() vs
// msg.retry() through a fake msg object — that's the observable side-effect
// handleConsumerError() ultimately produces.

interface FakeMsg {
  body: unknown;
  ack: ReturnType<typeof vi.fn>;
  retry: ReturnType<typeof vi.fn>;
}

function makeMsg(body: unknown): FakeMsg {
  return {
    body,
    ack: vi.fn(),
    retry: vi.fn(),
  };
}

const ENV = {
  WEBHOOK_SECRET: "test-secret",
  BACKEND_BASE_URL: "https://backend.test",
  ENVIRONMENT: "development" as const,
};

const VALID_MSG: ReportBuildMessage = {
  type: "report.build",
  org_id: "11111111-2222-3333-4444-555555555555",
  idempotency_key: "report-build-abc123",
  emitted_at: "2026-05-01T12:00:00Z",
  client_report_id: "aa-bb-cc",
};

describe("queue handler — retry classification", () => {
  // `any` here so the tests aren't coupled to vitest's MockInstance generic
  // (which has changed shape across minor versions). The runtime behaviour
  // we assert on (`mock.calls`, `mockResolvedValueOnce`, etc.) is stable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let renderSpy: any;

  beforeEach(() => {
    renderSpy = vi.spyOn(BackendClient.prototype, "renderReport");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("204 (rendered) → msg.ack()", async () => {
    renderSpy.mockResolvedValue(undefined);

    // Late-import the handler so the spies above are in place when the
    // module first reads BackendClient.prototype.
    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(renderSpy).toHaveBeenCalledTimes(1);
    const arg = renderSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      client_report_id: VALID_MSG.client_report_id,
      org_id: VALID_MSG.org_id,
    });
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("backend 5xx → RetryableError → msg.retry()", async () => {
    renderSpy.mockRejectedValueOnce(
      new BackendCallError("backend down", 503)
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("backend 404 (report deleted) → PermanentError → msg.ack()", async () => {
    renderSpy.mockRejectedValueOnce(
      new BackendCallError("client report not found", 404)
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    // PermanentError → handleConsumerError ack()s the message (effectively
    // dropping a deleted-report message; CF Queues won't retry an ack'd
    // message).
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("backend 409 (already generated) → PermanentError → msg.ack()", async () => {
    renderSpy.mockRejectedValueOnce(
      new BackendCallError("report already generated", 409)
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("malformed message (missing org_id) → PermanentError → msg.ack()", async () => {
    const { default: handler } = await import("./index.js");
    const { org_id: _omit, ...badBody } = VALID_MSG;
    const msg = makeMsg(badBody);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    // The Worker promotes InvalidMessageError to PermanentError so a
    // producer bug doesn't burn the retry budget — the bad message is
    // ack'd immediately and CF Queues sends it to the DLQ for operator
    // review on the next retry trip.
    expect(renderSpy).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });
});

// Surface the imports so unused-import lint doesn't drop them.
void PermanentError;
void RetryableError;
