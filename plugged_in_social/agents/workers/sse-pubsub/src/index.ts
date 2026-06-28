/**
 * stevie-sse-pubsub — Cloudflare Worker + Durable Object
 *
 * Replaces the Redis pub/sub used by backend/app/services/realtime.py.
 *
 * Two routes:
 *
 *   POST /publish/{org_id}
 *     Server → Worker. FastAPI calls this from broadcast_event() with the
 *     event payload. Auth via shared X-Webhook-Secret header. Forwards the
 *     body to the org's Durable Object, which fans out to all connected
 *     clients. Returns 202 on success.
 *
 *   GET /subscribe/{org_id}
 *     Browser → Worker. Long-lived SSE (text/event-stream) or WebSocket
 *     connection. Auth via Supabase JWT — see authentication notes below.
 *     Forwards the request (preserving Upgrade headers for WS) to the
 *     org's Durable Object.
 *
 * Routing: env.ORG_CHANNEL.idFromName(org_id) gives a stable DO id per
 * org, so every Worker instance in every CF colo lands on the same DO
 * for the same org. That DO is where the active sockets live.
 *
 * ─────────────────────────────────────────────────────────────────────
 * SECURITY — /subscribe/{org_id} auth:
 * ─────────────────────────────────────────────────────────────────────
 * The Bearer token (Authorization header or ?token= query) is verified
 * as a Supabase JWT using `jose`:
 *   - ES256 / RS256: signature checked against the project's JWKS
 *     (cached per-isolate for 1 hour, mirroring _JWKS_TTL_SECONDS in
 *     backend/app/auth/supabase.py).
 *   - HS256 (legacy): verified against SUPABASE_JWT_SECRET if present.
 *
 * After signature verification we require that the JWT's
 * `app_metadata.org_id` claim equals the URL `{org_id}`. Mismatch → 403.
 */
import { assertEnv, type BaseEnv } from "@stevie/shared";
import {
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
  type KeyLike,
} from "jose";

// Re-export the Durable Object class so wrangler can register it. Cloudflare
// requires the DO class to be exported from the same module that declares
// the default fetch handler.
export { OrgChannel } from "./org_channel.js";

interface Env extends BaseEnv {
  /** Durable Object namespace for per-org pub/sub channels. */
  ORG_CHANNEL: DurableObjectNamespace;
  /**
   * Supabase project URL — required to fetch the JWKS for ES256/RS256
   * signature verification on /subscribe. e.g. https://abc.supabase.co
   * (no trailing slash).
   */
  SUPABASE_URL: string;
  /**
   * Optional comma-separated browser origins allowed to open /subscribe.
   * When unset we reflect the request Origin because /subscribe is still
   * protected by a verified Supabase JWT tied to the URL org_id.
   */
  ALLOWED_ORIGINS?: string;
  /**
   * Optional. Only needed if the project still issues HS256 JWTs (legacy
   * Supabase). Keep in sync with backend/app/core/config.py
   * settings.supabase_jwt_secret.
   */
  SUPABASE_JWT_SECRET?: string;
}

// ── JWKS cache (per Worker isolate) ─────────────────────────
// Supabase rotates signing keys rarely; cache fetched JWKs for 1 hour
// keyed by `kid`. Matches FastAPI's _JWKS_TTL_SECONDS.
const JWKS_TTL_MS = 60 * 60 * 1000;

interface CachedJwk {
  jwk: JWK;
  fetchedAt: number;
}

// Module-scoped — survives across requests within an isolate, reset on
// isolate eviction. No locks needed: a duplicate concurrent fetch is
// harmless and rare, and the Worker runtime doesn't preempt.
const jwksCache: Map<string, CachedJwk> = new Map();

/**
 * Fetch the project's JWKS and replace the cache with the fresh keys.
 * Returns the JWK for `kid` if present, else null.
 */
