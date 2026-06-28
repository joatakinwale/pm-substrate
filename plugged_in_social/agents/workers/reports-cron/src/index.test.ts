/**
 * Smoke tests for stevie-reports-cron.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit the backend or the queue-producer Worker. We hand-roll
 * a backend stub and stub global fetch to assert:
 *   - empty sweep → zero producer POSTs
 *   - N due reports → N producer POSTs
 *   - each enqueued message carries idempotency_key = report-build:<client_report_id>
 *   - sweep failure surfaces as a thrown error (cron will retry on next tick)
 *   - per-row enqueue failure logs and continues to the next row
 *
 * Integration coverage (real cron firing → real backend → real queue)
 * lives outside this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BackendClient, DueReport } from "@stevie/backend-client";
import { runSweep } from "./index.js";

interface FakeBackend {
  sweepDueReports: () => Promise<DueReport[]>;
}

function makeBackend(reports: DueReport[]): BackendClient {
  const fake: FakeBackend = {
    sweepDueReports: async () => reports,
  };
  // Cast through unknown — we only call sweepDueReports in runSweep.
  return fake as unknown as BackendClient;
}

const env = {
  QUEUE_PRODUCER_URL: "https://producer.example",
  WEBHOOK_SECRET: "test-secret",
};

describe("runSweep", () => {
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

  it("does nothing when the sweep returns no reports", async () => {
    const result = await runSweep(makeBackend([]), env);
    expect(result).toEqual({ swept: 0, fanned: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts one enqueue per due report with the right URL and headers", async () => {
    const reports: DueReport[] = [
      {
        client_report_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      {
        client_report_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
    ];

    const result = await runSweep(makeBackend(reports), env);
    expect(result).toEqual({ swept: 2, fanned: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    for (const call of fetchSpy.mock.calls) {
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe(
        "https://producer.example/enqueue/stevie-report-builder"
      );
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["x-webhook-secret"]).toBe("test-secret");
      expect(headers["content-type"]).toBe("application/json");
    }
  });

  it("emits a report.build message with idempotency_key keyed on client_report_id", async () => {
    const fixedNow = new Date("2026-05-01T02:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const reports: DueReport[] = [
      {
        client_report_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
    ];

    await runSweep(makeBackend(reports), env);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body.type).toBe("report.build");
    expect(body.idempotency_key).toBe(
      "report-build:11111111-1111-1111-1111-111111111111"
    );
    expect(body.org_id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(body.client_report_id).toBe(
      "11111111-1111-1111-1111-111111111111"
    );
    // emitted_at must be ISO-8601 — BaseMessage contract.
    expect(typeof body.emitted_at).toBe("string");
    expect(() => new Date(body.emitted_at as string).toISOString()).not.toThrow();

    vi.useRealTimers();
  });

  it("propagates a sweep failure", async () => {
    const fakeFail = {
      sweepDueReports: async () => {
        throw new Error("backend down");
      },
    } as unknown as BackendClient;

    await expect(runSweep(fakeFail, env)).rejects.toThrow("backend down");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("continues fanout after one enqueue failure", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("nope", { status: 500 }))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    const reports: DueReport[] = [
      {
        client_report_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      {
        client_report_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
    ];

    const result = await runSweep(makeBackend(reports), env);
    // Both rows are attempted; only the second succeeds.
    expect(result).toEqual({ swept: 2, fanned: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("continues fanout after one enqueue network error", async () => {
    fetchSpy
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValueOnce(new Response(null, { status: 202 }));

    const reports: DueReport[] = [
      {
        client_report_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      },
      {
        client_report_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      },
    ];

    const result = await runSweep(makeBackend(reports), env);
    expect(result).toEqual({ swept: 2, fanned: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
