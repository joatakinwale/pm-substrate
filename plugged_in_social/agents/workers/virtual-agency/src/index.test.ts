/**
 * Smoke tests for stevie-virtual-agency.
 *
 * Two layers:
 *   1. Message-contract validation (validateMessage).
 *   2. The retry-classification decision tree, exercised via a mocked
 *      fetch() call to the FastAPI internal webhook.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  InvalidMessageError,
  validateMessage,
  type VirtualAgencyMessage,
} from "@stevie/shared";

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

const VALID_MSG: VirtualAgencyMessage = {
  type: "virtual_agency.task",
  org_id: "11111111-2222-3333-4444-555555555555",
  idempotency_key: "virtual-agency-task-abc123",
  emitted_at: "2026-05-01T12:00:00Z",
  agent_role: "content_creative",
  project_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  task_id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  orchestration_task_id: "cccccccc-dddd-eeee-ffff-000000000000",
  task_version: 1,
  approval_version: 1,
  approval_payload_hash: "9".repeat(64),
  lineage: {
    client_request: "Launch a June campaign",
    project_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    legacy_task_id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
  },
  context: { draft_type: "post", tone: "friendly" },
};

const SOURCELESS_TASK_MSG: VirtualAgencyMessage = {
  ...VALID_MSG,
  task_id: null,
  orchestration_task_id: "dddddddd-eeee-ffff-0000-111111111111",
  task_version: 2,
  lineage: {
    ...VALID_MSG.lineage,
    legacy_task_id: "dddddddd-eeee-ffff-0000-111111111111",
    orchestration_task_id: "dddddddd-eeee-ffff-0000-111111111111",
  },
  context: {
    report_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    proposal_kind: "next_action",
  },
};

describe("validateMessage(virtual_agency.task)", () => {
  it("accepts a well-formed message", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(VALID_MSG, "virtual_agency.task")
    ).not.toThrow();
  });

  it("accepts a source-less orchestration task with null legacy task id", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        SOURCELESS_TASK_MSG,
        "virtual_agency.task"
      )
    ).not.toThrow();
  });

  it("rejects an invalid legacy task id when provided", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        { ...VALID_MSG, task_id: "not-a-uuid" },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects mismatched type", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        { ...VALID_MSG, type: "automation.run" },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing org_id", () => {
    const { org_id: _omit, ...rest } = VALID_MSG;
    expect(() =>
      validateMessage<VirtualAgencyMessage>(rest, "virtual_agency.task")
    ).toThrow(InvalidMessageError);
  });

  it("rejects empty idempotency_key", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        { ...VALID_MSG, idempotency_key: "" },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects unparseable emitted_at", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        { ...VALID_MSG, emitted_at: "not-a-date" },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing orchestration task id", () => {
    const { orchestration_task_id: _omit, ...rest } = VALID_MSG;
    expect(() =>
      validateMessage<VirtualAgencyMessage>(rest, "virtual_agency.task")
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing task version", () => {
    const { task_version: _omit, ...rest } = VALID_MSG;
    expect(() =>
      validateMessage<VirtualAgencyMessage>(rest, "virtual_agency.task")
    ).toThrow(InvalidMessageError);
  });

  it("rejects unknown agent role", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        { ...VALID_MSG, agent_role: "content_writer" },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects invalid approval payload hash", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        { ...VALID_MSG, approval_payload_hash: "not-a-sha256" },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects missing required lineage fields", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        {
          ...VALID_MSG,
          lineage: {
            client_request: "Launch a June campaign",
            project_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          },
        },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("validates optional marketing-run lineage ids", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        {
          ...VALID_MSG,
          lineage: {
            ...VALID_MSG.lineage,
            engagement_id: "dddddddd-eeee-ffff-0000-111111111111",
            marketing_run_id: "eeeeeeee-ffff-0000-1111-222222222222",
          },
        },
        "virtual_agency.task"
      )
    ).not.toThrow();
    expect(() =>
      validateMessage<VirtualAgencyMessage>(
        {
          ...VALID_MSG,
          lineage: {
            ...VALID_MSG.lineage,
            marketing_run_id: "not-a-uuid",
          },
        },
        "virtual_agency.task"
      )
    ).toThrow(InvalidMessageError);
  });

  it("rejects non-object input", () => {
    expect(() =>
      validateMessage<VirtualAgencyMessage>(null, "virtual_agency.task")
    ).toThrow(InvalidMessageError);
    expect(() =>
      validateMessage<VirtualAgencyMessage>("string", "virtual_agency.task")
    ).toThrow(InvalidMessageError);
  });
});

describe("queue handler — retry classification", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let fetchSpy: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("200 → msg.ack() with the internal webhook payload", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://backend.test/api/internal/virtual-agency/task");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      "x-webhook-secret": "test-secret",
    });
    expect(JSON.parse(init.body as string)).toEqual(VALID_MSG);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("429 → RetryableError → msg.retry()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "rate limited" }), {
        status: 429,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("500 → RetryableError → msg.retry()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "backend down" }), {
        status: 503,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("425 dependency not ready → RetryableError → msg.retry()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "dependencies not satisfied" }), {
        status: 425,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
  });

  it("400 → PermanentError → msg.ack()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "bad request" }), {
        status: 400,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("409 invariant conflict → PermanentError → msg.ack()", async () => {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ error: "stale approval" }), {
        status: 409,
      }) as unknown as Response
    );

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });

  it("network failure → RetryableError → msg.retry()", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("socket hang up"));

    const { default: handler } = await import("./index.js");
    const msg = makeMsg(VALID_MSG);

    await handler.queue(
      { messages: [msg] } as unknown as MessageBatch<unknown>,
      ENV,
      {} as unknown as ExecutionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(msg.retry).toHaveBeenCalledTimes(1);
    expect(msg.ack).not.toHaveBeenCalled();
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

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(msg.ack).toHaveBeenCalledTimes(1);
    expect(msg.retry).not.toHaveBeenCalled();
  });
});
