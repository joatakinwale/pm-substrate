/**
 * stevie-automation-runner — Cloudflare Worker (queue consumer)
 *
 * Replaces: backend/app/tasks/automation_tasks.py::run_automation
 *
 * Flow:
 *   1. Consume AutomationRunMessage from the stevie-automation-runner queue.
 *   2. POST FastAPI /api/internal/automations/{automation_id}/execute body
 *      {org_id, trigger_event, trigger_data}.
 *   3. 200 → ack (the run reached a terminal state — completed or failed).
 *      202 → ack with a log line (paused at a wait step; FastAPI persisted
 *      progress on the AutomationRun and the resume mechanism — see README
 *      follow-up section — will re-enqueue when the wait elapses).
 *      4xx (404, 410 — automation deleted/disabled / not found) → PermanentError.
 *      5xx → RetryableError (CF Queues retries per max_retries=3).
 *
 * Why FastAPI does the actual step execution: automations are multi-step
 * state machines with 8 step types (send_email, add_tag, remove_tag, wait,
 * create_task, update_field, send_notification, webhook), conditional
 * branching, and per-step durable persistence. Porting all of that to
 * TypeScript is high-risk; the Python implementation already has full DB
 * model + service access. Worker stays thin — queue consumer + retry
 * orchestrator — same shape as stripe-sync and ai-content.
 *
 * Retry taxonomy:
 *     200            → ack (terminal: completed or failed)
 *     202            → ack (paused at wait step; resume is a follow-up)
 *     404 / 410      → PermanentError (automation deleted/disabled)
 *     other 4xx      → PermanentError (validation / contract bug)
 *     5xx            → RetryableError (transient — backend incident)
 *     network / abort → RetryableError (default-safe fallback)
 *
 * max_retries=3 (lower than the others) because rerunning has observable
 * side effects — a duplicate send_email step fires a second email, a
 * duplicate create_task creates a duplicate row. Three attempts is enough
 * for transient blips; anything past that is more likely a logic bug.
 */
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type AutomationRunMessage,
} from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";

// No extra env bindings — the Worker is a pure orchestrator over the
// backend client. If a future enhancement needs e.g. a per-Worker
// bearer token for cross-Worker fanout, extend BaseEnv here.
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
        let payload: AutomationRunMessage;
        try {
          payload = validateMessage<AutomationRunMessage>(
            msg.body,
            "automation.run"
          );
        } catch (err) {
          // A contract-failed message is a producer bug, not a transient
          // failure — retrying the same bad payload will fail the same way
          // every time. Promote to PermanentError so handleConsumerError
          // ack()s immediately and the message lands in the DLQ for
          // operator review instead of burning the retry budget.
          if (err instanceof InvalidMessageError) {
            throw new PermanentError(
              `invalid automation.run message: ${err.message}`,
              err
            );
          }
          throw err;
        }
        await runOne(payload, backend);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function runOne(
  payload: AutomationRunMessage,
  backend: BackendClient
): Promise<void> {
  // Single backend call — FastAPI runs every step under its own RLS
  // context (system actor) inside one request lifetime. The Worker is
  // pure orchestration; we never see step results, only the terminal
  // status code.
  let result: { status: "completed" | "paused" };
  try {
    result = await backend.executeAutomation({
      automation_id: payload.automation_id,
      org_id: payload.org_id,
      trigger_event: payload.trigger_event,
      trigger_data: payload.trigger_data,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      // BackendCallError.isRetryable: 5xx + 429 → retry. 4xx → permanent.
      // 404 (automation deleted) and 410 (disabled) both fall under the
      // permanent branch — DLQing them is the right call: a deleted
      // automation will never come back, and we don't want infinite
      // retries on what is almost certainly a producer-side timing bug
      // (someone deleted the automation between enqueue and consume).
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    // Network / abort / DNS — no HTTP status to classify on. Default to
    // retryable so a transient blip doesn't burn the run.
    throw new RetryableError(
      `backend execute failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  if (result.status === "paused") {
    // FastAPI returned 202 — the automation hit a `wait` step. FastAPI
    // has persisted the AutomationRun's high-water mark; the Worker's
    // job is done for this attempt. Re-enqueue at the right time is OUT
    // of scope for this migration — see README "follow-up" section. We
    // log explicitly so an operator can spot stuck runs in the meantime.
    console.log(
      `[automation-runner] paused at wait step: automation_id=${payload.automation_id} ` +
        `org_id=${payload.org_id} — re-enqueue mechanism is a follow-up`
    );
  }
}
