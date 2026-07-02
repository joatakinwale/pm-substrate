import { describe, expect, it } from "vitest";
import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state-core";
import {
  graphWriteAuthorityResolverFromWorkflowEnvelopeStore,
} from "@pm/capability-kit";
import type { GraphWriteAuthorityPolicy } from "@pm/graph";
import type { TenantId, Timestamp } from "@pm/types";

import {
  auditEvalEventsGraphWriteAuthority,
  auditEvalEventGraphWriteAuthority,
} from "./authority-recovery.js";
import type { EvalGraphWriteAuthorityResolver } from "./authority-recovery.js";
import {
  evalEvent,
  evalEvidenceRef,
  type EvalAxis,
  type EvalEvent,
  type EvalOperationalTerminalOutcome,
} from "./schema.js";
import { PostgresEvalEventStore } from "./persistence/postgres.js";

const tenantId = "tnt_authority_recovery" as TenantId;
const observedAt = "2026-06-25T18:00:00.000Z" as Timestamp;
const strictPolicy = {
  requireAuthorityRef: true,
  requireProviderCertificateStatusRef: true,
  requireSubstrateRecord: true,
} as const satisfies GraphWriteAuthorityPolicy;

describe("auditEvalEventGraphWriteAuthority", () => {
  it("composes packet recovery with the capability-kit store resolver under strict policy", async () => {
    const envelope = acceptedEnvelopeWithProviderStatus();
    const store = postgresStoreReturning(envelope);
    const audit = await auditEvalEventGraphWriteAuthority({
      event: authorityEvent({
        axis: "finance",
        envelope,
        runId: "run_axis_a_authority_recovered",
        scenarioId: "arrowhedge-authority-recovered",
      }),
      store,
      resolveAcceptedAuthority: resolverFromStore(store),
      policy: strictPolicy,
    });

    expect(audit).toMatchObject({
      valid: true,
      status: "accepted_authority_recovered",
      axis: "finance",
      envelopeId: "outcome_authority_recovery_accepted",
      actionId: "action_authority_recovery_accepted",
      terminalOutcome: "accepted",
      issueCodes: [],
    });
  });

  it("recovers blocked Axis C packets but refuses to turn them into write authority", async () => {
    const envelope = blockedEnvelope();
    const store = postgresStoreReturning(envelope);
    const audit = await auditEvalEventGraphWriteAuthority({
      event: authorityEvent({
        axis: "local_lab",
        envelope,
        runId: "run_axis_c_blocked_authority",
        scenarioId: "local-lab-blocked-authority",
        operationalTerminalOutcome: "blocked",
      }),
      store,
      resolveAcceptedAuthority: resolverFromStore(store),
      policy: strictPolicy,
    });

    expect(audit).toMatchObject({
      valid: true,
      status: "terminal_outcome_refused_authority",
      axis: "local_lab",
      envelopeId: "outcome_authority_recovery_blocked",
      actionId: "action_authority_recovery_blocked",
      terminalOutcome: "blocked",
      issueCodes: [],
    });
  });

  it("fails strict recovery when an accepted packet lacks provider status metadata", async () => {
    const envelope = acceptedEnvelopeWithoutProviderStatus();
    const store = postgresStoreReturning(envelope);
    const audit = await auditEvalEventGraphWriteAuthority({
      event: authorityEvent({
        axis: "finance",
        envelope,
        runId: "run_axis_a_missing_provider_status",
        scenarioId: "arrowhedge-missing-provider-status",
      }),
      store,
      resolveAcceptedAuthority: resolverFromStore(store),
      policy: strictPolicy,
    });

    expect(audit).toMatchObject({
      valid: false,
      status: "authority_policy_rejected",
      envelopeId: "outcome_authority_recovery_missing_provider",
      terminalOutcome: "accepted",
      issueCodes: ["graph_write_provider_certificate_status_ref_missing"],
    });
  });

  it("audits only events with outcome refs and summarizes batch recoveries", async () => {
    const accepted = acceptedEnvelopeWithProviderStatus();
    const missingProvider = acceptedEnvelopeWithoutProviderStatus();
    const envelopes = new Map(
      [accepted, missingProvider].map((envelope) => [
        envelope.substrateRefs.find((ref) => ref.kind === "action_outcome_envelope")!.id,
        envelope,
      ]),
    );
    const store = new PostgresEvalEventStore({
      query: async (_sql: string, values?: readonly unknown[]) => ({
        rows: [{ envelope: envelopes.get(String(values?.[1])) }],
      }),
    });
    const acceptedEvent = authorityEvent({
      axis: "finance",
      envelope: accepted,
      runId: "run_axis_a_authority_recovered",
      scenarioId: "arrowhedge-authority-recovered",
    });
    const missingProviderEvent = authorityEvent({
      axis: "finance",
      envelope: missingProvider,
      runId: "run_axis_a_missing_provider_status",
      scenarioId: "arrowhedge-missing-provider-status",
    });
    const { operationalTerminalOutcome: _terminal, ...eventWithoutTerminal } =
      acceptedEvent;
    const noOutcomeRefEvent = evalEvent({
      ...eventWithoutTerminal,
      runId: "run_no_outcome_ref",
      substrateRefs: [evalEvidenceRef("event", "evt_no_outcome_ref")],
    });

    const suite = await auditEvalEventsGraphWriteAuthority({
      events: [acceptedEvent, missingProviderEvent, noOutcomeRefEvent],
      store,
      resolveAcceptedAuthority: resolverFromStore(store),
      policy: strictPolicy,
    });

    expect(suite.summary).toMatchObject({
      totalEvents: 3,
      auditedEvents: 2,
      validRecoveries: 1,
      invalidRecoveries: 1,
      byStatus: {
        accepted_authority_recovered: 1,
        authority_policy_rejected: 1,
      },
    });
    expect(suite.recoveries.map((recovery) => recovery.runId)).toEqual([
      "run_axis_a_authority_recovered",
      "run_axis_a_missing_provider_status",
    ]);
  });
});

