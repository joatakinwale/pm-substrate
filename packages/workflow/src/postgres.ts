/**
 * Postgres-backed workflow runtime. Day-1 implementation of Layer 4.
 *
 * Scope:
 *   - install(doc): validate against registry, persist as JSONB.
 *   - onEvent(eventId): match triggers, walk DAG, invoke capabilities via
 *     the supplied InvocationDispatcher, record run + steps.
 *   - Idempotent on (workflow_id, triggered_by_event_id) via UNIQUE.
 *
 * NOT in scope yet:
 *   - Cycle prevention at install (TODO; current grammar is intended to be a
 *     DAG but the runtime doesn't enforce it).
 *   - Conditional `when` evaluation beyond simple truthy lookup.
 *   - Step-level retries on InvocationDispatcher errors. The current behavior
 *     marks a step failed and stops the run. This is the right floor: real
 *     retry policy is workflow-doc-declared and lands in Phase 1+.
 *
 * Idempotency strategy: workflow.runs has UNIQUE (workflow_id, triggered_by).
 * If the same event triggers the same workflow twice, the second insert is
 * caught by ON CONFLICT DO NOTHING and we skip the run. This is what makes
 * onEvent safe to call from a NOTIFY-driven consumer with at-least-once
 * delivery semantics.
 */

import { randomUUID } from "node:crypto";
import type {
  EventId,
  PMEvent,
  TenantId,
  WorkflowId,
} from "@pm/types";
import type { EventReader } from "@pm/events";
import type { Capability, Registry } from "@pm/registry";
import { matchesPattern } from "@pm/registry";
import pg from "pg";
import { WorkflowValidationError } from "./errors.js";
import { assertWorkflowAcyclic } from "./cycle-detection.js";
import { validateCapabilityContracts } from "./contract-validation.js";
import { allowAllAuthorizer, type PermissionAuthorizer } from "./permissions.js";
import type {
  InvocationDispatcher,
  WorkflowDoc,
  WorkflowNode,
  WorkflowRuntime,
} from "./interfaces.js";

/**
 * G8.2: deep equality check for workflow docs. Used at install time to
 * decide whether a re-install of an existing (tenant, name, version) is
 * a no-op (same doc) or a violation (different doc). We canonicalize via
 * JSON.stringify; doc fields are simple enough (strings/numbers/arrays/
 * plain objects) that key-order is the only canonicalization concern,
 * and we deal with that by sorting keys recursively.
 */
function docsEqual(a: unknown, b: unknown): boolean {
  return canonicalize(a) === canonicalize(b);
}
function canonicalize(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonicalize).join(",") + "]";
  const obj = v as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalize(obj[k])).join(",") + "}";
}

interface WorkflowRow {
  id: string;
  tenant_id: string;
  name: string;
  version: number;
  doc: WorkflowDoc;
  enabled: boolean;
}

export interface RuntimeDeps {
  readonly pool: pg.Pool;
  readonly registry: Registry;
  readonly events: EventReader;
  readonly dispatcher: InvocationDispatcher;
  /**
   * If true, install() rejects workflows whose capabilities still use
   * untyped (V1) contract declarations. Default: false (migration window).
   * Flip to true once all capabilities are migrated per ADR-0013 step 4.
   */
  readonly strictContracts?: boolean;
  /**
   * G7: authorizes each invoke node before dispatch. If omitted, uses an
   * explicit allow-all authorizer for migration/backward compatibility.
   */
  readonly authorizer?: PermissionAuthorizer;
}

export class PostgresWorkflowRuntime implements WorkflowRuntime {
  readonly #pool: pg.Pool;
  readonly #registry: Registry;
  readonly #events: EventReader;
  readonly #dispatcher: InvocationDispatcher;
  readonly #strictContracts: boolean;
  readonly #authorizer: PermissionAuthorizer;

