/**
 * Smoke tests for stevie-sse-pubsub.
 *
 * Durable Object behavior (fan-out across multiple clients, hibernation,
 * actual WebSocket handshakes) is integration-tested by
 * scripts/test-sse-pubsub.sh against a deployed `wrangler dev` instance.
 * These tests cover only what we can without spinning up a full DO:
 *
 *   - route matching (publish vs subscribe vs 404)
 *   - webhook secret rejection on /publish
 *   - malformed body rejection on /publish
 *   - JWT-based auth on /subscribe (signature + org_id claim)
 *
 * The test pool runs the Worker module via @cloudflare/vitest-pool-workers,
 * which provides a real Durable Object namespace binding. We hit the
 * Worker's fetch handler directly and assert on response status / body.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import worker from "./index.js";

// Minimal env stub the Worker needs. The vitest-pool-workers harness
// auto-injects ORG_CHANNEL based on wrangler.toml, but for the route-
// matching tests below we don't touch the DO at all — bad routes /
// missing auth never reach env.ORG_CHANNEL.
const baseEnv = {
  WEBHOOK_SECRET: "test-secret-please-rotate",
  BACKEND_BASE_URL: "https://api.example.test",
  ENVIRONMENT: "development" as const,
  SUPABASE_URL: "https://test-project.supabase.co",
};

const ORG_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_ORG_ID = "99999999-aaaa-bbbb-cccc-dddddddddddd";

/**
 * Minimal Durable Object namespace stub. Tests that exercise the
 * /subscribe happy path need *something* to call .idFromName().get()
 * on, but the auth gate (the actual unit under test here) runs
 * BEFORE the DO is ever invoked. The stub returns a 101 stand-in
 * response that the test harness treats as "auth passed".
 */
const stubOrgChannel = {
  idFromName: (_name: string) => ({ toString: () => "stub-do-id" }),
  get: (_id: unknown) => ({
    // Workers can't construct status 101 directly, so use 200 with a
    // sentinel header. The test below only asserts that we DIDN'T get
    // 401/403; the real upgrade-status path is exercised by integration
    // tests, not unit tests.
    fetch: async (_req: Request) =>
      new Response("stub-do-upgrade-ok", {
        status: 200,
        headers: { "x-stub-do-upgrade": "ok" },
      }),
  }),
};

function makeEnv(env?: Record<string, unknown>): never {
  // The harness injects the real DO namespace under env.ORG_CHANNEL when
  // tests run via `pnpm test`. The casts here keep TS happy in CI without
  // requiring us to construct a fake DO manually.
  return { ORG_CHANNEL: stubOrgChannel, ...baseEnv, ...env } as never;
}

