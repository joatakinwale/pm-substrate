/**
 * Typed fetch client to the FastAPI internal endpoints.
 *
 * Workers never write Postgres directly. All DB mutations go through
 * the FastAPI `/api/internal/*` routes so:
 *   1. RLS context (org_id, user_id, role) is set the same way as a normal request
 *   2. SQLAlchemy stays the single source of truth for schema + validators
 *   3. Stripe/Mux/etc. side-effects can stay co-located with their existing code
 *
 * Auth is the same shared-header pattern already used by the Cloudflare cron
 * Worker: `X-Stevie-Internal-Secret: <WEBHOOK_SECRET>`. The header is checked
 * by app/api/internal/* dependencies on the FastAPI side.
 */
import type { VirtualAgencyMessage } from "@stevie/shared";

export interface BackendClientConfig {
  /** No trailing slash. */
  baseUrl: string;
  /** Must match backend's WEBHOOK_SECRET env var. */
  webhookSecret: string;
  /** Default 10s. Workers have 30s per request, so leave headroom. */
  timeoutMs?: number;
}

export class BackendClient {
  constructor(private readonly cfg: BackendClientConfig) {}

  /**
   * Update an Invoice's Stripe-synced fields.
   * Backend handler: POST /api/internal/billing/invoice/{id}/sync
   */
  async syncInvoice(input: {
    invoice_id: string;
    org_id: string;
    status: string;
    amount_paid_cents: number;
    amount_due_cents: number;
    paid_at: string | null;
  }): Promise<void> {
    await this.post(
      `/api/internal/billing/invoice/${input.invoice_id}/sync`,
      {
        org_id: input.org_id,
        status: input.status,
        amount_paid_cents: input.amount_paid_cents,
        amount_due_cents: input.amount_due_cents,
        paid_at: input.paid_at,
      }
    );
  }

  /**
   * Run the daily payment-reminder sweep across all orgs and return the
   * list of email payloads the cron Worker should fan out to the
   * email-sender queue. The backend bumps reminder counters and stamps
   * ``last_reminder_at`` inside the same transaction so a re-run within
   * the 3-day throttle window is a no-op.
   * Backend handler: POST /api/internal/billing/reminders/sweep
   */
  async sweepPaymentReminders(): Promise<RemindersWaiting[]> {
    const result = await this.post(
      `/api/internal/billing/reminders/sweep`,
      {}
    );
    const parsed = result as { reminders?: RemindersWaiting[] } | null;
    return parsed?.reminders ?? [];
  }

  /**
   * Run the daily report-schedule sweep across all orgs. The backend walks
   * active ``ReportSchedule`` rows whose ``next_run_at`` has passed,
   * builds a metrics snapshot, inserts a ``ClientReport`` row with
   * status='pending', and advances ``last_run_at`` / ``next_run_at`` in
   * the same transaction so a re-fired cron sees an empty list. Returns
   * the report ids the cron Worker fans out to the report-builder queue.
   * Backend handler: POST /api/internal/reports/sweep-due
   */
  async sweepDueReports(): Promise<DueReport[]> {
    const result = await this.post(
      `/api/internal/reports/sweep-due`,
      {}
    );
    const parsed = result as { reports?: DueReport[] } | null;
    return parsed?.reports ?? [];
  }