  constructor(deps: RuntimeDeps) {
    this.#pool = deps.pool;
    this.#registry = deps.registry;
    this.#events = deps.events;
    this.#dispatcher = deps.dispatcher;
    this.#strictContracts = deps.strictContracts ?? false;
    this.#authorizer = deps.authorizer ?? allowAllAuthorizer();
  }

  // -------------------------------------------------------------------------

  async install(doc: WorkflowDoc): Promise<void> {
    // Validate all referenced capabilities exist in the registry. This is
    // the load-bearing install-time check: the workflow doc is the contract,
    // and the registry is the truth.
    const invokeNodes = doc.nodes.filter(
      (n): n is Extract<WorkflowNode, { kind: "invoke" }> =>
        n.kind === "invoke",
    );
    for (const n of invokeNodes) {
      const cap = await this.#registry.get(doc.tenantId, n.capability);
      if (!cap) {
        throw new WorkflowValidationError(
          `workflow "${doc.name}" v${doc.version} references unknown capability "${n.capability}"`,
        );
      }
    }

    // Validate node IDs are unique.
    const seen = new Set<string>();
    for (const n of doc.nodes) {
      if (seen.has(n.nodeId)) {
        throw new WorkflowValidationError(
          `duplicate nodeId in workflow "${doc.name}": ${n.nodeId}`,
        );
      }
      seen.add(n.nodeId);
    }
    // Validate edges reference declared nodes.
    for (const e of doc.edges) {
      if (!seen.has(e.from) || !seen.has(e.to)) {
        throw new WorkflowValidationError(
          `edge ${e.from}->${e.to} references undeclared node`,
        );
      }
    }

    // G8.1: workflow docs must be acyclic. Day-1 grammar implied this but
    // never enforced it; an installed cycle would manifest at runtime as
    // unbounded recursion through the DFS walker.
    assertWorkflowAcyclic(doc);

    // G6: typed-contract validation. Gather all capabilities the workflow
    // references, normalize their contracts, and verify cross-capability
    // compatibility (subscriber accepts producer's major version) and
    // ownership (no two capabilities own the same (interface, field)).
    const capSet: Capability[] = [];
    for (const n of invokeNodes) {
      const cap = await this.#registry.get(doc.tenantId, n.capability);
      // Already validated existence above; null shouldn't happen here.
      if (cap) capSet.push(cap);
    }
    validateCapabilityContracts(
      {
        capabilities: capSet,
        workflowName: doc.name,
        workflowVersion: doc.version,
      },
      { strict: this.#strictContracts },
    );

    // G8.2: workflow versions are immutable. Re-installing the same
    // (tenant_id, name, version) with a different doc would silently
    // rewrite history for any prior runs that referenced this row
    // (since runs FK on workflow_id, which doesn't change). Reject
    // mutation; require a new version for any change. The only legal
    // "upsert" here is re-enabling a previously-disabled doc with the
    // exact same content.
    const existing = await this.#pool.query<{ doc: WorkflowDoc; enabled: boolean }>(
      `SELECT doc, enabled FROM workflow.workflows
         WHERE tenant_id = $1 AND name = $2 AND version = $3`,
      [doc.tenantId, doc.name, doc.version],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      const prior = existing.rows[0]!;
      if (!docsEqual(prior.doc, doc)) {
        throw new WorkflowValidationError(
          `workflow "${doc.name}" v${doc.version} already installed with a different doc; ` +
            `bump the version field to upgrade. Workflow versions are immutable per ADR-0016.`,
        );
      }
      // Same content; just ensure it's enabled and we're idempotent.
      await this.#pool.query(
        `UPDATE workflow.workflows SET enabled = true
           WHERE tenant_id = $1 AND name = $2 AND version = $3`,
        [doc.tenantId, doc.name, doc.version],
      );
      return;
    }
    await this.#pool.query(
      `INSERT INTO workflow.workflows (id, tenant_id, name, version, doc, enabled)
       VALUES ($1, $2, $3, $4, $5::jsonb, true)
       ON CONFLICT (tenant_id, name, version) DO NOTHING`,
      [doc.id, doc.tenantId, doc.name, doc.version, JSON.stringify(doc)],
    );
  }

  async disable(tenantId: TenantId, id: WorkflowId): Promise<void> {
    await this.#pool.query(
      `UPDATE workflow.workflows SET enabled = false WHERE tenant_id = $1 AND id = $2`,
      [tenantId, id],
    );
  }

  // -------------------------------------------------------------------------

  async onEvent(tenantId: TenantId, eventId: EventId): Promise<void> {
    const event = await this.#events.getById(tenantId, eventId);
    if (!event) return;

    // Find enabled workflows whose triggers match this event type.
    const r = await this.#pool.query<WorkflowRow>(
      `SELECT id, tenant_id, name, version, doc, enabled
         FROM workflow.workflows
        WHERE tenant_id = $1 AND enabled = true`,
      [tenantId],
    );

    for (const row of r.rows) {
      const doc = row.doc;
      const triggers = doc.nodes.filter(
        (n): n is Extract<WorkflowNode, { kind: "trigger" }> =>
          n.kind === "trigger",
      );
      const matched = triggers.find((t) => matchesPattern(t.on, event.type));
      if (!matched) continue;

      await this.#runWorkflow(doc, matched.nodeId, event);
    }
  }

  // -------------------------------------------------------------------------

  async #runWorkflow(
    doc: WorkflowDoc,
    triggerNodeId: string,
    event: PMEvent,
  ): Promise<void> {
    const runId = `wfr_${randomUUID()}`;
    // G8.2: snapshot the workflow's exact version + full doc onto the run
    // row at creation time. Even if the runtime later allowed overwrites
    // (it doesn't, post-G8.2), the run history is self-contained.
    const inserted = await this.#pool.query(
      `INSERT INTO workflow.runs
         (id, tenant_id, workflow_id, triggered_by, status,
          workflow_version, workflow_doc)
       VALUES ($1, $2, $3, $4, 'running', $5, $6::jsonb)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [runId, doc.tenantId, doc.id, event.id, doc.version, JSON.stringify(doc)],
    );
    // If a row already exists for (workflow_id, triggered_by) — i.e. the
    // same event already triggered this workflow once — silently skip. This
    // is the at-least-once delivery safety net.
    if (inserted.rowCount === 0) return;

    // Build adjacency map. Walk depth-first from the trigger.
    const outgoing = new Map<string, { to: string; when?: string }[]>();
    for (const e of doc.edges) {
      const arr = outgoing.get(e.from) ?? [];
      const link: { to: string; when?: string } = { to: e.to };
      if (e.when !== undefined) link.when = e.when;
      arr.push(link);
      outgoing.set(e.from, arr);
    }
    const nodesById = new Map(doc.nodes.map((n) => [n.nodeId, n]));
    const results = new Map<string, Readonly<Record<string, unknown>>>();

    // Trigger node "result" is the event itself, for input resolution.
    results.set(triggerNodeId, { type: event.type, payload: event.payload });

    let runStatus: "completed" | "failed" = "completed";

    const visit = async (nodeId: string): Promise<void> => {
      const next = outgoing.get(nodeId) ?? [];
      for (const link of next) {
        if (
          link.when &&
          !this.#truthy(this.#resolve(link.when, results, event))
        ) {
          await this.#recordStep(runId, link.to, null, "skipped", null);
          continue;
        }
        const node = nodesById.get(link.to);
        if (!node || node.kind !== "invoke") {
          // Trigger nodes shouldn't appear downstream; skip.
          continue;
        }

        const inputs = Object.fromEntries(
          Object.entries(node.inputs).map(([k, expr]) => [
            k,
            this.#resolve(expr, results, event),
          ]),
        );

        await this.#recordStep(runId, node.nodeId, node.capability, "running", null);

        const capability = await this.#registry.get(doc.tenantId, node.capability);
        if (!capability) {
          await this.#recordStep(runId, node.nodeId, node.capability, "failed", {
            error: `capability not found at runtime: ${node.capability}`,
          });
          runStatus = "failed";
          return;
        }

        const decision = await this.#authorizer.authorize({
          tenantId: doc.tenantId,
          workflowId: doc.id,
          workflowName: doc.name,
          workflowVersion: doc.version,
          nodeId: node.nodeId,
          capability: node.capability,
          requiredPermissions: capability.requiredPermissions,
          triggerEvent: event,
        });
        if (!decision.allowed) {
          await this.#recordStep(runId, node.nodeId, node.capability, "failed", {
            error: "permission_denied",
            reason: decision.reason,
            requiredPermissions: capability.requiredPermissions,
          });
          runStatus = "failed";
          return;
        }

        const inv = await this.#dispatcher.invoke({
          tenantId: doc.tenantId,
          capability: node.capability,
          inputs,
          triggerEvent: event,
          workflowId: doc.id,
          nodeId: node.nodeId,
        });
        await this.#recordStep(
          runId,
          node.nodeId,
          node.capability,
          inv.success ? "completed" : "failed",
          inv.result ?? null,
        );

        if (!inv.success) {
          runStatus = "failed";
          return; // stop the run; no retries day-1
        }
        results.set(node.nodeId, inv.result);
        await visit(node.nodeId);
      }
    };

    await visit(triggerNodeId);

    await this.#pool.query(
      `UPDATE workflow.runs
          SET status = $2, completed_at = now()
        WHERE id = $1`,
      [runId, runStatus],
    );
  }

  async #recordStep(
    runId: string,
    nodeId: string,
    capability: string | null,
    status: "running" | "completed" | "failed" | "skipped",
    result: Readonly<Record<string, unknown>> | null,
  ): Promise<void> {
    await this.#pool.query(
      `INSERT INTO workflow.run_steps
         (run_id, node_id, capability, status, result, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now(),
               CASE WHEN $4 IN ('completed','failed','skipped') THEN now() ELSE NULL END)
       ON CONFLICT (run_id, node_id) DO UPDATE
         SET status = EXCLUDED.status,
             result = COALESCE(EXCLUDED.result, workflow.run_steps.result),
             completed_at = CASE WHEN EXCLUDED.status IN ('completed','failed','skipped')
                                 THEN now()
                                 ELSE workflow.run_steps.completed_at END`,
      [runId, nodeId, capability, status, result ? JSON.stringify(result) : null],
    );
  }

  /**
   * Resolve a dotted-path expression against the prior-results map and the
   * trigger event. Day-1 grammar:
   *   $trigger.payload.foo
   *   $nodes.<nodeId>.result.<...>
   *   $nodes.<nodeId>.<...>     (alias for $nodes.<nodeId>.result.<...>)
   * Anything else returns the literal string.
   */
  #resolve(
    expr: string,
    results: Map<string, Readonly<Record<string, unknown>>>,
    event: PMEvent,
  ): unknown {
    if (typeof expr !== "string" || !expr.startsWith("$")) return expr;
    const parts = expr.slice(1).split(".");
    if (parts[0] === "trigger") {
      const root: Record<string, unknown> = {
        type: event.type,
        payload: event.payload,
        entityId: event.entityId,
        emittedBy: event.emittedBy,
      };
      return this.#walk(root, parts.slice(1));
    }
    if (parts[0] === "nodes") {
      const nodeId = parts[1];
      if (!nodeId) return undefined;
      const r = results.get(nodeId);
      if (!r) return undefined;
      let rest = parts.slice(2);
      if (rest[0] === "result") rest = rest.slice(1);
      return this.#walk(r as Record<string, unknown>, rest);
    }
    return expr;
  }

  #walk(obj: unknown, path: string[]): unknown {
    let cur: unknown = obj;
    for (const p of path) {
      if (cur && typeof cur === "object" && p in (cur as object)) {
        cur = (cur as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return cur;
  }

  #truthy(v: unknown): boolean {
    if (v === null || v === undefined) return false;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") return v.length > 0;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === "object") return Object.keys(v as object).length > 0;
    return Boolean(v);
  }
}
