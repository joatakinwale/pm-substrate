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
import { assertWorkflowSound } from "./soundness.js";
import { validateCapabilityContracts } from "./contract-validation.js";
import { allowAllAuthorizer, type PermissionAuthorizer } from "./permissions.js";
import {
  acceptAllInputValidator,
  type InputValidator,
} from "./input-validation.js";
import {
  validateInvocationEvidenceBinding,
  type EvidenceBindingMode,
  type EvidenceBindingProvider,
  type EvidenceBindingVerifier,
  type InvocationEvidenceBinding,
} from "./evidence-binding.js";
import type {
  InvocationDispatcher,
  InvocationResult,
  RetryPolicy,
  WorkflowDoc,
  WorkflowNode,
  WorkflowRuntime,
} from "./interfaces.js";

/** G8.3: backoff delay for attempt N (1-based). Caps at 5 minutes. */
function backoffDelay(policy: RetryPolicy, attempt: number): number {
  const base = policy.backoffMs;
  if ((policy.mode ?? "fixed") === "fixed") return base;
  // Exponential: base * 2^(attempt-1), capped.
  const cap = 5 * 60 * 1000;
  return Math.min(cap, base * Math.pow(2, Math.max(0, attempt - 1)));
}
function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((res) => setTimeout(res, ms));
}

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

function capabilityHasWriteSurface(capability: Capability): boolean {
  return (
    capability.writesInterfaces.length > 0 ||
    capability.writesEdges.length > 0 ||
    capability.emits.length > 0
  );
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
  /**
   * G12 / ADR-0026: validates resolved inputs against the capability's
   * declared `inputSchema` before dispatch. If omitted, uses an explicit
   * accept-all validator (legacy behavior). Capabilities without an
   * `inputSchema` are unaffected regardless of which validator is wired.
   */
  readonly inputValidator?: InputValidator;
  /**
   * Research-to-code L018/v08: optional evidence-action binding before
   * dispatching write-capable capability nodes. Default remains off so
   * existing workflows keep migration compatibility.
   */
  readonly evidenceBindingMode?: EvidenceBindingMode;
  readonly evidenceBindingProvider?: EvidenceBindingProvider;
  readonly evidenceBindingVerifier?: EvidenceBindingVerifier;
}

export class PostgresWorkflowRuntime implements WorkflowRuntime {
  readonly #pool: pg.Pool;
  readonly #registry: Registry;
  readonly #events: EventReader;
  readonly #dispatcher: InvocationDispatcher;
  readonly #strictContracts: boolean;
  readonly #authorizer: PermissionAuthorizer;
  readonly #inputValidator: InputValidator;
  readonly #evidenceBindingMode: EvidenceBindingMode;
  readonly #evidenceBindingProvider: EvidenceBindingProvider | undefined;
  readonly #evidenceBindingVerifier: EvidenceBindingVerifier | undefined;