function postgresStoreReturning(envelope: ActionOutcomeEnvelope): PostgresEvalEventStore {
  return new PostgresEvalEventStore({
    query: async () => ({ rows: [{ envelope }] }),
  });
}

function resolverFromStore(store: PostgresEvalEventStore): EvalGraphWriteAuthorityResolver {
  const resolver = graphWriteAuthorityResolverFromWorkflowEnvelopeStore<{
    readonly envelopeId: string;
    readonly expectedActionId?: string;
  }>({
    store,
    envelopeId: ({ payload }) => payload.envelopeId,
    expectedActionId: ({ payload }) => payload.expectedActionId,
  });

  return async (input) => {
    const resolution = await resolver({
      tenantId: input.tenantId,
      payload:
        input.expectedActionId === undefined
          ? { envelopeId: input.envelopeId }
          : {
              envelopeId: input.envelopeId,
              expectedActionId: input.expectedActionId,
            },
      targetId: "ent_authority_recovery" as never,
      currentIdentity: {},
      currentSchemaVersion: 1,
      client: {} as never,
    });
    if (resolution === null || resolution === undefined) {
      throw new Error("authority resolver returned no resolution");
    }
    if ("authorityRef" in resolution) return resolution;
    return { authorityRef: resolution };
  };
}

function authorityEvent(input: {
  readonly axis: EvalAxis;
  readonly envelope: ActionOutcomeEnvelope;
  readonly runId: string;
  readonly scenarioId: string;
  readonly operationalTerminalOutcome?: EvalOperationalTerminalOutcome;
}): EvalEvent {
  const envelopeRef = input.envelope.substrateRefs.find(
    (ref) => ref.kind === "action_outcome_envelope",
  )!;
  return evalEvent({
    tenantId,
    axis: input.axis,
    runId: input.runId,
    agentId: "authority-recovery-test",
    scenarioId: input.scenarioId,
    failureClass: "parallel_write_conflict",
    observedAt,
    source: "authority-recovery-test",
    evidenceRefs: [evalEvidenceRef("external_fixture", `${input.scenarioId}.json`)],
    substrateRefs: [
      evalEvidenceRef("event", `evt_${input.scenarioId}`),
      evalEvidenceRef("action_outcome_envelope", envelopeRef.id),
    ],
    ...(input.axis === "finance"
      ? {
          runArm: "substrate" as const,
          pairedRunGroup: `pair_${input.scenarioId}`,
        }
      : {}),
    evidenceStage: "blocked_mutation",
    scenarioResult: "pass",
    operationalTerminalOutcome:
      input.operationalTerminalOutcome ?? input.envelope.terminalOutcome,
    result: "pass",
    notes: "strict graph write authority recovery test",
  });
}

