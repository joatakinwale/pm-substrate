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
  CreateNodeResult,
  UpdateNodeInput,
  CreateEdgeInput,
} from "./interfaces.js";

export { PostgresGraph } from "./postgres.js";
export type { PostgresGraphOptions, ValidatorFactory } from "./postgres.js";
export {
  OptimisticConcurrencyError,
  NotFoundError,
  InvalidIdError,
  NodeConflictError,
} from "./errors.js";

export {
  readStalenessOf,
  withNodeStaleness,
  withEdgeStaleness,
  withEdgeListStaleness,
  isStale,
  freshnessGate,
  requireFresh,
  StaleReadError,
  type ReadStaleness,
  type FreshnessDecision,
  type StaleReadErrorDetail,
} from "./staleness.js";

export {
  assertGraphWriteAuthority,
  GraphWriteAuthorityError,
  validateGraphWriteAuthority,
  type GraphWriteAuthorityIssue,
  type GraphWriteAuthorityIssueCode,
  type GraphWriteAuthorityPolicy,
  type GraphWriteAuthorityRef,
  type GraphWriteProviderCertificateStatusRef,
} from "./write-authority.js";
