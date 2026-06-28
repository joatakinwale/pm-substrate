/**
 * Queue message contracts shared between FastAPI (producer) and Workers (consumer).
 *
 * Every message MUST carry:
 *  - org_id          — the Stevie organization UUID. Without this we cannot scope work to the right tenant.
 *  - idempotency_key — opaque string. Workers de-duplicate on this so retries are safe.
 *  - emitted_at      — ISO-8601 producer timestamp. Used for staleness alerts.
 *
 * Producers (FastAPI) build these via the `app.services.queue_publisher` helper
 * (added during migration). Consumers (Workers) call `validateMessage()` first
 * thing in the handler.
 */

export interface BaseMessage {
  /** Stevie organization UUID. Used to set RLS context when calling FastAPI. */
  org_id: string;
  /** Opaque dedup key. Workers should reject duplicates. */
  idempotency_key: string;
  /** Producer ISO-8601 timestamp. */
  emitted_at: string;
}

// ── stripe-sync queue ────────────────────────────────────────────────
export interface StripeSyncMessage extends BaseMessage {
  type: "stripe.invoice.sync";
  /** Our internal Invoice.id (UUID). */
  invoice_id: string;
  /** Stripe's invoice ID (e.g. "in_1ABC..."). */
  stripe_invoice_id: string;
}

// ── email queue ──────────────────────────────────────────────────────
export interface EmailNotificationMessage extends BaseMessage {
  type: "email.notification";
  to: string;
  subject: string;
  /** Pre-rendered HTML body. Token replacement happens producer-side. */
  html_body: string;
  /** Optional plaintext fallback. If absent, the Worker derives one. */
  text_body?: string;
  /** Optional reply-to override. Falls back to the org's default. */
  reply_to?: string;
}

export interface EmailCampaignMessage extends BaseMessage {
  type: "email.campaign.send";
  campaign_id: string;
}

// ── mux queue ────────────────────────────────────────────────────────
export interface MuxIngestMessage extends BaseMessage {
  type: "mux.asset.ingest";
  /** Our internal MediaAsset.id. */
  asset_id: string;
  /** R2 key the Worker presigns to hand to Mux. */
  r2_key: string;
}

// ── ai-content queue ─────────────────────────────────────────────────
export interface AIContentMessage extends BaseMessage {
  type: "ai.content.generate";
  request_id: string;
}

// ── reports queue ────────────────────────────────────────────────────
export interface ReportBuildMessage extends BaseMessage {
  type: "report.build";
  client_report_id: string;
}

// ── automation queue ─────────────────────────────────────────────────
export interface AutomationRunMessage extends BaseMessage {
  type: "automation.run";
  automation_id: string;
  trigger_event: string;
  /** Loose JSON shape — depends on trigger type. Worker forwards as-is. */
  trigger_data: Record<string, unknown>;
}

// ── social queue ─────────────────────────────────────────────────────
export interface SocialPublishMessage extends BaseMessage {
  type: "social.post.publish";
  post_id: string;
}

// ── virtual agency queue ─────────────────────────────────────────────
export interface VirtualAgencyMessage extends BaseMessage {
  type: "virtual_agency.task";
  agent_role: string;
  project_id?: string;
  task_id?: string;
  context: Record<string, unknown>;
}

// ── union ────────────────────────────────────────────────────────────
export type QueueMessage =
  | StripeSyncMessage
  | EmailNotificationMessage
  | EmailCampaignMessage
  | MuxIngestMessage
  | AIContentMessage
  | ReportBuildMessage
  | AutomationRunMessage
  | SocialPublishMessage
  | VirtualAgencyMessage;

/**
 * Throws InvalidMessageError if the payload doesn't match the BaseMessage
 * contract. Each Worker should call this before doing any work — a bad
 * message goes to the dead letter queue, not the consumer's logic.
 */
export function validateMessage<T extends QueueMessage>(
  raw: unknown,
  expectedType: T["type"]
): T {
  if (typeof raw !== "object" || raw === null) {
    throw new InvalidMessageError("message body is not an object");
  }
  const msg = raw as Record<string, unknown>;

  if (msg["type"] !== expectedType) {
    throw new InvalidMessageError(
      `expected type=${expectedType}, got ${String(msg["type"])}`
    );
  }
  if (typeof msg["org_id"] !== "string" || msg["org_id"].length === 0) {
    throw new InvalidMessageError("missing or empty org_id");
  }
  if (
    typeof msg["idempotency_key"] !== "string" ||
    msg["idempotency_key"].length === 0
  ) {
    throw new InvalidMessageError("missing or empty idempotency_key");
  }
  if (typeof msg["emitted_at"] !== "string") {
    throw new InvalidMessageError("missing emitted_at");
  }
  return raw as T;
}

/** Thrown when an inbound queue message fails the contract check. */
export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageError";
  }
}
