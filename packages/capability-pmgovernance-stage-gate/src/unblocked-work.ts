/**
 * Unblocked-work projection + dispatcher (ROADMAP D3, "gap #1").
 *
 * Turns pmgovernance from governance-that-refuses into governance-that-DRIVES:
 * a deterministic projection computes exactly which WorkItems are unblocked
 * right now — todo, every `depends_on` target terminal-complete, every
 * covering `gated_by` Milestone passed — and the dispatcher hands each one to
 * its single accountable AgentRole (RACI "A") as a `pm.work.dispatched` event.
 *
 * Nothing is pushed twice for the same reason: each dispatch carries a
 * content-addressed basisHash over the readiness facts (states, dependencies,
 * gates, accountability) and the dispatcher dedupes on
 * (workItemId, basisHash) against the admitted log. If the world changes, the
 * basis changes, and a fresh dispatch is legal.
 */

import { createHash } from "node:crypto";
import pg from "pg";

import type { EventPublisher } from "@pm/events";
import type { EntityId, TenantId } from "@pm/types";

export const WORK_DISPATCHED_EVENT_TYPE = "pm.work.dispatched";

/** Terminal-complete WorkItem states: a dependency on these is satisfied. */
export const DEPENDENCY_SATISFIED_STATES = ["done", "accepted"] as const;

export interface UnblockedWorkInput {
  readonly workItems: readonly {
    readonly id: string;
    readonly title: string;
    readonly state: string;
    readonly priority?: string;
  }[];
  /** depends_on: fromId (WorkItem) depends on toId (WorkItem). */
  readonly dependencies: readonly { readonly fromId: string; readonly toId: string }[];
  /** gated_by: milestone covers workItemId with the milestone's gateState. */
  readonly gates: readonly {
    readonly milestoneId: string;
    readonly workItemId: string;
    readonly gateState: string;
  }[];
  /** accountable_to: workItemId → RACI "A" role. */
  readonly accountability: readonly {
    readonly workItemId: string;
    readonly roleId: string;
    readonly roleName?: string;
  }[];
}

export interface UnblockedWorkItem {
  readonly workItemId: string;
  readonly title: string;
  readonly priority?: string;
  readonly accountableRoleId?: string;
  readonly accountableRoleName?: string;
  readonly dispatchable: boolean;
  readonly holds: readonly string[];
  /** Content hash of the readiness facts this verdict was computed from. */
  readonly basisHash: string;
}

const sha256 = (s: string): string =>
  createHash("sha256").update(s).digest("hex");

/**
 * Pure projection: which WorkItems are unblocked right now, and why the rest
 * are held. Deterministic over its input; no clock, no I/O.
 */
export function computeUnblockedWork(
  input: UnblockedWorkInput,
): readonly UnblockedWorkItem[] {
  const stateById = new Map(input.workItems.map((w) => [w.id, w.state]));
  const satisfied = new Set<string>(DEPENDENCY_SATISFIED_STATES);
  const out: UnblockedWorkItem[] = [];

  for (const item of input.workItems) {
    if (item.state !== "todo") continue;

    const holds: string[] = [];
    const deps = input.dependencies.filter((d) => d.fromId === item.id);
    for (const d of deps) {
      const depState = stateById.get(d.toId);
      if (depState === undefined) {
        holds.push(`dependency_missing:${d.toId}`);
      } else if (!satisfied.has(depState)) {
        holds.push(`dependency_incomplete:${d.toId}:${depState}`);
      }
    }
    const gates = input.gates.filter((g) => g.workItemId === item.id);
    for (const g of gates) {
      if (g.gateState !== "passed") {
        holds.push(`gate_not_passed:${g.milestoneId}:${g.gateState}`);
      }
    }
    const accountable = input.accountability.find(
      (a) => a.workItemId === item.id,
    );
    if (accountable === undefined) {
      holds.push("no_accountable_role");
    }

    if (holds.length > 0 && holds.some((h) => !h.startsWith("no_accountable"))) {
      continue; // structurally blocked — not surfaced as dispatchable work
    }

    const basisHash = sha256(
      JSON.stringify({
        workItemId: item.id,
        state: item.state,
        deps: deps
          .map((d) => `${d.toId}:${stateById.get(d.toId) ?? "?"}`)
          .sort(),
        gates: gates.map((g) => `${g.milestoneId}:${g.gateState}`).sort(),
        role: accountable?.roleId ?? null,
      }),
    );
    out.push({
      workItemId: item.id,
      title: item.title,
      ...(item.priority !== undefined ? { priority: item.priority } : {}),
      ...(accountable !== undefined
        ? {
            accountableRoleId: accountable.roleId,
            ...(accountable.roleName !== undefined
              ? { accountableRoleName: accountable.roleName }
              : {}),
          }
        : {}),
      dispatchable: accountable !== undefined,
      holds,
      basisHash,
    });
  }
  return out;
}

