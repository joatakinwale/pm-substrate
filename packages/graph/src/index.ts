/**
 * @pm/graph — Entity graph API.
 *
 * Architecture rule (architecture.md, Layer 1):
 *   Nodes hold identity + stable attrs only. Everything contextual on typed edges.
 *   Per-tenant declared. Tools query edges they care about, not whole nodes.
 */

export type {
  Graph,
  GraphReader,
  GraphWriter,
  CreateNodeInput,
  UpdateNodeInput,
  CreateEdgeInput,
} from "./interfaces.js";

export { PostgresGraph } from "./postgres.js";
export type { PostgresGraphOptions, ValidatorFactory } from "./postgres.js";
export { OptimisticConcurrencyError, NotFoundError } from "./errors.js";
