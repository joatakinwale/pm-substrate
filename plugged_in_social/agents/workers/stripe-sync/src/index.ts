/**
 * stevie-stripe-sync — Cloudflare Worker (queue consumer)
 *
 * Replaces: backend/app/tasks/billing_tasks.py::sync_stripe_invoice
 *
 * Flow:
 *   1. Consume StripeSyncMessage from the stevie-stripe-sync queue.
 *   2. Fetch the latest invoice state from Stripe.
 *   3. POST synced fields → FastAPI POST /api/internal/billing/invoice/{id}/sync
 *      (which performs the DB UPDATE under RLS using org_id from the body).
 *   4. ack() the message on success; retry() on transient errors.
 *
 * This is the reference migration. The pattern here (validateMessage → fetch
 * external → backend call → ack/retry) is duplicated across every queue Worker.
 */
import Stripe from "stripe";
import {
  assertEnv,
  type BaseEnv,
  handleConsumerError,
  PermanentError,
  RetryableError,
  validateMessage,
  type StripeSyncMessage,
} from "@stevie/shared";
import { BackendCallError, BackendClient } from "@stevie/backend-client";

interface Env extends BaseEnv {
  STRIPE_SECRET_KEY: string;
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
      "STRIPE_SECRET_KEY",
    ]);

    const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
      // Pinning the API version protects us from upstream surprises.
      apiVersion: "2024-06-20",
      // Workers don't ship a Node fetch agent; use the global fetch.
      httpClient: Stripe.createFetchHttpClient(),
    });
    const backend = new BackendClient({
      baseUrl: env.BACKEND_BASE_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    });

    for (const msg of batch.messages) {
      try {
        const payload = validateMessage<StripeSyncMessage>(
          msg.body,
          "stripe.invoice.sync"
        );
        await syncOne(payload, stripe, backend);
        msg.ack();
      } catch (err) {
        handleConsumerError(msg, err);
      }
    }
  },
} satisfies ExportedHandler<Env>;

async function syncOne(
  payload: StripeSyncMessage,
  stripe: Stripe,
  backend: BackendClient
): Promise<void> {
  // 1. Pull current state from Stripe.
  let invoice: Stripe.Invoice;
  try {
    invoice = await stripe.invoices.retrieve(payload.stripe_invoice_id);
  } catch (err) {
    // Stripe SDK errors include a `type` field. Permanent: invalid_request_error,
    // authentication_error. Transient: api_connection_error, api_error, rate_limit_error.
    if (err instanceof Stripe.errors.StripeError) {
      if (
        err.type === "StripeInvalidRequestError" ||
        err.type === "StripeAuthenticationError"
      ) {
        throw new PermanentError(
          `stripe ${err.type}: ${err.message}`,
          err
        );
      }
      throw new RetryableError(
        `stripe ${err.type}: ${err.message}`,
        err
      );
    }
    throw new RetryableError(
      `unexpected stripe error: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }

  // 2. Push synced state to FastAPI.
  try {
    await backend.syncInvoice({
      invoice_id: payload.invoice_id,
      org_id: payload.org_id,
      status: invoice.status ?? "draft",
      amount_paid_cents: invoice.amount_paid,
      amount_due_cents: invoice.amount_due,
      paid_at:
        invoice.status_transitions?.paid_at != null
          ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
          : null,
    });
  } catch (err) {
    if (err instanceof BackendCallError) {
      if (err.isRetryable) {
        throw new RetryableError(err.message, err);
      }
      throw new PermanentError(err.message, err);
    }
    throw new RetryableError(
      `backend call failed: ${err instanceof Error ? err.message : String(err)}`,
      err
    );
  }
}
