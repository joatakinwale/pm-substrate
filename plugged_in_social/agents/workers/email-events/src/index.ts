/**
 * stevie-email-events — Cloudflare Worker (fetch handler)
 *
 * Replaces:
 *   backend/app/tasks/email_tasks.py::process_email_event
 *   plus the Resend webhook receiver previously inlined into
 *   backend/app/api/internal/webhooks.py at /internal/webhooks/resend.
 *
 * Flow:
 *   1. Resend POSTs a Svix-signed webhook to this Worker's URL.
 *   2. We verify the signature using RESEND_WEBHOOK_SECRET (Svix protocol).
 *   3. We validate the event type is one we care about, extract the
 *      provider-agnostic fields, and POST to FastAPI
 *      POST /api/internal/email/events (which performs DB updates under RLS).
 *   4. Return 204 on success.
 *
 * Unlike stripe-sync this Worker is NOT a queue consumer — Resend already
 * retries non-2xx for ~72h, so wrapping in a queue would be redundant.
 *
 * Status code contract:
 *   401 — bad/missing Svix signature
 *   400 — body parses but doesn't match a known Resend event shape
 *   204 — accepted (we either forwarded to FastAPI or ignored an event we
 *         don't aggregate, e.g. email.delivery_delayed)
 *   502 — backend FastAPI returned 5xx; Resend will retry
 */
import { Webhook, WebhookVerificationError } from "svix";
import { assertEnv, type BaseEnv } from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";

interface Env extends BaseEnv {
  /** Svix endpoint secret from the Resend dashboard. Starts with "whsec_". */
  RESEND_WEBHOOK_SECRET: string;
}

/**
 * Resend event types this Worker accepts and forwards. Anything outside
 * this set is acknowledged with 204 but dropped — Resend stops retrying
 * on a 2xx, which is the behaviour we want for events we don't aggregate.
 *
 * The set mirrors the spec exactly (sent, delivered, bounced, opened,
 * clicked, complained). ``email.delivery_delayed`` is intentionally
 * NOT here: Resend treats it as informational and so do we.
 */
const SUPPORTED_EVENTS = new Set<string>([
  "email.sent",
  "email.delivered",
  "email.bounced",
  "email.opened",
  "email.clicked",
  "email.complained",
]);

/**
 * Map a Resend event type to the generic event_type the FastAPI internal
 * endpoint expects. Provider-agnostic so a future provider swap only
 * touches this map and the signature verification.
 */
