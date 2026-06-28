/**
 * Stevie Social — Webhooks Worker
 *
 * Routes third-party webhook callbacks through a single edge endpoint at
 * hooks.stevie.social. For each provider the Worker:
 *
 *   1. Validates the provider's native signature (Svix for Resend,
 *      HMAC for Aurinko, CF's signing-secret for Stream) so the
 *      FastAPI origin never has to deal with timing-attack-sensitive
 *      signature verification.
 *   2. On success, re-POSTs a cleaned JSON payload to the matching
 *      /internal/webhooks/<provider> endpoint on api.stevie.social
 *      with our own shared WEBHOOK_SECRET header.
 *   3. Returns 200 to the provider fast — we don't wait for FastAPI to
 *      do the actual work. FastAPI's internal handler enqueues any
 *      follow-up via the queue-producer Worker if needed.
 *
 * Why this split exists:
 *   - Signature secrets for each provider live only in the Worker.
 *     Rotating a provider secret touches one worker, not the FastAPI env.
 *   - Providers (Resend, Aurinko) retry aggressively on slow responses.
 *     Cloudflare's edge responds in <50ms; a cold FastAPI instance on
 *     Coolify can take seconds on first hit.
 *   - The FastAPI origin only trusts requests bearing WEBHOOK_SECRET,
 *     so a leaked provider secret alone can't send fake events.
 */

interface Env {
  ORIGIN_URL: string;
  // Shared secret forwarded to FastAPI in the X-Webhook-Secret header.
  // Must match WEBHOOK_SECRET on the FastAPI backend.
  WEBHOOK_SECRET: string;
  // Resend webhook signing secret from the Resend dashboard
  // (Webhooks → your endpoint → Signing Secret). Begins with "whsec_".
  RESEND_WEBHOOK_SECRET: string;
  // Aurinko application signing secret (Aurinko portal → Application →
  // Signing Secret). Reserved for when the Aurinko webhook route is
  // wired through this Worker; today FastAPI's
  // /internal/webhooks/aurinko endpoint verifies the signature itself
  // using the same secret on the backend side.
  AURINKO_SIGNING_SECRET?: string;
}

// Match the FastAPI handler's event catalogue so changes to one force a
// conscious update to the other. Not used to short-circuit in the Worker
// — we forward every event and let FastAPI decide — but documented here
// for anyone debugging the pipeline.
const _RESEND_EVENT_TYPES = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
] as const;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Route by path suffix so one Worker handles every provider.
    switch (url.pathname) {
      case "/resend":
        return handleResend(request, env, ctx);
      // Cal.com and Stream routes can be added here alongside Resend
      // as the same pattern: provider-native verification → proxy.
      default:
        return new Response("Not found", { status: 404 });
    }
  },
};

// ─── Resend (Svix-signed webhooks) ─────────────────────────────
//
// Resend's webhook format is Svix's. The signature is computed over
// ``${svix-id}.${svix-timestamp}.${rawBody}`` and base64-encoded after
// HMAC-SHA256 with the webhook's secret (the part after "whsec_").
// See https://docs.resend.com/dashboard/webhooks and Svix's reference
// implementation at https://docs.svix.com/receiving/verifying-payloads.
async function handleResend(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[resend] Missing Svix headers");
    return new Response("Missing signature headers", { status: 400 });
  }

  // Timestamp tolerance: Svix recommends rejecting payloads older than
  // 5 minutes to prevent replay. ``svix-timestamp`` is seconds since
  // epoch. A clock-skew tolerance of 5 min either way is what Svix's
  // own library uses.
  const timestampSec = Number.parseInt(svixTimestamp, 10);
  if (!Number.isFinite(timestampSec)) {
    return new Response("Invalid timestamp", { status: 400 });
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) {
    console.warn(`[resend] Timestamp outside tolerance: skew=${nowSec - timestampSec}s`);
    return new Response("Timestamp outside tolerance window", { status: 400 });
  }

  // We must read the raw body text for signature computation; JSON-
  // parsing first would re-serialize with different whitespace and
  // produce a different HMAC.
  const rawBody = await request.text();
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

  const expectedSignatureB64 = await computeSvixHmacBase64(
    env.RESEND_WEBHOOK_SECRET,
    signedContent,
  );
  if (!expectedSignatureB64) {
    // Misconfigured: the secret is missing or can't be decoded. Return
    // 500 so Resend retries — the operator can fix the config and the
    // retry will succeed. (We DON'T want 200 here because that would
    // silently drop events during a misconfiguration window.)
    console.error("[resend] RESEND_WEBHOOK_SECRET missing or malformed");
    return new Response("Webhook misconfigured", { status: 500 });
  }

  // Svix sends one or more signature versions in a space-delimited list:
  //   "v1,<base64> v1,<base64>"
  // We accept the request if ANY v1 signature matches. Constant-time
  // comparison prevents timing leaks.
  const provided = svixSignature
    .split(" ")
    .map((part) => part.split(","))
    .filter(([version]) => version === "v1")
    .map(([, sig]) => sig);

  const matches = provided.some((sig) => constantTimeEquals(sig, expectedSignatureB64));
  if (!matches) {
    console.warn("[resend] Signature mismatch");
    return new Response("Invalid signature", { status: 400 });
  }

  // ─── Signature verified — proxy to FastAPI ─────────────────
  //
  // We use ``waitUntil`` so the Worker returns 200 to Resend
  // immediately; the forward happens in the background. If FastAPI is
  // slow or momentarily down, Resend shouldn't see a timeout — the
  // FastAPI side has its own idempotency guard (MED-3).
  const forwardUrl = `${env.ORIGIN_URL}/internal/webhooks/resend`;
  ctx.waitUntil(
    (async () => {
      try {
        const resp = await fetch(forwardUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Secret": env.WEBHOOK_SECRET,
            // Pass through the Svix id so FastAPI logs can be cross-
            // referenced with Resend's dashboard delivery attempts.
            "X-Svix-Id": svixId,
          },
          body: rawBody,
        });
        if (!resp.ok) {
          console.error(
            `[resend] Origin returned ${resp.status} for svix-id=${svixId}`,
          );
        }
      } catch (err) {
        console.error(`[resend] Origin forward failed for svix-id=${svixId}:`, err);
      }
    })(),
  );

  return new Response(JSON.stringify({ ok: true, svix_id: svixId }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── Crypto helpers ───────────────────────────────────────────

async function computeSvixHmacBase64(
  whsecSecret: string,
  signedContent: string,
): Promise<string | null> {
  // Svix secrets are formatted as ``whsec_<base64>``. The signing key
  // is the raw bytes of the base64-decoded portion, NOT the string
  // itself. Stripping the prefix is mandatory; skipping this step is
  // the single most common implementation mistake.
  if (!whsecSecret) return null;
  const b64 = whsecSecret.startsWith("whsec_") ? whsecSecret.slice(6) : whsecSecret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = base64ToBytes(b64);
  } catch {
    return null;
  }

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(signedContent),
  );
  return bytesToBase64(new Uint8Array(sig));
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
