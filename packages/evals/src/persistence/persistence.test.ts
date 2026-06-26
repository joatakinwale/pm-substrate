import { describe, expect, it } from "vitest";
import type { TenantId, Timestamp } from "@pm/types";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state";

import { evalEvidenceRef, type EvalEvent } from "../schema.js";
import { PostgresEvalEventStore } from "./postgres.js";

const event: EvalEvent = {
  tenantId: "tnt_eval" as TenantId,
  axis: "finance",
  runId: "run_arrow_001",
  agentId: "portfolio_manager",
  scenarioId: "stale-price-after-signals",
  failureClass: "stale_observation",
  observedAt: "2026-05-27T15:00:00.000Z" as Timestamp,
  source: "arrowhedge/backtest",
  evidenceRefs: [evalEvidenceRef("external_fixture", "fixtures/stale-price.json")],
  substrateRefs: [evalEvidenceRef("event", "evt_price_refresh")],
  runArm: "substrate",
  pairedRunGroup: "pair_stale_price_seed_001",
  stateBenchCategory: "stateful",
  memoryBenchmarkBridge: "knowledge_update",
  mastCategory: "task_verification",
  coordinationClass: "authority_gated_transition",
  result: "pass",
  notes: "Substrate rejected the stale decision before acceptance.",
};

describe("PostgresEvalEventStore", () => {
  it("validates and inserts eval events into evals.eval_events", async () => {
    const calls: Array<{ sql: string; values: readonly unknown[] | undefined }> = [];
    const db = {
      query: async (sql: string, values?: readonly unknown[]) => {
        calls.push({ sql, values });
        return { rows: [] };
      },
    };

    const store = new PostgresEvalEventStore(db);
    await store.record(event);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("INSERT INTO evals.eval_events");
    expect(calls[0]?.values).toEqual([
      event.tenantId,
      event.axis,
      event.runId,
      event.scenarioId,
      event.agentId,
      event.failureClass,
      event.observedAt,
      event.source,
      event.result,
      event.runArm,
      event.pairedRunGroup,
      event.stateBenchCategory,
      event.memoryBenchmarkBridge,
      event.mastCategory,
      event.coordinationClass,
      event,
    ]);
  });

  it("rejects invalid events before touching the database", async () => {
    const db = {
      query: async () => {
        throw new Error("query should not run");
      },
    };
    const store = new PostgresEvalEventStore(db);

    await expect(
      store.record({
        ...event,
        runArm: undefined,
        pairedRunGroup: undefined,
      }),
    ).rejects.toThrow("invalid eval event");
  });

  it("records hash-valid action outcome envelope packets for replay recovery", async () => {
    const envelope = actionOutcomeEnvelope();
    const calls: Array<{ sql: string; values: readonly unknown[] | undefined }> = [];
    const db = {
      query: async (sql: string, values?: readonly unknown[]) => {
        calls.push({ sql, values });
        return { rows: [{ envelope_ref_id: values?.[1] }] };
      },
    };

    const store = new PostgresEvalEventStore(db);
    await store.recordActionOutcomeEnvelope(envelope);

    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain(
      "INSERT INTO evals.action_outcome_envelope_packets",
    );
    expect(calls[0]?.sql).toContain(
      "WHERE evals.action_outcome_envelope_packets.outcome_hash = EXCLUDED.outcome_hash",
    );
    expect(calls[0]?.values).toEqual([
      envelope.tenantId,
      "outcome_eval_packet_blocked_001",
      envelope.actionId,
      envelope.terminalOutcome,
      envelope.outcomeHash,
      envelope,
    ]);
  });

  it("rejects hash-invalid action outcome envelope packets before touching the database", async () => {
    const envelope = {
      ...actionOutcomeEnvelope(),
      outcomeHash: "not-the-real-hash",
    } satisfies ActionOutcomeEnvelope;
    const db = {
      query: async () => {
        throw new Error("query should not run");
      },
    };

    const store = new PostgresEvalEventStore(db);

    await expect(store.recordActionOutcomeEnvelope(envelope)).rejects.toThrow(
      "invalid ActionOutcomeEnvelope hash",
    );
  });

  it("rejects conflicting packet writes for the same outcome-envelope ref", async () => {
    const db = {
      query: async () => ({ rows: [] }),
    };
    const store = new PostgresEvalEventStore(db);

    await expect(
      store.recordActionOutcomeEnvelope(actionOutcomeEnvelope()),
    ).rejects.toThrow("already exists with a different outcome hash");
  });

  it("recovers stored action outcome envelopes by eval substrate ref", async () => {
    const envelope = actionOutcomeEnvelope();
    const db = {
      query: async () => ({ rows: [{ envelope }] }),
    };

    const store = new PostgresEvalEventStore(db);
    const recovered = await store.getActionOutcomeEnvelopeByRef(event.tenantId, {
      kind: "action_outcome_envelope",
      id: "outcome_eval_packet_blocked_001",
    });
    const recoveries = await store.resolveActionOutcomeRefs({
      ...event,
      substrateRefs: [
        ...event.substrateRefs,
        evalEvidenceRef(
          "action_outcome_envelope",
          "outcome_eval_packet_blocked_001",
        ),
      ],
    });

    expect(recovered).toEqual(envelope);
    expect(recoveries).toEqual([
      {
        ref: {
          kind: "action_outcome_envelope",
          id: "outcome_eval_packet_blocked_001",
        },
        resolved: true,
        envelope,
        terminalOutcome: "blocked",
        outcomeHash: envelope.outcomeHash,
      },
    ]);
  });

  it("reports missing action outcome packets without treating them as recovered", async () => {
    const db = {
      query: async () => ({ rows: [] }),
    };
    const store = new PostgresEvalEventStore(db);

    const recoveries = await store.resolveActionOutcomeRefs({
      ...event,
      substrateRefs: [
        evalEvidenceRef("action_outcome_envelope", "outcome_missing_packet"),
      ],
    });

    expect(recoveries).toEqual([
      {
        ref: {
          kind: "action_outcome_envelope",
          id: "outcome_missing_packet",
        },
        resolved: false,
        reason: "missing_packet",
      },
    ]);
  });

  it("recovers graph write-authority envelope metadata from stored packets", async () => {
    const envelope = acceptedActionOutcomeEnvelopeWithProviderStatus();
    const db = {
      query: async () => ({ rows: [{ envelope }] }),
    };
    const store = new PostgresEvalEventStore(db);

    const recovered = await store.getWorkflowActionOutcomeEnvelope({
      tenantId: event.tenantId,
      envelopeId: "outcome_eval_packet_accepted_001",
    });

    expect(recovered).toEqual({
      envelopeId: "outcome_eval_packet_accepted_001",
      actionId: "action_eval_packet_accepted_001",
      terminalOutcome: "accepted",
      providerCertificateId: "cert_eval_terminal_provider",
      providerCertificateDigest: "sha256:eval_terminal_provider",
      providerCertificateStatusRef: {
        certificateId: "cert_eval_terminal_provider",
        certificateDigest: "sha256:eval_terminal_provider",
        status: "valid",
        statusSequence: 3,
        statusEventHash: "sha256:eval_status_event",
        statusUpdatedAt: "2026-05-27T14:59:00.000Z",
        checkedAt: "2026-05-27T15:00:00.000Z",
      },
    });
  });
});

