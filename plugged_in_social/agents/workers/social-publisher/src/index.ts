/**
 * stevie-social-publisher — Cloudflare Worker (queue consumer)
 *
 * Replaces: backend/app/tasks/social_tasks.py::publish_post
 *
 * Flow:
 *   1. Consume SocialPublishMessage from the stevie-social-publisher queue.
 *   2. POST FastAPI /api/internal/social/posts/{post_id}/publish body
 *      {org_id}.
 *   3. 200 → ack (terminal: published or failed — backend has persisted
 *      the SocialPost row in either case).
 *      4xx (404 — post or account deleted; 422 — unknown platform / config /
 *      auth refresh failure) → PermanentError.
 *      5xx → RetryableError (CF Queues retries per max_retries=3).
 *
 * Why FastAPI does the actual publish: the platform-specific publishers
 * (Meta Graph, LinkedIn, X, TikTok, YouTube, Pinterest) plus OAuth token
 * refresh logic are heavy Python with platform SDKs. Porting all of that
 * to TypeScript is a large rewrite for zero behaviour change. Worker
 * stays thin — queue consumer + retry orchestrator — same shape as
 * automation-runner.
 *
 * Retry taxonomy:
 *     200            → ack (terminal: published or failed)
 *     404            → PermanentError (post or account deleted)
 *     422            → PermanentError (unknown platform / config / auth)
 *     other 4xx      → PermanentError (validation / contract bug)
 *     5xx            → RetryableError (transient — platform incident)
 *     network / abort → RetryableError (default-safe fallback)
 *
 * max_retries=3 (lower than stripe-sync's 5) because rerunning has
 * observable side effects — a duplicate publish posts the same content
 * twice to the user's social account. Three attempts is enough for
 * transient blips; anything past that is more likely a logic bug or
 * a hard platform rejection.
 */
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  InvalidMessageError,
  PermanentError,
  RetryableError,
  validateMessage,
  type SocialPublishMessage,
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
        let payload: SocialPublishMessage;
        try {
          payload = validateMessage<SocialPublishMessage>(
            msg.body,
            "social.post.publish"
          );
        } catch (err) {
          // A contract-failed message is a producer bug, not a transient
          // failure — retrying the same bad payload will fail the same way
          // every time. Promote to PermanentError so handleConsumerError
          // ack()s immediately and the message lands in the DLQ for
          // operator review instead of burning the retry budget.
          if (err instanceof InvalidMessageError) {
            throw new PermanentError(
              `invalid social.post.publish message: ${err.message}`,
              err
            );
          }
          throw err;
        }
        await publishOne(payload, backend);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function publishOne(
  payload: SocialPublishMessage,
  backend: BackendClient
): Promise<void> {
  // Single backend call — FastAPI dispatches to the platform publisher,
  // refreshes the OAuth token if needed, persists the result, and logs
  // an Activity record under RLS. The Worker never sees the platform
  // response, only the terminal status.
  try {
    await backend.publishSocialPost({
      post_id: payload.post_id,
      org_id: payload.org_id,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      // BackendCallError.isRetryable: 5xx + 429 → retry. 4xx → permanent.
      // 404 (post or account deleted) and 422 (unknown platform / config /
      // auth refresh failure) both fall under the permanent branch —
      // DLQing them is the right call. A deleted post will never come
      // back, an unknown platform is a config bug, and an auth refresh
      // failure means the user has to re-auth their account before any
      // publish to that platform can succeed.
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    // Network / abort / DNS — no HTTP status to classify on. Default to
    // retryable so a transient blip doesn't burn the publish.
    throw new RetryableError(
      `backend publish failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}
