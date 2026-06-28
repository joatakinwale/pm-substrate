/**
 * Smoke tests for stevie-automation-runner.
 *
 * Two layers:
 *   1. Message-contract validation (validateMessage).
 *   2. The retry-classification decision tree, exercised via a mocked
 *      BackendClient (the only collaborator — there's no third-party API
 *      to stub here, unlike ai-content's AI Gateway leg).
 *
 * End-to-end tests against a real FastAPI dev server live in
 * /scripts/test-automation-runner.sh (covered in a later task).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type AutomationRunMessage,
} from "@stevie/shared";
import {
  BackendCallError,
  BackendClient,
} from "@stevie/backend-client";

// ── Contract validation ─────────────────────────────────────

describe("validateMessage(automation.run)", () => {
  const valid: AutomationRunMessage = {
    type: "automation.run",
    org_id: "11111111-2222-3333-4444-555555555555",
    idempotency_key: "automation-run-abc123",
    emitted_at: "2026-05-01T12:00:00Z",
    automation_id: "aa-bb-cc",
    trigger_event: "form_submission",
    trigger_data: { form_id: "form-123", contact_id: "contact-456" },
  };

  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<AutomationRunMessage>(valid, "automation.run")
    ).not.toThrow();
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<AutomationRunMessage>(
        { ...valid, type: "stripe.invoice.sync" },
        "automation.run"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = valid;
    expect(() =>
      validateMessage<AutomationRunMessage>(rest, "automation.run")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<AutomationRunMessage>(
        { ...valid, idempotency_key: "" },
        "automation.run"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<AutomationRunMessage>(null, "automation.run")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<AutomationRunMessage>("string", "automation.run")
    ).toThrow(InvalidMessageError);
  });
});

// ── Retry-classification decision tree ──────────────────────
//
// We exercise the queue() handler as if CF Queues delivered a single message,
// with the BackendClient.executeAutomation mocked. We assert msg.ack() vs
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

const VALID_MSG: AutomationRunMessage = {
  type: "automation.run",
  org_id: "11111111-2222-3333-4444-555555555555",
  idempotency_key: "automation-run-abc123",
  emitted_at: "2026-05-01T12:00:00Z",
  automation_id: "aa-bb-cc",
  trigger_event: "form_submission",
  trigger_data: { form_id: "form-123", contact_id: "contact-456" },
};

describe("queue handler — retry classification", () => {
  // `any` here so the tests aren't coupled to vitest's MockInstance generic
  // (which has changed shape across minor versions). The runtime behaviour
  // we assert on (`mock.calls`, `mockResolvedValueOnce`, etc.) is stable.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let executeSpy: any;

  beforeEach(() => {
    executeSpy = vi.spyOn(BackendClient.prototype, "executeAutomation");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("200 (completed) → msg.ack()", async () => {
    executeSpy.mockResolvedValue({ status: "completed" });

    // Late-import the handler so the spies above are in place when the
    // module first reads BackendClient.prototype.
    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    const arg = executeSpy.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg).toMatchObject({
      automation_id: VALID_MSG.automation_id,
      org_id: VALID_MSG.org_id,
      trigger_event: VALID_MSG.trigger_event,
      trigger_data: VALID_MSG.trigger_data,
    });
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("202 (paused at wait step) → msg.ack()", async () => {
    executeSpy.mockResolvedValue({ status: "paused" });

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(executeSpy).toHaveBeenCalledTimes(1);
    // Paused runs ack — the resume mechanism is OUT of scope (see README).
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("backend 5xx → RetryableError → msg.retry()", async () => {
    executeSpy.mockRejectedValueOnce(
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

  it("backend 404 (automation deleted) → PermanentError → msg.ack()", async () => {
    executeSpy.mockRejectedValueOnce(
      new BackendCallError("automation not found", 404)
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    // PermanentError → handleConsumerError ack()s the message (DLQ on next
    // retry trip — but since CF Queues doesn't retry an ack'd message, this
    // effectively drops a deleted-automation message cleanly).
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("backend 410 (automation disabled) → PermanentError → msg.ack()", async () => {
    executeSpy.mockRejectedValueOnce(
      new BackendCallError("automation gone", 410)
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
    expect(executeSpy).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });
});

// Surface the imports so unused-import lint doesn't drop them.
void PermanentError;
void RetryableError;