  /**
   * Render a single ClientReport's PDF.
   *
   * FastAPI loads the ClientReport, calls ``render_report_pdf``
   * (WeasyPrint), uploads to R2, and updates ``pdf_url`` +
   * ``pdf_generated_at`` + ``status='generated'`` — all under RLS in one
   * request lifetime. The Worker is a queue consumer + ack/retry
   * orchestrator; WeasyPrint stays Python-side.
   *
   * 90-second timeout — PDF rendering is slow (5–30s per report under
   * normal load). The default 10s would flap into RetryableError on slow
   * paths even when the backend is making progress.
   *
   * 404 → report or org/report pairing not found (DLQ).
   * 409 → report is already in a terminal status (e.g. 'generated' or
   *       'sent'); a duplicate enqueue or producer-side timing bug.
   *       Worker DLQs these so an operator can investigate.
   * 5xx → transient backend incident; CF Queues retries.
   *
   * Backend handler: POST /api/internal/reports/{client_report_id}/render
   */
  async renderReport(input: {
    client_report_id: string;
    org_id: string;
  }): Promise<void> {
    // 90s timeout — PDF rendering is slow; the default 10s would flap.
    await this.post(
      `/api/internal/reports/${input.client_report_id}/render`,
      { org_id: input.org_id },
      { timeoutMs: 90_000 }
    );
  }

  /**
   * Lock the campaign, run the audience match, create EmailSend rows, and
   * return the flat recipient list the Worker iterates over to dispatch
   * via Resend.
   *
   * 60-second timeout — campaigns can have thousands of recipients and
   * the audience match + bulk INSERT + per-row template render can take
   * 5–30s of wall time before the response returns. The default 10s
   * would flap into RetryableError on legitimate work.
   *
   * Backend handler: POST /api/internal/email/campaigns/{id}/dispatch
   */
  async dispatchCampaign(input: {
    campaign_id: string;
    org_id: string;
  }): Promise<DispatchCampaignResponse> {
    const result = await this.post(
      `/api/internal/email/campaigns/${input.campaign_id}/dispatch`,
      { org_id: input.org_id },
      { timeoutMs: 60_000 }
    );
    return result as DispatchCampaignResponse;
  }

  /**
   * Record a successful per-recipient send so campaign aggregates stay
   * accurate even if the Worker is interrupted partway through a fanout.
   * Backend handler: POST /api/internal/email/sends/{send_id}/dispatched
   */
  async markSendDispatched(input: {
    send_id: string;
    org_id: string;
    ses_message_id: string;
    sent_at: string;
  }): Promise<void> {
    await this.post(
      `/api/internal/email/sends/${input.send_id}/dispatched`,
      {
        org_id: input.org_id,
        ses_message_id: input.ses_message_id,
        sent_at: input.sent_at,
      }
    );
  }

  /**
   * Record a failed per-recipient send. Worker calls this on Resend errors
   * that didn't escalate to a queue retry (e.g. a single bad address in an
   * otherwise-good campaign).
   * Backend handler: POST /api/internal/email/sends/{send_id}/failed
   */
  async markSendFailed(input: {
    send_id: string;
    org_id: string;
    error: string;
  }): Promise<void> {
    await this.post(
      `/api/internal/email/sends/${input.send_id}/failed`,
      {
        org_id: input.org_id,
        error: input.error,
      }
    );
  }

  /**
   * Record a Resend webhook event (sent / delivered / bounced / opened /
   * clicked / complained). The Worker has already verified the Svix
   * signature; FastAPI looks up the EmailSend by message_id and updates
   * EmailSend / EmailCampaign / Contact under RLS.
   *
   * No org_id in the body — the backend derives it from the EmailSend
   * row, since Resend's webhook envelope doesn't carry our org id and
   * round-tripping it through send metadata is more failure-prone than
   * a single ses_message_id lookup.
   *
   * Backend handler: POST /api/internal/email/events
   */
  async recordEmailEvent(input: EmailEventInput): Promise<void> {
    await this.post(`/api/internal/email/events`, input);
  }

  /**
   * Record a freshly-created Mux asset on the corresponding MediaAsset row.
   * Called by stevie-mux-ingest after `POST https://api.mux.com/video/v1/assets`
   * returns. The backend updates `mux_asset_id` and `mux_status` under RLS.
   *
   * Backend handler: POST /api/internal/video/{asset_id}/mux-created
   */
  async markMuxAssetCreated(input: {
    asset_id: string;
    org_id: string;
    mux_asset_id: string;
    mux_status: string;
  }): Promise<void> {
    await this.post(
      `/api/internal/video/${input.asset_id}/mux-created`,
      {
        org_id: input.org_id,
        mux_asset_id: input.mux_asset_id,
        mux_status: input.mux_status,
      }
    );
  }

