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
  /** SHA-256 of the approved/scheduled content the Worker is allowed to publish. */
  expected_content_hash: string;
}

// ── virtual agency queue ─────────────────────────────────────────────
export type VirtualAgencyAgentRole =
  | "chief_of_staff"
  | "content_creative"
  | "scheduling_distribution"
  | "community_engagement"
  | "analytics_reporting";

export interface VirtualAgencyLineage {
  client_request: string;
  project_id: string;
  legacy_task_id: string;
  orchestration_task_id: string;
  artifact_id?: string;
  engagement_id?: string;
  marketing_run_id?: string;
}

export interface VirtualAgencyMessage extends BaseMessage {
  type: "virtual_agency.task";
  agent_role: VirtualAgencyAgentRole;
  project_id: string;
  /** Legacy project task UUID. Null for source-less orchestration tasks. */
  task_id?: string | null;
  orchestration_task_id: string;
  task_version: number;
  approval_version?: number | null;
  approval_payload_hash?: string | null;
  lineage: VirtualAgencyLineage;
  dependency_ids: string[];
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
  if (Number.isNaN(Date.parse(msg["emitted_at"] as string))) {
    throw new InvalidMessageError("emitted_at must be a parseable timestamp");
  }
  if (expectedType === "virtual_agency.task") {
    validateVirtualAgencyMessage(msg);
  }
  if (expectedType === "social.post.publish") {
    validateSocialPublishMessage(msg);
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;

const VIRTUAL_AGENCY_ROLES = new Set<string>([
  "chief_of_staff",
  "content_creative",
  "scheduling_distribution",
  "community_engagement",
  "analytics_reporting",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  msg: Record<string, unknown>,
  field: string
): string {
  const value = msg[field];
  if (typeof value !== "string" || value.length === 0) {
    throw new InvalidMessageError(`missing or empty ${field}`);
  }
  return value;
}

function requireUuid(msg: Record<string, unknown>, field: string): void {
  const value = requireString(msg, field);
  if (!UUID_RE.test(value)) {
    throw new InvalidMessageError(`${field} must be a UUID`);
  }
}

function validateOptionalUuid(
  msg: Record<string, unknown>,
  field: string
): void {
  const value = msg[field];
  if (value == null) {
    return;
  }
  if (typeof value !== "string" || !UUID_RE.test(value)) {
    throw new InvalidMessageError(`${field} must be a UUID when provided`);
  }
}

function requireSha256(msg: Record<string, unknown>, field: string): void {
  const value = requireString(msg, field);
  if (!SHA256_RE.test(value)) {
    throw new InvalidMessageError(`${field} must be a SHA-256 hex digest`);
  }
}

function validateSocialPublishMessage(msg: Record<string, unknown>): void {
  requireString(msg, "post_id");
  requireSha256(msg, "expected_content_hash");
}

function validateVirtualAgencyMessage(msg: Record<string, unknown>): void {
  requireUuid(msg, "org_id");
  requireUuid(msg, "project_id");
  validateOptionalUuid(msg, "task_id");
  requireUuid(msg, "orchestration_task_id");

  const agentRole = requireString(msg, "agent_role");
  if (!VIRTUAL_AGENCY_ROLES.has(agentRole)) {
    throw new InvalidMessageError(`unknown virtual agency role: ${agentRole}`);
  }

  if (!Number.isInteger(msg["task_version"])) {
    throw new InvalidMessageError("missing or invalid task_version");
  }
  const approvalVersion = msg["approval_version"];
  if (approvalVersion != null && !Number.isInteger(approvalVersion)) {
    throw new InvalidMessageError("approval_version must be an integer when provided");
  }
  const approvalPayloadHash = msg["approval_payload_hash"];
  if (
    approvalPayloadHash != null &&
    (typeof approvalPayloadHash !== "string" || !SHA256_RE.test(approvalPayloadHash))
  ) {
    throw new InvalidMessageError(
      "approval_payload_hash must be a SHA-256 hex digest when provided"
    );
  }

  const lineage = msg["lineage"];
  if (!isRecord(lineage)) {
    throw new InvalidMessageError("missing or invalid lineage");
  }
  for (const field of [
    "client_request",
    "project_id",
    "legacy_task_id",
    "orchestration_task_id",
  ]) {
    const value = lineage[field];
    if (typeof value !== "string" || value.length === 0) {
      throw new InvalidMessageError(`missing lineage.${field}`);
    }
  }
  if (!UUID_RE.test(lineage["project_id"] as string)) {
    throw new InvalidMessageError("lineage.project_id must be a UUID");
  }
  if (!UUID_RE.test(lineage["legacy_task_id"] as string)) {
    throw new InvalidMessageError("lineage.legacy_task_id must be a UUID");
  }
  if (!UUID_RE.test(lineage["orchestration_task_id"] as string)) {
    throw new InvalidMessageError("lineage.orchestration_task_id must be a UUID");
  }
  if (lineage["project_id"] !== msg["project_id"]) {
    throw new InvalidMessageError("lineage.project_id must match project_id");
  }
  if (msg["task_id"] != null && lineage["legacy_task_id"] !== msg["task_id"]) {
    throw new InvalidMessageError("lineage.legacy_task_id must match task_id");
  }
  if (lineage["orchestration_task_id"] !== msg["orchestration_task_id"]) {
    throw new InvalidMessageError(
      "lineage.orchestration_task_id must match orchestration_task_id"
    );
  }
  for (const field of [
    "artifact_id",
    "engagement_id",
    "marketing_run_id",
  ]) {
    const value = lineage[field];
    if (value != null && (typeof value !== "string" || !UUID_RE.test(value))) {
      throw new InvalidMessageError(`lineage.${field} must be a UUID when provided`);
    }
  }

  const context = msg["context"];
  if (!isRecord(context)) {
    throw new InvalidMessageError("missing or invalid context");
  }

  const dependencyIds = msg["dependency_ids"];
  if (!Array.isArray(dependencyIds)) {
    throw new InvalidMessageError("missing or invalid dependency_ids");
  }
  for (const dependencyId of dependencyIds) {
    if (typeof dependencyId !== "string" || !UUID_RE.test(dependencyId)) {
      throw new InvalidMessageError("dependency_ids must contain only UUIDs");
    }
  }
}
