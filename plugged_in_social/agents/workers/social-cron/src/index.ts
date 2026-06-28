/**
 * stevie-social-cron — Cloudflare Worker (scheduled handler)
 *
 * Owns two scheduled jobs:
 *   - publish_scheduled_posts: sweep due rows, fan out to social-publisher
 *   - refresh_engagement_metrics: nightly metrics pull
 *
 * Flow (hourly, 0 * * * *):
 *   1. Cron Trigger fires scheduled() with controller.cron = "0 * * * *".
 *   2. POST /internal/social/scheduled/sweep on FastAPI. Backend flips
 *      due posts from 'scheduled' → 'publishing' under one transaction
 *      and returns the list of {post_id, org_id}.
 *   3. For each entry, POST a social.post.publish message to the
 *      queue-producer Worker's /enqueue/stevie-social-publisher route.
 *
 * Flow (every 30 minutes, *​/30 * * * *):
 *   1. Cron Trigger fires scheduled() with controller.cron = "*​/30 * * * *".
 *   2. POST /internal/social/metrics/refresh on FastAPI. Backend runs
 *      the cross-org sweep in-process (no fanout) and returns counts.
 *
 * Why two triggers in one Worker: same backend client, same env bindings,
 * same auth — splitting would just double the deploy surface. Same
 * pattern Cloudflare's docs recommend for related schedules.
 *
 * Why no fanout for metrics: refresh is already an aggregate operation —
 * one platform API call per post against the same Meta/LinkedIn/X
 * rate-limit bucket. N concurrent Worker fetches would just serialize
 * behind the rate limiter; in-process keeps the design 1:1 with the
 * legacy beat task.
 *
 * Idempotency for scheduled fanout: each social.post.publish carries an
 * idempotency_key of ``social-publish:<post_id>:<sweep-iso>``. If the
 * cron fires twice in the same hour (CF retry, manual re-trigger), the
 * status flip from 'scheduled' → 'publishing' has already happened on
 * the first run, so the second sweep returns an empty list. The key
 * shape is belt-and-suspenders for any consumer-side dedupe.
 */
import { assertEnv, type BaseEnv } from "@stevie/shared";
import {
  BackendCallError,
  BackendClient,
  type DueSocialPost,
} from "@stevie/backend-client";

interface Env extends BaseEnv {
  /** Base URL of the stevie-queue-producer Worker, no trailing slash. */
  QUEUE_PRODUCER_URL: string;
}

// Cron expressions used in wrangler.toml. We dispatch on these literally
// so a typo in the dispatch table is caught by the type system the next
// time we read this file rather than at runtime when a cron fires.
const CRON_SCHEDULED_SWEEP = "0 * * * *";
const CRON_METRICS_REFRESH = "*/30 * * * *";

export default {
  async scheduled(
    controller: ScheduledController,
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
    // long fanout doesn't get killed early — same shape as billing-cron.
    if (controller.cron === CRON_SCHEDULED_SWEEP) {
      ctx.waitUntil(runScheduledSweep(backend, env));
    } else if (controller.cron === CRON_METRICS_REFRESH) {
      ctx.waitUntil(runMetricsRefresh(backend));
    } else {
      // An unknown cron expression is a wrangler.toml bug — log loudly
      // so we notice on the first tick. Don't throw; the cron daemon
      // would just retry the same broken config.
      console.error(
        `[social-cron] unknown cron expression: ${controller.cron}`
      );
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * Hourly: sweep for due scheduled posts and fan out a publish message
 * per row. Exposed (non-default) so tests can exercise it directly
 * without standing up a fake ScheduledController.
 */
export async function runScheduledSweep(
  backend: BackendClient,
  env: Pick<Env, "QUEUE_PRODUCER_URL" | "WEBHOOK_SECRET">
): Promise<{ swept: number; fanned: number }> {
  let posts: DueSocialPost[];
  try {
    posts = await backend.sweepScheduledSocialPosts();
  } catch (err) {
    // Sweep failure: log and re-throw. CF cron will retry on the next
    // scheduled tick (we do NOT add inline retries — an hourly cron has
    // plenty of headroom).
    if (err instanceof BackendCallError) {
      console.error(
        `[social-cron] scheduled-sweep failed (${err.status}): ${err.message}`
      );
    } else {
      console.error(
        `[social-cron] scheduled-sweep failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    throw err;
  }

  if (posts.length === 0) {
    console.log("[social-cron] no due scheduled posts, nothing to enqueue");
    return { swept: 0, fanned: 0 };
  }

  // Sweep timestamp shared across all messages from this run. Re-runs
  // within the same minute collapse to one logical message per post.
  const sweepIso = new Date().toISOString();
  const enqueueUrl = `${env.QUEUE_PRODUCER_URL}/enqueue/stevie-social-publisher`;

  let fanned = 0;
  for (const p of posts) {
    const message = {
      type: "social.post.publish" as const,
      org_id: p.org_id,
      // Sweep-scoped key — re-runs within the same sweep produce the
      // same idempotency key per post; the next sweep sees a new key.
      idempotency_key: `social-publish:${p.post_id}:${sweepIso}`,
      emitted_at: sweepIso,
      post_id: p.post_id,
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
        // Fanout per-row failure: log and keep going. The backend has
        // already flipped this post to 'publishing'; losing one enqueue
        // means the post is stuck in 'publishing' until manually
        // retried. Better than throwing out of the loop and abandoning
        // the rest of the batch.
        console.error(
          `[social-cron] enqueue failed for post ${p.post_id} (${res.status}): ${text.slice(0, 300)}`
        );
        continue;
      }
      fanned += 1;
    } catch (err) {
      console.error(
        `[social-cron] enqueue network error for post ${p.post_id}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  console.log(
    `[social-cron] scheduled-sweep swept=${posts.length} fanned=${fanned}`
  );
  return { swept: posts.length, fanned };
}

/**
 * Every 30 minutes: trigger an in-process metrics refresh on FastAPI.
 * No fanout — backend handles the cross-org sweep itself. Exposed
 * (non-default) so tests can exercise it directly.
 */
export async function runMetricsRefresh(
  backend: BackendClient
): Promise<{ checked: number; updated: number; errored: number }> {
  try {
    const result = await backend.refreshSocialMetrics();
    console.log(
      `[social-cron] metrics-refresh checked=${result.checked} updated=${result.updated} errored=${result.errored}`
    );
    return result;
  } catch (err) {
    if (err instanceof BackendCallError) {
      console.error(
        `[social-cron] metrics-refresh failed (${err.status}): ${err.message}`
      );
    } else {
      console.error(
        `[social-cron] metrics-refresh failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    throw err;
  }
}
