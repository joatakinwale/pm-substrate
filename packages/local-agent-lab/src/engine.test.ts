import { describe, expect, it } from "vitest";
import { verifyActionOutcomeEnvelopeHash } from "@pm/agent-state-core";

import { buildLocalAgentLabActionOutcomeEnvelope } from "./engine.js";
import { SCENARIOS } from "./registry.js";

const FAILURE_CLASSES = [
  "partial_observation",
  "stale_observation",
  "representation_loss",
  "memory_drift",
  "source_authority_conflict",
  "workflow_invalidation",
  "capability_contract_violation",
  "parallel_write_conflict",
  "feedback_disconnection",
  "continuity_break",
] as const;

describe("local-agent-lab action outcome packets", () => {
  it("covers every state-failure class with at least one dynamic scenario", () => {
    const classes = SCENARIOS.map((scenario) => scenario.failureClass);
    // Every canonical failure class has a scenario…
    expect(new Set(classes)).toEqual(new Set(FAILURE_CLASSES));
    // …and no scenario invents a class outside the taxonomy. Multiple
    // scenarios may share a class (e.g. pm-governance-approval-gate is a
    // second, governance-flavored workflow_invalidation probe).
    for (const c of classes) expect(FAILURE_CLASSES).toContain(c);
  });

  it("builds hash-valid accepted packets from admitted dynamic runs", () => {
    const envelope = buildLocalAgentLabActionOutcomeEnvelope({
      spec: {
        scenarioId: "stale-observation",
        failureClass: "stale_observation",
      },
      arm: "no_substrate",
      tenantId: "tnt_lab_test",
      decidedAt: "2026-06-25T18:00:00.000Z",
      observation: {
        key: "AAPL",
        perceivedValue: 100,
        basisPosition: 1,
      },
      action: {
        key: "AAPL",
        actedValue: 100,
        rawText: "ACT AAPL=100",
      },
      outcome: {
        admitted: true,
        admittedEventId: "evt_lab_order_accepted",
      },
      result: "fail",
    });

    expect(envelope.terminalOutcome).toBe("accepted");
    expect(envelope.blockingCauses).toEqual([]);
    expect(envelope.providerCertificateId).toBe(
      "tapc_local_agent_lab_terminal_provider_v1",
    );
    expect(envelope.providerCertificateDigest).toBe(
      "sha256:local_agent_lab_terminal_provider_v1",
    );
    expect(envelope.providerCertificateStatusRef).toMatchObject({
      certificateId: "tapc_local_agent_lab_terminal_provider_v1",
      certificateDigest: "sha256:local_agent_lab_terminal_provider_v1",
      status: "valid",
      statusSequence: 1,
      statusEventHash: "sha256:local_agent_lab_terminal_provider_status_v1",
      statusUpdatedAt: "2026-06-25T00:00:00.000Z",
      checkedAt: "2026-06-25T18:00:00.000Z",
    });
    expect(envelope.statusCheckRefs).toContainEqual({
      kind: "event",
      id: "evt_local_agent_lab_terminal_provider_status_v1",
      label: "Local agent lab terminal provider status",
    });
    expect(
      envelope.substrateRefs.some(
        (ref) =>
          ref.kind === "action_outcome_envelope" &&
          ref.id === "outcome_local_agent_lab_stale-observation_no_substrate",
      ),
    ).toBe(true);
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
  });

  it("builds hash-valid blocked packets from refused substrate runs", () => {
    const envelope = buildLocalAgentLabActionOutcomeEnvelope({
      spec: {
        scenarioId: "stale-observation",
        failureClass: "stale_observation",
      },
      arm: "substrate",
      tenantId: "tnt_lab_test",
      decidedAt: "2026-06-25T18:00:00.000Z",
      observation: {
        key: "AAPL",
        perceivedValue: 100,
        basisPosition: 1,
      },
      action: {
        key: "AAPL",
        actedValue: 100,
        rawText: "ACT AAPL=100",
      },
      outcome: {
        admitted: false,
        refusedReason: "stale_basis position=1 < head=2",
      },
      result: "blocked",
    });

    expect(envelope.terminalOutcome).toBe("blocked");
    expect(envelope.providerCertificateId).toBeUndefined();
    expect(envelope.providerCertificateDigest).toBeUndefined();
    expect(envelope.providerCertificateStatusRef).toBeUndefined();
    expect(envelope.statusCheckRefs).toEqual([]);
    expect(envelope.blockingCauses).toHaveLength(1);
    expect(envelope.blockingCauses[0]).toMatchObject({
      source: "policy",
      code: "stale_basis position=1 < head=2",
    });
    expect(
      envelope.substrateRefs.some(
        (ref) =>
          ref.kind === "action_outcome_envelope" &&
          ref.id === "outcome_local_agent_lab_stale-observation_substrate",
      ),
    ).toBe(true);
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
  });
});
