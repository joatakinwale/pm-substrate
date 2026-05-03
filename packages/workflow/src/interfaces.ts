import type {
  EventId,
  PMEvent,
  TenantId,
  WorkflowId,
} from "@pm/types";

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