function acceptedEnvelopeWithProviderStatus(): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId,
    actionId: "action_authority_recovery_accepted",
    subject: stateRef("projection", "arrowhedge_cop:AAPL"),
    proposalReviewId: "proposal_review_authority_recovery_accepted",
    stateReviewArtifactHash: "a".repeat(64),
    evidenceAdmissionReviewIds: ["ev_authority_recovery:admission_review"],
    providerCertificateId: "cert_authority_recovery",
    providerCertificateDigest: "sha256:authority_recovery",
    providerCertificateStatusRef: {
      certificateId: "cert_authority_recovery",
      certificateDigest: "sha256:authority_recovery",
      status: "valid",
      statusSequence: 2,
      statusEventHash: "sha256:authority_recovery_status_event",
      statusUpdatedAt: "2026-06-25T17:59:00.000Z",
      checkedAt: observedAt,
    },
    requestedTerminalOutcome: "accepted",
    decidedAt: observedAt,
    decidedBy: "authority-recovery-test",
    evidenceRefs: [stateRef("event", "evt_authority_recovery")],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome_authority_recovery_accepted",
      ),
      stateRef("workflow_run", "wf_authority_recovery"),
    ],
  });
}

function acceptedEnvelopeWithoutProviderStatus(): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId,
    actionId: "action_authority_recovery_missing_provider",
    subject: stateRef("projection", "arrowhedge_cop:AAPL"),
    proposalReviewId: "proposal_review_authority_recovery_missing_provider",
    stateReviewArtifactHash: "b".repeat(64),
    evidenceAdmissionReviewIds: ["ev_authority_recovery:admission_review"],
    requestedTerminalOutcome: "accepted",
    decidedAt: observedAt,
    decidedBy: "authority-recovery-test",
    evidenceRefs: [stateRef("event", "evt_authority_recovery_missing_provider")],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome_authority_recovery_missing_provider",
      ),
      stateRef("workflow_run", "wf_authority_recovery"),
    ],
  });
}

function blockedEnvelope(): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId,
    actionId: "action_authority_recovery_blocked",
    subject: stateRef("document", "local-lab-blocked-authority"),
    proposalReviewId: "proposal_review_authority_recovery_blocked",
    stateReviewArtifactHash: "c".repeat(64),
    evidenceAdmissionReviewIds: ["ev_authority_recovery_blocked:admission_review"],
    requestedTerminalOutcome: "blocked",
    decidedAt: observedAt,
    decidedBy: "authority-recovery-test",
    evidenceRefs: [stateRef("event", "evt_authority_recovery_blocked")],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome_authority_recovery_blocked",
      ),
      stateRef("workflow_run", "wf_authority_recovery"),
    ],
    blockingCauses: [
      {
        source: "policy",
        code: "stale_observation",
        message: "Blocked packets cannot authorize graph writes.",
        refs: [stateRef("event", "evt_authority_recovery_blocked")],
      },
    ],
  });
}
