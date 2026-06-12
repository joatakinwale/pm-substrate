import type {
  EventId,
  PMEvent,
  TenantId,
  WorkflowId,
} from "@pm/types";
import type { InvocationEvidenceBinding } from "./evidence-binding.js";

export type {
  EvidenceBindingMode,
  EvidenceBindingProvider,
  EvidenceBindingRequest,
  InvocationEvidenceBinding,
  InvocationEvidenceConsequence,
  InvocationEvidencePolicyDisposition,
} from "./evidence-binding.js";

export interface WorkflowDoc {
  readonly id: WorkflowId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly version: number;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

export type WorkflowNode = TriggerNode | InvokeNode;

export interface TriggerNode {
  readonly nodeId: string;
  readonly kind: "trigger";
  /** Event-type pattern (glob) — e.g., "contract.signed". */
  readonly on: string;
}

export interface InvokeNode {
  readonly nodeId: string;
  readonly kind: "invoke";
  /** Capability name (must exist in registry at install time). */
  readonly capability: string;
  /**
   * Inputs are dotted paths resolved at invocation time:
   *   $trigger.payload.<...>
   *   $nodes.<nodeId>.result.<...>
   * Day-1 grammar; will be tightened in Phase 1+.
   */
  readonly inputs: Readonly<Record<string, string>>;
  /**
   * G8.3: optional retry policy. Omitted = single attempt (legacy behavior).
   * On dispatcher failure (success=false), the runtime will retry up to
   * `maxAttempts` total times (counting the first attempt) with `backoffMs`
   * delay between attempts. After exhaustion, the step lands in the
   * dead-letter table and the run is marked failed.
   *
   * `mode` controls backoff growth: "fixed" (default) sleeps backoffMs
   * between every attempt; "exponential" sleeps backoffMs * 2^(attempt-1)
   * for attempt >= 1, capped at 5 minutes.
   *
   * Authorization denials and "capability not found" errors are NOT
   * retried (they are not transient by nature) and go straight to the
   * dead-letter with reason='permission_denied' or 'capability_not_found'.
   */
  readonly retry?: RetryPolicy;
}

export interface RetryPolicy {
  /** Total attempts including the first. Must be >= 1; values <= 1 disable retry. */
  readonly maxAttempts: number;
  /** Base delay between attempts, in milliseconds. */
  readonly backoffMs: number;
  /** Backoff growth mode. Default "fixed". */
  readonly mode?: "fixed" | "exponential";
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  /** Optional dotted-path that must resolve truthy. Day-1 only. */
  readonly when?: string;
}

/**
 * The substrate cannot call user code directly. Capability invocations are
 * delegated to an `InvocationDispatcher` that the consumer wires in. For
 * tests we use an in-process dispatcher; for production this is replaced by
 * a transport-aware one (HTTP, queue, etc.).
 */
export interface InvocationDispatcher {
  invoke(ctx: InvocationContext): Promise<InvocationResult>;
}

export interface InvocationContext {
  readonly tenantId: TenantId;
  readonly capability: string;
  readonly inputs: Readonly<Record<string, unknown>>;
  /**
   * Optional evidence-action binding for write-capable invocations. When the
   * runtime is configured with `evidenceBindingMode: "require_for_writes"`,
   * dispatch is denied unless this binding is present and complete.
   */
  readonly evidenceBinding?: InvocationEvidenceBinding;
  /** Event that triggered the run, for tracing/audit. */
  readonly triggerEvent: PMEvent;
  /** Workflow + node identification, for logs. */
  readonly workflowId: WorkflowId;
  readonly nodeId: string;
}

export interface InvocationResult {
  readonly success: boolean;
  readonly result: Readonly<Record<string, unknown>>;
  readonly error?: string;
}

export interface WorkflowRuntime {
  /**
   * Install or upgrade a workflow. Idempotent on (tenantId, name, version).
   * Validates that all referenced capabilities exist in the registry.
   */
  install(doc: WorkflowDoc): Promise<void>;

  /** Disable a workflow (stops triggering future runs; history preserved). */
  disable(tenantId: TenantId, id: WorkflowId): Promise<void>;

  /**
   * Process an incoming event. Looks up workflows whose triggers match,
   * walks each one's DAG, invokes capabilities, records run + steps.
   * Idempotent on (workflow_id, triggered_by_event_id).
   */
  onEvent(tenantId: TenantId, eventId: EventId): Promise<void>;
}
