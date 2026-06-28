/**
 * stevie-reports-cron — Cloudflare Worker (scheduled handler)
 *
 * Owns the daily sweep that fires due monthly client reports.
 *
 * Flow (daily at 02:00 UTC):
 *   1. Cron Trigger fires scheduled().
 *   2. POST /internal/reports/sweep-due on FastAPI. Backend walks active
 *      ReportSchedule rows whose next_run_at has passed, computes the
 *      metrics snapshot per row, inserts a ClientReport with
 *      status='pending', advances last_run_at + next_run_at on the
 *      schedule, and returns the list of {client_report_id, org_id}.
 *   3. For each entry, POST a report.build message to the queue-producer
 *      Worker's /enqueue/stevie-report-builder route. The actual PDF
 *      builder Worker (stevie-report-builder, WeasyPrint port) is a
 *      future migration — until it lands, messages sit on the queue
 *      (CF Queues hold messages up to 4 days) and the build runs as
 *      soon as the consumer ships.
 *
 * Why the split (sweep on backend, fanout on Worker): SQLAlchemy lives in
 * FastAPI; queue producers are CF Worker bindings. Splitting at the HTTP
 * boundary keeps each side owning what it already owns and lets this
 * Worker stay a thin orchestrator (no schema knowledge, no queue binding).
 *
 * Idempotency: every report.build message carries an idempotency_key of
 * ``report-build:<client_report_id>``. The ClientReport row is inserted
 * exactly once per logical period (the backend advances next_run_at in
 * the same transaction), so the report id alone is enough — no date
 * suffix needed. If the Cron Trigger fires twice on the same day (CF
 * retry, manual re-trigger, etc.) the backend's sweep returns an empty
 * list on the second pass; the dedup key is belt-and-suspenders for the
 * window between the backend commit and the Worker's enqueue call.
 */
import { assertEnv, type BaseEnv } from "@stevie/shared";
import {
  BackendCallError,
  BackendClient,
  type DueReport,
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
  let reports: DueReport[];
  try {
    reports = await backend.sweepDueReports();
  } catch (err) {
    // Sweep failure: log and re-throw. CF cron will retry on the next
    // scheduled tick. We do NOT add inline retries — the backend bumps
    // ReportSchedule.next_run_at inside the same transaction as the
    // ClientReport insert, so a partial failure naturally re-tries on
    // tomorrow's tick without double-inserting reports.
    if (err instanceof BackendCallError) {
      console.error(
        `[reports-cron] sweep failed (${err.status}): ${err.message}`
      );
    } else {
      console.error(
        `[reports-cron] sweep failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    throw err;
  }

  if (reports.length === 0) {
    console.log("[reports-cron] no due report schedules, nothing to enqueue");
    return { swept: 0, fanned: 0 };
  }

  const enqueueUrl = `${env.QUEUE_PRODUCER_URL}/enqueue/stevie-report-builder`;

  let fanned = 0;
  for (const r of reports) {
    const message = {
      type: "report.build" as const,
      org_id: r.org_id,
      // The ClientReport row exists exactly once for this logical period
      // (backend transaction guarantees that), so the report id alone is
      // a sufficient dedup key — the report-builder Worker can drop
      // duplicates without a date suffix.
      idempotency_key: `report-build:${r.client_report_id}`,
      emitted_at: new Date().toISOString(),
      client_report_id: r.client_report_id,
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
        // Fanout per-row failure: log and keep going. The ClientReport
        // row is already inserted with status='pending'; losing one
        // enqueue means the report sits unbuilt until someone manually
        // re-triggers it (or until status='pending' rows get a sweep
        // re-driver later). Better than throwing out of the loop and
        // abandoning the rest of the batch.
        console.error(
          `[reports-cron] enqueue failed for report ${r.client_report_id} (${res.status}): ${text.slice(0, 300)}`
        );
        continue;
      }
      fanned += 1;
    } catch (err) {
      console.error(
        `[reports-cron] enqueue network error for report ${r.client_report_id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[reports-cron] swept=${reports.length} fanned=${fanned}`
  );
  return { swept: reports.length, fanned };
}
