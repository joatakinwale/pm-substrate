/**
 * Smoke tests for stevie-mux-webhook.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit Mux or the backend — we sign a payload using the
 * Worker runtime's WebCrypto with a known test secret, then exercise
 * the Worker's fetch handler with the resulting headers. The backend
 * client is replaced via vi.mock so a 204 means "would have called
 * recordMuxEvent" rather than an actual HTTP round-trip.
 *
 * Integration coverage (real Mux → real Worker → real FastAPI) lives
 * in /scripts/test-mux-webhook.sh, not in this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const recordMuxEvent = vi.fn();
vi.mock("@stevie/backend-client", async () => {
  const actual = await vi.importActual<typeof import("@stevie/backend-client")>(
    "@stevie/backend-client"
  );
  return {
    ...actual,
    BackendClient: class {
      recordMuxEvent = recordMuxEvent;
    },
  };
});

// Imported AFTER the mock so the Worker resolves the mocked BackendClient.
import worker from "./index.js";

const TEST_SECRET = "whsec_test_mux_signing_secret_value";

const baseEnv = {
  WEBHOOK_SECRET: "test-webhook-secret",
  BACKEND_BASE_URL: "https://api.example.test",
  ENVIRONMENT: "development" as const,
  MUX_WEBHOOK_SIGNING_SECRET: TEST_SECRET,
};

const noopCtx = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

interface MuxEvent {
  type: string;
  data: {
    id?: string;
    status?: string;
    duration?: number;
    passthrough?: string;
    playback_ids?: Array<{ id: string; policy: string }>;
    errors?: { type?: string; messages?: string[] };
  };
}

function buildMuxEvent(type: string, overrides?: Partial<MuxEvent["data"]>): MuxEvent {
  return {
    type,
    data: {
      id: "mux_asset_abc123",
      status: type === "video.asset.errored" ? "errored" : "ready",
      passthrough: "11111111-2222-3333-4444-555555555555",
      duration: 42.5,
      playback_ids: [{ id: "pb_xyz789", policy: "public" }],
      ...overrides,
    },
  };
}

/**
 * Sign a payload the way Mux would, returning the Request the Worker
 * should see. Uses WebCrypto so the verify() call inside the Worker
 * sees a valid signature.
 */
async function buildSignedRequest(body: object, opts?: { staleTimestamp?: boolean }): Promise<Request> {
  const raw = JSON.stringify(body);
  const ts = opts?.staleTimestamp
    ? Math.floor(Date.now() / 1000) - 3600 // 1h old → outside tolerance
    : Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(TEST_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(`${ts}.${raw}`));
  const sigHex = Array.from(new Uint8Array(sigBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return new Request("https://mux-webhook.workers.dev/", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "mux-signature": `t=${ts},v1=${sigHex}`,
    },
    body: raw,
  });
}

describe("mux-webhook Worker", () => {
  beforeEach(() => {
    recordMuxEvent.mockReset();
    recordMuxEvent.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts a valid signature and forwards video.asset.ready with thumbnail_url", async () => {
    const req = await buildSignedRequest(buildMuxEvent("video.asset.ready"));
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    expect(recordMuxEvent).toHaveBeenCalledTimes(1);
    const body = recordMuxEvent.mock.calls[0]![0];
    expect(body.event_type).toBe("video.asset.ready");
    expect(body.asset_id).toBe("11111111-2222-3333-4444-555555555555");
    expect(body.playback_id).toBe("pb_xyz789");
    expect(body.thumbnail_url).toBe(
      "https://image.mux.com/pb_xyz789/thumbnail.jpg?width=1920&height=1080&fit_mode=preserve&time=1"
    );
    expect(body.duration_seconds).toBe(42.5);
    expect(body.status).toBe("ready");
  });

  it("forwards video.asset.errored with error_message", async () => {
    const req = await buildSignedRequest(
      buildMuxEvent("video.asset.errored", {
        errors: { type: "input_error", messages: ["unsupported codec"] },
      })
    );
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    const body = recordMuxEvent.mock.calls[0]![0];
    expect(body.event_type).toBe("video.asset.errored");
    expect(body.status).toBe("errored");
    expect(body.error_message).toContain("input_error");
    expect(body.error_message).toContain("unsupported codec");
  });

  it("forwards video.asset.deleted with status=deleted", async () => {
    const req = await buildSignedRequest(buildMuxEvent("video.asset.deleted"));
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    const body = recordMuxEvent.mock.calls[0]![0];
    expect(body.event_type).toBe("video.asset.deleted");
    expect(body.status).toBe("deleted");
  });

  it("rejects a bad signature with 401", async () => {
    const req = await buildSignedRequest(buildMuxEvent("video.asset.ready"));
    const headers = new Headers(req.headers);
    headers.set(
      "mux-signature",
      `t=${Math.floor(Date.now() / 1000)},v1=0000000000000000000000000000000000000000000000000000000000000000`
    );
    const tampered = new Request(req.url, {
      method: "POST",
      headers,
      body: await req.text(),
    });
    const res = await worker.fetch(tampered, baseEnv, noopCtx);
    expect(res.status).toBe(401);
    expect(recordMuxEvent).not.toHaveBeenCalled();
  });

  it("rejects a missing signature header with 401", async () => {
    const raw = JSON.stringify(buildMuxEvent("video.asset.ready"));
    const req = new Request("https://mux-webhook.workers.dev/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
    });
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(401);
    expect(recordMuxEvent).not.toHaveBeenCalled();
  });

  it("rejects a stale signature timestamp with 401", async () => {
    const req = await buildSignedRequest(buildMuxEvent("video.asset.ready"), {
      staleTimestamp: true,
    });
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(401);
    expect(recordMuxEvent).not.toHaveBeenCalled();
  });

  it("returns 204 and skips backend on an unsupported event type", async () => {
    const req = await buildSignedRequest({
      type: "video.upload.created",
      data: { id: "up_abc", passthrough: "irrelevant" },
    });
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(204);
    expect(recordMuxEvent).not.toHaveBeenCalled();
  });

  it("rejects a malformed body (missing 'type') with 400", async () => {
    const req = await buildSignedRequest({ data: { id: "abc" } });
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(400);
    expect(recordMuxEvent).not.toHaveBeenCalled();
  });

  it("rejects an event missing data.passthrough with 400", async () => {
    const req = await buildSignedRequest(
      buildMuxEvent("video.asset.ready", { passthrough: undefined })
    );
    const res = await worker.fetch(req, baseEnv, noopCtx);
    expect(res.status).toBe(400);
    expect(recordMuxEvent).not.toHaveBeenCalled();
  });
});
