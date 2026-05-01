/**
 * @pm/workflow — Per-tenant workflow runtime.
 *
 * Phase 0: interface only + the workflow document grammar. Interpreter follows.
 *
 * Architecture rule (architecture.md, Layer 4):
 *   Business processes are expressed, not coded. A graph of capability
 *   invocations conditioned on events. Per-tenant configuration. No fixed
 *   workflow ships.
 */

import type {
  TenantId,
  WorkflowId,
} from "@pm/types";

/**
 * A workflow is a directed acyclic graph of nodes. Nodes are either
 *   - triggers (subscribe to event-type patterns), or
 *   - capability invocations (call a registered capability with derived input).
 *
 * Edges encode "when X completes/emits Y, run Z."
 *
 * The grammar is intentionally minimal at day 1. Profile authors and tenant
 * configurators write workflow JSON; the substrate validates against the
 * registry and executes via the interpreter.
 */
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
  /** Capability name (must exist in registry). */
  readonly capability: string;
  /**
   * Input mapping — declarative pull from prior node outputs and event payload.
   * Day-1 syntax: dotted paths like `$trigger.payload.customerId`,
   * `$nodes.create-project.result.projectId`. Properly typed in Phase 1+.
   */
  readonly inputs: Readonly<Record<string, string>>;
}

export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  /**
   * Optional condition expressed as a dotted-path expression that must be truthy.
   * Day-1 example: "$nodes.create-project.result.success".
   */
  readonly when?: string;
}

export interface WorkflowRuntime {
  /**
   * Install or upgrade a workflow. Idempotent on (tenantId, name, version).
   * Validates that all referenced capabilities are in the registry.
   */
  install(doc: WorkflowDoc): Promise<void>;

  /**
   * Disable a workflow (does not delete history; events that triggered prior
   * runs are preserved in the event log).
   */
  disable(tenantId: TenantId, id: WorkflowId): Promise<void>;

  /**
   * Tick the runtime. Internal — usually invoked by the SubscriptionRouter
   * when a relevant event arrives. Exposed for tests + manual replay.
   */
  onEvent(tenantId: TenantId, eventId: import("@pm/types").EventId): Promise<void>;
}

// TODO(phase-0):
//   - Interpreter implementation — walks the DAG from each matched trigger,
//     resolves inputs, invokes capabilities, records each step as an event
//     so the run is fully reconstructible from the event log.
//   - Idempotency: a run started by event E should be safe to retry if the
//     interpreter crashes mid-run. Step-level event records make this clean.
//   - Loop / cycle prevention at install time.
