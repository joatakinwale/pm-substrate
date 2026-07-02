import { describe, expect, it } from "vitest";
import {
  verifyActionOutcomeEnvelopeHash,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state-core";
import { graphWriteAuthorityResolutionFromWorkflowEnvelope } from "@pm/capability-kit";
import type { GraphWriteAuthorityPolicy } from "@pm/graph";

import {
  auditEvalEventsGraphWriteAuthority,
  type EvalGraphWriteAuthorityEnvelope,
  type EvalGraphWriteAuthorityEnvelopeStore,
  type EvalGraphWriteAuthorityResolver,
} from "./authority-recovery.js";
import {
  LOCAL_LAB_SCENARIOS,
  assertCompleteLocalLabPairs,
  runLocalLabPairedEvals,
  runLocalLabPairedScenario,
} from "./local-lab.js";

describe("local-lab paired evals", () => {
  it("emits baseline and substrate arms for a stale-memory scenario", () => {
    const scenario = LOCAL_LAB_SCENARIOS.find(
      (s) => s.scenarioId === "stale-memory-after-source-update",
    );
    expect(scenario).toBeDefined();

    const pair = runLocalLabPairedScenario(scenario!);

    expect(pair.events).toHaveLength(2);
    expect(pair.events.map((e) => e.runArm)).toEqual(["baseline", "substrate"]);
    expect(pair.events.map((e) => e.result)).toEqual(["fail", "pass"]);
    expect(pair.events.every((e) => e.axis === "local_lab")).toBe(true);
    expect(pair.events.every((e) => e.pairedRunGroup === pair.pairedRunGroup)).toBe(true);
    expect(pair.events.every((e) => e.stateBenchCategory === "stateful")).toBe(true);
    expect(pair.events.every((e) => e.memoryBenchmarkBridge === "knowledge_update")).toBe(true);
    expect(pair.events.every((e) => e.mastCategory === "system_design")).toBe(true);
    expect(pair.events.every((e) => e.coordinationClass === "derived_projection")).toBe(true);
    expect(pair.events.every((e) => e.evidenceStage === "scaffolded_scenario")).toBe(true);
    expect(pair.events.every((e) => !e.notes.includes("state_bench_category="))).toBe(true);
    expect(pair.events[0]!.substrateRefs.some((ref) => ref.kind === "action_outcome_envelope")).toBe(false);
    expect(pair.events[1]!.substrateRefs).toContainEqual({
      kind: "action_outcome_envelope",
      id: "outcome_local_lab_stale_memory_rebased",
      label: "Local lab ActionOutcomeEnvelope",
    });
    expect(pair.actionOutcomeEnvelopes).toHaveLength(1);
    expect(verifyActionOutcomeEnvelopeHash(pair.actionOutcomeEnvelopes[0]!).valid).toBe(true);
    expect(pair.actionOutcomeEnvelopes[0]!.terminalOutcome).toBe("accepted");
    expect(pair.actionOutcomeEnvelopes[0]!.providerCertificateId).toBe(
      "tapc_local_lab_terminal_provider_v1",
    );
    expect(pair.actionOutcomeEnvelopes[0]!.providerCertificateStatusRef).toMatchObject({
      certificateId: "tapc_local_lab_terminal_provider_v1",
      certificateDigest: "sha256:local_lab_terminal_provider_v1",
      status: "valid",
      statusSequence: 1,
      statusEventHash: "sha256:local_lab_terminal_provider_status_v1",
      statusUpdatedAt: "2026-06-25T00:00:00.000Z",
      checkedAt: "2026-06-02T18:00:00.000Z",
    });
    expect(
      pair.actionOutcomeEnvelopes[0]!.substrateRefs.some(
        (ref) =>
          ref.kind === "action_outcome_envelope" &&
          ref.id === "outcome_local_lab_stale_memory_rebased",
      ),
    ).toBe(true);
    expect(pair.summary).toMatchObject({
      scenarioId: "stale-memory-after-source-update",
      failureClass: "memory_drift",
      stateBenchCategory: "stateful",
      memoryBenchmarkBridge: "knowledge_update",
      mastCategory: "system_design",
      coordinationClass: "derived_projection",
      baselineResult: "fail",
      substrateResult: "pass",
      improvement: 1,
    });
  });

  it("summarizes deterministic local-lab scaffold without overstating proof maturity", () => {
    const suite = runLocalLabPairedEvals();

    expect(suite.events).toHaveLength(LOCAL_LAB_SCENARIOS.length * 2);
    expect(suite.summaries).toHaveLength(LOCAL_LAB_SCENARIOS.length);
    expect(suite.actionOutcomeEnvelopes).toHaveLength(LOCAL_LAB_SCENARIOS.length);
    expect(
      suite.actionOutcomeEnvelopes.every(
        (envelope) => verifyActionOutcomeEnvelopeHash(envelope).valid,
      ),
    ).toBe(true);
    expect(
      suite.actionOutcomeEnvelopes.map((envelope) => envelope.terminalOutcome),
    ).toEqual(["accepted", "blocked", "blocked"]);
    const eventOutcomeRefIds = suite.events.flatMap((event) =>
      event.substrateRefs
        .filter((ref) => ref.kind === "action_outcome_envelope")
        .map((ref) => ref.id),
    );
    const packetOutcomeRefIds = suite.actionOutcomeEnvelopes.flatMap((envelope) =>
      envelope.substrateRefs
        .filter((ref) => ref.kind === "action_outcome_envelope")
        .map((ref) => ref.id),
    );
    expect(eventOutcomeRefIds).toEqual(packetOutcomeRefIds);
    expect(suite.baselineFailures).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.substrateFailures).toBe(0);
    expect(suite.failureReduction).toBe(0);
    expect(suite.allStageFailureReduction).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.metrics.failureReduction).toBe(0);
    expect(suite.metrics.allStageFailureReduction).toBe(LOCAL_LAB_SCENARIOS.length);
    expect(suite.metrics.authorityGatePassRate).toBe(1);
    expect(suite.metrics.byCoordinationClass["authority_gated_transition"]).toMatchObject({
      pairedGroups: 2,
      failureReduction: 0,
      allStageFailureReduction: 2,
    });
    expect(suite.stateBenchCategories).toEqual([
      "procedural_execution",
      "stateful",
      "user_experience",
    ]);
  });

  it("recovers deterministic local-lab authority from provider-status-bearing packets", async () => {
    const suite = runLocalLabPairedEvals();
    const { store, resolveAcceptedAuthority } = authorityHarness(
      suite.actionOutcomeEnvelopes,
    );

    const recovery = await auditEvalEventsGraphWriteAuthority({
      events: suite.events,
      store,
      resolveAcceptedAuthority,
      policy: strictGraphAuthorityPolicy,
    });

    expect(recovery.summary).toMatchObject({
      totalEvents: LOCAL_LAB_SCENARIOS.length * 2,
      auditedEvents: LOCAL_LAB_SCENARIOS.length,
      validRecoveries: LOCAL_LAB_SCENARIOS.length,
      invalidRecoveries: 0,
      byStatus: {
        accepted_authority_recovered: 1,
        terminal_outcome_refused_authority: 2,
      },
    });
  });

  it("rejects incomplete paired local-lab evidence", () => {
    const suite = runLocalLabPairedEvals();
    const missingSubstrateArm = suite.events.filter((e) => e.runArm !== "substrate");

    expect(() => assertCompleteLocalLabPairs(missingSubstrateArm)).toThrow(
      /missing substrate arm/,
    );
  });
});