describe("sse-pubsub Worker — route matching", () => {
  it("answers CORS preflight for browser subscribers", async () => {
    const req = new Request(`https://w.example.test/subscribe/${ORG_ID}`, {
      method: "OPTIONS",
      headers: { origin: "https://stevie.testingjoat.work" },
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(204);
    expect(resp.headers.get("access-control-allow-origin")).toBe(
      "https://stevie.testingjoat.work"
    );
    expect(resp.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("returns 404 on an unknown path", async () => {
    const req = new Request("https://w.example.test/totally/unknown");
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(404);
  });

  it("rejects POST on /subscribe", async () => {
    const req = new Request(`https://w.example.test/subscribe/${ORG_ID}`, {
      method: "POST",
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(405);
  });

  it("rejects GET on /publish", async () => {
    const req = new Request(`https://w.example.test/publish/${ORG_ID}`, {
      method: "GET",
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(405);
  });
});

describe("sse-pubsub Worker — /publish auth + body validation", () => {
  it("rejects requests with no X-Webhook-Secret", async () => {
    const req = new Request(`https://w.example.test/publish/${ORG_ID}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "lead.created" }),
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(401);
  });

  it("rejects requests with the wrong X-Webhook-Secret", async () => {
    const req = new Request(`https://w.example.test/publish/${ORG_ID}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": "not-the-right-one",
      },
      body: JSON.stringify({ event: "lead.created" }),
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(401);
  });

  it("rejects malformed JSON bodies", async () => {
    const req = new Request(`https://w.example.test/publish/${ORG_ID}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-webhook-secret": baseEnv.WEBHOOK_SECRET,
      },
      body: "{not json",
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(400);
  });
});

// ── /subscribe JWT auth tests ──────────────────────────────────────
//
// We don't want these unit tests to actually hit Supabase, so we
// generate an ES256 keypair locally and stub `globalThis.fetch` to
// return the public JWK on the JWKS URL.

interface TestKeys {
  // jose.generateKeyPair returns KeyLike; in WebCrypto-backed builds
  // that's effectively CryptoKey, but the static types stay generic.
  // Using `any` avoids the structural mismatch between KeyLike and
  // CryptoKey without losing test fidelity.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  privateKey: any;
  publicJwk: Record<string, unknown>;
  kid: string;
}

async function makeTestKeys(kid = "test-kid-1"): Promise<TestKeys> {
  const { privateKey, publicKey } = await generateKeyPair("ES256", {
    extractable: true,
  });
  const publicJwk = (await exportJWK(publicKey)) as unknown as Record<
    string,
    unknown
  >;
  publicJwk.kid = kid;
  publicJwk.alg = "ES256";
  publicJwk.use = "sig";
  return { privateKey, publicJwk, kid };
}

async function signTokenWith(opts: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  privateKey: any;
  kid: string;
  orgId: string | null; // null → omit app_metadata.org_id
  includeAppMetadata?: boolean; // default true
}): Promise<string> {
  const appMetadata: Record<string, unknown> = {};
  if (opts.orgId !== null) {
    appMetadata.org_id = opts.orgId;
  }
  const payload: Record<string, unknown> = {
    sub: "user-uuid-1234",
    role: "authenticated",
  };
  if (opts.includeAppMetadata !== false) {
    payload.app_metadata = appMetadata;
  }
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256", kid: opts.kid })
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(opts.privateKey);
}

function stubJwksFetch(jwks: { keys: unknown[] }): void {
  const expectedUrl = `${baseEnv.SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === expectedUrl) {
        return new Response(JSON.stringify(jwks), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      throw new Error(`unexpected fetch in test: ${url}`);
    })
  );
}

describe("sse-pubsub Worker — /subscribe JWT auth", () => {
  beforeEach(() => {
    // Reset isolate-level JWKS cache between tests by reloading the
    // module is awkward; instead each test stubs fetch deterministically
    // so even a cache hit from a prior test is overwritten on miss.
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects subscribers with no Bearer token (401)", async () => {
    const req = new Request(`https://w.example.test/subscribe/${ORG_ID}`, {
      method: "GET",
    });
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(401);
  });

  it("rejects subscribers with an empty token query param (401)", async () => {
    const req = new Request(
      `https://w.example.test/subscribe/${ORG_ID}?token=`,
      { method: "GET" }
    );
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(401);
  });

  it("rejects a token signed by a different key (401)", async () => {
    const trusted = await makeTestKeys("trusted-kid");
    const attacker = await makeTestKeys("trusted-kid"); // same kid, wrong key
    // JWKS only contains the trusted public key.
    stubJwksFetch({ keys: [trusted.publicJwk] });

    const token = await signTokenWith({
      privateKey: attacker.privateKey,
      kid: trusted.kid,
      orgId: ORG_ID,
    });

    const req = new Request(
      `https://w.example.test/subscribe/${ORG_ID}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(401);
  });

  it("rejects a valid JWT whose org_id mismatches the URL (403)", async () => {
    const keys = await makeTestKeys("valid-kid-mismatch");
    stubJwksFetch({ keys: [keys.publicJwk] });

    const token = await signTokenWith({
      privateKey: keys.privateKey,
      kid: keys.kid,
      orgId: OTHER_ORG_ID, // different org than the URL
    });

    const req = new Request(
      `https://w.example.test/subscribe/${ORG_ID}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(403);
  });

  it("rejects a valid JWT with no app_metadata.org_id (403)", async () => {
    const keys = await makeTestKeys("valid-kid-noorg");
    stubJwksFetch({ keys: [keys.publicJwk] });

    const token = await signTokenWith({
      privateKey: keys.privateKey,
      kid: keys.kid,
      orgId: null, // omits org_id
    });

    const req = new Request(
      `https://w.example.test/subscribe/${ORG_ID}`,
      {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    expect(resp.status).toBe(403);
  });

  it("accepts a valid JWT with matching org_id (no 401/403)", async () => {
    const keys = await makeTestKeys("valid-kid-match");
    stubJwksFetch({ keys: [keys.publicJwk] });

    const token = await signTokenWith({
      privateKey: keys.privateKey,
      kid: keys.kid,
      orgId: ORG_ID,
    });

    const req = new Request(
      `https://w.example.test/subscribe/${ORG_ID}`,
      {
        method: "GET",
        headers: {
          authorization: `Bearer ${token}`,
          origin: "https://stevie.testingjoat.work",
        },
      }
    );
    const resp = await worker.fetch!(req, makeEnv(), {} as ExecutionContext);
    // We can't fully exercise the DO upgrade path here, but the auth
    // gate must NOT have rejected the request — anything other than
    // 401/403 means we got past auth and into DO land.
    expect(resp.status).not.toBe(401);
    expect(resp.status).not.toBe(403);
    expect(resp.headers.get("access-control-allow-origin")).toBe(
      "https://stevie.testingjoat.work"
    );
  });
});
