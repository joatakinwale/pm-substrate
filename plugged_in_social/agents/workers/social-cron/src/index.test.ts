/**
 * Smoke tests for stevie-social-cron.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit the backend or the queue-producer Worker. We hand-roll
 * a backend stub and stub global fetch to assert:
 *   - empty scheduled sweep → zero producer POSTs
 *   - N due posts → N producer POSTs
 *   - each enqueued message carries idempotency_key shape
 *     ``social-publish:<post_id>:<iso>``
 *   - sweep failure surfaces as a thrown error (cron will retry on next tick)
 *   - metrics refresh delegates to backend.refreshSocialMetrics with NO
 *     fanout (backend does the cross-org sweep in-process)
 *
 * Integration coverage (real cron firing → real backend → real queue)
 * lives in /scripts/test-social-cron.sh — not in this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BackendClient,
  DueSocialPost,
} from "@stevie/backend-client";
import { runMetricsRefresh, runScheduledSweep } from "./index.js";

interface FakeBackend {
  sweepScheduledSocialPosts: () => Promise<DueSocialPost[]>;
  refreshSocialMetrics: () => Promise<{
    checked: number;
    updated: number;
    errored: number;
  }>;
}

function makeBackend(
  posts: DueSocialPost[],
  metrics?: { checked: number; updated: number; errored: number }
): BackendClient {
  const fake: FakeBackend = {
    sweepScheduledSocialPosts: async () => posts,
    refreshSocialMetrics: async () =>
      metrics ?? { checked: 0, updated: 0, errored: 0 },
  };
  // Cast through unknown — we only call the two methods exercised by
  // the helpers under test.
  return fake as unknown as BackendClient;
}

const env = {
  QUEUE_PRODUCER_URL: "https://producer.example",
  WEBHOOK_SECRET: "test-secret",
};

// ── Scheduled-sweep path ─────────────────────────────────────────────

describe("runScheduledSweep", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async () =>
      new Response(null, { status: 202 })
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("does nothing when the sweep returns no due posts", async () => {
    const result = await runScheduledSweep(makeBackend([]), env);
    expect(result).toEqual({ swept: 0, fanned: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts one enqueue per due post with the right URL and headers", async () => {
    const posts: DueSocialPost[] = [
      {
        post_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      {
        post_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
    ];

    const result = await runScheduledSweep(makeBackend(posts), env);
    expect(result).toEqual({ swept: 2, fanned: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    for (const call of fetchSpy.mock.calls) {
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe(
        "https://producer.example/enqueue/stevie-social-publisher"
      );
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["x-webhook-secret"]).toBe("test-secret");
      expect(headers["content-type"]).toBe("application/json");
    }
  });

  it("derives idempotency_key from post_id + sweep ISO timestamp", async () => {
    const fixedNow = new Date("2026-05-01T12:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const posts: DueSocialPost[] = [
      {
        post_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
    ];

    await runScheduledSweep(makeBackend(posts), env);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body.type).toBe("social.post.publish");
    expect(body.idempotency_key).toBe(
      "social-publish:11111111-1111-1111-1111-111111111111:2026-05-01T12:00:00.000Z"
    );
    expect(body.org_id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(body.post_id).toBe("11111111-1111-1111-1111-111111111111");
    // emitted_at must be ISO-8601 — BaseMessage contract.
    expect(typeof body.emitted_at).toBe("string");
    expect(() => new Date(body.emitted_at as string).toISOString()).not.toThrow();

    vi.useRealTimers();
  });

  it("propagates a sweep failure", async () => {
    const fakeFail = {
      sweepScheduledSocialPosts: async () => {
        throw new Error("backend down");
      },
    } as unknown as BackendClient;

    await expect(runScheduledSweep(fakeFail, env)).rejects.toThrow(
      "backend down"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("continues fanout after one enqueue failure", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    const posts: DueSocialPost[] = [
      {
        post_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      {
        post_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
    ];

    const result = await runScheduledSweep(makeBackend(posts), env);
    // Both rows are attempted; only the second succeeds.
    expect(result).toEqual({ swept: 2, fanned: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});

// ── Metrics-refresh path ─────────────────────────────────────────────

describe("runMetricsRefresh", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async () =>
      new Response(null, { status: 202 })
    );
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("delegates to backend.refreshSocialMetrics with NO fanout", async () => {
    const backend = makeBackend([], {
      checked: 42,
      updated: 7,
      errored: 1,
    });
    const result = await runMetricsRefresh(backend);
    expect(result).toEqual({ checked: 42, updated: 7, errored: 1 });
    // Critically: the metrics path never POSTs to the queue producer —
    // backend handles the cross-org sweep in-process.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("propagates a refresh failure", async () => {
    const fakeFail = {
      refreshSocialMetrics: async () => {
        throw new Error("backend down");
      },
    } as unknown as BackendClient;

    await expect(runMetricsRefresh(fakeFail)).rejects.toThrow(
      "backend down"
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
