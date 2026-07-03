/**
 * @pm/substrate-mcp — the substrate's MCP tool surface (ROADMAP D2).
 *
 * Five tools, the productized front door: any MCP-capable agent mounts the
 * substrate with a config line and gets resume / observe / propose / admit /
 * checkpoint. The admission doctrine is enforced here, not promised:
 *
 *   - substrate_observe returns a CurrentStateView + ObservationContract —
 *     the basis an action must cite.
 *   - substrate_propose reviews the action WARN-FIRST against a fresh view
 *     (@pm/agent-state-core reviewProposedActionAgainstCurrentState) and
 *     persists a hash-verified StateReviewArtifact as an admitted event.
 *   - substrate_admit re-reviews the SAME action against the CURRENT view in
 *     ENFORCE mode; a stale or conflicted basis auto-derives blocking causes
 *     and the ActionOutcomeEnvelope terminal outcome flips to "blocked".
 *     Only accepted record_checkpoint actions execute (the one in-substrate
 *     executor); everything else is an envelope for an external executor.
 *   - Agents never get a write path that bypasses the gate.
 *
 * Stateless across calls: proposals are carried by their artifact events, so
 * any server instance (or restart) can admit a proposal it never saw.
 */

import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import pg from "pg";

import {
  buildActionOutcomeEnvelope,
  buildObservationContractFromCurrentStateView,
  buildStateReviewArtifact,
  importStateReviewArtifact,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifact,
  stateRef,
  verifyStateReviewArtifactHash,
  type ActionProposalReview,
  type CurrentStateView,
  type ReadSetEntry,
  type StateRef,
} from "@pm/agent-state-core";
import {
  PostgresContinuityLedger,
  buildContinuityContext,
  verifyContinuityCheckpointChain,
  type CheckpointKind,
} from "@pm/continuity";
import { PostgresEventStore } from "@pm/events";
import type { EntityId, TenantId, Timestamp } from "@pm/types";

export const PROPOSAL_EVENT_TYPE = "pm.mcp.proposal";
export const ACTION_EVENT_TYPE = "pm.mcp.action";
export const SUBSTRATE_MCP_SERVER_NAME = "pm-substrate-mcp-server";
export const SUBSTRATE_MCP_TOOL_NAMES = [
  "substrate_resume",
  "substrate_observe",
  "substrate_propose",
  "substrate_admit",
  "substrate_checkpoint",
] as const;

export interface SubstrateMcpDeps {
  readonly pool: pg.Pool;
  readonly tenantId?: TenantId;
  readonly agentId?: string;
  readonly scope?: string;
}

const now = (): Timestamp => new Date().toISOString() as Timestamp;

const refSchema = z
  .object({
    kind: z.enum([
      "event",
      "graph_node",
      "graph_edge",
      "projection",
      "workflow_run",
      "continuity_checkpoint",
      "capability_invocation",
      "state_review_artifact",
      "action_outcome_envelope",
      "source_record",
      "document",
    ]),
    id: z.string().min(1),
    label: z.string().optional(),
  })
  .strict();

const readSetEntrySchema = z
  .object({
    ref: refSchema,
    observedAt: z.string().min(1),
    authority: z.string().min(1),
    validUntil: z.string().optional(),
  })
  .strict();

