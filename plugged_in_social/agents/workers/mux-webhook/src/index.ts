/**
 * stevie-mux-webhook — Cloudflare Worker (fetch handler)
 *
 * Replaces:
 *   backend/app/tasks/video_tasks.py::process_mux_webhook
 *   plus the Mux webhook receiver previously inlined into
 *   backend/app/api/internal/webhooks.py at /internal/webhooks/mux.
 *
 * Also subsumes the Mux happy path of generate_thumbnail: when
 * video.asset.ready arrives, we construct
 * https://image.mux.com/<playback>/thumbnail.jpg?... inline and pass it
 * to the backend so the FastAPI side never has to know about Mux's image
 * URL scheme.
 *
 * Mux thumbnails only. ffmpeg fallback dropped per Path B+ migration;
 * Mux is the single source of truth for thumbnails. If Mux is unavailable
 * for an asset, the asset stays in `processing` status and the user retries.
 *
 * Flow:
 *   1. Mux POSTs an HMAC-signed webhook to this Worker's URL.
 *   2. We verify the signature using MUX_WEBHOOK_SIGNING_SECRET
 *      (HMAC-SHA256 over `<timestamp>.<raw_body>`, header
 *      `mux-signature: t=<timestamp>,v1=<sig>`).
 *   3. We validate the event type is one we care about, extract the
 *      asset id (from data.passthrough — set by stevie-mux-ingest to our
 *      internal MediaAsset.id), and POST to FastAPI
 *      POST /api/internal/video/events (which performs DB updates under RLS).
 *   4. Return 204 on success.
 *
 * Status code contract:
 *   401 — bad/missing Mux signature
 *   400 — body parses but doesn't match a known Mux event shape
 *   204 — accepted (forwarded to FastAPI, or dropped because we don't
 *         aggregate this event type)
 *   502 — backend FastAPI returned 5xx; Mux will retry
 */
import { assertEnv, type BaseEnv } from "@stevie/shared";
import { BackendCallError, BackendClient, type MuxEventInput } from "@stevie/backend-client";

interface Env extends BaseEnv {
  /** Mux webhook signing secret (from the Mux dashboard webhook config). */
  MUX_WEBHOOK_SIGNING_SECRET: string;
}

/**
 * Mux event types this Worker accepts and forwards. Anything outside
 * this set is acknowledged with 204 but dropped — Mux stops retrying
 * on a 2xx, which is the behaviour we want for events we don't aggregate
 * (live streams, uploads, track updates, etc.).
 */
const SUPPORTED_EVENTS = new Set<MuxEventInput["event_type"]>([
  "video.asset.ready",
  "video.asset.errored",
  "video.asset.deleted",
]);

/**
 * Mux signature freshness window. Anything outside this is rejected to
 * prevent replay attacks. Mux's own SDK uses 5 minutes; we mirror that.
 */
const SIGNATURE_TOLERANCE_SECONDS = 300;

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
      "MUX_WEBHOOK_SIGNING_SECRET",
    ]);

    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    // Read raw body BEFORE parsing — HMAC verifies the exact byte sequence,
    // so json() / round-tripping would invalidate the signature.
    const rawBody = await request.text();
    const sigHeader = request.headers.get("mux-signature");

    if (!sigHeader) {
      return new Response("missing mux-signature header", { status: 401 });
    }

    const sigOk = await verifyMuxSignature(
      env.MUX_WEBHOOK_SIGNING_SECRET,
      sigHeader,
      rawBody
    );
    if (!sigOk) {
      return new Response("invalid signature", { status: 401 });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return new Response("invalid JSON body", { status: 400 });
    }

    let event: MuxWebhookEnvelope;
    try {
      event = parseMuxEvent(parsed);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return new Response(`invalid payload: ${reason}`, { status: 400 });
    }

    if (!SUPPORTED_EVENTS.has(event.type as MuxEventInput["event_type"])) {
      // Event type we don't care about (live streams, uploads, etc.).
      // 204 so Mux stops retrying.
      console.warn(
        `[mux-webhook] unsupported event type: ${event.type} (mux_id=${event.data.id ?? ""})`
      );
      return new Response(null, { status: 204 });
    }

    // The passthrough field is what stevie-mux-ingest set to our internal
    // MediaAsset.id during asset creation. It's the only id Mux carries
    // round-trip that we control.
    const assetId = event.data.passthrough;
    if (!assetId) {
      console.warn(
        `[mux-webhook] event ${event.type} missing data.passthrough (mux_id=${event.data.id ?? ""})`
      );
      return new Response("missing data.passthrough", { status: 400 });
    }

    const eventBody = buildEventBody(event, assetId);
    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    try {
      await backend.recordMuxEvent(eventBody);
    } catch (err) {
      if (err instanceof BackendCallError) {
        // 4xx (other than 429) → permanent. We've verified the Mux
        // signature so the body is genuine; a 4xx from the backend means
        // it doesn't recognize the asset id. 204 to stop Mux retrying;
        // the FastAPI side has logged the miss.
        if (!err.isRetryable) {
          console.warn(
            `[mux-webhook] backend ${err.status} for asset_id=${assetId}: ${err.message}`
          );
          return new Response(null, { status: 204 });
        }
        return new Response(`backend ${err.status}: ${err.message}`, {
          status: 502,
        });
      }
      const msg = err instanceof Error ? err.message : String(err);
      return new Response(`backend call failed: ${msg}`, { status: 502 });
    }

    return new Response(null, { status: 204 });
  },
} satisfies ExportedHandler<Env>;