const EVENT_TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.complained": "complained",
};

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
      "RESEND_WEBHOOK_SECRET",
    ]);

    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    // Read raw body BEFORE parsing — Svix verifies the exact byte sequence
    // including whitespace, so json() / round-tripping would invalidate
    // the signature.
    const rawBody = await request.text();

    // Svix expects header keys to be lowercased. The Worker runtime's
    // Headers object already returns lowercase, but we normalize defensively
    // because Svix's verify() does a strict lookup.
    const svixHeaders: Record<string, string> = {};
    const idHeader = request.headers.get("svix-id");
    const tsHeader = request.headers.get("svix-timestamp");
    const sigHeader = request.headers.get("svix-signature");
    if (idHeader) svixHeaders["svix-id"] = idHeader;
    if (tsHeader) svixHeaders["svix-timestamp"] = tsHeader;
    if (sigHeader) svixHeaders["svix-signature"] = sigHeader;

    let verified: unknown;
    try {
      const wh = new Webhook(env.RESEND_WEBHOOK_SECRET);
      verified = wh.verify(rawBody, svixHeaders);
    } catch (err) {
      if (err instanceof WebhookVerificationError) {
        return new Response("invalid signature", { status: 401 });
      }
      // Unexpected failure inside svix — treat as bad signature rather than
      // 500 so Resend doesn't retry forever against a broken Worker.
      return new Response("signature verification failed", { status: 401 });
    }

    let payload: ResendEventBody;
    try {
      payload = parseResendEvent(verified);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      return new Response(`invalid payload: ${reason}`, { status: 400 });
    }

    if (!SUPPORTED_EVENTS.has(payload.type)) {
      // Event type we don't care about (e.g. email.delivery_delayed).
      // 204 so Resend stops retrying. We log via the runtime's console so
      // a flood of unknowns surfaces in the Worker logs.
      console.warn(
        `[email-events] unsupported event type: ${payload.type} (id=${idHeader ?? ""})`
      );
      return new Response(null, { status: 204 });
    }

    const eventBody = buildEventBody(payload);
    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    try {
      await backend.recordEmailEvent(eventBody);
    } catch (err) {
      if (err instanceof BackendCallError) {
        // 4xx (other than 429) → permanent. We've already verified the Svix
        // signature so the body is genuinely from Resend; a 4xx from the
        // backend means it doesn't recognize the message_id. 204 to stop
        // Resend retrying; the FastAPI side has logged the miss.
        if (!err.isRetryable) {
          console.warn(
            `[email-events] backend ${err.status} for message_id=${eventBody.message_id}: ${err.message}`
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
 * Resend's webhook envelope (docs.resend.com/dashboard/webhooks).
 * We only model the fields we read — Resend may add more.
 */
interface ResendEventBody {
  type: string;
  created_at?: string;
  data: ResendEventData;
}

interface ResendEventData {
  email_id: string;
  to?: string[] | string;
  subject?: string;
  // event-specific nested objects:
  click?: { link?: string };
  bounce?: { type?: string; subType?: string };
  complaint?: { type?: string };
}

/** Body shape POSTed to FastAPI /api/internal/email/events. */
interface EmailEventBody {
  event_type: "sent" | "delivered" | "bounced" | "opened" | "clicked" | "complained";
  message_id: string;
  to: string;
  timestamp: string;
  subject?: string;
  bounce_type?: string;
  link_url?: string;
  complaint_type?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Narrow Svix's verified payload to the Resend webhook shape. Throws if
 * required fields (type, data.email_id) are missing — we want a 400 in
 * that case, not a downstream NPE.
 */
function parseResendEvent(raw: unknown): ResendEventBody {
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
  const dataObj = data as Record<string, unknown>;
  const emailId = dataObj["email_id"];
  if (typeof emailId !== "string" || emailId.length === 0) {
    throw new Error("missing 'data.email_id'");
  }
  return {
    type,
    created_at: typeof obj["created_at"] === "string" ? (obj["created_at"] as string) : undefined,
    data: dataObj as unknown as ResendEventData,
  };
}

/**
 * Build the flat payload the FastAPI internal endpoint consumes. We
 * deliberately do NOT pass through the entire Resend envelope — workers
 * are the integration boundary and FastAPI shouldn't have to know
 * Resend's per-event nesting.
 */
function buildEventBody(payload: ResendEventBody): EmailEventBody {
  const generic = EVENT_TYPE_MAP[payload.type];
  if (!generic) {
    // Should be unreachable — caller already filtered on SUPPORTED_EVENTS.
    throw new Error(`no event mapping for ${payload.type}`);
  }
  const body: EmailEventBody = {
    event_type: generic as EmailEventBody["event_type"],
    message_id: payload.data.email_id,
    to: extractTo(payload.data.to),
    timestamp: payload.created_at ?? new Date().toISOString(),
  };
  if (payload.data.subject) body.subject = payload.data.subject;
  if (payload.type === "email.clicked" && payload.data.click?.link) {
    body.link_url = payload.data.click.link;
  }
  if (payload.type === "email.bounced" && payload.data.bounce) {
    // Resend's bounce.type is "hard" | "soft" | "suppressed". We surface
    // subType when present (more specific) and fall back to type.
    body.bounce_type = payload.data.bounce.subType ?? payload.data.bounce.type;
  }
  if (payload.type === "email.complained" && payload.data.complaint?.type) {
    body.complaint_type = payload.data.complaint.type;
  }
  return body;
}

/**
 * Resend's ``data.to`` is usually a one-element array, but the docs reserve
 * the right to send a string. Normalize to a single address — we only ever
 * render per-recipient mail, so the first entry is the canonical recipient.
 */
function extractTo(to: string[] | string | undefined): string {
  if (Array.isArray(to)) return to[0] ?? "";
  if (typeof to === "string") return to;
  return "";
}
