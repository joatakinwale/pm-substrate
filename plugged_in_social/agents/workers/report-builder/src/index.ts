/**
 * stevie-report-builder — Cloudflare Worker (queue consumer)
 *
 * Triggers: backend/app/api/internal/reports.py::render_client_report
 *
 * Flow:
 *   1. Consume ReportBuildMessage from the stevie-report-builder queue.
 *   2. POST FastAPI /api/internal/reports/{client_report_id}/render body
 *      {org_id} with a 90-second timeout (renders are slow).
 *   3. FastAPI loads the ClientReport, calls render_report_pdf
 *      (WeasyPrint), uploads to R2, updates pdf_url + pdf_generated_at +
 *      status='generated', returns 204.
 *   4. ack() on 2xx; retry() on 5xx / network / timeout; PermanentError
 *      (→ ack → DLQ) on 4xx.
 *
 * Why FastAPI does the render: WeasyPrint stays Python-side. Porting the
 * HTML→PDF pipeline to a Cloudflare Browser Rendering Worker or a
 * third-party PDF service is a design tax we declined — see README. The
 * Worker exists because renders are slow (5–30s per report) and queueing
 * isolates that latency from the producer (the cron sweep handler).
 *
 * Retry taxonomy:
 *     204            → ack (render + upload + DB update done)
 *     404            → PermanentError (report deleted between enqueue + consume)
 *     409            → PermanentError (already-generated report; producer bug)
 *     other 4xx      → PermanentError (validation / contract bug)
 *     5xx            → RetryableError (transient — backend incident)
 *     network / abort → RetryableError (default-safe fallback)
 *
 * max_retries=3 — re-rendering is idempotent (same input → same PDF,
 * overwrites the same R2 key) so transient blips are safe to retry, but
 * past three attempts a failure is more likely a logic bug than a
 * transient one and belongs in the DLQ.
 */
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type ReportBuildMessage,
} from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";

// No extra env bindings — the Worker is a pure orchestrator over the
// backend client. WeasyPrint, R2 upload, and DB writes are all owned by
// FastAPI; the Worker has no direct R2 / DB credentials.
type Env = BaseEnv;

export default {
  async queue(
    batch: MessageBatch<unknown>,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
    ]);

    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    for (const msg of batch.messages) {
      try {
        let payload: ReportBuildMessage;
        try {
          payload = validateMessage<ReportBuildMessage>(
            msg.body,
            "report.build"
          );
        } catch (err) {
          // A contract-failed message is a producer bug — retrying the same
          // bad payload will fail the same way every time. Promote to
          // PermanentError so handleConsumerError ack()s immediately and
          // the message lands in the DLQ for operator review instead of
          // burning the retry budget.
          if (err instanceof InvalidMessageError) {
            throw new PermanentError(
              `invalid report.build message: ${err.message}`,
              err
            );
          }
          throw err;
        }
        await buildOne(payload, backend);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function buildOne(
  payload: ReportBuildMessage,
  backend: BackendClient
): Promise<void> {
  // Single backend call — FastAPI does the WeasyPrint render, R2 upload,
  // and ClientReport update in one request lifetime. The Worker is pure
  // orchestration; we never see PDF bytes or R2 keys.
  try {
    await backend.renderReport({
      client_report_id: payload.client_report_id,
      org_id: payload.org_id,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      // BackendCallError.isRetryable: 5xx + 429 → retry. 4xx → permanent.
      // 404 (report deleted) and 409 (already generated) both fall under
      // the permanent branch — DLQing them is correct: a deleted report
      // will never come back, and re-rendering an already-generated one is
      // either a duplicate enqueue or a producer-side timing bug we want
      // an operator to see.
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    // Network / abort / DNS / timeout — no HTTP status to classify on.
    // Default to retryable so a transient blip doesn't burn the render.
    throw new RetryableError(
      `backend render failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}