// ── Types ─────────────────────────────────────────────────────────────

/**
 * Mux's webhook envelope. We only model the fields we read — Mux carries
 * a lot more, but if a future feature needs it, add it here rather than
 * passing through the whole blob (the FastAPI side shouldn't have to know
 * Mux's per-event nesting).
 */
interface MuxWebhookEnvelope {
  type: string;
  data: MuxEventData;
}

interface MuxEventData {
  /** Mux's internal asset id (e.g. "abc123def456"). */
  id?: string;
  /** Mux asset status: "preparing" | "ready" | "errored". */
  status?: string;
  /** Mux asset duration in seconds. */
  duration?: number;
  /** Our internal MediaAsset.id, set by stevie-mux-ingest. */
  passthrough?: string;
  /** Playback ids assigned to this asset. */
  playback_ids?: Array<{ id?: string; policy?: string }>;
  /** Errors object on video.asset.errored events. */
  errors?: { type?: string; messages?: string[] };
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Parse Mux's webhook envelope. Throws if required fields are missing —
 * we want a 400 in that case, not a downstream NPE.
 */
function parseMuxEvent(raw: unknown): MuxWebhookEnvelope {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("payload is not an object");
  }
  const obj = raw as Record<string, unknown>;
  const type = obj["type"];
  if (typeof type !== "string" || type.length === 0) {
    throw new Error("missing or empty 'type'");
  }
  const data = obj["data"];
  if (typeof data !== "object" || data === null) {
    throw new Error("missing 'data' object");
  }
  return { type, data: data as MuxEventData };
}

/**
 * Build the flat payload the FastAPI internal endpoint consumes.
 * - On video.asset.ready: include playback_id + duration + thumbnail_url.
 * - On video.asset.errored: include error_message.
 * - On video.asset.deleted: just event_type + asset_id.
 *
 * Mux thumbnail URL synthesis lives here (not on the backend) so that
 * FastAPI doesn't have to know Mux's image hostname or query-param vocab.
 */
function buildEventBody(
  event: MuxWebhookEnvelope,
  assetId: string
): MuxEventInput {
  const eventType = event.type as MuxEventInput["event_type"];
  const body: MuxEventInput = {
    event_type: eventType,
    asset_id: assetId,
  };

  if (eventType === "video.asset.ready") {
    const playbackId = event.data.playback_ids?.[0]?.id;
    if (playbackId) {
      body.playback_id = playbackId;
      // Mux image URL spec — preserves aspect ratio inside a 1920x1080 box,
      // grabs the frame at t=1s (avoids the all-black opening frame that
      // a lot of phone-camera videos start with).
      body.thumbnail_url =
        `https://image.mux.com/${playbackId}/thumbnail.jpg` +
        `?width=1920&height=1080&fit_mode=preserve&time=1`;
    }
    body.status = event.data.status ?? "ready";
    if (typeof event.data.duration === "number") {
      body.duration_seconds = event.data.duration;
    }
  } else if (eventType === "video.asset.errored") {
    body.status = "errored";
    const errType = event.data.errors?.type;
    const errMessages = event.data.errors?.messages;
    body.error_message =
      [errType, errMessages?.join("; ")].filter(Boolean).join(": ") ||
      "unknown error";
  } else if (eventType === "video.asset.deleted") {
    body.status = "deleted";
  }

  return body;
}

/**
 * Verify Mux's webhook signature.
 *
 * Mux header format: ``mux-signature: t=<unix_timestamp>,v1=<hex_hmac>``.
 * The signed payload is the literal string ``<timestamp>.<raw_body>``,
 * HMAC-SHA256, hex-encoded. Matches Stripe's signature scheme — no
 * accident; both predate Svix and use the same canonical form.
 *
 * We do constant-time comparison and reject signatures older than
 * SIGNATURE_TOLERANCE_SECONDS to prevent replay.
 */
async function verifyMuxSignature(
  secret: string,
  header: string,
  body: string
): Promise<boolean> {
  // Header parse: ``t=...,v1=...``. Order isn't guaranteed; tolerate both.
  let timestamp: string | null = null;
  let signature: string | null = null;
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const k = part.slice(0, eq).trim();
    const v = part.slice(eq + 1).trim();
    if (k === "t") timestamp = v;
    else if (k === "v1") signature = v;
  }
  if (!timestamp || !signature) {
    return false;
  }

  // Reject stale signatures.
  const tsSeconds = Number(timestamp);
  if (!Number.isFinite(tsSeconds)) {
    return false;
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > SIGNATURE_TOLERANCE_SECONDS) {
    return false;
  }

  // HMAC-SHA256 the canonical signed string.
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${timestamp}.${body}`)
  );
  const expectedHex = bytesToHex(new Uint8Array(sigBytes));

  return constantTimeEquals(expectedHex, signature);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Constant-time string comparison. Length mismatch returns immediately —
 * length itself isn't sensitive (HMAC-SHA256 is always 64 hex chars).
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