/** Load the pmgovernance readiness facts for a tenant from the graph. */
export async function loadUnblockedWorkInput(
  pool: pg.Pool,
  tenantId: TenantId,
): Promise<UnblockedWorkInput> {
  const items = await pool.query<{
    id: string;
    identity: { title?: string; state?: string; priority?: string };
  }>(
    `SELECT id, identity FROM graph.nodes
      WHERE tenant_id = $1 AND profile = 'pmgovernance' AND concrete = 'WorkItem'`,
    [tenantId],
  );
  const edges = await pool.query<{ type: string; from_id: string; to_id: string }>(
    `SELECT type, from_id, to_id FROM graph.edges
      WHERE tenant_id = $1 AND deleted_at IS NULL
        AND type = ANY($2)`,
    [
      tenantId,
      [
        "pmgovernance/depends_on",
        "pmgovernance/gated_by",
        "pmgovernance/accountable_to",
      ],
    ],
  );
  const milestones = await pool.query<{
    id: string;
    identity: { gateState?: string };
  }>(
    `SELECT id, identity FROM graph.nodes
      WHERE tenant_id = $1 AND profile = 'pmgovernance' AND concrete = 'Milestone'`,
    [tenantId],
  );
  const roles = await pool.query<{ id: string; identity: { name?: string } }>(
    `SELECT id, identity FROM graph.nodes
      WHERE tenant_id = $1 AND profile = 'pmgovernance' AND concrete = 'AgentRole'`,
    [tenantId],
  );
  const gateStateById = new Map(
    milestones.rows.map((m) => [m.id, m.identity.gateState ?? "pending"]),
  );
  const roleNameById = new Map(roles.rows.map((r) => [r.id, r.identity.name]));

  return {
    workItems: items.rows.map((r) => ({
      id: r.id,
      title: r.identity.title ?? r.id,
      state: r.identity.state ?? "todo",
      ...(r.identity.priority !== undefined
        ? { priority: r.identity.priority }
        : {}),
    })),
    dependencies: edges.rows
      .filter((e) => e.type === "pmgovernance/depends_on")
      .map((e) => ({ fromId: e.from_id, toId: e.to_id })),
    gates: edges.rows
      .filter((e) => e.type === "pmgovernance/gated_by")
      .map((e) => ({
        milestoneId: e.from_id,
        workItemId: e.to_id,
        gateState: gateStateById.get(e.from_id) ?? "pending",
      })),
    accountability: edges.rows
      .filter((e) => e.type === "pmgovernance/accountable_to")
      .map((e) => {
        const roleName = roleNameById.get(e.to_id);
        return {
          workItemId: e.from_id,
          roleId: e.to_id,
          ...(roleName !== undefined ? { roleName } : {}),
        };
      }),
  };
}

export interface DispatchReport {
  readonly unblocked: readonly UnblockedWorkItem[];
  readonly dispatched: readonly { workItemId: string; eventId: string }[];
  readonly deduped: readonly string[];
  readonly held: readonly { workItemId: string; holds: readonly string[] }[];
}

/**
 * The dispatcher: compute unblocked work and publish one pm.work.dispatched
 * event per dispatchable item to its accountable role, deduped on
 * (workItemId, basisHash) against the admitted log.
 */
export async function dispatchUnblockedWork(
  pool: pg.Pool,
  events: EventPublisher,
  tenantId: TenantId,
  options: { readonly emittedBy?: string } = {},
): Promise<DispatchReport> {
  const emittedBy = options.emittedBy ?? "pm.work-dispatcher";
  const input = await loadUnblockedWorkInput(pool, tenantId);
  const unblocked = computeUnblockedWork(input);

  const dispatched: { workItemId: string; eventId: string }[] = [];
  const deduped: string[] = [];
  const held: { workItemId: string; holds: readonly string[] }[] = [];

  for (const item of unblocked) {
    if (!item.dispatchable) {
      held.push({ workItemId: item.workItemId, holds: item.holds });
      continue;
    }
    const existing = await pool.query(
      `SELECT 1 FROM events.events
        WHERE tenant_id = $1 AND type = $2
          AND payload->>'workItemId' = $3 AND payload->>'basisHash' = $4
        LIMIT 1`,
      [tenantId, WORK_DISPATCHED_EVENT_TYPE, item.workItemId, item.basisHash],
    );
    if ((existing.rowCount ?? 0) > 0) {
      deduped.push(item.workItemId);
      continue;
    }
    const ev = await events.publish({
      tenantId,
      type: WORK_DISPATCHED_EVENT_TYPE,
      entityId: item.workItemId as unknown as EntityId,
      emittedBy,
      payloadSchema: `${WORK_DISPATCHED_EVENT_TYPE}.v1`,
      payload: {
        workItemId: item.workItemId,
        title: item.title,
        ...(item.priority !== undefined ? { priority: item.priority } : {}),
        accountableRoleId: item.accountableRoleId,
        ...(item.accountableRoleName !== undefined
          ? { accountableRoleName: item.accountableRoleName }
          : {}),
        basisHash: item.basisHash,
      },
    });
    dispatched.push({ workItemId: item.workItemId, eventId: String(ev.id) });
  }

  return { unblocked, dispatched, deduped, held };
}
