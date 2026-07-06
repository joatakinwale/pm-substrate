/**
 * Executor bridge (ROADMAP D5c) — admitted action → the app's EXISTING API.
 *
 * The last leg of zero-rewrite: once the gate admits an action (an
 * ActionOutcomeEnvelope with terminalOutcome "accepted"), this bridge
 * carries it to the app as a plain HTTP call against an endpoint the app
 * already has. The app never learns the substrate exists; the substrate
 * never reaches into the app's internals.
 *
 * The doctrine is enforced here, not promised:
 *
 *   - a non-accepted envelope NEVER fires — the refusal itself is recorded
 *     (`pm.executor.refused`) so the control plane can count real blocks;
 *   - dispatch is deduped by `outcomeHash` — the same admitted outcome
 *     fires at most once per target (`pm.executor.dispatched` is the
 *     receipt; replays and retries after success are structural no-ops);
 *   - endpoint failures are recorded (`pm.executor.failed`) and do NOT
 *     count as dispatched, so a retry after a fixed outage is legal.
 *
 * Single-writer note: dedupe is read-then-fire; run one bridge per target.
 * The request body carries `outcomeHash`, so an app can (and should)
 * dedupe on its side too — that closes the concurrent-executor window.
 */

import type { ActionOutcomeEnvelope } from "@pm/agent-state-core";
import type { EventPublisher, EventReader } from "@pm/events";
import type { EntityId, TenantId } from "@pm/types";

export const EXECUTOR_DISPATCHED_EVENT_TYPE = "pm.executor.dispatched";
export const EXECUTOR_REFUSED_EVENT_TYPE = "pm.executor.refused";
export const EXECUTOR_FAILED_EVENT_TYPE = "pm.executor.failed";

/** Where an admitted action lands: an endpoint the app ALREADY exposes. */
export interface ActionExecutorTarget {
  /** Stable executor name, e.g. "orbit_crm_api". Part of the dedupe key. */
  readonly name: string;
  readonly endpoint: string;
  readonly method?: "POST" | "PUT" | "PATCH";
  /** Auth and friends. Merged over the default content-type header. */
  readonly headers?: Readonly<Record<string, string>>;
}

export interface ExecuteAdmittedActionInput {
  readonly tenantId: TenantId;
  readonly envelope: ActionOutcomeEnvelope;
  readonly target: ActionExecutorTarget;
  readonly executedBy: string;
  /** Chain-of-custody grant; defaults to executedBy. */
  readonly authority?: string;
  /** Action payload forwarded to the app (verbatim, under `body`). */
  readonly body?: Readonly<Record<string, unknown>>;
  /** Injectable for tests; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
}

export type ExecuteAdmittedActionReason =
  | "dispatched"
  | "not_accepted"
  | "already_dispatched"
  | "endpoint_error";

export interface ExecuteAdmittedActionResult {
  readonly executed: boolean;
  readonly reason: ExecuteAdmittedActionReason;
  readonly httpStatus?: number;
}

const dispatchEntityId = (targetName: string, outcomeHash: string): EntityId =>
  `executor:${targetName}:${outcomeHash}` as unknown as EntityId;

/**
 * Carry one admitted envelope to its target. Returns what happened; every
 * branch leaves evidence on the admitted log.
 */
export async function executeAdmittedAction(
  events: EventPublisher & EventReader,
  input: ExecuteAdmittedActionInput,
): Promise<ExecuteAdmittedActionResult> {
  const { envelope, target } = input;
  const authority = input.authority ?? input.executedBy;
  const entityId = dispatchEntityId(target.name, envelope.outcomeHash);
  const base = {
    tenantId: input.tenantId,
    entityId,
    emittedBy: input.executedBy,
    authority,
  } as const;

  if (envelope.terminalOutcome !== "accepted") {
    await events.publish({
      ...base,
      type: EXECUTOR_REFUSED_EVENT_TYPE,
      payloadSchema: `${EXECUTOR_REFUSED_EVENT_TYPE}.v1`,
      payload: {
        outcomeHash: envelope.outcomeHash,
        actionId: envelope.actionId,
        target: target.name,
        terminalOutcome: envelope.terminalOutcome,
        blockingCauseCodes: envelope.blockingCauses.map((c) => c.code),
      },
    });
    return { executed: false, reason: "not_accepted" };
  }

  const prior = await events.read({
    tenantId: input.tenantId,
    typePattern: EXECUTOR_DISPATCHED_EVENT_TYPE,
    entityId,
  });
  if (prior.length > 0) {
    return { executed: false, reason: "already_dispatched" };
  }

  const doFetch = input.fetchImpl ?? fetch;
  let httpStatus: number | undefined;
  let failure: string | undefined;
  try {
    const response = await doFetch(target.endpoint, {
      method: target.method ?? "POST",
      headers: { "content-type": "application/json", ...target.headers },
      body: JSON.stringify({
        tenantId: input.tenantId,
        actionId: envelope.actionId,
        subject: envelope.subject,
        outcomeHash: envelope.outcomeHash,
        decidedBy: envelope.decidedBy,
        decidedAt: envelope.decidedAt,
        body: input.body ?? {},
      }),
    });
    httpStatus = response.status;
    if (!response.ok) failure = `endpoint returned ${response.status}`;
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  if (failure !== undefined) {
    await events.publish({
      ...base,
      type: EXECUTOR_FAILED_EVENT_TYPE,
      payloadSchema: `${EXECUTOR_FAILED_EVENT_TYPE}.v1`,
      payload: {
        outcomeHash: envelope.outcomeHash,
        actionId: envelope.actionId,
        target: target.name,
        endpoint: target.endpoint,
        reason: failure,
        ...(httpStatus !== undefined ? { httpStatus } : {}),
      },
    });
    return {
      executed: false,
      reason: "endpoint_error",
      ...(httpStatus !== undefined ? { httpStatus } : {}),
    };
  }

  await events.publish({
    ...base,
    type: EXECUTOR_DISPATCHED_EVENT_TYPE,
    payloadSchema: `${EXECUTOR_DISPATCHED_EVENT_TYPE}.v1`,
    payload: {
      outcomeHash: envelope.outcomeHash,
      actionId: envelope.actionId,
      target: target.name,
      endpoint: target.endpoint,
      httpStatus,
    },
  });
  return { executed: true, reason: "dispatched", httpStatus: httpStatus! };
}