  /**
   * Record a Mux webhook event (video.asset.ready / errored / deleted).
   * The Worker has already verified the Mux signature; FastAPI looks up
   * the MediaAsset by `asset_id` (which the Worker reads from Mux's
   * `data.passthrough` — set by stevie-mux-ingest at create time).
   *
   * No org_id in the body — the backend derives it from the MediaAsset
   * row, same pattern as recordEmailEvent: Mux's webhook envelope doesn't
   * carry our org id and the asset_id lookup is the cleanest hop.
   *
   * Backend handler: POST /api/internal/video/events
   */
  async recordMuxEvent(input: MuxEventInput): Promise<void> {
    await this.post(`/api/internal/video/events`, input);
  }

  /**
   * Begin AI content generation for a request_id.
   *
   * FastAPI loads the AIContentRequest + (optional) BrandVoiceProfile,
   * builds the system + user prompts, and returns the provider-ready
   * params. Keeping the prompt-build Python-side means there's one
   * source of truth for the content_type / platform hint maps — the
   * Worker stays a thin HTTP relay.
   *
   * 409 means the request is in a non-startable status (already completed
   * or failed). Workers should DLQ those.
   *
   * Backend handler: POST /api/internal/ai/{request_id}/begin
   */
  async beginAIContent(input: {
    request_id: string;
    org_id: string;
  }): Promise<BeginAIContentResponse> {
    const result = await this.post(
      `/api/internal/ai/${input.request_id}/begin`,
      { org_id: input.org_id }
    );
    return result as BeginAIContentResponse;
  }

  /**
   * Mark an AI content request as completed and persist generation
   * results. The backend computes cost_cents from model + tokens via the
   * existing record_cost_sync helper — the Worker doesn't need to know
   * the price table.
   *
   * Backend handler: POST /api/internal/ai/{request_id}/complete
   */
  async completeAIContent(input: AICompleteInput): Promise<void> {
    await this.post(
      `/api/internal/ai/${input.request_id}/complete`,
      {
        org_id: input.org_id,
        generated_content: input.generated_content,
        model: input.model,
        input_tokens: input.input_tokens,
        output_tokens: input.output_tokens,
        latency_ms: input.latency_ms,
      }
    );
  }

  /**
   * Mark an AI content request as failed with a (truncated) error message.
   * Called by the Worker on PermanentError paths — auth errors, bad
   * prompts — so the user sees the failure in the UI rather than a row
   * stuck in 'generating'.
   *
   * Backend handler: POST /api/internal/ai/{request_id}/fail
   */
  async failAIContent(input: {
    request_id: string;
    org_id: string;
    error_message: string;
  }): Promise<void> {
    await this.post(
      `/api/internal/ai/${input.request_id}/fail`,
      {
        org_id: input.org_id,
        error_message: input.error_message,
      }
    );
  }

  /**
   * Execute an automation workflow inline.
   *
   * FastAPI loads the Automation, walks every step (send_email, add_tag,
   * remove_tag, wait, create_task, update_field, send_notification,
   * webhook), evaluates conditional branches, and persists progress on
   * the AutomationRun row under RLS — all in one request lifetime. The
   * Worker is a queue consumer + ack/retry orchestrator, not the
   * step-execution engine.
   *
   * Status values:
   *   - "completed" — the run reached a terminal state (success or
   *     per-step failure was logged on AutomationRun).
   *   - "paused"    — the run hit a wait step. FastAPI persisted the
   *     resume target; re-enqueueing once the wait elapses is OUT of
   *     scope for this migration (see automation-runner README's
   *     follow-up section).
   *
   * Backend handler: POST /api/internal/automations/{automation_id}/execute
   */
  async executeAutomation(input: {
    automation_id: string;
    org_id: string;
    trigger_event: string;
    trigger_data: Record<string, unknown>;
  }): Promise<{ status: "completed" | "paused" }> {
    const result = await this.post(
      `/api/internal/automations/${input.automation_id}/execute`,
      {
        org_id: input.org_id,
        trigger_event: input.trigger_event,
        trigger_data: input.trigger_data,
      }
    );
    const parsed = result as { status?: unknown } | null;
    // Defensive: treat anything that's not literally "paused" as
    // "completed". Future status values (e.g. "skipped") should be added
    // here explicitly so a backend that returns an unknown string doesn't
    // get silently coerced.
    if (parsed?.status === "paused") {
      return { status: "paused" };
    }
    return { status: "completed" };
  }