/** Build the governed current-state view for a dev scope: ledger head + event tail. */
async function buildScopeView(
  pool: pg.Pool,
  ledger: PostgresContinuityLedger,
  tenantId: TenantId,
  scope: string,
  agentId: string,
): Promise<CurrentStateView> {
  const observedAt = now();
  const checkpoints = await ledger.list({
    tenantId,
    agentId,
    scope,
    limit: 200,
  });
  const events = await pool.query<{ id: string; type: string; recorded_at: Date }>(
    `SELECT id, type, recorded_at FROM events.events
      WHERE tenant_id = $1 ORDER BY recorded_at DESC, id DESC LIMIT 25`,
    [tenantId],
  );
  // Git-style HEAD: the basis cites the ledger head by CONTENT HASH. When the
  // head moves, contracts citing the old head fail required_source_refs_present
  // — staleness is structural, not a timestamp heuristic.
  const head = [...checkpoints].sort(
    (a, b) =>
      b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  )[0];
  const sourceRefs: StateRef[] = [
    stateRef(
      "continuity_checkpoint",
      `head:${head?.contentHash ?? "empty"}`,
      "ledger head (content-addressed)",
    ),
    ...checkpoints
      .slice(0, 50)
      .map((c) => stateRef("continuity_checkpoint", c.id, c.title)),
    ...events.rows.map((r) => stateRef("event", r.id, r.type)),
  ];
  return {
    tenantId,
    viewId: `view_${randomUUID()}`,
    subject: stateRef("projection", `dev_scope:${scope}`, "dev scope head"),
    observedAt,
    authorityRule: "continuity-ledger-and-event-log-head",
    sourceRefs,
    missingSources: [],
    conflicts: [],
    allowedActions: [
      {
        actionType: "record_checkpoint",
        label: "Record a continuity checkpoint through the gate",
        requiredRefs: [],
      },
      {
        actionType: "external",
        label: "Externally-executed action (envelope only; executor applies)",
        requiredRefs: [],
      },
    ],
  };
}

const viewToStructured = (view: CurrentStateView) => ({
  viewId: view.viewId,
  tenantId: view.tenantId,
  subject: view.subject,
  observedAt: view.observedAt,
  authorityRule: view.authorityRule,
  sourceRefs: view.sourceRefs.slice(0, 60),
  allowedActions: view.allowedActions.map((a) => a.actionType),
  readSet: view.sourceRefs.slice(0, 60).map(
    (ref): ReadSetEntry => ({
      ref,
      observedAt: view.observedAt,
      authority: view.authorityRule,
    }),
  ),
});

