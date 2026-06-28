/**
 * Error types Workers throw to signal retry / DLQ behavior to Cloudflare Queues.
 *
 * - RetryableError → CF Queues will retry per the retry config (exponential backoff).
 * - PermanentError → message goes straight to DLQ, no retry.
 *
 * Anything else (a thrown Error, an unhandled rejection) is treated as retryable
 * by default, which is the safer fallback for unexpected failures.
 */

export class RetryableError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "RetryableError";
    this.cause = cause;
  }
}

export class PermanentError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "PermanentError";
    this.cause = cause;
  }
}

/**
 * Helper for the queue handler — call inside `for (const msg of batch.messages)`.
 * Translates the thrown error into the right Cloudflare Queues ack semantics:
 *   - PermanentError → msg.ack() (do NOT retry; DLQ on next retry config trip)
 *   - everything else → msg.retry() (let CF retry per the queue's retry policy)
 */
export function handleConsumerError(
  msg: { ack: () => void; retry: () => void },
  err: unknown
): void {
  if (err instanceof PermanentError) {
    console.error(
      `[permanent] ${err.message}`,
      err.cause ? { cause: err.cause } : {}
    );
    msg.ack();
    return;
  }
  console.warn(
    `[retryable] ${err instanceof Error ? err.message : String(err)}`
  );
  msg.retry();
}