  /**
   * Publish a single social media post via its target platform publisher.
   *
   * FastAPI loads the SocialPost + SocialAccount, refreshes the OAuth
   * token if near expiry, dispatches to the right platform publisher
   * (Meta/LinkedIn/X/etc), persists the result on the SocialPost row,
   * and logs an Activity entry — all under RLS.
   *
   * Status values:
   *   - "published" — the platform accepted the post; platform_post_id
   *     and published_at are persisted.
   *   - "failed"    — terminal failure; error_message is persisted.
   *
   * 404 means the post or its SocialAccount is gone (deleted between
   * enqueue and consume). 422 covers permanent errors (unknown platform,
   * config error, auth refresh failure). 5xx is a transient platform
   * failure and the Worker retries.
   *
   * Backend handler: POST /api/internal/social/posts/{post_id}/publish
   */
  async publishSocialPost(input: {
    post_id: string;
    org_id: string;
    expected_content_hash: string;
  }): Promise<{ status: string; platform_post_id?: string | null }> {
    const result = await this.post(
      `/api/internal/social/posts/${input.post_id}/publish`,
      {
        org_id: input.org_id,
        expected_content_hash: input.expected_content_hash,
      }
    );
    const parsed = result as {
      status?: unknown;
      platform_post_id?: unknown;
    } | null;
    return {
      status: typeof parsed?.status === "string" ? parsed.status : "failed",
      platform_post_id:
        typeof parsed?.platform_post_id === "string"
          ? parsed.platform_post_id
          : null,
    };
  }

  /**
   * Run the hourly scheduled-post sweep across all orgs and return the
   * list of {post_id, org_id} pairs the cron Worker fans out to the
   * social-publisher queue. The backend flips each due post's status to
   * 'publishing' inside the same transaction so a re-fired cron sees an
   * empty list.
   *
   * Backend handler: POST /api/internal/social/scheduled/sweep
   */
  async sweepScheduledSocialPosts(): Promise<DueSocialPost[]> {
    const result = await this.post(
      `/api/internal/social/scheduled/sweep`,
      {}
    );
    const parsed = result as { posts?: DueSocialPost[] } | null;
    return parsed?.posts ?? [];
  }

  /**
   * Refresh engagement metrics for recently-published social posts. The
   * backend runs the cross-org sweep in-process (no fanout) — metrics
   * refresh hits one platform API per post and concurrent fetches against
   * the same Meta/LinkedIn/X rate-limit bucket would just serialize
   * behind the rate limiter anyway. Returns a count summary.
   *
   * Backend handler: POST /api/internal/social/metrics/refresh
   */
  async refreshSocialMetrics(): Promise<MetricsRefreshResult> {
    const result = await this.post(
      `/api/internal/social/metrics/refresh`,
      {}
    );
    const parsed = result as {
      checked?: unknown;
      updated?: unknown;
      errored?: unknown;
      virtual_agency_tasks?: unknown;
    } | null;
    return {
      checked: typeof parsed?.checked === "number" ? parsed.checked : 0,
      updated: typeof parsed?.updated === "number" ? parsed.updated : 0,
      errored: typeof parsed?.errored === "number" ? parsed.errored : 0,
      virtual_agency_tasks: Array.isArray(parsed?.virtual_agency_tasks)
        ? (parsed.virtual_agency_tasks as VirtualAgencyMessage[])
        : [],
    };
  }