export function buildSubstrateMcpServer(deps: SubstrateMcpDeps): McpServer {
  const tenantId = (deps.tenantId ??
    (process.env["PM_DEV_TENANT_ID"] || "tenant_dev")) as TenantId;
  const agentId = deps.agentId ?? (process.env["PM_DEV_AGENT_ID"] || "joat-dev");
  const defaultScope =
    deps.scope ?? (process.env["PM_DEV_SCOPE"] || "pm-substrate-dev");
  const pool = deps.pool;
  const ledger = new PostgresContinuityLedger(pool);
  const events = new PostgresEventStore(pool);

  const server = new McpServer({
    name: SUBSTRATE_MCP_SERVER_NAME,
    version: "0.1.0",
  });

  server.registerTool(
    "substrate_resume",
    {
      title: "Resume from the substrate",
      description:
        "Session-start briefing from the continuity ledger (never chat history): last handoff, open work, standing decisions, lessons, claims — hash-chain verified. Call this FIRST in every session.",
      inputSchema: {
        scope: z.string().default(defaultScope).describe("Continuity scope"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ scope }) => {
      const ctx = await buildContinuityContext(ledger, {
        tenantId,
        agentId,
        scope,
      });
      const all = await ledger.list({ tenantId, agentId, scope, limit: 500 });
      const chain = verifyContinuityCheckpointChain({
        tenantId,
        agentId,
        checkpoints: all,
      });
      const handoff = all
        .filter((c) => c.kind === "handoff")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const brief = (
        rows: readonly { title: string; summary: string }[],
        n: number,
      ) => rows.slice(0, n).map((c) => ({ title: c.title, summary: c.summary }));
      const output = {
        scope,
        checkpointCount: all.length,
        chainValid: chain.valid,
        lastHandoff: handoff
          ? { title: handoff.title, summary: handoff.summary }
          : null,
        openWork: brief(ctx.openWork, 10),
        decisions: brief(ctx.decisions, 12),
        lessons: brief(ctx.lessons, 8),
        claims: brief(ctx.claims, 8),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "substrate_observe",
    {
      title: "Observe current governed state",
      description:
        "Returns a CurrentStateView plus its ObservationContract — the basis every proposed action must cite. Actions proposed from a superseded basis are warned at propose time and BLOCKED at admit time.",
      inputSchema: {
        scope: z.string().default(defaultScope).describe("Continuity scope"),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ scope }) => {
      const view = await buildScopeView(pool, ledger, tenantId, scope, agentId);
      const contract = buildObservationContractFromCurrentStateView(view);
      const output = { view: viewToStructured(view), contract };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "substrate_propose",
    {
      title: "Propose an action (warn-first review)",
      description:
        "Reviews a proposed action against a FRESH current-state view (warn-first), persists a hash-verified StateReviewArtifact as an admitted proposal event, and returns the review + proposalId. Cite the contract and readSet from substrate_observe as your basis.",
      inputSchema: {
        actionType: z
          .enum(["record_checkpoint", "external"])
          .describe(
            "record_checkpoint executes in-substrate on admit; external returns an envelope for your executor",
          ),
        subject: refSchema.describe("The state the action targets"),
        payload: z
          .record(z.unknown())
          .describe(
            "Action payload. For record_checkpoint: { kind, title, summary, status? }",
          ),
        contract: z
          .record(z.unknown())
          .describe("The ObservationContract from substrate_observe (verbatim)"),
        readSet: z
          .array(readSetEntrySchema)
          .min(1)
          .describe("The readSet from substrate_observe you actually relied on"),
        scope: z.string().default(defaultScope),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ actionType, subject, payload, contract, readSet, scope }) => {
      const view = await buildScopeView(pool, ledger, tenantId, scope, agentId);
      const review = reviewProposedActionAgainstCurrentState(
        {
          tenantId,
          actionType,
          subject: subject as StateRef,
          payload: payload as Readonly<Record<string, unknown>>,
          readSet: readSet as unknown as readonly ReadSetEntry[],
          observationContract: contract as never,
          proposedBy: agentId,
          proposedAt: now(),
        },
        view,
        { observationContract: contract as never, enforcementMode: "advisory" },
      );
      const artifact = buildStateReviewArtifact(review, {
        source: "pm-substrate/substrate-mcp",
      });
      await events.publish({
        tenantId,
        type: PROPOSAL_EVENT_TYPE,
        entityId: subject.id as unknown as EntityId,
        emittedBy: agentId,
        payloadSchema: `${PROPOSAL_EVENT_TYPE}.v1`,
        payload: {
          proposalId: review.reviewId,
          scope,
          artifact: serializeStateReviewArtifact(artifact),
        },
      });
      const output = {
        proposalId: review.reviewId,
        valid: review.valid,
        mode: review.mode,
        execution: review.execution,
        warningCount: review.warnings.length,
        warnings: review.warnings.slice(0, 8),
        artifactHash: artifact.artifactHash,
        next: "Call substrate_admit with this proposalId. Admission re-reviews in ENFORCE mode against the then-current state.",
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "substrate_admit",
    {
      title: "Admit a proposal (enforced gate)",
      description:
        "Re-reviews the proposal's ORIGINAL action and basis against the CURRENT state in enforce mode, then emits a terminal ActionOutcomeEnvelope: accepted (record_checkpoint actions execute) or blocked with derived causes. This is the gate; there is no bypass.",
      inputSchema: {
        proposalId: z.string().min(1).describe("proposalId from substrate_propose"),
        decidedBy: z.string().min(1).default("joat-dev"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ proposalId, decidedBy }) => {
      const row = await pool.query<{ payload: { artifact: string; scope: string } }>(
        `SELECT payload FROM events.events
          WHERE tenant_id = $1 AND type = $2 AND payload->>'proposalId' = $3
          ORDER BY recorded_at DESC LIMIT 1`,
        [tenantId, PROPOSAL_EVENT_TYPE, proposalId],
      );
      if (row.rowCount === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No proposal found for proposalId=${proposalId}. Call substrate_propose first.`,
            },
          ],
          isError: true,
        };
      }
      const imported = importStateReviewArtifact(row.rows[0]!.payload.artifact);
      if (!imported.valid || imported.artifact === undefined) {
        return {
          content: [
            {
              type: "text",
              text: `Proposal artifact failed integrity import: ${JSON.stringify(imported.issues ?? [])}`,
            },
          ],
          isError: true,
        };
      }
      const artifact = imported.artifact;
      const hashCheck = verifyStateReviewArtifactHash(artifact);
      const original: ActionProposalReview = artifact.review;
      const scope = row.rows[0]!.payload.scope;

      // The gate: re-review the original action + basis against the CURRENT view.
      const freshView = await buildScopeView(pool, ledger, tenantId, scope, agentId);
      const reReview = reviewProposedActionAgainstCurrentState(
        original.proposedAction,
        freshView,
        {
          observationContract: original.observationContract,
          enforcementMode: "blocking",
        },
      );
      const envelope = buildActionOutcomeEnvelope({
        tenantId,
        actionId: `act_${proposalId}`,
        subject: original.proposedAction.subject,
        proposalReviewId: proposalId,
        stateReviewArtifactHash: artifact.artifactHash,
        requestedTerminalOutcome: hashCheck.valid ? "accepted" : "blocked",
        ...(hashCheck.valid
          ? {}
          : {
              blockingCauses: [
                {
                  source: "policy" as const,
                  code: "artifact_hash_invalid",
                  message: "Stored proposal artifact failed hash replay.",
                  refs: [stateRef("state_review_artifact", artifact.artifactId)],
                },
              ],
            }),
        proposalReview: reReview,
        decidedAt: now(),
        decidedBy,
        substrateRefs: [
          stateRef("state_review_artifact", artifact.artifactId),
          stateRef("projection", `dev_scope:${scope}`),
        ],
      });

      let executed = false;
      if (
        envelope.terminalOutcome === "accepted" &&
        original.proposedAction.actionType === "record_checkpoint"
      ) {
        const p = original.proposedAction.payload as {
          kind?: string;
          title?: string;
          summary?: string;
          status?: string;
        };
        if (p.kind && p.title && p.summary) {
          await ledger.record({
            tenantId,
            agentId,
            scope,
            kind: p.kind as CheckpointKind,
            title: p.title,
            summary: p.summary,
            ...(p.status ? { status: p.status as "open" | "closed" } : {}),
            decisionRefs: [`action_outcome:${envelope.outcomeHash}`],
          });
          executed = true;
        }
      }

      await events.publish({
        tenantId,
        type: ACTION_EVENT_TYPE,
        entityId: original.proposedAction.subject.id as unknown as EntityId,
        emittedBy: agentId,
        payloadSchema: `${ACTION_EVENT_TYPE}.v1`,
        payload: {
          proposalId,
          envelopeHash: envelope.outcomeHash,
          terminalOutcome: envelope.terminalOutcome,
          blockingCauseCodes: envelope.blockingCauses.map((c) => c.code),
          executed,
        },
      });

      const output = {
        proposalId,
        terminalOutcome: envelope.terminalOutcome,
        envelopeHash: envelope.outcomeHash,
        artifactHashValid: hashCheck.valid,
        reReviewValid: reReview.valid,
        blockingCauses: envelope.blockingCauses.map((c) => ({
          code: c.code,
          message: c.message,
        })),
        executed,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  server.registerTool(
    "substrate_checkpoint",
    {
      title: "Record a continuity checkpoint",
      description:
        "Low-ceremony ledger write for session hygiene: decisions, lessons, work items, handoffs. For governed actions use substrate_propose → substrate_admit instead.",
      inputSchema: {
        kind: z.enum(["work", "decision", "lesson", "research", "handoff", "claim"]),
        title: z.string().min(1).max(200),
        summary: z.string().min(1).max(4000),
        status: z.enum(["open", "closed"]).optional(),
        scope: z.string().default(defaultScope),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async ({ kind, title, summary, status, scope }) => {
      await pool.query(
        `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
         ON CONFLICT DO NOTHING`,
        [tenantId],
      );
      const recorded = await ledger.record({
        tenantId,
        agentId,
        scope,
        kind,
        title,
        summary,
        ...(status ? { status } : {}),
      });
      const output = {
        id: recorded.id,
        kind: recorded.kind,
        title: recorded.title,
        contentHash: recorded.contentHash,
      };
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output,
      };
    },
  );

  return server;
}
