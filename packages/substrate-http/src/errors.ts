import { HTTPException } from "hono/http-exception";
import {
  InvalidIdError,
  NodeConflictError,
  NotFoundError,
  OptimisticConcurrencyError,
} from "@pm/graph";
import { ProfileValidationError } from "@pm/profile-registry";
import {
  InvalidTenantIdError,
  TenantConflictError,
  TenantNotFoundError,
} from "@pm/tenants";

/**
 * Translate substrate domain errors into HTTP status codes. Only documented
 * substrate exceptions get translated; anything else bubbles as 500 (and is
 * logged by Hono's default error middleware in the caller's app).
 *
 * Discipline: if a new substrate exception class is added, it MUST be added
 * here too. The mapping is the contract the HTTP clients depend on.
 *
 * Current mapping (P2.3a additions marked):
 *   ProfileValidationError   → 422 Unprocessable Entity
 *   OptimisticConcurrencyError → 409 Conflict
 *   NodeConflictError        → 409 Conflict   [P2.3a]
 *   InvalidIdError           → 400 Bad Request [P2.3a]
 *   NotFoundError            → 404 Not Found
 *   TenantNotFoundError      → 404 Not Found
 *   TenantConflictError      → 409 Conflict
 *   InvalidTenantIdError     → 400 Bad Request
 *   everything else          → 500 Internal Server Error
 */
export const toHTTPException = (err: unknown): HTTPException => {
  if (err instanceof HTTPException) return err;
  if (err instanceof ProfileValidationError) {
    return new HTTPException(422, {
      message: err.message,
      cause: { kind: "profile_validation", subject: err.subject },
    });
  }
  if (err instanceof TenantConflictError) {
    return new HTTPException(409, {
      message: err.message,
      cause: { kind: "tenant_conflict" },
    });
  }
  if (err instanceof TenantNotFoundError) {
    return new HTTPException(404, {
      message: err.message,
      cause: { kind: "tenant_not_found" },
    });
  }
  if (err instanceof InvalidTenantIdError) {
    return new HTTPException(400, {
      message: err.message,
      cause: { kind: "invalid_tenant_id" },
    });
  }
  if (err instanceof NodeConflictError) {
    return new HTTPException(409, {
      message: err.message,
      cause: {
        kind: "node_conflict",
        existing: err.existingProfile,
        requested: err.requestedProfile,
      },
    });
  }
  if (err instanceof OptimisticConcurrencyError) {
    return new HTTPException(409, {
      message: err.message,
      cause: { kind: "optimistic_concurrency" },
    });
  }
  if (err instanceof InvalidIdError) {
    return new HTTPException(400, {
      message: err.message,
      cause: { kind: "invalid_id" },
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
