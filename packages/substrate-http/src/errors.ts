import { HTTPException } from "hono/http-exception";
import { NotFoundError, OptimisticConcurrencyError } from "@pm/graph";
import { ProfileValidationError } from "@pm/profile-registry";

/**
 * Translate substrate domain errors into HTTP status codes. Only documented
 * substrate exceptions get translated; anything else bubbles as 500 (and is
 * logged by Hono's default error middleware in the caller's app).
 *
 * Discipline: if a new substrate exception class is added, it MUST be added
 * here too. The mapping is the contract the HTTP clients depend on.
 */
export const toHTTPException = (err: unknown): HTTPException => {
  if (err instanceof HTTPException) return err;
  if (err instanceof ProfileValidationError) {
    return new HTTPException(422, {
      message: err.message,
      cause: { kind: "profile_validation", subject: err.subject },
    });
  }
  if (err instanceof OptimisticConcurrencyError) {
    return new HTTPException(409, {
      message: err.message,
      cause: { kind: "optimistic_concurrency" },
    });
  }
  if (err instanceof NotFoundError) {
    return new HTTPException(404, {
      message: err.message,
      cause: { kind: "not_found" },
    });
  }
  // Unknown — let the framework return 500 with the message.
  return new HTTPException(500, {
    message: err instanceof Error ? err.message : String(err),
  });
};
