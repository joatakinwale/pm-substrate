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
      `optimistic concurrency conflict on ${id}: expected schemaVersion ${expected}, found ${actual}`,
    );
    this.name = "OptimisticConcurrencyError";
  }
}