function actionOutcomeEnvelope(): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId: event.tenantId,
    actionId: "action_eval_packet_blocked_001",
    subject: stateRef("projection", "arrowhedge_cop:AAPL"),
    proposalReviewId: "proposal_review_eval_packet_blocked_001",
    stateReviewArtifactHash: "a".repeat(64),
    evidenceAdmissionReviewIds: ["ev_eval_packet:admission_review"],
    requestedTerminalOutcome: "blocked",
    decidedAt: event.observedAt,
    decidedBy: "test:evaluations",
    evidenceRefs: [stateRef("event", "evt_price_refresh")],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome_eval_packet_blocked_001",
        "Eval test outcome packet",
      ),
      stateRef("workflow_run", "wf_eval_packet"),
    ],
    blockingCauses: [
      {
        source: "policy",
        code: "stale_observation",
        message: "Stale observation cannot support accepted write.",
        refs: [stateRef("event", "evt_price_refresh")],
      },
    ],
  });
}

function acceptedActionOutcomeEnvelopeWithProviderStatus(): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId: event.tenantId,
    actionId: "action_eval_packet_accepted_001",
    subject: stateRef("projection", "arrowhedge_cop:AAPL"),
    proposalReviewId: "proposal_review_eval_packet_accepted_001",
    stateReviewArtifactHash: "b".repeat(64),
    evidenceAdmissionReviewIds: ["ev_eval_packet:admission_review"],
    providerCertificateId: "cert_eval_terminal_provider",
    providerCertificateDigest: "sha256:eval_terminal_provider",
    providerCertificateStatusRef: {
      certificateId: "cert_eval_terminal_provider",
      certificateDigest: "sha256:eval_terminal_provider",
      status: "valid",
      statusSequence: 3,
      statusEventHash: "sha256:eval_status_event",
      statusUpdatedAt: "2026-05-27T14:59:00.000Z",
      checkedAt: "2026-05-27T15:00:00.000Z",
    },
    requestedTerminalOutcome: "accepted",
    decidedAt: event.observedAt,
    decidedBy: "test:evaluations",
    evidenceRefs: [stateRef("event", "evt_price_refresh")],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome_eval_packet_accepted_001",
        "Eval test accepted outcome packet",
      ),
      stateRef("workflow_run", "wf_eval_packet"),
    ],
  });
}
