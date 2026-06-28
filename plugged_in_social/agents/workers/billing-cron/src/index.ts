/**
 * stevie-billing-cron — Cloudflare Worker (scheduled handler)
 *
 * Owns the daily payment-reminder sweep.
 *
 * Flow (daily at 09:00 UTC):
 *   1. Cron Trigger fires scheduled().
 *   2. POST /internal/billing/reminders/sweep on FastAPI. Backend bumps
 *      reminder counters under a single transaction and returns the
 *      list of {invoice_id, org_id, to_email, subject, html_body}.
 *   3. For each entry, POST an email.notification message to the
 *      queue-producer Worker's /enqueue/stevie-email-sender route.
 *
 * Why the split (sweep on backend, fanout on Worker): SQLAlchemy lives in
 * FastAPI; queue producers are CF Worker bindings. Splitting at the HTTP
 * boundary keeps each side owning what it already owns and lets this
 * Worker stay a thin orchestrator (no schema knowledge, no queue binding).
 *
 * Idempotency: every email.notification carries an idempotency_key of
 * ``reminder:<invoice_id>:<YYYY-MM-DD>`` (UTC). If the Cron Trigger
 * fires twice on the same day (CF retry, manual re-trigger, etc.) the
 * email-sender Worker's dedupe will catch it. The 3-day throttle on the
 * backend is the first line of defense; this is belt-and-suspenders.
 */
import { assertEnv, type BaseEnv } from "@stevie/shared";
import {
  BackendCallError,
  BackendClient,
  type RemindersWaiting,
} from "@stevie/backend-client";

interface Env extends BaseEnv {
  /** Base URL of the stevie-queue-producer Worker, no trailing slash. */
  QUEUE_PRODUCER_URL: string;
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    assertEnv<Env>(env, [
      "WEBHOOK_SECRET",
      "BACKEND_BASE_URL",
      "ENVIRONMENT",
      "QUEUE_PRODUCER_URL",
    ]);

    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    // waitUntil keeps the Worker alive past the synchronous return so a
    // long fanout doesn't get killed early.
    ctx.waitUntil(runSweep(backend, env));
  },
} satisfies ExportedHandler<Env>;

/**
 * One end-to-end sweep+fanout pass. Exposed (non-default) so tests can
 * exercise it directly without standing up a fake ScheduledController.
 */
export async function runSweep(
  backend: BackendClient,
  env: Pick<Env, "QUEUE_PRODUCER_URL" | "WEBHOOK_SECRET">
): Promise<{ swept: number; fanned: number }> {
  let reminders: RemindersWaiting[];
  try {
    reminders = await backend.sweepPaymentReminders();
  } catch (err) {
    // Sweep failure: log and re-throw. CF cron will retry on the next
    // scheduled tick (we do NOT add inline retries — a daily cron with
    // a 3-day throttle has plenty of headroom).
    if (err instanceof BackendCallError) {
      console.error(
        `[billing-cron] sweep failed (${err.status}): ${err.message}`
      );
    } else {
      console.error(
        `[billing-cron] sweep failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    throw err;
  }

  if (reminders.length === 0) {
    console.log("[billing-cron] no overdue invoices, nothing to enqueue");
    return { swept: 0, fanned: 0 };
  }

  // YYYY-MM-DD in UTC — matches the cron trigger's tz so two fires on
  // the same calendar day produce the same idempotency key.
  const today = new Date().toISOString().slice(0, 10);
  const enqueueUrl = `${env.QUEUE_PRODUCER_URL}/enqueue/stevie-email-sender`;

  let fanned = 0;
  for (const r of reminders) {
    const message = {
      type: "email.notification" as const,
      org_id: r.org_id,
      // Date-scoped key — re-runs on the same UTC day collapse to one
      // logical send; the next day's cron sees a new key.
      idempotency_key: `reminder:${r.invoice_id}:${today}`,
      emitted_at: new Date().toISOString(),
      to: r.to_email,
      subject: r.subject,
      html_body: r.html_body,
    };

    try {
      const res = await fetch(enqueueUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Same shared-secret header the queue-producer Worker checks.
          "x-webhook-secret": env.WEBHOOK_SECRET,
        },
        body: JSON.stringify(message),
      });
      if (!res.ok) {
        const text = await res.text();
        // Fanout per-row failure: log and keep going. The backend
        // already bumped this invoice's counter — losing one enqueue
        // turns into a missed reminder for 3 days, not a crash. Better
        // than throwing out of the loop and abandoning the rest.
        console.error(
          `[billing-cron] enqueue failed for invoice ${r.invoice_id} (${res.status}): ${text.slice(0, 300)}`
        );
        continue;
      }
      fanned += 1;
    } catch (err) {
      console.error(
        `[billing-cron] enqueue network error for invoice ${r.invoice_id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[billing-cron] swept=${reminders.length} fanned=${fanned}`
  );
  return { swept: reminders.length, fanned };
}