  /**
   * Generic POST helper. Adds the shared-secret header and parses JSON.
   * 4xx responses throw with the body included so the queue handler can
   * decide whether to retry or DLQ.
   *
   * `opts.timeoutMs` lets callers override the per-instance default for a
   * single call. The renderReport endpoint uses this because PDF
   * rendering can take 5–30s; the default 10s would flap into RetryableError
   * on slow-but-progressing renders. Existing callers that omit the
   * argument keep the previous behaviour (this.cfg.timeoutMs ?? 10s).
   */
  private async post(
    path: string,
    body: unknown,
    opts?: { timeoutMs?: number }
  ): Promise<unknown> {
    const url = `${this.cfg.baseUrl}${path}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(
      () => ctrl.abort(),
      opts?.timeoutMs ?? this.cfg.timeoutMs ?? 10_000
    );
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Matches FastAPI's existing `verify_webhook_secret` dependency.
          "x-webhook-secret": this.cfg.webhookSecret,
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) {
        throw new BackendCallError(
          `${path} returned ${res.status}: ${text.slice(0, 500)}`,
          res.status
        );
      }
      return text ? JSON.parse(text) : null;
    } finally {
      clearTimeout(timeout);
    }
  }
}

/**
 * One reminder payload returned by /api/internal/billing/reminders/sweep.
 *
 * The cron Worker translates each entry into an EmailNotificationMessage
 * and POSTs it to the queue-producer Worker for the stevie-email-sender
 * queue. Counter updates have already happened backend-side; the Worker's
 * job is fanout, not bookkeeping.
 */
export interface RemindersWaiting {
  /** Internal Invoice.id (UUID string). Used to derive the idempotency key. */
  invoice_id: string;
  /** Stevie organization UUID — required by every queue message. */
  org_id: string;
  /** Recipient address. Backend has already filtered out null client_email rows. */
  to_email: string;
  /** Pre-rendered subject line. */
  subject: string;
  /** Pre-rendered HTML body. */
  html_body: string;
}

/**
 * One report-build payload returned by /api/internal/reports/sweep-due.
 *
 * The cron Worker translates each entry into a ReportBuildMessage and
 * POSTs it to the queue-producer Worker for the stevie-report-builder
 * queue. Snapshot computation, ClientReport row insert, and ReportSchedule
 * cadence advancement have already happened backend-side; the Worker's
 * job is the queue handoff.
 */
export interface DueReport {
  /** Internal ClientReport.id (UUID). Used to derive the idempotency key. */
  client_report_id: string;
  /** Stevie organization UUID — required by every queue message. */
  org_id: string;
}

/**
 * One scheduled-post payload returned by /api/internal/social/scheduled/sweep.
 *
 * The cron Worker translates each entry into a SocialPublishMessage and
 * POSTs it to the queue-producer Worker for the stevie-social-publisher
 * queue. The status flip from 'scheduled' → 'publishing' has already
 * happened backend-side; the Worker's job is the queue handoff.
 */
export interface DueSocialPost {
  /** Internal SocialPost.id (UUID). Used to derive the idempotency key. */
  post_id: string;
  /** Stevie organization UUID — required by every queue message. */
  org_id: string;
  /** SHA-256 digest captured when the post was scheduled. */
  expected_content_hash: string;
}

export interface MetricsRefreshResult {
  checked: number;
  updated: number;
  errored: number;
  virtual_agency_tasks: VirtualAgencyMessage[];
}

/** Per-recipient row returned by /api/internal/email/campaigns/{id}/dispatch. */
export interface CampaignSendRow {
  send_id: string;
  to: string;
  subject: string;
  html_body: string;
}

/** Response shape from /api/internal/email/campaigns/{id}/dispatch. */
export interface DispatchCampaignResponse {
  sends: CampaignSendRow[];
}

/**
 * Input shape for /api/internal/email/events.
 *
 * Matches the Pydantic body in app/api/internal/email.py::EmailEventBody.
 * Mirrors Resend's per-event vocabulary 1:1: event_type strings are the
 * second half of Resend's event names (``email.bounced`` → ``bounced``).
 */
export interface EmailEventInput {
  event_type:
    | "sent"
    | "delivered"
    | "bounced"
    | "opened"
    | "clicked"
    | "complained";
  /** Resend's opaque message id — matches EmailSend.ses_message_id. */
  message_id: string;
  /** Single recipient address — Resend webhooks carry one per event. */
  to: string;
  /** ISO-8601 timestamp from Resend's ``created_at``. */
  timestamp: string;
  subject?: string;
  /** Resend's bounce.subType when present, else bounce.type ("hard"|"soft"|...). */
  bounce_type?: string;
  /** Click destination URL (only set on clicked events). */
  link_url?: string;
  /** Complaint sub-classification, when Resend supplies one. */
  complaint_type?: string;
}

/**
 * Input shape for /api/internal/video/events.
 *
 * Matches the Pydantic body in app/api/internal/video.py::MuxEventBody.
 * The Worker keeps Mux's vocabulary in `event_type` (Mux uses dotted
 * names like ``video.asset.ready`` directly — no translation map needed,
 * unlike Resend).
 */
export interface MuxEventInput {
  event_type:
    | "video.asset.ready"
    | "video.asset.errored"
    | "video.asset.deleted";
  /** Our internal MediaAsset.id — extracted from Mux's data.passthrough. */
  asset_id: string;
  /** Mux playback id, only set on video.asset.ready. */
  playback_id?: string;
  /** Mux asset status: "ready" | "errored" | "deleted" (mirrors event_type). */
  status?: string;
  /** Asset duration in seconds, only set on video.asset.ready. */
  duration_seconds?: number;
  /** Mux thumbnail URL synthesized by the Worker from playback_id. */
  thumbnail_url?: string;
  /** Stringified error type/messages, only set on video.asset.errored. */
  error_message?: string;
}

/**
 * Response shape from POST /api/internal/ai/{request_id}/begin.
 *
 * Mirrors AIBeginResponse on the FastAPI side. The system_prompt is
 * already resolved from the linked BrandVoiceProfile (or null if none);
 * the Worker passes it straight through to Anthropic without re-templating.
 */
export interface BeginAIContentResponse {
  /** Resolved system prompt, or null if no BrandVoiceProfile linked. */
  system_prompt: string | null;
  /** User-side prompt with content_type and platform hints already wrapped. */
  user_prompt: string;
  /**
   * Primary model id, equal to ``model_chain[0]``. Older Workers that
   * don't know about ``model_chain`` keep working with this field.
   * Example: "claude-sonnet-4-6", "@cf/meta/llama-3.1-8b-instruct".
   */
  model: string;
  /**
   * Resolved model chain for this generation. Length 1 means the
   * Worker uses the per-provider call path. Length > 1 means use the
   * AI Gateway Universal Endpoint with this list as a fallback chain
   * — first 2xx wins.
   *
   * Optional for backwards-compat with older backends that don't
   * include it; the Worker falls back to ``[model]`` then.
   */
  model_chain?: string[];
  max_tokens: number;
  temperature: number;
}

/**
 * Input shape for POST /api/internal/ai/{request_id}/complete.
 *
 * The backend computes cost_cents from model + tokens — the Worker stays
 * out of the pricing-table business so a model-price change is a one-line
 * Python edit, not a Worker redeploy.
 */
export interface AICompleteInput {
  request_id: string;
  org_id: string;
  generated_content: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  latency_ms: number;
}

export class BackendCallError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "BackendCallError";
  }
  /** 4xx (other than 429) → permanent. 5xx + 429 → retry. */
  get isRetryable(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}
