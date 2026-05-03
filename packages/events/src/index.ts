/**
 * @pm/events — Append-only event log + LISTEN/NOTIFY router.
 *
 * Architecture rule (architecture.md, Layer 2):
 *   Append-only. Topic-scoped streams (tenant + entity type).
 *   Declarative subscriptions. Time-travel queries free.
 */

export type {
  EventPublisher,
  EventReader,
  SubscriptionRouter,
  PublishInput,
  ReadQuery,
} from "./interfaces.js";

export { PostgresEventStore } from "./postgres.js";
export { matchesPattern } from "./pattern.js";