const strictGraphAuthorityPolicy = {
  requireAuthorityRef: true,
  requireProviderCertificateStatusRef: true,
  requireSubstrateRecord: true,
} as const satisfies GraphWriteAuthorityPolicy;

type LocalLabAuthorityEnvelope = EvalGraphWriteAuthorityEnvelope &
  Pick<
    ActionOutcomeEnvelope,
    | "providerCertificateId"
    | "providerCertificateDigest"
    | "providerCertificateStatusRef"
  >;

function authorityHarness(packets: readonly ActionOutcomeEnvelope[]): {
  readonly store: EvalGraphWriteAuthorityEnvelopeStore;
  readonly resolveAcceptedAuthority: EvalGraphWriteAuthorityResolver;
} {
  const envelopesByRef = new Map<string, LocalLabAuthorityEnvelope>();
  for (const packet of packets) {
    for (const ref of packet.substrateRefs) {
      if (ref.kind !== "action_outcome_envelope") continue;
      envelopesByRef.set(
        `${packet.tenantId}:${ref.id}`,
        localLabAuthorityEnvelope(packet, ref.id),
      );
    }
  }

  const findEnvelope = (tenantId: string, envelopeId: string) =>
    envelopesByRef.get(`${tenantId}:${envelopeId}`);
  const store: EvalGraphWriteAuthorityEnvelopeStore = {
    getWorkflowActionOutcomeEnvelope: async ({ tenantId, envelopeId }) =>
      findEnvelope(tenantId, envelopeId),
  };
  const resolveAcceptedAuthority: EvalGraphWriteAuthorityResolver = async ({
    tenantId,
    envelopeId,
    expectedActionId,
  }) => {
    const envelope = findEnvelope(String(tenantId), envelopeId);
    if (envelope === undefined) {
      throw new Error(`missing local-lab authority envelope ${envelopeId}`);
    }
    if (
      expectedActionId !== undefined &&
      envelope.actionId !== expectedActionId
    ) {
      throw new Error(
        `local-lab envelope ${envelopeId} action ${envelope.actionId} does not match ${expectedActionId}`,
      );
    }
    return graphWriteAuthorityResolutionFromWorkflowEnvelope(envelope);
  };

  return { store, resolveAcceptedAuthority };
}

function localLabAuthorityEnvelope(
  packet: ActionOutcomeEnvelope,
  envelopeId: string,
): LocalLabAuthorityEnvelope {
  return {
    envelopeId,
    actionId: packet.actionId,
    terminalOutcome: packet.terminalOutcome,
    ...(packet.providerCertificateId !== undefined
      ? { providerCertificateId: packet.providerCertificateId }
      : {}),
    ...(packet.providerCertificateDigest !== undefined
      ? { providerCertificateDigest: packet.providerCertificateDigest }
      : {}),
    ...(packet.providerCertificateStatusRef !== undefined
      ? { providerCertificateStatusRef: packet.providerCertificateStatusRef }
      : {}),
  };
}
