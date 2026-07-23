/**
 * @pm/projections — Read-model projection workers.
 *
 * Architecture rule (architecture.md, Layer 2 + Performance #4):
 *   CQRS. Graph = source of truth. Read-models built deterministically
 *   from the event stream. The only state a projection holds is its
 *   position in the event log.
 */

export type {
  Projection,
  ProjectionReplayFrontier,
  ProjectionReplayFrontierEvent,
  ProjectionRunner,
} from "./interfaces.js";
export { PostgresProjectionRunner } from "./postgres.js";
