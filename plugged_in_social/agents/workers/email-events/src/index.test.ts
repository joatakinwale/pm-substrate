/**
 * Smoke tests for stevie-email-events.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit Resend or the backend — we sign a payload with the
 * Svix SDK using a known test secret, then exercise the Worker's fetch
 * handler with the resulting headers. The backend client is replaced
 * via vi.mock so a 200 is "would have called recordEmailEvent" rather
 * than an actual HTTP round-trip.
 *
 * Integration coverage (real Resend → real Worker → real FastAPI) lives
 * in /scripts/test-email-events.sh, not in this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "svix";

const recordEmailEvent = vi.fn();
vi.mock("@stevie/backend-client", async () => {
  const actual = await vi.importActual<typeof import("@stevie/backend-client")>(
    "@stevie/backend-client"
  );
  return {
    ...actual,
    BackendClient: class {
      recordEmailEvent = recordEmailEvent;
    },
  };
});

// Imported AFTER the mock so the Worker resolves the mocked BackendClient.
import worker from "./index.js";

// Svix test secrets must be base64; the SDK accepts the "whsec_" prefix
// and strips it. This value is for tests only — the real secret comes
// from `wrangler secret put RESEND_WEBHOOK_SECRET`.
const TEST_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

const baseEnv = {
  WEBHOOK_SECRET: "test-webhook-secret",
  BACKEND_BASE_URL: "https://api.example.test",
  ENVIRONMENT: "development" as const,
  RESEND_WEBHOOK_SECRET: TEST_SECRET,
};

function buildResendEvent(type: string): object {
  return {
    type,
    created_at: "2026-05-01T12:00:00.000Z",
    data: {
      email_id: "4ef9a417-1111-2222-3333-444455556666",
      from: "hello@example.test",
      to: ["recipient@example.test"],
      subject: "Test subject",
      // Click events nest the URL under `click`; harmless on other types.
      click: { link: "https://example.test/path" },
    },
  };
}

/**
 * Sign a payload the way Resend would, returning the Request the Worker
 * should see. Uses the Svix SDK's symmetric sign() so the verify() call
 * inside the Worker sees a valid signature.
 */
async function buildSignedRequest(body: object): Promise<Request> {
  const wh = new Webhook(TEST_SECRET);
  const id = "msg_test_" + Math.random().toString(36).slice(2);
  const timestamp = new Date();
  const raw = JSON.stringify(body);
  const signature = wh.sign(id, timestamp, raw);
  return new Request("https://email-events.workers.dev/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "svix-id": id,
      "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "svix-signature": signature,
    },
    body: raw,
  });
}

const noopCtx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

describe("email-events Worker", () => {
  beforeEach(() => {
    recordEmailEvent.mockReset();
    recordEmailEvent.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid signature and forwards to the backend", async () => {
    const req = await buildSignedRequest(buildResendEvent("email.opened"));
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    expect(recordEmailEvent).toHaveBeenCalledTimes(1);
    const body = recordEmailEvent.mock.calls[0]![0];
    expect(body.event_type).toBe("opened");
    expect(body.message_id).toBe("4ef9a417-1111-2222-3333-444455556666");
    expect(body.to).toBe("recipient@example.test");
    expect(body.subject).toBe("Test subject");
  });

  it("forwards link_url for click events", async () => {
    const req = await buildSignedRequest(buildResendEvent("email.clicked"));
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    const body = recordEmailEvent.mock.calls[0]![0];
    expect(body.event_type).toBe("clicked");
    expect(body.link_url).toBe("https://example.test/path");
  });

  it("rejects a bad signature with 401", async () => {
    const req = await buildSignedRequest(buildResendEvent("email.opened"));
    // Tamper with the signature header — simplest way to invalidate it.
    const headers = new Headers(req.headers);
    headers.set("svix-signature", "v1,invalidsignaturebytes");
    const tampered = new Request(req.url, {
      method: "POST",
      headers,
      body: await req.text(),
    });
    const res = await worker.fetch(tampered, baseEnv, noopCtx);
    expect(res.status).toBe(401);
    expect(recordEmailEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing signature header with 401", async () => {
    const raw = JSON.stringify(buildResendEvent("email.opened"));
    const req = new Request("https://email-events.workers.dev/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
    });
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(401);
    expect(recordEmailEvent).not.toHaveBeenCalled();
  });

  it("returns 204 and skips backend on an unsupported event type", async () => {
    // Signature is valid; the Worker just shouldn't forward this one.
    const req = await buildSignedRequest(buildResendEvent("email.delivery_delayed"));
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    expect(recordEmailEvent).not.toHaveBeenCalled();
  });

  it("rejects a malformed body (missing data.email_id) with 400", async () => {
    const malformed = {
      type: "email.opened",
      created_at: "2026-05-01T12:00:00.000Z",
      data: { from: "hello@example.test" },
    };
    const req = await buildSignedRequest(malformed);
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(400);
    expect(recordEmailEvent).not.toHaveBeenCalled();
  });

  it("rejects a body with no 'type' field with 400", async () => {
    const malformed = {
      data: { email_id: "abc-123" },
    };
    const req = await buildSignedRequest(malformed);
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(400);
    expect(recordEmailEvent).not.toHaveBeenCalled();
  });
});