async function fetchAndCacheJwks(
  supabaseUrl: string,
  kid: string
): Promise<JWK | null> {
  const url = `${supabaseUrl.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
  let resp: Response;
  try {
    resp = await fetch(url);
  } catch {
    return null;
  }
  if (!resp.ok) {
    return null;
  }
  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    return null;
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { keys?: unknown }).keys)
  ) {
    return null;
  }
  const now = Date.now();
  // Drop stale entries and refill from the fresh response.
  jwksCache.clear();
  for (const k of (data as { keys: unknown[] }).keys) {
    if (typeof k !== "object" || k === null) continue;
    const candidate = k as JWK & { kid?: string };
    if (typeof candidate.kid === "string" && candidate.kid.length > 0) {
      jwksCache.set(candidate.kid, { jwk: candidate, fetchedAt: now });
    }
  }
  return jwksCache.get(kid)?.jwk ?? null;
}

/** Look up a JWK by `kid`, refreshing the cache if expired or missing. */
async function getJwkForKid(
  supabaseUrl: string,
  kid: string
): Promise<JWK | null> {
  const now = Date.now();
  const cached = jwksCache.get(kid);
  if (cached && now - cached.fetchedAt < JWKS_TTL_MS) {
    return cached.jwk;
  }
  return fetchAndCacheJwks(supabaseUrl, kid);
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
      "SUPABASE_URL",
    ]);

    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return corsPreflight(request, env);
    }

    // ── POST /publish/{org_id} ─────────────────────────────────
    const publishMatch = url.pathname.match(
      /^\/publish\/([0-9a-f-]{36})\/?$/i
    );
    if (publishMatch) {
      if (request.method !== "POST") {
        return withCors(jsonError(405, "method not allowed"), request, env);
      }
      const resp = await handlePublish(request, env, publishMatch[1] as string);
      return withCors(resp, request, env);
    }

    // ── GET /subscribe/{org_id} ────────────────────────────────
    const subscribeMatch = url.pathname.match(
      /^\/subscribe\/([0-9a-f-]{36})\/?$/i
    );
    if (subscribeMatch) {
      if (request.method !== "GET") {
        return withCors(jsonError(405, "method not allowed"), request, env);
      }
      const resp = await handleSubscribe(request, env, subscribeMatch[1] as string);
      return withCors(resp, request, env);
    }

    return withCors(
      jsonError(
        404,
        "unknown route — expected /publish/{org_id} or /subscribe/{org_id}"
      ),
      request,
      env
    );
  },
} satisfies ExportedHandler<Env>;

/**
 * Verify the X-Webhook-Secret header and forward the publish request to the
 * org's Durable Object. The DO's /internal/publish endpoint accepts the
 * same body and broadcasts to every connected client.
 */
async function handlePublish(
  request: Request,
  env: Env,
  orgId: string
): Promise<Response> {
  const got = request.headers.get("x-webhook-secret");
  if (!got || got !== env.WEBHOOK_SECRET) {
    return jsonError(401, "invalid webhook secret");
  }

  // Validate the body is JSON before sending it across to the DO. The DO
  // will re-parse, but failing here gives the caller a clearer error.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "body is not valid JSON");
  }

  if (typeof body !== "object" || body === null) {
    return jsonError(400, "body must be a JSON object");
  }

  // Route to the per-org Durable Object. idFromName is deterministic, so
  // every publish for a given org_id lands on the same DO instance.
  const id = env.ORG_CHANNEL.idFromName(orgId);
  const stub = env.ORG_CHANNEL.get(id);

  // Use a synthetic internal URL — the DO inspects request.url to route
  // between /internal/publish and the subscribe upgrade path.
  const internalReq = new Request(
    "https://do/internal/publish",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  const resp = await stub.fetch(internalReq);
  if (!resp.ok) {
    // Log and bubble up — most likely a transient DO startup error.
    return jsonError(502, `durable object publish failed: ${resp.status}`);
  }
  return new Response(null, { status: 202 });
}

/**
 * Verify the subscriber's auth and proxy the request to the org's DO. The
 * DO handles both SSE (Accept: text/event-stream) and WebSocket
 * (Upgrade: websocket) — we just forward unchanged.
 */
async function handleSubscribe(
  request: Request,
  env: Env,
  orgId: string
): Promise<Response> {
  const authResult = await verifySubscriberAuth(request, orgId, env);
  if (!authResult.ok) {
    return jsonError(authResult.status, authResult.message);
  }

  const id = env.ORG_CHANNEL.idFromName(orgId);
  const stub = env.ORG_CHANNEL.get(id);

  // Forward the original request unchanged so the DO sees the Upgrade
  // header (for WS) or the Accept header (for SSE). The DO's URL is
  // synthetic; only the path /subscribe matters for routing inside it.
  const forwarded = new Request(
    `https://do/subscribe/${orgId}`,
    request
  );
  return stub.fetch(forwarded);
}

