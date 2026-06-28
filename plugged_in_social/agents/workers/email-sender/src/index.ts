/**
 * stevie-email-sender — Cloudflare Worker (queue consumer)
 *
 * Replaces:
 *   backend/app/tasks/email_tasks.py::send_notification_email
 *   backend/app/tasks/email_tasks.py::send_campaign
 *
 * One queue, two message types. The branch is selected on msg.body.type:
 *
 *   email.notification    — direct Resend send with the producer-rendered HTML.
 *   email.campaign.send   — ask FastAPI to materialize the recipient list, then
 *                           loop and send each via Resend, reporting back per-send.
 *
 * The audience match (Postgres array contains/overlap on Contact.tags) stays
 * on the backend — Workers don't talk to Postgres directly. The Worker's only
 * jobs are Resend API calls and ack/retry decisions.
 */
import { Resend } from "resend";
import {
  assertEnv,
  type BaseEnv,
  type EmailCampaignMessage,
  type EmailNotificationMessage,
  handleConsumerError,
  PermanentError,
  RetryableError,
  validateMessage,
} from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";
import {
  addTrackingPixel,
  rewriteLinks,
} from "./email_helpers.js";

interface Env extends BaseEnv {
  RESEND_API_KEY: string;
  /** Resend-verified default sender, e.g. "Stevie <hello@stevie.social>". */
  RESEND_FROM_EMAIL: string;
  /** Optional default reply-to. Empty string = unset. */
  RESEND_REPLY_TO?: string;
}

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
      "RESEND_API_KEY",
      "RESEND_FROM_EMAIL",
    ]);

    const resend = new Resend(env.RESEND_API_KEY);
    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    for (const msg of batch.messages) {
      try {
        const body = msg.body as { type?: unknown };
        if (body && body.type === "email.notification") {
          const payload = validateMessage<EmailNotificationMessage>(
            msg.body,
            "email.notification"
          );
          await handleNotification(payload, resend, env);
          msg.ack();
        } else if (body && body.type === "email.campaign.send") {
          const payload = validateMessage<EmailCampaignMessage>(
            msg.body,
            "email.campaign.send"
          );
          await handleCampaign(payload, resend, backend, env);
          msg.ack();
        } else {
          // Unknown type — DLQ via PermanentError. The same queue feeds two
          // contracts, and an unknown ``type`` is almost certainly a producer
          // bug, not a transient failure to retry against.
          throw new PermanentError(
            `unknown email message type: ${String(body?.type)}`
          );
        }
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

/**
 * One-shot transactional send. The producer has already rendered the HTML
 * body, so we just hand it to Resend and ack.
 */
async function handleNotification(
  payload: EmailNotificationMessage,
  resend: Resend,
  env: Env
): Promise<void> {
  await sendOneEmail(resend, env, {
    to: payload.to,
    subject: payload.subject,
    html: payload.html_body,
    text: payload.text_body,
    replyTo: payload.reply_to,
  });
}

/**
 * Campaign fanout. The Worker doesn't know the audience — FastAPI does that
 * match under RLS and hands back a flat list of {send_id, to, subject,
 * html_body}. We then loop and send each one, reporting success/failure per
 * recipient so the campaign aggregates stay in sync even if the batch is
 * interrupted partway through.
 *
 * The base URL for tracking pixel + click rewrite is the FastAPI host —
 * the same host that serves /api/tracking/open and /api/tracking/click.
 */
async function handleCampaign(
  payload: EmailCampaignMessage,
  resend: Resend,
  backend: BackendClient,
  env: Env
): Promise<void> {
  let dispatch: { sends: CampaignSend[] };
  try {
    dispatch = await backend.dispatchCampaign({
      campaign_id: payload.campaign_id,
      org_id: payload.org_id,
    });
  } catch (err) {
    throw translateBackendError(err);
  }

  // Tracking endpoints live on the same FastAPI host the Worker just called.
  const trackingBase = env.BACKEND_BASE_URL;

  for (const send of dispatch.sends) {
    // Rewrite tracking AFTER FastAPI has rendered per-contact HTML. Doing it
    // here (instead of in the dispatch endpoint) keeps the FastAPI endpoint
    // ignorant of the tracking host — Worker is the integration boundary.
    let html = addTrackingPixel(send.html_body, send.send_id, trackingBase);
    html = rewriteLinks(html, send.send_id, trackingBase);

    try {
      const result = await sendOneEmail(resend, env, {
        to: send.to,
        subject: send.subject,
        html,
      });

      try {
        await backend.markSendDispatched({
          send_id: send.send_id,
          org_id: payload.org_id,
          ses_message_id: result.messageId,
          sent_at: new Date().toISOString(),
        });
      } catch (markErr) {
        // We sent the email but couldn't record it. That's a partial-failure
        // shape we can't undo; surface it to the queue as retryable. CF
        // Queues will replay the WHOLE message — the recipient may receive a
        // duplicate. Acceptable: better a duplicate than a silent skip.
        throw translateBackendError(markErr);
      }
    } catch (sendErr) {
      // For per-recipient send failures we record the failure (best-effort)
      // and continue with the rest of the recipient list. We do NOT throw
      // out of the batch — one bad email address shouldn't roll back an
      // entire campaign send.
      const msg =
        sendErr instanceof Error ? sendErr.message : String(sendErr);
      try {
        await backend.markSendFailed({
          send_id: send.send_id,
          org_id: payload.org_id,
          error: msg,
        });
      } catch (markFailErr) {
        // If we can't even record the failure, the backend is unhealthy
        // enough that the right thing is to retry the whole campaign
        // message. We've already failed at least one recipient send and
        // the bookkeeping is now broken; better to replay than to leave
        // EmailSend rows stuck in "queued".
        throw translateBackendError(markFailErr);
      }
    }
  }
}

/** Per-recipient row returned by the FastAPI dispatch endpoint. */
interface CampaignSend {
  send_id: string;
  to: string;
  subject: string;
  html_body: string;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

interface SendResult {
  messageId: string;
}

/**
 * Single Resend dispatch with structured error translation.
 *
 * Resend's SDK returns ``{ data, error }`` rather than throwing on 4xx.
 * We mirror the original Python ``EmailSendResult`` shape: success is the
 * presence of ``data.id``, anything else becomes an error string.
 *
 * Error classification:
 *   - 401/403/404 (auth, missing resource) → PermanentError (DLQ)
 *   - 429 (rate limit) and 5xx              → RetryableError
 *   - Network / unknown                     → RetryableError
 */
async function sendOneEmail(
  resend: Resend,
  env: Env,
  args: SendArgs
): Promise<SendResult> {
  const replyTo = args.replyTo ?? env.RESEND_REPLY_TO;

  let response: Awaited<ReturnType<Resend["emails"]["send"]>>;
  try {
    response = await resend.emails.send({
      from: env.RESEND_FROM_EMAIL,
      to: [args.to],
      subject: args.subject,
      html: args.html,
      ...(args.text ? { text: args.text } : {}),
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (err) {
    // Network-level failure. Resend SDK uses fetch under the hood — a
    // thrown error here is a TLS/DNS/timeout problem, all of which are
    // transient by definition.
    throw new RetryableError(
      `resend network error: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  if (response.error) {
    // The SDK normalizes the error to {name, message, statusCode?}.
    const status = (response.error as { statusCode?: number }).statusCode;
    const name = response.error.name ?? "ResendError";
    const message = response.error.message ?? "unknown resend error";
    if (status === 401 || status === 403 || status === 404 || status === 422) {
      throw new PermanentError(`resend ${name} (${status}): ${message}`);
    }
    if (status === 429 || (status !== undefined && status >= 500)) {
      throw new RetryableError(`resend ${name} (${status}): ${message}`);
    }
    // No status code at all — treat as retryable; the alternative is to DLQ
    // a message that might just have hit a transient SDK glitch.
    throw new RetryableError(`resend ${name}: ${message}`);
  }

  const messageId = response.data?.id;
  if (!messageId) {
    // Resend returned 200 with no id — should never happen, but if it does
    // we don't have anything to record. Treat as permanent so we don't
    // re-send (potentially duplicating the email).
    throw new PermanentError("resend returned no message id");
  }
  return { messageId };
}

/**
 * Map a BackendCallError onto the queue's retry/permanent split.
 * Mirrors the stripe-sync template exactly so behaviour is uniform.
 */
function translateBackendError(err: unknown): Error {
  if (err instanceof BackendCallError) {
    if (err.isRetryable) return new RetryableError(err.message, err);
    return new PermanentError(err.message, err);
  }
  return new RetryableError(
    `backend call failed: ${err instanceof Error ? err.message : String(err)}`,
    err
  );
}
