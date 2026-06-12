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
export {
  allowAllAuthorizer,
  type PermissionAuthorizer,
  type PermissionCheck,
  type PermissionDecision,
} from "./permissions.js";
export {
  assertAcyclic,
  assertWorkflowAcyclic,
  type CycleDetectionInput,
} from "./cycle-detection.js";
export {
  analyzeWorkflowSoundness,
  assertWorkflowSound,
  type WorkflowSoundnessReport,
} from "./soundness.js";
export {
  acceptAllInputValidator,
  rejectAllInputValidator,
  builtinInputValidator,
  type InputValidator,
  type InputValidationCheck,
  type InputValidationDecision,
} from "./input-validation.js";
export {
  validateInvocationEvidenceBinding,
  verifyInvocationEvidenceBindingAgainstCatalog,
  type EvidenceBindingAdmissionReviewRef,
  type EvidenceBindingIssue,
  type EvidenceBindingMode,
  type EvidenceBindingProvider,
  type EvidenceBindingReferenceCatalog,
  type EvidenceBindingRequest,
  type EvidenceBindingRuntimeVerificationRequest,
  type EvidenceBindingStateReviewArtifactRef,
  type EvidenceBindingValidationCheck,
  type EvidenceBindingValidationDecision,
  type EvidenceBindingVerificationDecision,
  type EvidenceBindingVerificationRequest,
  type EvidenceBindingVerifier,
  type InvocationEvidenceBinding,
  type InvocationEvidenceConsequence,
  type InvocationEvidencePolicyDisposition,
} from "./evidence-binding.js";