/**
 * Auth gate for /subscribe/{org_id}.
 *
 * Verifies the Bearer token as a Supabase JWT and confirms its
 * `app_metadata.org_id` claim matches the URL `org_id`.
 *
 *   - ES256 / RS256: looked up in the JWKS by `kid`, cached 1h.
 *   - HS256: verified against env.SUPABASE_JWT_SECRET if set.
 *
 * Returns:
 *   - 401 if no/malformed token, unsupported alg, signature invalid,
 *     or unknown `kid`.
 *   - 403 if the token verifies but the org_id claim is missing or
 *     doesn't match the URL.
 */
async function verifySubscriberAuth(
  request: Request,
  orgId: string,
  env: Env
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const authHeader = request.headers.get("authorization") ?? "";
  // EventSource can't set custom headers, so the frontend will pass the
  // token via ?token= query param. Accept either.
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token") ?? "";

  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = bearerMatch ? (bearerMatch[1] as string) : queryToken;

  if (!token || token.length < 10) {
    return {
      ok: false,
      status: 401,
      message: "missing or invalid Authorization bearer token",
    };
  }

  // Decode the protected header (no signature check yet) just to pick
  // the verification path. jose throws if the JWT is structurally
  // malformed.
  let header: { alg?: string; kid?: string };
  try {
    header = decodeProtectedHeader(token);
  } catch {
    return { ok: false, status: 401, message: "malformed JWT" };
  }

  const alg = (header.alg ?? "").toUpperCase();

  let payload: JWTPayload;
  try {
    if (alg === "ES256" || alg === "RS256") {
      const kid = header.kid;
      if (!kid) {
        return {
          ok: false,
          status: 401,
          message: "JWT header missing kid",
        };
      }
      const jwk = await getJwkForKid(env.SUPABASE_URL, kid);
      if (!jwk) {
        return {
          ok: false,
          status: 401,
          message: "no JWK found for kid",
        };
      }
      const key: KeyLike | Uint8Array = await importJWK(jwk, alg);
      const verified = await jwtVerify(token, key, {
        audience: "authenticated",
        algorithms: [alg],
      });
      payload = verified.payload;
    } else if (alg === "HS256") {
      if (!env.SUPABASE_JWT_SECRET) {
        return {
          ok: false,
          status: 401,
          message: "HS256 token presented but SUPABASE_JWT_SECRET unset",
        };
      }
      const secretBytes = new TextEncoder().encode(env.SUPABASE_JWT_SECRET);
      const verified = await jwtVerify(token, secretBytes, {
        audience: "authenticated",
        algorithms: ["HS256"],
      });
      payload = verified.payload;
    } else {
      return {
        ok: false,
        status: 401,
        message: `unsupported JWT alg: ${alg || "(none)"}`,
      };
    }
  } catch {
    return { ok: false, status: 401, message: "JWT verification failed" };
  }

  // Signature is good — now enforce that this JWT belongs to the org
  // whose URL it's trying to subscribe to.
  const appMetadata = (payload as { app_metadata?: unknown }).app_metadata;
  const claimOrgId =
    typeof appMetadata === "object" &&
    appMetadata !== null &&
    typeof (appMetadata as { org_id?: unknown }).org_id === "string"
      ? ((appMetadata as { org_id: string }).org_id as string)
      : null;

  if (!claimOrgId) {
    return {
      ok: false,
      status: 403,
      message: "JWT missing app_metadata.org_id",
    };
  }
  if (claimOrgId !== orgId) {
    return {
      ok: false,
      status: 403,
      message: "JWT org_id does not match URL org_id",
    };
  }

  return { ok: true };
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function corsPreflight(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env),
  });
}

function withCors(response: Response, request: Request, env: Env): Response {
  if (response.status === 101) {
    return response;
  }

  const headers = new Headers(response.headers);
  const cors = corsHeaders(request, env);
  cors.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers({
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers":
      "authorization, content-type, x-webhook-secret, accept",
    "access-control-max-age": "86400",
  });

  const allowOrigin = resolveAllowedOrigin(request, env);
  if (allowOrigin) {
    headers.set("access-control-allow-origin", allowOrigin);
    if (allowOrigin !== "*") {
      headers.set("vary", "Origin");
    }
  }

  return headers;
}

function resolveAllowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return "*";

  const configured = env.ALLOWED_ORIGINS?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!configured || configured.length === 0 || configured.includes("*")) {
    return origin;
  }
  return configured.includes(origin) ? origin : null;
}
