/**
 * Smoke tests for stevie-billing-cron.
 * Run via `pnpm test` inside this worker directory.
 *
 * These don't hit the backend or the queue-producer Worker. We hand-roll
 * a backend stub and stub global fetch to assert:
 *   - empty sweep → zero producer POSTs
 *   - N reminders → N producer POSTs
 *   - each enqueued message carries idempotency_key = reminder:<invoice_id>:<YYYY-MM-DD>
 *   - sweep failure surfaces as a thrown error (cron will retry on next tick)
 *
 * Integration coverage (real cron firing → real backend → real queue)
 * lives in /scripts/test-billing-cron.sh — not in this file.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BackendClient,
  RemindersWaiting,
} from "@stevie/backend-client";
import { runSweep } from "./index.js";

interface FakeBackend {
  sweepPaymentReminders: () => Promise<RemindersWaiting[]>;
}

function makeBackend(reminders: RemindersWaiting[]): BackendClient {
  const fake: FakeBackend = {
    sweepPaymentReminders: async () => reminders,
  };
  // Cast through unknown — we only call sweepPaymentReminders in runSweep.
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

  it("does nothing when the sweep returns no reminders", async () => {
    const result = await runSweep(makeBackend([]), env);
    expect(result).toEqual({ swept: 0, fanned: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts one enqueue per reminder with the right URL and headers", async () => {
    const reminders: RemindersWaiting[] = [
      {
        invoice_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        to_email: "a@example.com",
        subject: "subj a",
        html_body: "<p>a</p>",
      },
      {
        invoice_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        to_email: "b@example.com",
        subject: "subj b",
        html_body: "<p>b</p>",
      },
    ];

    const result = await runSweep(makeBackend(reminders), env);
    expect(result).toEqual({ swept: 2, fanned: 2 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);

    for (const call of fetchSpy.mock.calls) {
      const [url, init] = call as [string, RequestInit];
      expect(url).toBe(
        "https://producer.example/enqueue/stevie-email-sender"
      );
      expect(init.method).toBe("POST");
      const headers = init.headers as Record<string, string>;
      expect(headers["x-webhook-secret"]).toBe("test-secret");
      expect(headers["content-type"]).toBe("application/json");
    }
  });

  it("derives idempotency_key from invoice_id + UTC date", async () => {
    const fixedNow = new Date("2026-05-01T09:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);

    const reminders: RemindersWaiting[] = [
      {
        invoice_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        to_email: "a@example.com",
        subject: "s",
        html_body: "<p>a</p>",
      },
    ];

    await runSweep(makeBackend(reminders), env);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as Record<string, unknown>;

    expect(body.type).toBe("email.notification");
    expect(body.idempotency_key).toBe(
      "reminder:11111111-1111-1111-1111-111111111111:2026-05-01"
    );
    expect(body.org_id).toBe("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    expect(body.to).toBe("a@example.com");
    expect(body.subject).toBe("s");
    expect(body.html_body).toBe("<p>a</p>");
    // emitted_at must be ISO-8601 — BaseMessage contract.
    expect(typeof body.emitted_at).toBe("string");
    expect(() => new Date(body.emitted_at as string).toISOString()).not.toThrow();

    vi.useRealTimers();
  });

  it("two runs on the same UTC day produce the same idempotency_key per invoice", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T09:00:00Z"));

    const reminders: RemindersWaiting[] = [
      {
        invoice_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        to_email: "a@example.com",
        subject: "s",
        html_body: "<p>a</p>",
      },
    ];

    await runSweep(makeBackend(reminders), env);
    // Bump the clock within the same UTC day — different timestamp,
    // same idempotency key. This is the de-dupe contract a re-fired
    // cron must rely on.
    vi.setSystemTime(new Date("2026-05-01T20:30:00Z"));
    await runSweep(makeBackend(reminders), env);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const firstBody = JSON.parse(
      (fetchSpy.mock.calls[0] as [string, RequestInit])[1].body as string
    ) as Record<string, unknown>;
    const secondBody = JSON.parse(
      (fetchSpy.mock.calls[1] as [string, RequestInit])[1].body as string
    ) as Record<string, unknown>;

    expect(firstBody.idempotency_key).toBe(secondBody.idempotency_key);
    // emitted_at differs across the two runs even though the dedup key
    // matches — that's the whole point of the date-scoped key.
    expect(firstBody.emitted_at).not.toBe(secondBody.emitted_at);

    vi.useRealTimers();
  });

  it("propagates a sweep failure", async () => {
    const fakeFail = {
      sweepPaymentReminders: async () => {
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

    const reminders: RemindersWaiting[] = [
      {
        invoice_id: "11111111-1111-1111-1111-111111111111",
        org_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        to_email: "a@example.com",
        subject: "a",
        html_body: "<p>a</p>",
      },
      {
        invoice_id: "22222222-2222-2222-2222-222222222222",
        org_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        to_email: "b@example.com",
        subject: "b",
        html_body: "<p>b</p>",
      },
    ];

    const result = await runSweep(makeBackend(reminders), env);
    // Both rows are attempted; only the second succeeds.
    expect(result).toEqual({ swept: 2, fanned: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
