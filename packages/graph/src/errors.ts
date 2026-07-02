/**
 * Domain errors raised by the graph layer. Subclasses of Error so callers
 * can branch on instanceof without importing string codes.
 */

export class NotFoundError extends Error {
  constructor(kind: string, id: string) {
    super(`${kind} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

export class OptimisticConcurrencyError extends Error {
  constructor(id: string, expected: number, actual: number) {
    super(
      `optimistic concurrency conflict on ${id}: expected revision ${expected}, found ${actual}`,
    );
    this.name = "OptimisticConcurrencyError";
  }
}

/**
 * Thrown when a caller-supplied node ID is not a valid UUID (v1–v5/nil).
 * HTTP mapping: 400 Bad Request.
 */
export class InvalidIdError extends Error {
  constructor(id: string, reason?: string) {
    super(
      reason
        ? `invalid node id "${id}": ${reason}`
        : `invalid node id "${id}": must be a valid UUID`,
    );
    this.name = "InvalidIdError";
  }
}

/**
 * Thrown when a caller-supplied node ID already exists in this tenant but
 * with a different profile/type binding than the request specifies. Callers
 * should not overwrite existing nodes this way.
 * HTTP mapping: 409 Conflict.
 */
export class NodeConflictError extends Error {
  readonly existingProfile: { tier1: string; profile: string | null; concrete: string };
  readonly requestedProfile: { tier1: string; profile: string | null; concrete: string };

  constructor(
    id: string,
    existing: { tier1: string; profile: string | null; concrete: string },
    requested: { tier1: string; profile: string | null; concrete: string },
  ) {
    super(
      `node id conflict on "${id}": existing type is ${existing.concrete} (profile=${existing.profile ?? "null"}), ` +
      `but request specifies ${requested.concrete} (profile=${requested.profile ?? "null"})`,
    );
    this.name = "NodeConflictError";
    this.existingProfile = existing;
    this.requestedProfile = requested;
  }
}
