/**
 * @pm/workflow — Per-tenant workflow runtime.
 *
 * Architecture rule (architecture.md, Layer 4):
 *   Business processes are expressed, not coded. A graph of capability
 *   invocations conditioned on events. Per-tenant configuration. No fixed
 *   workflow ships in the substrate.
 */

export type {
  InvokeNode,
  TriggerNode,
  WorkflowDoc,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRuntime,
  InvocationDispatcher,
  InvocationContext,
  InvocationResult,
} from "./interfaces.js";

export { PostgresWorkflowRuntime } from "./postgres.js";
export { WorkflowValidationError } from "./errors.js";
export {
  validateCapabilityContracts,
  type ContractValidationContext,
  type ContractValidationOptions,
} from "./contract-validation.js";
