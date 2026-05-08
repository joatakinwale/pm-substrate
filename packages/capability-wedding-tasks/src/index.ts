/**
 * @pm/capability-wedding-tasks \u2014 owns PlannerTask creation in response to
 * contract milestones.
 *
 * Tier-2 capability: profile-bound to the wedding profile. Subscribes to
 * `wedding.contract.signed`. On each signed contract, writes one
 * PlannerTask graph node + one Contract \u2192 PlannerTask edge + emits
 * `wedding.task.created`. Atomic across all three writes (single tx).
 *
 * Idempotency: keyed on (contractId, taskKind) via the externalRef field
 * on the task node. Same contract.signed delivered twice is a no-op.
 *
 * Architecture: this capability has no knowledge of downstream consumers
 * (calendar, reminders, etc.). It writes one event and walks away.
 */

export { WEDDING_TASKS_CAPABILITY } from "./capability.js";
export {
  TaskCreationHandler,
  DEFAULT_TASK_POLICY,
} from "./handler.js";
export type {
  ContractSignedPayload,
  TaskRuntimeDeps,
  TaskPolicy,
} from "./handler.js";