  constructor(deps: RuntimeDeps) {
    this.#pool = deps.pool;
    this.#registry = deps.registry;
    this.#events = deps.events;
    this.#dispatcher = deps.dispatcher;
    this.#strictContracts = deps.strictContracts ?? false;
    this.#authorizer = deps.authorizer ?? allowAllAuthorizer();
    this.#inputValidator = deps.inputValidator ?? acceptAllInputValidator();
    this.#evidenceBindingMode = deps.evidenceBindingMode ?? "off";
    this.#evidenceBindingProvider = deps.evidenceBindingProvider;
    this.#evidenceBindingVerifier = deps.evidenceBindingVerifier;
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

    // ADR-0029: enforce the completion invariant at install time. This is the
    // substrate-native form of the workflow-net/cell-checkpoint bridge: every
    // installed workflow must be reachable from a trigger and able to complete.
    assertWorkflowSound(doc);

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
          // G8.3: non-retryable; goes straight to dead-letter.
          const errPayload = { error: `capability not found at runtime: ${node.capability}` };
          await this.#recordStep(runId, node.nodeId, node.capability, "failed", errPayload, 1);
          await this.#writeDeadLetter({
            tenantId: doc.tenantId, runId, workflowId: doc.id, workflowVersion: doc.version,
            nodeId: node.nodeId, capability: node.capability, triggeredBy: event.id,
            inputs, attempts: 1, error: errPayload, reason: "capability_not_found",
          });
          runStatus = "failed";
          return;
        }

        // G12 / ADR-0026: input validation gate. Runs BEFORE permission
        // check so we don't waste the authorizer on garbage. Non-retryable.
        const inputDecision = await this.#inputValidator.validate({
          capability: node.capability,
          inputs,
          ...(capability.inputSchema ? { inputSchema: capability.inputSchema } : {}),
          tenantId: doc.tenantId,
          workflowId: doc.id,
          nodeId: node.nodeId,
        });
        if (!inputDecision.valid) {
          const errPayload: Record<string, unknown> = {
            error: "input_invalid",
            reason: inputDecision.reason,
          };
          if (inputDecision.issues && inputDecision.issues.length > 0) {
            errPayload["issues"] = inputDecision.issues;
          }
          await this.#recordStep(runId, node.nodeId, node.capability, "failed", errPayload, 1);
          await this.#writeDeadLetter({
            tenantId: doc.tenantId, runId, workflowId: doc.id, workflowVersion: doc.version,
            nodeId: node.nodeId, capability: node.capability, triggeredBy: event.id,
            inputs, attempts: 1, error: errPayload, reason: "input_invalid",
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
          // G8.3: non-retryable; goes straight to dead-letter.
          const errPayload = {
            error: "permission_denied",
            reason: decision.reason,
            requiredPermissions: capability.requiredPermissions,
          };
          await this.#recordStep(runId, node.nodeId, node.capability, "failed", errPayload, 1);
          await this.#writeDeadLetter({
            tenantId: doc.tenantId, runId, workflowId: doc.id, workflowVersion: doc.version,
            nodeId: node.nodeId, capability: node.capability, triggeredBy: event.id,
            inputs, attempts: 1, error: errPayload, reason: "permission_denied",
          });
          runStatus = "failed";
          return;
        }

        const capabilityWrites = capabilityHasWriteSurface(capability);
        const evidenceBindingRequired =
          this.#evidenceBindingMode === "require_for_writes" && capabilityWrites;
        let evidenceBinding: InvocationEvidenceBinding | undefined;
        if (evidenceBindingRequired) {
          const bindingRequest = {
            tenantId: doc.tenantId,
            workflowId: doc.id,
            workflowName: doc.name,
            workflowVersion: doc.version,
            nodeId: node.nodeId,
            capability: node.capability,
            inputs,
            capabilityWrites,
            triggerEventId: event.id,
          };
          const providedBinding = await this.#evidenceBindingProvider?.bind(bindingRequest);
          const evidenceDecision = validateInvocationEvidenceBinding({
            capabilityWrites,
            evidenceBindingRequired,
            evidenceBinding: providedBinding ?? null,
          });
          if (!evidenceDecision.valid) {
            const errPayload = {
              error: evidenceDecision.reason,
              issues: evidenceDecision.issues,
            };
            await this.#recordStep(runId, node.nodeId, node.capability, "failed", errPayload, 1);
            await this.#writeDeadLetter({
              tenantId: doc.tenantId, runId, workflowId: doc.id, workflowVersion: doc.version,
              nodeId: node.nodeId, capability: node.capability, triggeredBy: event.id,
              inputs, attempts: 1, error: errPayload, reason: evidenceDecision.reason,
            });
            runStatus = "failed";
            return;
          }
          if (this.#evidenceBindingVerifier && providedBinding) {
            const verificationDecision = await this.#evidenceBindingVerifier.verify({
              request: bindingRequest,
              evidenceBinding: providedBinding,
            });
            if (!verificationDecision.valid) {
              const errPayload = {
                error: verificationDecision.reason,
                issues: verificationDecision.issues,
              };
              await this.#recordStep(runId, node.nodeId, node.capability, "failed", errPayload, 1);
              await this.#writeDeadLetter({
                tenantId: doc.tenantId, runId, workflowId: doc.id, workflowVersion: doc.version,
                nodeId: node.nodeId, capability: node.capability, triggeredBy: event.id,
                inputs, attempts: 1, error: errPayload, reason: verificationDecision.reason,
              });
              runStatus = "failed";
              return;
            }
          }
          evidenceBinding = providedBinding ?? undefined;
        }

        // G8.3: retry loop. Default policy is single attempt (legacy).
        const policy = node.retry;
        const maxAttempts = policy && policy.maxAttempts > 0 ? policy.maxAttempts : 1;
        let inv: InvocationResult | null = null;
        let attempt = 0;
        while (attempt < maxAttempts) {
          attempt++;
          inv = await this.#dispatcher.invoke({
            tenantId: doc.tenantId,
            capability: node.capability,
            inputs,
            triggerEvent: event,
            workflowId: doc.id,
            nodeId: node.nodeId,
            ...(evidenceBinding !== undefined ? { evidenceBinding } : {}),
          });
          if (inv.success) break;
          if (attempt < maxAttempts && policy) {
            const delay = backoffDelay(policy, attempt);
            await sleep(delay);
          }
        }
        // After the loop, inv is non-null because maxAttempts >= 1.
        const finalInv = inv!;
        await this.#recordStep(
          runId,
          node.nodeId,
          node.capability,
          finalInv.success ? "completed" : "failed",
          finalInv.result ?? (finalInv.error ? { error: finalInv.error } : null),
          attempt,
        );

        if (!finalInv.success) {
          // G8.3: dead-letter the step after retry exhaustion.
          await this.#writeDeadLetter({
            tenantId: doc.tenantId, runId, workflowId: doc.id, workflowVersion: doc.version,
            nodeId: node.nodeId, capability: node.capability, triggeredBy: event.id,
            inputs, attempts: attempt,
            error: { error: finalInv.error ?? "dispatcher reported success=false", result: finalInv.result },
            reason: "retry_exhausted",
          });
          runStatus = "failed";
          return;
        }
        results.set(node.nodeId, finalInv.result);
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
    attempts?: number,
  ): Promise<void> {
    // G8.3: `attempts` is 1 for non-invoke steps and for the initial 'running'
    // record; the final completion/failure record carries the actual count.
    const attemptsVal = attempts && attempts >= 1 ? attempts : 1;
    await this.#pool.query(
      `INSERT INTO workflow.run_steps
         (run_id, node_id, capability, status, result, attempts, started_at, completed_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, now(),
               CASE WHEN $4 IN ('completed','failed','skipped') THEN now() ELSE NULL END)
       ON CONFLICT (run_id, node_id) DO UPDATE
         SET status = EXCLUDED.status,
             result = COALESCE(EXCLUDED.result, workflow.run_steps.result),
             attempts = GREATEST(EXCLUDED.attempts, workflow.run_steps.attempts),
             completed_at = CASE WHEN EXCLUDED.status IN ('completed','failed','skipped')
                                 THEN now()
                                 ELSE workflow.run_steps.completed_at END`,
      [runId, nodeId, capability, status, result ? JSON.stringify(result) : null, attemptsVal],
    );
  }

  async #writeDeadLetter(d: {
    tenantId: string;
    runId: string;
    workflowId: string;
    workflowVersion: number;
    nodeId: string;
    capability: string;
    triggeredBy: string;
    inputs: Readonly<Record<string, unknown>>;
    attempts: number;
    error: Readonly<Record<string, unknown>>;
    reason:
      | "retry_exhausted"
      | "permission_denied"
      | "capability_not_found"
      | "input_invalid"
      | "evidence_binding_missing"
      | "evidence_binding_incomplete"
      | "evidence_policy_blocked"
      | "evidence_binding_unverified";
  }): Promise<void> {
    const id = `dl_${randomUUID()}`;
    await this.#pool.query(
      `INSERT INTO workflow.dead_letter
         (id, tenant_id, run_id, workflow_id, workflow_version, node_id,
          capability, triggered_by, inputs, attempts, error, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11::jsonb, $12)`,
      [
        id, d.tenantId, d.runId, d.workflowId, d.workflowVersion, d.nodeId,
        d.capability, d.triggeredBy, JSON.stringify(d.inputs), d.attempts,
        JSON.stringify(d.error), d.reason,
      ],
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
