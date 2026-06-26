import { describe, expect, it } from "vitest";
import { tenantId, timestamp } from "@pm/types";

import {
  buildProjectionReplayCertificateStoreRootWitnessAuthorityTransition,
  buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition,
  buildObservationContractFromCurrentStateView,
  computeProjectionReplayCertificateHash,
  buildProjectionReplayCertificate,
  buildProjectionReplayCertificateFromFrontier,
  buildProjectionReplayCertificateRecord,
  buildProjectionReplayCertificateRef,
  buildProjectionReplayCertificateRefFromRecord,
  buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpoint,
  buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecord,
  buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition,
  buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact,
  buildActionOutcomeEnvelope,
  buildActionOutcomeProviderAuthority,
  buildActionOutcomeTerminalIndex,
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  compareObservedReadSetToDeclared,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadHash,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionSignaturePayloadHash,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessObservationSignaturePayloadHash,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadHash,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionWitnessSignaturePayloadHash,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionSignaturePayloadHash,
  computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessObservationSignaturePayloadHash,
  computeStateReviewArtifactHash,
  admitActionOutcomeEnvelope,
  evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningAdmission,
  evaluateStateReviewInvariantPolicy,
  evaluateObservationContract,
  evaluateProjectionReplayCertificate,
  evaluateProjectionReplayCertificateStoreRootWitnessSettlement,
  evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate,
  evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmission,
  evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificate,
  evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadObservation,
  importStateReviewArtifact,
  importStateReviewArtifactsJsonl,
  InMemoryProjectionReplayCertificateStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessAuthorityTransitionStore,
  InMemoryProjectionReplayCertificateStoreRootWitness,
  InMemoryProjectionReplayCertificateStoreRootWitnessLedger,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecordStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecordStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecordStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger,
  InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecordStore,
  LedgerBackedProjectionReplayCertificateStoreRootWitness,
  LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness,
  LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitness,
  projectionReplayCertificateStoreEntryFromRecord,
  projectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadFromRecord,
  projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord,
  projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord,
  projectionReplayCertificateStoreRootFromEntry,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecords,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecords,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecords,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions,
  replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords,
  replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions,
  replayProjectionReplayCertificateStoreRootWitnessRecords,
  replayProjectionReplayCertificateStoreRootWitnessSettlementRecords,
  StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier,
  StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier,
  verifyProjectionReplayCertificateStoreRootWitnessSettlementRef,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifact,
  serializeStateReviewArtifactsJsonl,
  stateRef,
  validateProposedActionReadSet,
  verifyActionOutcomeEnvelopeHash,
  verifyProjectionReplayCertificateHash,
  verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity,
  verifyProjectionReplayCertificateStoreConsistencyProof,
  verifyStateReviewArtifactHash,
  type ActionOutcomeEnvelopeInput,
  type CurrentStateView,
  type ProposedAction,
  type ProjectionReplayCertificateStoreRoot,
  type ProjectionReplayCertificateStoreRootWitnessLedger,
} from "./index.js";

const t = tenantId("tnt_agent_state");
const signalRef = stateRef("event", "evt_signal", "analyst.signal.created");
const riskRef = stateRef("event", "evt_risk", "risk.state.validated");
const decisionRef = stateRef("event", "evt_decision", "portfolio.decision.proposed");

const baseView = (overrides: Partial<CurrentStateView> = {}): CurrentStateView => ({
  tenantId: t,
  viewId: "view_aapl",
  subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
  observedAt: timestamp("2026-06-03T14:00:00.000Z"),
  validUntil: timestamp("2026-06-03T14:10:00.000Z"),
  authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
  projectionVersion: 1,
  workflowPosition: "decision_pending",
  sourceRefs: [signalRef, riskRef, decisionRef],
  missingSources: [],
  conflicts: [],
  allowedActions: [
    {
      actionType: "portfolio.decision.accept",
      label: "Accept portfolio decision",
      requiredRefs: [signalRef, riskRef, decisionRef],
      requiredWorkflowPosition: "decision_pending",
    },
  ],
  ...overrides,
});

const actionFrom = (
  view: CurrentStateView,
  overrides: Partial<ProposedAction> = {},
): ProposedAction => ({
  tenantId: view.tenantId,
  actionType: "portfolio.decision.accept",
  subject: view.subject,
  payload: { decisionId: "dec_aapl_buy_120" },
  readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
  proposedBy: "agent:portfolio-manager",
  proposedAt: timestamp("2026-06-03T14:05:00.000Z"),
  ...overrides,
});

const actionOutcomeEnvelope = (
  overrides: Partial<ActionOutcomeEnvelopeInput> = {},
) =>
  buildActionOutcomeEnvelope({
    tenantId: t,
    actionId: "action:dec_aapl_buy_120:accept",
    subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
    proposalReviewId: "review:dec_aapl_buy_120",
    stateReviewArtifactHash: "a".repeat(64),
    evidenceAdmissionReviewIds: ["ev:price_window:admission_review"],
    requestedTerminalOutcome: "accepted",
    decidedAt: timestamp("2026-06-03T14:06:00.000Z"),
    decidedBy: "agent:portfolio-manager",
    evidenceRefs: [signalRef, riskRef],
    substrateRefs: [
      stateRef(
        "action_outcome_envelope",
        "outcome:dec_aapl_buy_120",
        "AAPL terminal outcome",
      ),
    ],
    ...overrides,
  });

const recordReplayRoot = async (
  store: InMemoryProjectionReplayCertificateStore,
  view: CurrentStateView,
  options: {
    readonly certificateId: string;
    readonly eventId: string;
    readonly sequence: number;
    readonly contentHash: string;
    readonly replayedAt: ReturnType<typeof timestamp>;
    readonly recordedAt: ReturnType<typeof timestamp>;
  },
) => {
  const certificate = buildProjectionReplayCertificateFromFrontier(view, {
    certificateId: options.certificateId,
    replayedAt: options.replayedAt,
    frontier: {
      tenantId: view.tenantId,
      projectionName: "arrowhedge/current-state",
      projectionVersion: view.projectionVersion ?? 0,
      replayedToPosition: options.sequence,
      transitionEvents: [
        {
          eventId: options.eventId,
          sequence: options.sequence,
          contentHash: options.contentHash,
        },
      ],
    },
  });
  const record = await store.recordProjectionReplayCertificate({
    certificate,
    recordedAt: options.recordedAt,
  });
  const entry = projectionReplayCertificateStoreEntryFromRecord(record);
  if (entry === undefined) {
    throw new Error("projection replay certificate store entry missing");
  }
  return {
    certificate,
    record,
    entry,
    root: projectionReplayCertificateStoreRootFromEntry(entry),
  };
};

const buildWitnessAuthorityTransitions = (
  view: CurrentStateView,
  transitions: readonly Omit<
    Parameters<
      typeof buildProjectionReplayCertificateStoreRootWitnessAuthorityTransition
    >[0],
    "tenantId" | "authoritySequence" | "previousAuthorityHash"
  >[],
) => {
  let previousAuthorityHash: string | undefined;
  return transitions.map((transition, index) => {
    const built =
      buildProjectionReplayCertificateStoreRootWitnessAuthorityTransition({
        ...transition,
        tenantId: view.tenantId,
        authoritySequence: index + 1,
        ...(previousAuthorityHash !== undefined
          ? { previousAuthorityHash }
          : {}),
      });
    previousAuthorityHash = built.authorityHash;
    return built;
  });
};

const buildSettlementHeadWitnessAuthorityTransitions = (
  view: CurrentStateView,
  transitions: readonly Omit<
    Parameters<
      typeof buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition
    >[0],
    "tenantId" | "authoritySequence" | "previousAuthorityHash"
  >[],
) => {
  let previousAuthorityHash: string | undefined;
  return transitions.map((transition, index) => {
    const built =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
        {
          ...transition,
          tenantId: view.tenantId,
          authoritySequence: index + 1,
          ...(previousAuthorityHash !== undefined
            ? { previousAuthorityHash }
            : {}),
        },
      );
    previousAuthorityHash = built.authorityHash;
    return built;
  });
};

const testSignatureFor = (input: {
  readonly principalId: string;
  readonly keyId: string;
  readonly payloadHash: string;
}) => ({
  principalId: input.principalId,
  keyId: input.keyId,
  algorithm: "test-signature-v1",
  payloadHash: input.payloadHash,
  signature: `sig:${input.principalId}:${input.keyId}:${input.payloadHash}`,
  signedAt: timestamp("2026-06-03T14:06:00.000Z"),
});

const testSignatureVerifier = (input: {
  readonly principalId: string;
  readonly keyId: string;
  readonly payloadHash: string;
  readonly signature: string;
}) =>
  input.signature ===
  `sig:${input.principalId}:${input.keyId}:${input.payloadHash}`;

const signedSettlementHeadObservation = (
  input: Parameters<
    LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness["observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead"]
  >[0],
  keyId: string,
) => {
  const payloadHash =
    computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessObservationSignaturePayloadHash(
      input,
    );
  return {
    ...input,
    signature: testSignatureFor({
      principalId: input.observerId,
      keyId,
      payloadHash,
    }),
  };
};

const signedSettlementHeadAuthorityTransitionInput = async (
  authorityStore: InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore,
  view: CurrentStateView,
  input: Omit<
    Parameters<
      InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore["appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition"]
    >[0],
    "tenantId" | "signature"
  >,
  signer: { readonly principalId: string; readonly keyId: string },
) => {
  const transitions =
    await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
      {
        tenantId: view.tenantId,
      },
    );
  const latest = transitions[transitions.length - 1];
  const payloadHash =
    computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionSignaturePayloadHash(
      {
        ...input,
        tenantId: view.tenantId,
        authoritySequence: transitions.length + 1,
        ...(latest !== undefined
          ? { previousAuthorityHash: latest.authorityHash }
          : {}),
      },
    );
  return {
    ...input,
    tenantId: view.tenantId,
    signature: testSignatureFor({
      principalId: signer.principalId,
      keyId: signer.keyId,
      payloadHash,
    }),
  };
};

const signedTombstoneHeadObservation = (
  input: Parameters<
    LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitness["observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead"]
  >[0],
  keyId: string,
) => {
  const payloadHash =
    computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessObservationSignaturePayloadHash(
      input,
    );
  return {
    ...input,
    signature: testSignatureFor({
      principalId: input.observerId,
      keyId,
      payloadHash,
    }),
  };
};

const signedTombstoneHeadAuthorityTransitionInput = async (
  authorityStore: InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore,
  view: CurrentStateView,
  input: Omit<
    Parameters<
      InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore["appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition"]
    >[0],
    "tenantId" | "signature"
  >,
  signer: { readonly principalId: string; readonly keyId: string },
) => {
  const transitions =
    await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
      {
        tenantId: view.tenantId,
      },
    );
  const latest = transitions[transitions.length - 1];
  const payloadHash =
    computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionSignaturePayloadHash(
      {
        ...input,
        tenantId: view.tenantId,
        authoritySequence: transitions.length + 1,
        ...(latest !== undefined
          ? { previousAuthorityHash: latest.authorityHash }
          : {}),
      },
    );
  return {
    ...input,
    tenantId: view.tenantId,
    signature: testSignatureFor({
      principalId: signer.principalId,
      keyId: signer.keyId,
      payloadHash,
    }),
  };
};

const buildSingleWitnessAuthorityTopology = (
  view: CurrentStateView,
  root: ProjectionReplayCertificateStoreRoot,
  prefix: string,
  witnessId = "witness-a",
) =>
  replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
    tenantId: view.tenantId,
    rootSequence: root.sequence,
    transitions: buildWitnessAuthorityTransitions(view, [
      {
        transitionId: `${prefix}_quorum`,
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:replay-root-settlement",
        effectiveFromRootSequence: 1,
        requiredWitnesses: 1,
        minimumWitnesses: 1,
      },
      {
        transitionId: `${prefix}_admit_${witnessId}`,
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:replay-root-settlement",
        effectiveFromRootSequence: 1,
        witnessId,
      },
    ]),
  });

const settleRootFromWitnessLedger = async (
  view: CurrentStateView,
  root: ProjectionReplayCertificateStoreRoot,
  ledger: ProjectionReplayCertificateStoreRootWitnessLedger,
  prefix: string,
  witnessId = "witness-a",
) =>
  evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
    tenantId: view.tenantId,
    root,
    authorityTopology: buildSingleWitnessAuthorityTopology(
      view,
      root,
      prefix,
      witnessId,
    ),
    witnessLedgers: [
      {
        witnessId,
        replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
          tenantId: view.tenantId,
          records:
            await ledger.listProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
            }),
        }),
      },
    ],
  });

const buildSettlementHeadFixture = async (
  view: CurrentStateView,
  prefix: string,
) => {
  const store = new InMemoryProjectionReplayCertificateStore();
  const { root } = await recordReplayRoot(store, view, {
    certificateId: `projection_replay_${prefix}`,
    eventId: `evt_${prefix}`,
    sequence: 42,
    contentHash: `sha256:${prefix}`,
    replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
    recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
  });
  const rootLedger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
  await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
    rootLedger,
  ).observeProjectionReplayCertificateStoreRoot({
    tenantId: view.tenantId,
    observerId: "agent:root-witness",
    observedAt: timestamp("2026-06-03T14:05:32.000Z"),
    root,
  });
  const settlement = await settleRootFromWitnessLedger(
    view,
    root,
    rootLedger,
    prefix,
  );
  const settlementStore =
    new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
  const record =
    await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
      settlement,
      recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
    });
  return {
    root,
    settlement,
    record,
    head:
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        record,
      ),
  };
};

describe("@pm/agent-state read-set validation", () => {
  it("builds provider authority metadata with a status ref bound to the certificate", () => {
    expect(
      buildActionOutcomeProviderAuthority({
        certificateId: "cert_local_lab_terminal_provider",
        certificateDigest: "sha256:local_lab_terminal_provider",
        statusEventHash: "sha256:local_lab_terminal_status_event",
        statusUpdatedAt: timestamp("2026-06-25T18:00:00.000Z"),
        checkedAt: timestamp("2026-06-25T18:01:00.000Z"),
      }),
    ).toEqual({
      providerCertificateId: "cert_local_lab_terminal_provider",
      providerCertificateDigest: "sha256:local_lab_terminal_provider",
      providerCertificateStatusRef: {
        certificateId: "cert_local_lab_terminal_provider",
        certificateDigest: "sha256:local_lab_terminal_provider",
        status: "valid",
        statusSequence: 1,
        statusEventHash: "sha256:local_lab_terminal_status_event",
        statusUpdatedAt: "2026-06-25T18:00:00.000Z",
        checkedAt: "2026-06-25T18:01:00.000Z",
      },
    });
  });

  it("builds read-set entries from every current-state source ref", () => {
    expect(buildReadSetFromCurrentStateView(baseView(), "authority:test")).toEqual([
      {
        ref: signalRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
      {
        ref: riskRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
      {
        ref: decisionRef,
        observedAt: "2026-06-03T14:00:00.000Z",
        validUntil: "2026-06-03T14:10:00.000Z",
        authority: "authority:test",
        projectionVersion: 1,
      },
    ]);
  });

  it("accepts a current allowed action with complete refs", () => {
    expect(validateProposedActionReadSet(actionFrom(baseView()), baseView())).toEqual({
      valid: true,
      mode: "warn",
      issues: [],
    });
  });

  it("warns when a proposed action subject differs from the current-state subject", () => {
    const view = baseView();

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          subject: stateRef("projection", "arrowhedge_cop:MSFT", "MSFT COP"),
        }),
        view,
      ).issues,
    ).toMatchObject([
      {
        code: "subject_mismatch",
        path: "/subject",
      },
    ]);
  });

  it("warns without blocking when read-set refs are stale", () => {
    const view = baseView();

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
        }),
        view,
      ),
    ).toMatchObject({
      valid: false,
      mode: "warn",
      issues: [
        { code: "stale_read_ref", path: "/readSet/0/validUntil" },
        { code: "stale_read_ref", path: "/readSet/1/validUntil" },
        { code: "stale_read_ref", path: "/readSet/2/validUntil" },
      ],
    });
  });

  it("warns for missing required refs, authority drift, projection drift, workflow mismatch, and current conflicts", () => {
    const view = baseView({
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "decision risk snapshot no longer matches current risk state",
        },
      ],
    });
    const readSet = buildReadSetFromCurrentStateView(baseView(), "other-authority")
      .filter((entry) => entry.ref.id !== riskRef.id);

    expect(
      validateProposedActionReadSet(
        actionFrom(view, {
          readSet,
        }),
        view,
      ).issues.map((issue) => issue.code),
    ).toEqual([
      "current_view_conflict",
      "missing_read_ref",
      "authority_mismatch",
      "authority_mismatch",
      "projection_version_mismatch",
      "projection_version_mismatch",
      "workflow_position_mismatch",
    ]);
  });

  it("compares declared proposal read sets against observed tool reads without blocking execution", () => {
    const view = baseView();
    const declared = [
      {
        ref: signalRef,
        observedAt: timestamp("2026-06-03T14:00:00.000Z"),
        validUntil: timestamp("2026-06-03T14:10:00.000Z"),
        authority: view.authorityRule,
        projectionVersion: 1,
      },
      {
        ref: riskRef,
        observedAt: timestamp("2026-06-03T14:00:00.000Z"),
        validUntil: timestamp("2026-06-03T14:10:00.000Z"),
        authority: view.authorityRule,
        projectionVersion: 1,
      },
    ];

    const comparison = compareObservedReadSetToDeclared(
      declared,
      [
        {
          ref: signalRef,
          observedAt: timestamp("2026-06-03T13:59:00.000Z"),
          validUntil: timestamp("2026-06-03T14:01:00.000Z"),
          authority: "arrowhedge:paper_quote:latest",
          projectionVersion: 0,
          workflowPosition: "risk_refresh_pending",
          tool: "arrowhedge.quote.read",
          source: "broker_snapshot",
        },
        {
          ref: decisionRef,
          observedAt: timestamp("2026-06-03T14:03:00.000Z"),
          authority: "arrowhedge:paper_quote:latest",
          projectionVersion: 0,
          workflowPosition: "risk_refresh_pending",
          tool: "arrowhedge.decision.read",
        },
      ],
      view,
      timestamp("2026-06-03T14:05:00.000Z"),
    );

    expect(comparison).toMatchObject({
      valid: false,
      mode: "warn",
      issues: [
        { code: "observed_but_undeclared", path: "/observedReadSet/1/ref" },
        { code: "declared_but_unobserved", path: "/declaredReadSet/1/ref" },
        { code: "stale_observed_read", path: "/observedReadSet/0/validUntil" },
        { code: "authority_mismatch", path: "/observedReadSet/0/authority" },
        {
          code: "projection_version_drift",
          path: "/observedReadSet/0/projectionVersion",
        },
        {
          code: "workflow_position_drift",
          path: "/observedReadSet/0/workflowPosition",
        },
      ],
    });
    expect(comparison.observedReadSet.map((entry) => entry.tool)).toEqual([
      "arrowhedge.quote.read",
      "arrowhedge.decision.read",
    ]);
    expect(comparison.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "observed_but_undeclared",
          observedIndex: 1,
        }),
        expect.objectContaining({
          code: "authority_mismatch",
          declaredIndex: 0,
          observedIndex: 0,
        }),
      ]),
    );
    expect(
      comparison.issues.filter((issue) => issue.path.startsWith("/observedReadSet/1/")),
    ).toHaveLength(1);
    expect(comparison.issues.some((issue) => "observedEntry" in issue)).toBe(false);
    expect(comparison.issues.some((issue) => "declaredEntry" in issue)).toBe(false);
  });

  it("builds an observation contract from a current-state view", () => {
    expect(
      buildObservationContractFromCurrentStateView(
        baseView({
          missingSources: ["risk_state_refresh"],
          conflicts: [
            {
              conflictType: "stale_observation",
              refs: [riskRef],
              message: "risk state expired",
            },
          ],
        }),
      ),
    ).toEqual({
      tenantId: t,
      contractId: "view_aapl:observation_contract",
      subject: stateRef("projection", "arrowhedge_cop:AAPL", "AAPL COP"),
      issuedAt: "2026-06-03T14:00:00.000Z",
      observedAt: "2026-06-03T14:00:00.000Z",
      validUntil: "2026-06-03T14:10:00.000Z",
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      projectionVersion: 1,
      workflowPosition: "decision_pending",
      requiredSourceRefs: [signalRef, riskRef, decisionRef],
      declaredMissingSources: ["risk_state_refresh"],
      declaredConflictCount: 1,
    });
  });

  it("evaluates observation contracts into state assertions", () => {
    const contract = buildObservationContractFromCurrentStateView(baseView());
    const changedView = baseView({
      authorityRule: "arrowhedge:paper_quote:latest",
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      sourceRefs: [signalRef, decisionRef],
      missingSources: ["risk_state"],
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "risk snapshot no longer matches",
        },
      ],
    });

    expect(
      evaluateObservationContract(
        contract,
        changedView,
        timestamp("2026-06-03T14:11:00.000Z"),
      ).assertions.map((assertion) => ({
        code: assertion.code,
        passed: assertion.passed,
      })),
    ).toEqual([
      { code: "required_source_refs_present", passed: false },
      { code: "authority_rule_matches", passed: false },
      { code: "freshness_window_current", passed: false },
      { code: "projection_version_matches", passed: false },
      { code: "workflow_position_matches", passed: false },
      { code: "conflicts_declared", passed: false },
      { code: "missing_sources_declared", passed: false },
    ]);
  });

  it("reviews a proposed action as a warn-first pre-execution artifact", () => {
    const view = baseView();

    expect(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    ).toMatchObject({
      tenantId: t,
      reviewId: "view_aapl:portfolio.decision.accept:proposal_review",
      mode: "warn",
      valid: true,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
        warningCount: 0,
      },
      readSetValidation: {
        valid: true,
        issues: [],
      },
      observationEvaluation: {
        valid: true,
        currentStateViewId: "view_aapl",
      },
      warnings: [],
    });
  });

  it("keeps stale proposed actions warn-first while surfacing read-set and observation warnings", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    expect(review).toMatchObject({
      mode: "warn",
      valid: false,
      execution: {
        allowed: true,
        blocking: false,
        enforcementMode: "advisory",
        reason: "advisory_warn_first_v1",
      },
    });
    expect(review.warnings.map((warning) => warning.source)).toEqual([
      "read_set",
      "read_set",
      "read_set",
      "observation_contract",
    ]);
    expect(review.warnings.map((warning) => warning.code)).toEqual([
      "stale_read_ref",
      "stale_read_ref",
      "stale_read_ref",
      "freshness_window_current",
    ]);
  });

  it("can switch to blocking mode without changing the default advisory contract", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        enforcementMode: "blocking",
      },
    );

    expect(review.execution).toMatchObject({
      allowed: false,
      blocking: true,
      enforcementMode: "blocking",
      reason: "blocking_policy_failed",
    });
  });

  it("blocks action review when replay identity is required but absent", () => {
    const view = baseView();

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view),
      view,
      {
        enforcementMode: "blocking",
        requireReplayCertificate: true,
      },
    );

    expect(review.valid).toBe(false);
    expect(review.execution).toMatchObject({
      allowed: false,
      blocking: true,
      reason: "blocking_policy_failed",
    });
    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "projection_replay",
          code: "projection_replay_certificate_missing",
          severity: "fail",
        }),
      ]),
    );
  });

  it("admits action review from a hash-valid replay certificate over transition refs", () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificate(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      replayedBy: "projection:arrowhedge_cop",
      replayedToPosition: 3,
      transitionRefs: [
        {
          ref: signalRef,
          sequence: 1,
          contentHash: "sha256:signal",
          admittedAt: timestamp("2026-06-03T14:00:00.000Z"),
          authority: view.authorityRule,
        },
        {
          ref: riskRef,
          sequence: 2,
          contentHash: "sha256:risk",
          admittedAt: timestamp("2026-06-03T14:01:00.000Z"),
          authority: view.authorityRule,
        },
        {
          ref: decisionRef,
          sequence: 3,
          contentHash: "sha256:decision",
          admittedAt: timestamp("2026-06-03T14:02:00.000Z"),
          authority: view.authorityRule,
        },
      ],
    });
    const replayedView = { ...view, replayCertificate };

    expect(verifyProjectionReplayCertificateHash(replayCertificate).valid).toBe(
      true,
    );
    expect(
      evaluateProjectionReplayCertificate(replayedView, {
        minimumReplayPosition: 3,
        requireTransitionContentHash: true,
      }),
    ).toMatchObject({
      valid: true,
      issues: [],
    });

    expect(
      reviewProposedActionAgainstCurrentState(actionFrom(replayedView), replayedView, {
        enforcementMode: "blocking",
        requireReplayCertificate: true,
        minimumReplayPosition: 3,
        requireReplayTransitionContentHash: true,
      }).execution,
    ).toMatchObject({
      allowed: true,
      blocking: false,
      reason: "blocking_policy_passed",
    });
  });

  it("builds replay certificates from a projection replay frontier", () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 40,
            contentHash: "sha256:event-signal",
            recordedAt: timestamp("2026-06-03T14:00:00.000Z"),
            authority: view.authorityRule,
          },
          {
            eventId: "evt_risk",
            sequence: 41,
            contentHash: "sha256:event-risk",
            recordedAt: timestamp("2026-06-03T14:01:00.000Z"),
            authority: view.authorityRule,
          },
          {
            eventId: "evt_decision",
            sequence: 42,
            contentHash: "sha256:event-decision",
            recordedAt: timestamp("2026-06-03T14:02:00.000Z"),
            authority: view.authorityRule,
          },
        ],
      },
    });
    const replayedView = { ...view, replayCertificate };

    expect(replayCertificate.replayedBy).toBe(
      "projection:arrowhedge/current-state",
    );
    expect(replayCertificate.transitionRefs).toEqual([
      expect.objectContaining({
        ref: stateRef("event", "evt_signal"),
        sequence: 40,
        contentHash: "sha256:event-signal",
      }),
      expect.objectContaining({
        ref: stateRef("event", "evt_risk"),
        sequence: 41,
        contentHash: "sha256:event-risk",
      }),
      expect.objectContaining({
        ref: stateRef("event", "evt_decision"),
        sequence: 42,
        contentHash: "sha256:event-decision",
      }),
    ]);
    expect(
      evaluateProjectionReplayCertificate(replayedView, {
        minimumReplayPosition: 42,
        requireTransitionContentHash: true,
      }).valid,
    ).toBe(true);
    expect(
      reviewProposedActionAgainstCurrentState(actionFrom(replayedView), replayedView, {
        enforcementMode: "blocking",
        requireReplayCertificate: true,
        minimumReplayPosition: 42,
        requireReplayTransitionContentHash: true,
      }).execution.allowed,
    ).toBe(true);
  });

  it("admits replay refs only when they resolve to a durable certificate record", async () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 40,
            contentHash: "sha256:event-signal",
            recordedAt: timestamp("2026-06-03T14:00:00.000Z"),
            authority: view.authorityRule,
          },
          {
            eventId: "evt_risk",
            sequence: 41,
            contentHash: "sha256:event-risk",
            recordedAt: timestamp("2026-06-03T14:01:00.000Z"),
            authority: view.authorityRule,
          },
          {
            eventId: "evt_decision",
            sequence: 42,
            contentHash: "sha256:event-decision",
            recordedAt: timestamp("2026-06-03T14:02:00.000Z"),
            authority: view.authorityRule,
          },
        ],
      },
    });
    const ref = buildProjectionReplayCertificateRef(replayCertificate, {
      checkedAt: timestamp("2026-06-03T14:05:30.000Z"),
    });
    const store = new InMemoryProjectionReplayCertificateStore();

    expect(replayCertificate.projectionName).toBe("arrowhedge/current-state");
    expect(
      await store.verifyProjectionReplayCertificateRef({
        tenantId: view.tenantId,
        ref,
      }),
    ).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_record_missing",
        }),
      ],
    });

    const record = await store.recordProjectionReplayCertificate({
      certificate: replayCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });

    expect(record).toMatchObject({
      certificateId: replayCertificate.certificateId,
      certificateHash: replayCertificate.certificateHash,
      projectionName: "arrowhedge/current-state",
      projectionVersion: 1,
      replayedToPosition: 42,
    });
    expect(
      await store.verifyProjectionReplayCertificateRef({
        tenantId: view.tenantId,
        ref,
      }),
    ).toMatchObject({
      valid: true,
      issues: [],
      record: expect.objectContaining({
        certificateHash: replayCertificate.certificateHash,
      }),
    });

    const envelope = actionOutcomeEnvelope({
      projectionReplayRef: ref,
    });
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
    expect(envelope.projectionReplayRef).toEqual(ref);
  });

  it("rejects replay refs that diverge from the stored full certificate", async () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 40,
            contentHash: "sha256:event-signal",
          },
          {
            eventId: "evt_risk",
            sequence: 41,
            contentHash: "sha256:event-risk",
          },
          {
            eventId: "evt_decision",
            sequence: 42,
            contentHash: "sha256:event-decision",
          },
        ],
      },
    });
    const ref = buildProjectionReplayCertificateRef(replayCertificate, {
      checkedAt: timestamp("2026-06-03T14:05:30.000Z"),
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    await store.recordProjectionReplayCertificate({
      certificate: replayCertificate,
    });

    const verification = await store.verifyProjectionReplayCertificateRef({
      tenantId: view.tenantId,
      ref: {
        ...ref,
        certificateHash: `${ref.certificateHash}:forged`,
        replayedToPosition: ref.replayedToPosition + 1,
      },
    });

    expect(verification.valid).toBe(false);
    expect(verification.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        "/certificateHash",
        "/replayedToPosition",
      ]),
    );
  });

  it("requires replay refs to cite the append-only certificate-store commitment under strict store-root verification", async () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 40,
            contentHash: "sha256:event-signal",
          },
          {
            eventId: "evt_risk",
            sequence: 41,
            contentHash: "sha256:event-risk",
          },
          {
            eventId: "evt_decision",
            sequence: 42,
            contentHash: "sha256:event-decision",
          },
        ],
      },
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    const record = await store.recordProjectionReplayCertificate({
      certificate: replayCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const refWithoutRoot = buildProjectionReplayCertificateRef(replayCertificate, {
      checkedAt: timestamp("2026-06-03T14:05:32.000Z"),
    });
    const committedRef = buildProjectionReplayCertificateRefFromRecord(record, {
      checkedAt: timestamp("2026-06-03T14:05:33.000Z"),
    });

    expect(record.storeSequence).toBe(1);
    expect(record.storeEntryHash).toBe(record.storeRootHash);
    expect(committedRef).toMatchObject({
      certificateStoreSequence: record.storeSequence,
      certificateStoreEntryHash: record.storeEntryHash,
      certificateStoreRootHash: record.storeRootHash,
    });
    expect(
      await store.verifyProjectionReplayCertificateRef({
        tenantId: view.tenantId,
        ref: refWithoutRoot,
        requireStoreCommitment: true,
      }),
    ).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_commitment_missing",
        }),
      ],
    });
    expect(
      await store.verifyProjectionReplayCertificateRef({
        tenantId: view.tenantId,
        ref: committedRef,
        requireStoreCommitment: true,
      }),
    ).toMatchObject({
      valid: true,
      issues: [],
    });
    expect(
      await store.verifyProjectionReplayCertificateRef({
        tenantId: view.tenantId,
        ref: {
          ...committedRef,
          certificateStoreRootHash: `${committedRef.certificateStoreRootHash}:fork`,
        },
        requireStoreCommitment: true,
      }),
    ).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_commitment_mismatch",
          path: "/projectionReplayRef/certificateStoreRootHash",
        }),
      ],
    });
  });

  it("verifies certificate-store consistency proofs and rejects broken hash chains", async () => {
    const view = baseView();
    const firstCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_first",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 40,
            contentHash: "sha256:event-signal",
          },
        ],
      },
    });
    const secondCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_second",
      replayedAt: timestamp("2026-06-03T14:06:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 43,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 40,
            contentHash: "sha256:event-signal",
          },
          {
            eventId: "evt_risk",
            sequence: 43,
            contentHash: "sha256:event-risk",
          },
        ],
      },
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    const firstRecord = await store.recordProjectionReplayCertificate({
      certificate: firstCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const secondRecord = await store.recordProjectionReplayCertificate({
      certificate: secondCertificate,
      recordedAt: timestamp("2026-06-03T14:06:31.000Z"),
    });
    const firstEntry = projectionReplayCertificateStoreEntryFromRecord(firstRecord);
    const secondEntry = projectionReplayCertificateStoreEntryFromRecord(secondRecord);
    expect(firstEntry).toBeDefined();
    expect(secondEntry).toBeDefined();

    const firstRoot = projectionReplayCertificateStoreRootFromEntry(firstEntry!);
    const secondRoot = projectionReplayCertificateStoreRootFromEntry(secondEntry!);

    expect(
      verifyProjectionReplayCertificateStoreConsistencyProof({
        tenantId: view.tenantId,
        toRoot: secondRoot,
        entries: [firstEntry!, secondEntry!],
      }),
    ).toMatchObject({
      valid: true,
      root: secondRoot,
      issues: [],
    });
    expect(
      verifyProjectionReplayCertificateStoreConsistencyProof({
        tenantId: view.tenantId,
        fromRoot: firstRoot,
        toRoot: secondRoot,
        entries: [secondEntry!],
      }),
    ).toMatchObject({
      valid: true,
      root: secondRoot,
      issues: [],
    });
    expect(
      verifyProjectionReplayCertificateStoreConsistencyProof({
        tenantId: view.tenantId,
        fromRoot: firstRoot,
        toRoot: secondRoot,
        entries: [
          {
            ...secondEntry!,
            previousEntryHash: "sha256:forked-root",
          },
        ],
      }),
    ).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_chain_previous_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_chain_entry_hash_mismatch",
        }),
      ],
    });
  });

  it("witnesses replay certificate-store roots and obstructs unproved forks", async () => {
    const view = baseView();
    const firstCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_first",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
        ],
      },
    });
    const secondCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_second",
      replayedAt: timestamp("2026-06-03T14:06:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 43,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
          {
            eventId: "evt_risk",
            sequence: 43,
            contentHash: "sha256:event-risk",
          },
        ],
      },
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    const firstRecord = await store.recordProjectionReplayCertificate({
      certificate: firstCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const secondRecord = await store.recordProjectionReplayCertificate({
      certificate: secondCertificate,
      recordedAt: timestamp("2026-06-03T14:06:31.000Z"),
    });
    const firstEntry = projectionReplayCertificateStoreEntryFromRecord(firstRecord);
    const secondEntry = projectionReplayCertificateStoreEntryFromRecord(secondRecord);
    expect(firstEntry).toBeDefined();
    expect(secondEntry).toBeDefined();

    const firstRoot = projectionReplayCertificateStoreRootFromEntry(firstEntry!);
    const secondRoot = projectionReplayCertificateStoreRootFromEntry(secondEntry!);
    const witness = new InMemoryProjectionReplayCertificateStoreRootWitness();

    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-a",
        observedAt: timestamp("2026-06-03T14:05:32.000Z"),
        root: firstRoot,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_initial",
      acceptedRoots: [firstRoot],
    });

    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-b",
        observedAt: timestamp("2026-06-03T14:05:33.000Z"),
        root: firstRoot,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_duplicate",
      acceptedRoots: [firstRoot],
    });

    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-c",
        observedAt: timestamp("2026-06-03T14:06:32.000Z"),
        root: secondRoot,
      }),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_consistency_proof_missing",
        }),
      ],
      obstruction: expect.objectContaining({
        allowedAction: "request_root_consistency_proof",
      }),
    });

    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-d",
        observedAt: timestamp("2026-06-03T14:06:33.000Z"),
        root: secondRoot,
        consistencyProof: {
          tenantId: view.tenantId,
          fromRoot: firstRoot,
          toRoot: secondRoot,
          entries: [secondEntry!],
        },
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_advance",
      acceptedRoots: [secondRoot],
    });

    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-e",
        observedAt: timestamp("2026-06-03T14:06:34.000Z"),
        root: {
          ...secondRoot,
          rootHash: `${secondRoot.rootHash}:fork`,
        },
      }),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_fork",
        }),
      ],
    });
  });

  it("rejects replay root witness advances with invalid consistency proofs", async () => {
    const view = baseView();
    const firstCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_invalid_first",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
        ],
      },
    });
    const secondCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_invalid_second",
      replayedAt: timestamp("2026-06-03T14:06:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 43,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
          {
            eventId: "evt_risk",
            sequence: 43,
            contentHash: "sha256:event-risk",
          },
        ],
      },
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    const firstRecord = await store.recordProjectionReplayCertificate({
      certificate: firstCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const secondRecord = await store.recordProjectionReplayCertificate({
      certificate: secondCertificate,
      recordedAt: timestamp("2026-06-03T14:06:31.000Z"),
    });
    const firstEntry = projectionReplayCertificateStoreEntryFromRecord(firstRecord);
    const secondEntry = projectionReplayCertificateStoreEntryFromRecord(secondRecord);
    expect(firstEntry).toBeDefined();
    expect(secondEntry).toBeDefined();

    const firstRoot = projectionReplayCertificateStoreRootFromEntry(firstEntry!);
    const secondRoot = projectionReplayCertificateStoreRootFromEntry(secondEntry!);
    const witness = new InMemoryProjectionReplayCertificateStoreRootWitness();
    await witness.observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:resume-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root: firstRoot,
    });

    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-b",
        observedAt: timestamp("2026-06-03T14:06:32.000Z"),
        root: secondRoot,
        consistencyProof: {
          tenantId: view.tenantId,
          fromRoot: firstRoot,
          toRoot: secondRoot,
          entries: [
            {
              ...secondEntry!,
              previousEntryHash: "sha256:forked-root",
            },
          ],
        },
      }),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_consistency_proof_invalid",
        }),
      ],
    });
  });

  it("replays ledger-backed replay root witness observations after restart", async () => {
    const view = baseView();
    const firstCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_ledger_first",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
        ],
      },
    });
    const secondCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_ledger_second",
      replayedAt: timestamp("2026-06-03T14:06:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 43,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
          {
            eventId: "evt_risk",
            sequence: 43,
            contentHash: "sha256:event-risk",
          },
        ],
      },
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    const firstRecord = await store.recordProjectionReplayCertificate({
      certificate: firstCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const secondRecord = await store.recordProjectionReplayCertificate({
      certificate: secondCertificate,
      recordedAt: timestamp("2026-06-03T14:06:31.000Z"),
    });
    const firstEntry = projectionReplayCertificateStoreEntryFromRecord(firstRecord);
    const secondEntry = projectionReplayCertificateStoreEntryFromRecord(secondRecord);
    expect(firstEntry).toBeDefined();
    expect(secondEntry).toBeDefined();

    const firstRoot = projectionReplayCertificateStoreRootFromEntry(firstEntry!);
    const secondRoot = projectionReplayCertificateStoreRootFromEntry(secondEntry!);
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const witness = new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    );
    await expect(
      witness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-a",
        observedAt: timestamp("2026-06-03T14:05:32.000Z"),
        root: firstRoot,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_initial",
    });

    const restartedWitness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitness(ledger);
    await expect(
      restartedWitness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-b",
        observedAt: timestamp("2026-06-03T14:06:32.000Z"),
        root: secondRoot,
      }),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_consistency_proof_missing",
        }),
      ],
    });

    await expect(
      restartedWitness.observeProjectionReplayCertificateStoreRoot({
        tenantId: view.tenantId,
        observerId: "agent:resume-c",
        observedAt: timestamp("2026-06-03T14:06:33.000Z"),
        root: secondRoot,
        consistencyProof: {
          tenantId: view.tenantId,
          fromRoot: firstRoot,
          toRoot: secondRoot,
          entries: [secondEntry!],
        },
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_advance",
    });

    const records =
      await ledger.listProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
      });
    expect(records.map((record) => record.witnessSequence)).toEqual([1, 2, 3]);
    expect(records[1]!.previousObservationHash).toBe(
      records[0]!.observationHash,
    );
    expect(
      replayProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
        records,
      }),
    ).toMatchObject({
      valid: true,
      latestRoot: secondRoot,
      acceptedRoots: [firstRoot, secondRoot],
      issues: [],
    });
  });

  it("rejects tampered replay root witness ledgers during replay", async () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificateFromFrontier(view, {
      certificateId: "projection_replay_witness_ledger_tamper",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      frontier: {
        tenantId: view.tenantId,
        projectionName: "arrowhedge/current-state",
        projectionVersion: view.projectionVersion ?? 0,
        replayedToPosition: 42,
        transitionEvents: [
          {
            eventId: "evt_signal",
            sequence: 42,
            contentHash: "sha256:event-signal",
          },
        ],
      },
    });
    const store = new InMemoryProjectionReplayCertificateStore();
    const record = await store.recordProjectionReplayCertificate({
      certificate: replayCertificate,
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const entry = projectionReplayCertificateStoreEntryFromRecord(record);
    expect(entry).toBeDefined();
    const root = projectionReplayCertificateStoreRootFromEntry(entry!);
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const witness = new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    );
    await witness.observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:resume-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });

    const records =
      await ledger.listProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
      });
    const tamperedFirst = {
      ...records[0]!,
      root: {
        ...records[0]!.root,
        rootHash: `${records[0]!.root.rootHash}:tampered`,
      },
    };

    expect(
      replayProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
        records: [tamperedFirst, ...records.slice(1)],
      }),
    ).toMatchObject({
      valid: false,
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_ledger_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_ledger_decision_mismatch",
        }),
      ],
    });
  });

  it("settles replay roots only after an independent witness quorum", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_root",
      eventId: "evt_settlement_signal",
      sequence: 42,
      contentHash: "sha256:settlement-signal",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    expect(root.sequence).toBe(1);
    const ledgerA = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const ledgerB = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();

    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerA,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerB,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-b",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root,
    });

    const replayA = replayProjectionReplayCertificateStoreRootWitnessRecords({
      tenantId: view.tenantId,
      records: await ledgerA.listProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
      }),
    });
    const replayB = replayProjectionReplayCertificateStoreRootWitnessRecords({
      tenantId: view.tenantId,
      records: await ledgerB.listProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
      }),
    });

    const witnessed =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        witnessLedgers: [{ witnessId: "witness-a", replay: replayA }],
        policy: { requiredWitnesses: 2 },
      });
    expect(witnessed).toMatchObject({
      status: "witnessed",
      acceptedWitnessIds: ["witness-a"],
      obstructingWitnessIds: [],
      invalidWitnessIds: [],
      allowedAction: "collect_more_witnesses",
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_quorum_not_met",
        }),
      ],
    });
    expect(typeof witnessed.settlementHash).toBe("string");

    const settled =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        witnessLedgers: [
          { witnessId: "witness-a", replay: replayA },
          { witnessId: "witness-b", replay: replayB },
        ],
        policy: { requiredWitnesses: 2 },
      });
    expect(settled).toMatchObject({
      status: "settled",
      acceptedWitnessIds: ["witness-a", "witness-b"],
      obstructingWitnessIds: [],
      invalidWitnessIds: [],
      issues: [],
    });
    expect(settled.allowedAction).toBeUndefined();
  });

  it("obstructs replay root settlement when valid witness ledgers conflict", async () => {
    const view = baseView();
    const targetStore = new InMemoryProjectionReplayCertificateStore();
    const forkStore = new InMemoryProjectionReplayCertificateStore();
    const { root: targetRoot } = await recordReplayRoot(targetStore, view, {
      certificateId: "projection_replay_settlement_target",
      eventId: "evt_settlement_target",
      sequence: 42,
      contentHash: "sha256:settlement-target",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const { root: forkRoot } = await recordReplayRoot(forkStore, view, {
      certificateId: "projection_replay_settlement_fork",
      eventId: "evt_settlement_fork",
      sequence: 42,
      contentHash: "sha256:settlement-fork",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    expect(targetRoot.sequence).toBe(forkRoot.sequence);
    const targetLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const forkLedger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();

    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      targetLedger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-target",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root: targetRoot,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      forkLedger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-fork",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root: forkRoot,
    });

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root: targetRoot,
        witnessLedgers: [
          {
            witnessId: "witness-target",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await targetLedger.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
          {
            witnessId: "witness-fork",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await forkLedger.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
        ],
        policy: { requiredWitnesses: 2 },
      });

    expect(settlement).toMatchObject({
      status: "obstructed",
      acceptedWitnessIds: ["witness-target"],
      obstructingWitnessIds: ["witness-fork"],
      invalidWitnessIds: [],
      allowedAction: "resolve_root_conflict",
      issues: [
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_conflicting_root",
        }),
      ],
    });
  });

  it("does not count tampered witness ledgers toward replay root settlement", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_tamper",
      eventId: "evt_settlement_tamper",
      sequence: 42,
      contentHash: "sha256:settlement-tamper",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledgerA = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const ledgerB = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();

    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerA,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerB,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-b",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root,
    });

    const recordsB =
      await ledgerB.listProjectionReplayCertificateStoreRootWitnessRecords({
        tenantId: view.tenantId,
      });
    const tamperedB = {
      ...recordsB[0]!,
      root: {
        ...recordsB[0]!.root,
        rootHash: `${recordsB[0]!.root.rootHash}:tampered`,
      },
    };
    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerA.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
          {
            witnessId: "witness-b",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records: [tamperedB],
            }),
          },
        ],
        policy: { requiredWitnesses: 2 },
      });

    expect(settlement).toMatchObject({
      status: "witnessed",
      acceptedWitnessIds: ["witness-a"],
      obstructingWitnessIds: [],
      invalidWitnessIds: ["witness-b"],
      allowedAction: "collect_more_witnesses",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_witness_replay_invalid",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_quorum_not_met",
        }),
      ]),
    });
  });

  it("settles replay roots only through replayed witness-principal authority topology", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_authority_topology_root",
      eventId: "evt_authority_topology",
      sequence: 42,
      contentHash: "sha256:authority-topology",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledgerA = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const ledgerB = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();

    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerA,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerB,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-b",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root,
    });

    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: buildWitnessAuthorityTransitions(view, [
          {
            transitionId: "witness_authority_set_quorum",
            transitionKind: "set_quorum",
            recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            requiredWitnesses: 2,
            minimumWitnesses: 1,
          },
          {
            transitionId: "witness_authority_admit_a",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-a",
          },
          {
            transitionId: "witness_authority_admit_b",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-b",
          },
        ]),
      });
    expect(authorityTopology).toMatchObject({
      valid: true,
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      eligibleWitnessIds: ["witness-a", "witness-b"],
      issues: [],
    });

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerA.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
          {
            witnessId: "witness-b",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerB.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
        ],
      });

    expect(settlement).toMatchObject({
      status: "settled",
      acceptedWitnessIds: ["witness-a", "witness-b"],
      eligibleWitnessIds: ["witness-a", "witness-b"],
      invalidWitnessIds: [],
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      issues: [],
    });
    expect(settlement.authorityTopologyHash).toBe(
      authorityTopology.latestAuthorityHash,
    );
  });

  it("does not count non-member witness ledgers toward topology-bound settlement", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_authority_non_member",
      eventId: "evt_authority_non_member",
      sequence: 42,
      contentHash: "sha256:authority-non-member",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledgerA = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const ledgerIntruder =
      new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();

    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerA,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerIntruder,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-intruder",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root,
    });

    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: buildWitnessAuthorityTransitions(view, [
          {
            transitionId: "witness_authority_non_member_quorum",
            transitionKind: "set_quorum",
            recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            requiredWitnesses: 2,
            minimumWitnesses: 1,
          },
          {
            transitionId: "witness_authority_non_member_admit_a",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-a",
          },
          {
            transitionId: "witness_authority_non_member_admit_b",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-b",
          },
        ]),
      });

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerA.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
          {
            witnessId: "witness-intruder",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerIntruder.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
        ],
      });

    expect(settlement).toMatchObject({
      status: "witnessed",
      acceptedWitnessIds: ["witness-a"],
      eligibleWitnessIds: ["witness-a", "witness-b"],
      invalidWitnessIds: ["witness-intruder"],
      allowedAction: "collect_more_witnesses",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_witness_not_authorized",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_quorum_not_met",
        }),
      ]),
    });
  });

  it("does not count equivocated witness principals toward settlement", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_authority_equivocated",
      eventId: "evt_authority_equivocated",
      sequence: 42,
      contentHash: "sha256:authority-equivocated",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledgerA = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const ledgerB = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();

    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerA,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerB,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-b",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root,
    });

    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: buildWitnessAuthorityTransitions(view, [
          {
            transitionId: "witness_authority_equivocated_quorum",
            transitionKind: "set_quorum",
            recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            requiredWitnesses: 2,
            minimumWitnesses: 1,
          },
          {
            transitionId: "witness_authority_equivocated_admit_a",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-a",
          },
          {
            transitionId: "witness_authority_equivocated_admit_b",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-b",
          },
          {
            transitionId: "witness_authority_equivocated_b",
            transitionKind: "mark_equivocated",
            recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-b",
            reason: "conflicting same-sequence root history",
          },
        ]),
      });
    expect(authorityTopology.principals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          witnessId: "witness-b",
          status: "equivocated",
        }),
      ]),
    );

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerA.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
          {
            witnessId: "witness-b",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerB.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
        ],
      });

    expect(settlement).toMatchObject({
      status: "witnessed",
      acceptedWitnessIds: ["witness-a"],
      eligibleWitnessIds: ["witness-a"],
      invalidWitnessIds: ["witness-b"],
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_witness_not_authorized",
        }),
      ]),
    });
  });

  it("obstructs settlement when witness authority topology does not replay", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_authority_tampered",
      eventId: "evt_authority_tampered",
      sequence: 42,
      contentHash: "sha256:authority-tampered",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });

    const transitions = buildWitnessAuthorityTransitions(view, [
      {
        transitionId: "witness_authority_tampered_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:replay-root-settlement",
        effectiveFromRootSequence: 1,
        requiredWitnesses: 1,
        minimumWitnesses: 1,
      },
      {
        transitionId: "witness_authority_tampered_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:replay-root-settlement",
        effectiveFromRootSequence: 1,
        witnessId: "witness-a",
      },
    ]);
    const tamperedTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: [
          {
            ...transitions[0]!,
            requiredWitnesses: 2,
          },
          transitions[1]!,
        ],
      });
    expect(tamperedTopology.valid).toBe(false);

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology: tamperedTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records: await ledger.listProjectionReplayCertificateStoreRootWitnessRecords({
                tenantId: view.tenantId,
              }),
            }),
          },
        ],
      });

    expect(settlement).toMatchObject({
      status: "obstructed",
      acceptedWitnessIds: [],
      invalidWitnessIds: ["witness-a"],
      allowedAction: "correct_authority_topology",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_authority_topology_invalid",
        }),
      ]),
    });
  });

  it("replays durable witness authority and settlement stores after restart", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_authority_store_settled",
      eventId: "evt_authority_store_settled",
      sequence: 42,
      contentHash: "sha256:authority-store-settled",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledgerA = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const ledgerB = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerA,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledgerB,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-b",
      observedAt: timestamp("2026-06-03T14:05:33.000Z"),
      root,
    });

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessAuthorityTransition({
      tenantId: view.tenantId,
      transitionId: "witness_authority_store_quorum",
      transitionKind: "set_quorum",
      recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
      recordedBy: "authority:replay-root-settlement",
      effectiveFromRootSequence: 1,
      requiredWitnesses: 2,
      minimumWitnesses: 1,
    });
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessAuthorityTransition({
      tenantId: view.tenantId,
      transitionId: "witness_authority_store_admit_a",
      transitionKind: "admit_witness",
      recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
      recordedBy: "authority:replay-root-settlement",
      effectiveFromRootSequence: 1,
      witnessId: "witness-a",
    });
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessAuthorityTransition({
      tenantId: view.tenantId,
      transitionId: "witness_authority_store_admit_b",
      transitionKind: "admit_witness",
      recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
      recordedBy: "authority:replay-root-settlement",
      effectiveFromRootSequence: 1,
      witnessId: "witness-b",
    });

    const restartedAuthorityTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
      });
    expect(
      restartedAuthorityTransitions.map((transition) => ({
        sequence: transition.authoritySequence,
        previous: transition.previousAuthorityHash,
      })),
    ).toEqual([
      { sequence: 1, previous: undefined },
      {
        sequence: 2,
        previous: restartedAuthorityTransitions[0]!.authorityHash,
      },
      {
        sequence: 3,
        previous: restartedAuthorityTransitions[1]!.authorityHash,
      },
    ]);
    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: restartedAuthorityTransitions,
      });
    expect(authorityTopology).toMatchObject({
      valid: true,
      requiredWitnesses: 2,
      eligibleWitnessIds: ["witness-a", "witness-b"],
      issues: [],
    });

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerA.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
          {
            witnessId: "witness-b",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records:
                await ledgerB.listProjectionReplayCertificateStoreRootWitnessRecords({
                  tenantId: view.tenantId,
                }),
            }),
          },
        ],
      });
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const settlementRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    expect(settlementRecord).toMatchObject({
      settlementSequence: 1,
      root,
      settlement,
    });
    expect(settlementRecord.previousSettlementRecordHash).toBeUndefined();

    const restartedSettlementRecords =
      await settlementStore.listProjectionReplayCertificateStoreRootWitnessSettlementRecords({
        tenantId: view.tenantId,
      });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementRecords({
        tenantId: view.tenantId,
        records: restartedSettlementRecords,
      }),
    ).toMatchObject({
      valid: true,
      settledRoots: [root],
      latestSettledRoot: root,
      issues: [],
    });
    const settlementRef =
      projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord(
        settlementRecord,
        { checkedAt: timestamp("2026-06-03T14:06:01.000Z") },
      );
    expect(settlementRef).toMatchObject({
      rootSequence: root.sequence,
      rootHash: root.rootHash,
      settlementSequence: settlementRecord.settlementSequence,
      settlementStatus: "settled",
      settlementHash: settlement.settlementHash,
      settlementRecordHash: settlementRecord.settlementRecordHash,
    });
    await expect(
      settlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: settlementRef!,
        root,
      }),
    ).resolves.toMatchObject({
      valid: true,
      issues: [],
    });
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: settlementRef!,
        records: restartedSettlementRecords,
        root: {
          ...root,
          rootHash: "sha256:other-root",
        },
      }),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_root_mismatch",
        }),
      ]),
    });
  });

  it("rejects settled-root refs that no longer cite the latest settled root", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const first = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_currentness_first",
      eventId: "evt_currentness_first",
      sequence: 42,
      contentHash: "sha256:currentness-first",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const second = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_currentness_second",
      eventId: "evt_currentness_second",
      sequence: 43,
      contentHash: "sha256:currentness-second",
      replayedAt: timestamp("2026-06-03T14:05:10.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:41.000Z"),
    });

    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    const witness = new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    );
    await witness.observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:currentness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root: first.root,
    });
    const firstSettlement = await settleRootFromWitnessLedger(
      view,
      first.root,
      ledger,
      "currentness_first",
    );
    expect(firstSettlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const firstSettlementRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement: firstSettlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const firstSettlementRef =
      projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord(
        firstSettlementRecord,
        { checkedAt: timestamp("2026-06-03T14:06:01.000Z") },
      );
    expect(firstSettlementRef).toBeDefined();

    await witness.observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:currentness-a",
      observedAt: timestamp("2026-06-03T14:06:32.000Z"),
      root: second.root,
      consistencyProof: {
        tenantId: view.tenantId,
        fromRoot: first.root,
        toRoot: second.root,
        entries: [second.entry],
      },
    });
    const secondSettlement = await settleRootFromWitnessLedger(
      view,
      second.root,
      ledger,
      "currentness_second",
    );
    expect(secondSettlement.status).toBe("settled");
    await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
      settlement: secondSettlement,
      recordedAt: timestamp("2026-06-03T14:06:40.000Z"),
    });

    await expect(
      settlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: firstSettlementRef!,
        root: first.root,
      }),
    ).resolves.toMatchObject({
      valid: true,
      issues: [],
    });
    await expect(
      settlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: firstSettlementRef!,
        root: first.root,
        currentnessPolicy: {
          requireLatestSettledRoot: true,
        },
      }),
    ).resolves.toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_stale",
        }),
      ]),
    });
  });

  it("rejects superseded same-root settlement refs under currentness policy", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_currentness_same_root",
      eventId: "evt_currentness_same_root",
      sequence: 42,
      contentHash: "sha256:currentness-same-root",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:currentness-same-root",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const settlement = await settleRootFromWitnessLedger(
      view,
      root,
      ledger,
      "currentness_same_root",
    );
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const firstRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const firstRef =
      projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord(
        firstRecord,
      );
    expect(firstRef).toBeDefined();
    const secondRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
      });
    const secondRef =
      projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord(
        secondRecord,
      );
    expect(secondRef).toBeDefined();

    await expect(
      settlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: firstRef!,
        root,
        currentnessPolicy: {
          requireLatestSettlementForRoot: true,
          minimumSettlementSequence: secondRecord.settlementSequence,
        },
      }),
    ).resolves.toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_stale",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_below_currentness_frontier",
        }),
      ]),
    });
    await expect(
      settlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: secondRef!,
        root,
        currentnessPolicy: {
          requireLatestSettlementForRoot: true,
          minimumSettlementSequence: secondRecord.settlementSequence,
        },
      }),
    ).resolves.toMatchObject({
      valid: true,
      issues: [],
    });
  });

  it("rejects settled-root refs followed by conflicting or obstructed settlement records", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_currentness_conflict",
      eventId: "evt_currentness_conflict",
      sequence: 42,
      contentHash: "sha256:currentness-conflict",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:currentness-conflict",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const settlement = await settleRootFromWitnessLedger(
      view,
      root,
      ledger,
      "currentness_conflict",
    );
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const settledRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const settledRef =
      projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord(
        settledRecord,
      );
    expect(settledRef).toBeDefined();

    const conflictingRoot = {
      ...root,
      rootHash: "sha256:currentness-conflicting-root",
    };
    const conflictingSettlement =
      await settleRootFromWitnessLedger(
        view,
        conflictingRoot,
        ledger,
        "currentness_conflicting_root",
      );
    expect(conflictingSettlement.status).toBe("obstructed");
    await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
      settlement: conflictingSettlement,
      recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
    });

    await expect(
      settlementStore.verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: settledRef!,
        root,
        currentnessPolicy: {
          disallowLaterConflictingRoot: true,
          disallowLaterObstruction: true,
        },
      }),
    ).resolves.toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_conflict",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_stale",
        }),
      ]),
    });
  });

  it("rejects currentness verification against truncated settlement-store heads", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_head_truncation",
      eventId: "evt_settlement_head_truncation",
      sequence: 42,
      contentHash: "sha256:settlement-head-truncation",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-truncation",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const settlement = await settleRootFromWitnessLedger(
      view,
      root,
      ledger,
      "settlement_head_truncation",
    );
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const firstRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const secondRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
      });
    const firstRef =
      projectionReplayCertificateStoreRootWitnessSettlementRefFromRecord(
        firstRecord,
      );
    const witnessedHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        secondRecord,
      );
    expect(firstRef).toBeDefined();
    await expect(
      settlementStore.getProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
        tenantId: view.tenantId,
      }),
    ).resolves.toEqual(witnessedHead);

    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementRef({
        tenantId: view.tenantId,
        ref: firstRef!,
        records: [firstRecord],
        root,
        currentnessPolicy: {
          requiredSettlementStoreHead: witnessedHead,
        },
      }),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_ref_store_head_mismatch",
        }),
      ]),
    });
  });

  it("witnesses settlement-store heads and obstructs hidden regressions or forks", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_head_witness",
      eventId: "evt_settlement_head_witness",
      sequence: 42,
      contentHash: "sha256:settlement-head-witness",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-witness",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const settlement = await settleRootFromWitnessLedger(
      view,
      root,
      ledger,
      "settlement_head_witness",
    );
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const firstRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const firstHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        firstRecord,
      );
    const secondRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
      });
    const secondHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        secondRecord,
      );

    const witness =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness();
    await expect(
      witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
        tenantId: view.tenantId,
        observerId: "agent:settlement-head-witness",
        observedAt: timestamp("2026-06-03T14:06:01.000Z"),
        head: firstHead,
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_initial",
    });
    await expect(
      witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
        tenantId: view.tenantId,
        observerId: "agent:settlement-head-witness",
        observedAt: timestamp("2026-06-03T14:07:01.000Z"),
        head: secondHead,
      }),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_consistency_proof_missing",
        }),
      ]),
    });
    await expect(
      witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
        tenantId: view.tenantId,
        observerId: "agent:settlement-head-witness",
        observedAt: timestamp("2026-06-03T14:07:02.000Z"),
        head: secondHead,
        consistencyProof: {
          tenantId: view.tenantId,
          fromHead: firstHead,
          toHead: secondHead,
          records: [secondRecord],
        },
      }),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_advance",
    });
    await expect(
      witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
        tenantId: view.tenantId,
        observerId: "agent:settlement-head-witness",
        observedAt: timestamp("2026-06-03T14:07:02.500Z"),
        head: firstHead,
      }),
    ).resolves.toMatchObject({
      accepted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_regression",
        }),
      ]),
    });

    const forkHead = {
      ...secondHead,
      settlementRecordHash: "sha256:settlement-head-fork",
      headHash:
        computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadHash(
          {
            tenantId: secondHead.tenantId,
            settlementSequence: secondHead.settlementSequence,
            settlementRecordHash: "sha256:settlement-head-fork",
            recordedAt: secondHead.recordedAt,
          },
        ),
    };
    const forkDecision =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadObservation(
        {
          observation: {
            tenantId: view.tenantId,
            observerId: "agent:settlement-head-witness",
            observedAt: timestamp("2026-06-03T14:07:03.000Z"),
            head: forkHead,
          },
          knownHeads:
            witness.observedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeads(
              view.tenantId,
            ),
        },
      );
    expect(forkDecision).toMatchObject({
      accepted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_fork",
        }),
      ]),
    });
  });

  it("replays settlement-store head witness ledgers after restart", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_head_ledger",
      eventId: "evt_settlement_head_ledger",
      sequence: 42,
      contentHash: "sha256:settlement-head-ledger",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const rootLedger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      rootLedger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-ledger",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const settlement = await settleRootFromWitnessLedger(
      view,
      root,
      rootLedger,
      "settlement_head_ledger",
    );
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const firstRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const firstHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        firstRecord,
      );
    const secondRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
      });
    const secondHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        secondRecord,
      );

    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const headWitness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await headWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-ledger",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head: firstHead,
    });
    await headWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-ledger",
      observedAt: timestamp("2026-06-03T14:07:01.000Z"),
      head: secondHead,
      consistencyProof: {
        tenantId: view.tenantId,
        fromHead: firstHead,
        toHead: secondHead,
        records: [secondRecord],
      },
    });

    const records =
      await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords({
        tenantId: view.tenantId,
      });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords({
        tenantId: view.tenantId,
        records,
      }),
    ).toMatchObject({
      valid: true,
      latestHead: secondHead,
      issues: [],
    });

    const tamperedRecords = [
      records[0]!,
      {
        ...records[1]!,
        decision: {
          ...records[1]!.decision,
          status: "accepted_initial" as const,
        },
      },
    ];
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords({
        tenantId: view.tenantId,
        records: tamperedRecords,
      }),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_ledger_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_ledger_decision_mismatch",
        }),
      ]),
    });
  });

  it("shares settlement-store head witness ledgers across fresh agents", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_head_cross_agent",
      eventId: "evt_settlement_head_cross_agent",
      sequence: 42,
      contentHash: "sha256:settlement-head-cross-agent",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const rootLedger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      rootLedger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-cross-agent",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const settlement = await settleRootFromWitnessLedger(
      view,
      root,
      rootLedger,
      "settlement_head_cross_agent",
    );
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    const firstRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
      });
    const firstHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        firstRecord,
      );
    const secondRecord =
      await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
        settlement,
        recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
      });
    const secondHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadFromRecord(
        secondRecord,
      );

    const sharedHeadLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const agentA =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        sharedHeadLedger,
      );
    await agentA.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head: firstHead,
    });
    await agentA.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "agent:settlement-head-a",
      observedAt: timestamp("2026-06-03T14:07:01.000Z"),
      head: secondHead,
      consistencyProof: {
        tenantId: view.tenantId,
        fromHead: firstHead,
        toHead: secondHead,
        records: [secondRecord],
      },
    });

    const agentB =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        sharedHeadLedger,
      );
    await expect(
      agentB.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
        tenantId: view.tenantId,
        observerId: "agent:settlement-head-b",
        observedAt: timestamp("2026-06-03T14:08:01.000Z"),
        head: firstHead,
      }),
    ).resolves.toMatchObject({
      accepted: false,
      latestHead: secondHead,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_regression",
        }),
      ]),
    });

    const records =
      await sharedHeadLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords({
        tenantId: view.tenantId,
        records,
      }),
    ).toMatchObject({
      valid: true,
      latestHead: secondHead,
      issues: [],
    });
  });

  it("certifies settlement-store heads only through replayed head-witness topology quorum", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_certified",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-b",
      observedAt: timestamp("2026-06-03T14:06:02.000Z"),
      head,
    });
    const witnessReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    expect(witnessReplay.valid).toBe(true);

    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: buildSettlementHeadWitnessAuthorityTransitions(view, [
            {
              transitionId: "settlement_head_quorum_certified_set_quorum",
              transitionKind: "set_quorum",
              recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              requiredWitnesses: 2,
              minimumWitnesses: 1,
            },
            {
              transitionId: "settlement_head_quorum_certified_admit_a",
              transitionKind: "admit_witness",
              recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-a",
            },
            {
              transitionId: "settlement_head_quorum_certified_admit_b",
              transitionKind: "admit_witness",
              recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-b",
            },
          ]),
        },
      );

    expect(authorityTopology).toMatchObject({
      valid: true,
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      eligibleWitnessIds: ["head-witness-a", "head-witness-b"],
      issues: [],
    });
    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head,
          witnessReplay,
          authorityTopology,
        },
      ),
    ).toMatchObject({
      status: "certified",
      acceptedWitnessIds: ["head-witness-a", "head-witness-b"],
      eligibleWitnessIds: ["head-witness-a", "head-witness-b"],
      invalidWitnessIds: [],
      obstructingWitnessIds: [],
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      authorityTopologyHash: authorityTopology.latestAuthorityHash,
      issues: [],
    });
  });

  it("certifies settlement-store heads from durable head-witness authority transitions after restart", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_store_backed",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-b",
      observedAt: timestamp("2026-06-03T14:06:02.000Z"),
      head,
    });

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_store_backed_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_store_backed_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_store_backed_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-b",
      },
    );

    const restartedAuthorityTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    expect(
      restartedAuthorityTransitions.map((transition) => ({
        sequence: transition.authoritySequence,
        previous: transition.previousAuthorityHash,
      })),
    ).toEqual([
      { sequence: 1, previous: undefined },
      {
        sequence: 2,
        previous: restartedAuthorityTransitions[0]!.authorityHash,
      },
      {
        sequence: 3,
        previous: restartedAuthorityTransitions[1]!.authorityHash,
      },
    ]);

    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        headLedger,
      );

    await expect(
      certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
        },
      ),
    ).resolves.toMatchObject({
      certified: true,
      status: "certified",
      acceptedWitnessIds: ["head-witness-a", "head-witness-b"],
      eligibleWitnessIds: ["head-witness-a", "head-witness-b"],
      invalidWitnessIds: [],
      obstructingWitnessIds: [],
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      authorityTopologyHash:
        restartedAuthorityTransitions[2]!.authorityHash,
      issues: [],
    });
  });

  it("seals settlement-head witness authority epochs against retroactive topology edits", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_epoch_seal",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-b",
      observedAt: timestamp("2026-06-03T14:06:02.000Z"),
      head,
    });

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_epoch_seal_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_epoch_seal_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_epoch_seal_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-b",
      },
    );
    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        headLedger,
      );
    const certificate =
      await certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
        },
      );
    expect(certificate.certified).toBe(true);

    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_epoch_seal_seal",
        transitionKind: "seal_authority_epoch",
        recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: head.settlementSequence,
        sealedThroughSettlementSequence: head.settlementSequence,
        sealedAuthorityTopologyHash: certificate.authorityTopologyHash!,
        sealedQuorumCertificateHash: certificate.quorumCertificateHash,
      },
    );

    await expect(
      authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          transitionId: "settlement_head_quorum_epoch_seal_revoke_a_retroactive",
          transitionKind: "revoke_witness",
          recordedAt: timestamp("2026-06-03T14:04:04.000Z"),
          recordedBy: "authority:settlement-head-witness",
          effectiveFromSettlementSequence: head.settlementSequence,
          witnessId: "head-witness-a",
          reason: "attempted retroactive revocation",
        },
      ),
    ).rejects.toThrow(/cannot modify sealed settlement epoch/);

    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_epoch_seal_revoke_a_future",
        transitionKind: "revoke_witness",
        recordedAt: timestamp("2026-06-03T14:04:05.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: head.settlementSequence + 1,
        witnessId: "head-witness-a",
        reason: "future revocation",
      },
    );
    const sealedTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const replayedTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: sealedTransitions,
        },
      );
    expect(replayedTopology).toMatchObject({
      valid: true,
      effectiveAuthorityHash: certificate.authorityTopologyHash,
      sealedThroughSettlementSequence: head.settlementSequence,
      eligibleWitnessIds: ["head-witness-a", "head-witness-b"],
      issues: [],
    });

    const recertified =
      await certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
        },
      );
    expect(recertified).toMatchObject({
      certified: true,
      authorityTopologyHash: certificate.authorityTopologyHash,
      quorumCertificateHash: certificate.quorumCertificateHash,
    });
  });

  it("obstructs store-backed settlement-head quorum when tampered history rewrites a sealed epoch", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_epoch_seal_tamper",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
      headLedger,
    ).observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    const baseTransitions = buildSettlementHeadWitnessAuthorityTransitions(view, [
      {
        transitionId: "settlement_head_quorum_epoch_seal_tamper_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 1,
        minimumWitnesses: 1,
      },
      {
        transitionId: "settlement_head_quorum_epoch_seal_tamper_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
      },
    ]);
    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: baseTransitions,
        },
      );
    const witnessReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    const certificate =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head,
          witnessReplay,
          authorityTopology,
        },
      );
    expect(certificate.certified).toBe(true);
    const seal =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          authoritySequence: 3,
          transitionId: "settlement_head_quorum_epoch_seal_tamper_seal",
          transitionKind: "seal_authority_epoch",
          recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
          recordedBy: "authority:settlement-head-witness",
          effectiveFromSettlementSequence: head.settlementSequence,
          sealedThroughSettlementSequence: head.settlementSequence,
          sealedAuthorityTopologyHash: certificate.authorityTopologyHash!,
          sealedQuorumCertificateHash: certificate.quorumCertificateHash,
          previousAuthorityHash: baseTransitions[1]!.authorityHash,
        },
      );
    const retroactiveRevocation =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          authoritySequence: 4,
          transitionId:
            "settlement_head_quorum_epoch_seal_tamper_revoke_a_retroactive",
          transitionKind: "revoke_witness",
          recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
          recordedBy: "authority:settlement-head-witness",
          effectiveFromSettlementSequence: head.settlementSequence,
          witnessId: "head-witness-a",
          reason: "tampered retroactive revocation",
          previousAuthorityHash: seal.authorityHash,
        },
      );
    const tamperedTransitions = [
      ...baseTransitions,
      seal,
      retroactiveRevocation,
    ];
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: tamperedTransitions,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_authority_retroactive_transition",
        }),
      ]),
    });
    const tamperedAuthorityStore = {
      async appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition() {
        throw new Error("not used");
      },
      async listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions() {
        return tamperedTransitions;
      },
    };
    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        tamperedAuthorityStore,
        headLedger,
      );

    await expect(
      certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      allowedAction: "correct_head_witness_authority_topology",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_authority_topology_invalid",
        }),
      ]),
    });
  });

  it("requires admitted principal signatures for settlement-head observations and authority epoch seals under strict identity policy", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_signed_identity",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-a",
          observedAt: timestamp("2026-06-03T14:06:01.000Z"),
          head,
        },
        "key-a",
      ),
    );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-b",
          observedAt: timestamp("2026-06-03T14:06:02.000Z"),
          head,
        },
        "key-b",
      ),
    );

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_signed_identity_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_signed_identity_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
        signatureKeyId: "key-a",
        signatureAlgorithm: "test-signature-v1",
        signaturePublicKeyFingerprint: "fp:key-a",
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_signed_identity_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-b",
        signatureKeyId: "key-b",
        signatureAlgorithm: "test-signature-v1",
        signaturePublicKeyFingerprint: "fp:key-b",
      },
    );
    const strictIdentityPolicy = {
      required: true,
      verifier: testSignatureVerifier,
    };
    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        headLedger,
      );
    const certificate =
      await certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
          signaturePolicy: strictIdentityPolicy,
        },
      );
    expect(certificate).toMatchObject({
      certified: true,
      status: "certified",
      acceptedWitnessIds: ["head-witness-a", "head-witness-b"],
      issues: [],
    });

    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      await signedSettlementHeadAuthorityTransitionInput(
        authorityStore,
        view,
        {
          transitionId: "settlement_head_quorum_signed_identity_seal",
          transitionKind: "seal_authority_epoch",
          recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
          recordedBy: "authority:settlement-head-witness",
          effectiveFromSettlementSequence: head.settlementSequence,
          sealedThroughSettlementSequence: head.settlementSequence,
          sealedAuthorityTopologyHash: certificate.authorityTopologyHash!,
          sealedQuorumCertificateHash: certificate.quorumCertificateHash,
        },
        { principalId: "head-witness-a", keyId: "key-a" },
      ),
    );
    const signedTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions:
            await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
              {
                tenantId: view.tenantId,
              },
            ),
          signaturePolicy: strictIdentityPolicy,
        },
      );
    expect(signedTopology).toMatchObject({
      valid: true,
      authorityEpochSeals: [
        expect.objectContaining({
          sealedQuorumCertificateHash: certificate.quorumCertificateHash,
        }),
      ],
      issues: [],
    });

    const unsignedLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
      unsignedLedger,
    ).observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:03.000Z"),
      head,
    });
    const unsignedCertifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        unsignedLedger,
      );
    await expect(
      unsignedCertifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
          signaturePolicy: strictIdentityPolicy,
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_witness_replay_invalid",
        }),
      ]),
    });

    const sealTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const badSeal = {
      ...sealTransitions[3]!,
      signature: {
        ...sealTransitions[3]!.signature!,
        keyId: "key-b",
      },
    };
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: [...sealTransitions.slice(0, 3), badSeal],
          signaturePolicy: strictIdentityPolicy,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_authority_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_authority_signature_key_mismatch",
        }),
      ]),
    });
  });

  it("records settlement-head quorum certificates as durable signed proof objects", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_certificate_record",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-a",
          observedAt: timestamp("2026-06-03T14:06:01.000Z"),
          head,
        },
        "key-a",
      ),
    );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-b",
          observedAt: timestamp("2026-06-03T14:06:02.000Z"),
          head,
        },
        "key-b",
      ),
    );

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_certificate_record_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_certificate_record_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
        signatureKeyId: "key-a",
        signatureAlgorithm: "test-signature-v1",
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_quorum_certificate_record_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-b",
        signatureKeyId: "key-b",
        signatureAlgorithm: "test-signature-v1",
      },
    );
    const strictIdentityPolicy = {
      required: true,
      verifier: testSignatureVerifier,
    };
    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        headLedger,
      );
    const certificate =
      await certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
          signaturePolicy: strictIdentityPolicy,
        },
      );
    expect(certificate).toMatchObject({
      certified: true,
      acceptedWitnessIds: ["head-witness-a", "head-witness-b"],
    });

    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      await signedSettlementHeadAuthorityTransitionInput(
        authorityStore,
        view,
        {
          transitionId: "settlement_head_quorum_certificate_record_seal",
          transitionKind: "seal_authority_epoch",
          recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
          recordedBy: "authority:settlement-head-witness",
          effectiveFromSettlementSequence: head.settlementSequence,
          sealedThroughSettlementSequence: head.settlementSequence,
          sealedAuthorityTopologyHash: certificate.authorityTopologyHash!,
          sealedQuorumCertificateHash: certificate.quorumCertificateHash,
        },
        { principalId: "head-witness-a", keyId: "key-a" },
      ),
    );
    const authorityTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const seal = authorityTransitions.find(
      (transition) => transition.transitionKind === "seal_authority_epoch",
    );
    expect(seal).toBeDefined();
    const witnessRecords =
      await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    const recordStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecordStore();
    const record =
      await recordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate,
          witnessRecords,
          authorityEpochSeal: seal!,
          recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
        },
      );
    expect(record).toMatchObject({
      quorumCertificateSequence: 1,
      certificate: expect.objectContaining({
        quorumCertificateHash: certificate.quorumCertificateHash,
      }),
      acceptedWitnessEvidence: [
        expect.objectContaining({
          witnessId: "head-witness-a",
          signature: expect.objectContaining({ keyId: "key-a" }),
        }),
        expect.objectContaining({
          witnessId: "head-witness-b",
          signature: expect.objectContaining({ keyId: "key-b" }),
        }),
      ],
      authorityEpochSeal: expect.objectContaining({
        sealedQuorumCertificateHash: certificate.quorumCertificateHash,
        signature: expect.objectContaining({ keyId: "key-a" }),
      }),
    });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records:
            await recordStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      ),
    ).toMatchObject({
      valid: true,
      latestCertifiedRecord: expect.objectContaining({
        quorumCertificateRecordHash: record.quorumCertificateRecordHash,
      }),
      issues: [],
    });

    const badEvidenceRecord = {
      ...record,
      acceptedWitnessEvidence: [
        {
          ...record.acceptedWitnessEvidence[0]!,
          witnessId: "head-witness-z",
        },
        record.acceptedWitnessEvidence[1]!,
      ],
    };
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [badEvidenceRecord],
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_certificate_record_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_certificate_record_witness_evidence_mismatch",
        }),
      ]),
    });

    const badSealRecord = {
      ...record,
      authorityEpochSeal: {
        ...record.authorityEpochSeal!,
        sealedQuorumCertificateHash: "not_the_certificate_hash",
      },
    };
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [badSealRecord],
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_certificate_record_authority_seal_mismatch",
        }),
      ]),
    });
  });

  it("refuses revoked settlement-head witness keys during certification and certificate-record replay", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_key_status",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-a",
          observedAt: timestamp("2026-06-03T14:06:01.000Z"),
          head,
        },
        "key-a",
      ),
    );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-b",
          observedAt: timestamp("2026-06-03T14:06:02.000Z"),
          head,
        },
        "key-b",
      ),
    );

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_key_status_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_key_status_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
        signatureKeyId: "key-a",
        signatureAlgorithm: "test-signature-v1",
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_key_status_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-b",
        signatureKeyId: "key-b",
        signatureAlgorithm: "test-signature-v1",
      },
    );

    const strictIdentityPolicy = {
      required: true,
      verifier: testSignatureVerifier,
    };
    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        headLedger,
      );
    const certificate =
      await certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
          signaturePolicy: strictIdentityPolicy,
        },
      );
    expect(certificate).toMatchObject({
      certified: true,
      status: "certified",
      acceptedWitnessIds: ["head-witness-a", "head-witness-b"],
    });

    const currentTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions:
            await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    const witnessRecords =
      await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    const recordStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecordStore();
    const record =
      await recordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate,
          witnessRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: currentTopology,
          },
          recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
        },
      );
    expect(record.acceptedWitnessEvidence).toEqual([
      expect.objectContaining({
        witnessId: "head-witness-a",
        signature: expect.objectContaining({ keyId: "key-a" }),
      }),
      expect.objectContaining({
        witnessId: "head-witness-b",
        signature: expect.objectContaining({ keyId: "key-b" }),
      }),
    ]);

    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_key_status_revoke_a",
        transitionKind: "revoke_signature_key",
        recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: head.settlementSequence,
        witnessId: "head-witness-a",
        signatureKeyId: "key-a",
        reason: "compromised witness signing key",
      },
    );

    await expect(
      certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
          signaturePolicy: strictIdentityPolicy,
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_witness_replay_invalid",
        }),
      ]),
    });

    const revokedTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions:
            await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    expect(revokedTopology).toMatchObject({
      valid: true,
      principals: expect.arrayContaining([
        expect.objectContaining({
          witnessId: "head-witness-a",
          signatureKeyId: "key-a",
          signatureKeyStatus: "revoked",
        }),
      ]),
    });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records:
            await recordStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
              {
                tenantId: view.tenantId,
              },
            ),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: revokedTopology,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_certificate_record_signature_key_not_current",
          path: "/records/0/acceptedWitnessEvidence/0/signature/keyId",
        }),
      ]),
    });

    const staleRecordStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecordStore();
    await expect(
      staleRecordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate,
          witnessRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: revokedTopology,
          },
          recordedAt: timestamp("2026-06-03T14:07:30.000Z"),
        },
      ),
    ).rejects.toThrow(/signature_key_not_current/);
  });

  it("resumes settlement-head witness replay from a proof-preserving compaction checkpoint", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_compaction_checkpoint",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-a",
          observedAt: timestamp("2026-06-03T14:06:01.000Z"),
          head,
        },
        "key-a",
      ),
    );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
      signedSettlementHeadObservation(
        {
          tenantId: view.tenantId,
          observerId: "head-witness-b",
          observedAt: timestamp("2026-06-03T14:06:02.000Z"),
          head,
        },
        "key-b",
      ),
    );

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_compaction_checkpoint_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_compaction_checkpoint_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
        signatureKeyId: "key-a",
        signatureAlgorithm: "test-signature-v1",
      },
    );
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_compaction_checkpoint_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-b",
        signatureKeyId: "key-b",
        signatureAlgorithm: "test-signature-v1",
      },
    );

    const strictIdentityPolicy = {
      required: true,
      verifier: testSignatureVerifier,
    };
    const authorityTransitionsBeforeRotation =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const topologyBeforeRotation =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: authorityTransitionsBeforeRotation,
        },
      );
    expect(topologyBeforeRotation.valid).toBe(true);

    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        authorityStore,
        headLedger,
      );
    const certificate =
      await certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
          signaturePolicy: strictIdentityPolicy,
        },
      );
    expect(certificate.certified).toBe(true);

    const witnessRecords =
      await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    const recordStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecordStore();
    const firstCertificateRecord =
      await recordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate,
          witnessRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          recordedAt: timestamp("2026-06-03T14:07:00.000Z"),
        },
      );
    const secondCertificateRecord =
      await recordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate,
          witnessRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          recordedAt: timestamp("2026-06-03T14:07:30.000Z"),
        },
      );

    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "settlement_head_compaction_checkpoint_rotate_a",
        transitionKind: "rotate_signature_key",
        recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: head.settlementSequence,
        witnessId: "head-witness-a",
        signatureKeyId: "key-a2",
        signatureAlgorithm: "test-signature-v1",
      },
    );
    const authorityTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const fullAuthorityReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: authorityTransitions,
        },
      );
    expect(fullAuthorityReplay).toMatchObject({
      valid: true,
      principals: expect.arrayContaining([
        expect.objectContaining({
          witnessId: "head-witness-a",
          signatureKeyId: "key-a2",
          signatureKeyStatus: "active",
        }),
      ]),
    });

    const firstWitnessReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: [witnessRecords[0]!],
        },
      );
    const checkpoint =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpoint(
        {
          tenantId: view.tenantId,
          checkpointId: "settlement_head_compaction_checkpoint_001",
          recordedAt: timestamp("2026-06-03T14:08:00.000Z"),
          witnessLedger: {
            compactedThroughWitnessSequence:
              witnessRecords[0]!.witnessSequence,
            compactedThroughObservationHash:
              witnessRecords[0]!.observationHash,
            acceptedHeads: firstWitnessReplay.acceptedHeads,
          },
          authorityTopology: {
            settlementSequence: head.settlementSequence,
            compactedThroughAuthoritySequence:
              authorityTransitionsBeforeRotation[2]!.authoritySequence,
            compactedThroughAuthorityHash:
              authorityTransitionsBeforeRotation[2]!.authorityHash,
            requiredWitnesses: topologyBeforeRotation.requiredWitnesses!,
            minimumWitnesses: topologyBeforeRotation.minimumWitnesses!,
            effectiveAuthorityHash:
              topologyBeforeRotation.effectiveAuthorityHash!,
            principals: topologyBeforeRotation.principals,
            authorityEpochSeals: topologyBeforeRotation.authorityEpochSeals,
          },
          quorumCertificateRecords: {
            compactedThroughQuorumCertificateSequence:
              firstCertificateRecord.quorumCertificateSequence,
            compactedThroughQuorumCertificateRecordHash:
              firstCertificateRecord.quorumCertificateRecordHash,
            latestCertifiedRecord: firstCertificateRecord,
          },
        },
      );
    const checkpointWitnessEvidence = [
      {
        witnessId: "head-witness-a",
        keyId: "key-a",
        witnessedAt: timestamp("2026-06-03T14:08:01.000Z"),
      },
      {
        witnessId: "head-witness-b",
        keyId: "key-b",
        witnessedAt: timestamp("2026-06-03T14:08:02.000Z"),
      },
    ].map(({ witnessId, keyId, witnessedAt }) => {
      const payloadHash =
        computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionWitnessSignaturePayloadHash(
          {
            tenantId: view.tenantId,
            witnessId,
            checkpointHash: checkpoint.checkpointHash,
            witnessedAt,
          },
        );
      return {
        witnessId,
        checkpointHash: checkpoint.checkpointHash,
        witnessedAt,
        signature: testSignatureFor({
          principalId: witnessId,
          keyId,
          payloadHash,
        }),
      };
    });
    const checkpointAdmission =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmission(
        {
          tenantId: view.tenantId,
          checkpoint,
          authorityTopology: topologyBeforeRotation,
          witnessEvidence: checkpointWitnessEvidence,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      );
    expect(checkpointAdmission).toMatchObject({
      status: "admitted",
      admitted: true,
      acceptedWitnessIds: ["head-witness-a", "head-witness-b"],
      issues: [],
    });
    const insufficientCheckpointAdmission =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmission(
        {
          tenantId: view.tenantId,
          checkpoint,
          authorityTopology: topologyBeforeRotation,
          witnessEvidence: checkpointWitnessEvidence.slice(0, 1),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      );
    expect(insufficientCheckpointAdmission).toMatchObject({
      status: "obstructed",
      admitted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_checkpoint_admission_quorum_not_met",
        }),
      ]),
    });
    const checkpointAdmissionRecordStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecordStore();
    await expect(
      checkpointAdmissionRecordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecord(
        {
          checkpoint,
          admission: insufficientCheckpointAdmission,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          recordedAt: timestamp("2026-06-03T14:08:03.000Z"),
        },
      ),
    ).rejects.toThrow(/admission_record_admission_invalid/);

    const checkpointAdmissionRecord =
      await checkpointAdmissionRecordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecord(
        {
          checkpoint,
          admission: checkpointAdmission,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          recordedAt: timestamp("2026-06-03T14:08:04.000Z"),
        },
      );
    const checkpointAdmissionRecords =
      await checkpointAdmissionRecordStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecords(
        {
          tenantId: view.tenantId,
        },
      );
    const checkpointAdmissionReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecords(
        {
          tenantId: view.tenantId,
          records: checkpointAdmissionRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      );
    expect(checkpointAdmissionReplay).toMatchObject({
      valid: true,
      latestAdmissionRecord: expect.objectContaining({
        checkpointAdmissionRecordHash:
          checkpointAdmissionRecord.checkpointAdmissionRecordHash,
      }),
      issues: [],
    });
    const recoveredCheckpointAdmission =
      checkpointAdmissionReplay.latestAdmissionRecord!.admission;
    const tamperedAdmissionRecord = {
      ...checkpointAdmissionRecord,
      admission: {
        ...checkpointAdmissionRecord.admission,
        checkpointAdmissionHash: "tampered_checkpoint_admission_hash",
      },
    };
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionCheckpointAdmissionRecords(
        {
          tenantId: view.tenantId,
          records: [tamperedAdmissionRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_checkpoint_admission_record_admission_hash_mismatch",
        }),
      ]),
    });
    const pruningAdmission =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningAdmission(
        {
          tenantId: view.tenantId,
          checkpointAdmissionRecord,
          checkpointAdmissionRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          witnessRecords: witnessRecords.slice(1),
          authorityTransitions: authorityTransitions.slice(3),
          quorumCertificateRecords: [secondCertificateRecord],
        },
      );
    expect(pruningAdmission).toMatchObject({
      status: "admitted",
      admitted: true,
      lanes: [
        "witness_ledger",
        "authority_topology",
        "quorum_certificate_records",
      ],
      issues: [],
    });
    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningAdmission(
        {
          tenantId: view.tenantId,
          checkpointAdmissionRecord,
          checkpointAdmissionRecords: [],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          witnessRecords: witnessRecords.slice(1),
          authorityTransitions: authorityTransitions.slice(3),
          quorumCertificateRecords: [secondCertificateRecord],
        },
      ),
    ).toMatchObject({
      status: "obstructed",
      admitted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_admission_record_missing",
        }),
      ]),
    });
    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningAdmission(
        {
          tenantId: view.tenantId,
          checkpointAdmissionRecord,
          checkpointAdmissionRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          witnessRecords,
          authorityTransitions: authorityTransitions.slice(3),
          quorumCertificateRecords: [secondCertificateRecord],
        },
      ),
    ).toMatchObject({
      status: "obstructed",
      admitted: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_admission_witness_suffix_invalid",
        }),
      ]),
    });
    const pruningTombstoneStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecordStore();
    const pruningTombstoneRecord =
      await pruningTombstoneStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecord(
        {
          checkpointAdmissionRecord,
          pruningAdmission,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          recordedAt: timestamp("2026-06-03T14:08:05.000Z"),
        },
      );
    expect(pruningTombstoneRecord).toMatchObject({
      pruningTombstoneSequence: 1,
      pruningAdmission: expect.objectContaining({
        pruningAdmissionHash: pruningAdmission.pruningAdmissionHash,
      }),
      prunedFrontiers: [
        {
          lane: "authority_topology",
          compactedThroughSequence:
            authorityTransitionsBeforeRotation[2]!.authoritySequence,
          compactedThroughHash:
            authorityTransitionsBeforeRotation[2]!.authorityHash,
        },
        {
          lane: "quorum_certificate_records",
          compactedThroughSequence:
            firstCertificateRecord.quorumCertificateSequence,
          compactedThroughHash:
            firstCertificateRecord.quorumCertificateRecordHash,
        },
        {
          lane: "witness_ledger",
          compactedThroughSequence: witnessRecords[0]!.witnessSequence,
          compactedThroughHash: witnessRecords[0]!.observationHash,
        },
      ],
    });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecords(
        {
          tenantId: view.tenantId,
          records:
            await pruningTombstoneStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecords(
              {
                tenantId: view.tenantId,
              },
            ),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).toMatchObject({
      valid: true,
      latestTombstoneRecord: expect.objectContaining({
        pruningTombstoneRecordHash:
          pruningTombstoneRecord.pruningTombstoneRecordHash,
      }),
      issues: [],
    });
    const tamperedPruningTombstoneRecord = {
      ...pruningTombstoneRecord,
      pruningAdmission: {
        ...pruningTombstoneRecord.pruningAdmission,
        witnessSuffixRecordCount: 99,
      },
    };
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneRecords(
        {
          tenantId: view.tenantId,
          records: [tamperedPruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_pruning_admission_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_hash_mismatch",
        }),
      ]),
    });
    await expect(
      headLedger.pruneProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          pruningTombstoneRecord: tamperedPruningTombstoneRecord,
        },
      ),
    ).rejects.toThrow(/hash mismatch/);

    await expect(
      headLedger.pruneProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          pruningTombstoneRecord,
        },
      ),
    ).resolves.toBe(1);
    await expect(
      authorityStore.pruneProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneRecord,
        },
      ),
    ).resolves.toBe(3);
    await expect(
      recordStore.pruneProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          pruningTombstoneRecord,
        },
      ),
    ).resolves.toBe(1);
    const prunedWitnessRecords =
      await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    const prunedAuthorityTransitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const prunedQuorumCertificateRecords =
      await recordStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
        },
      );
    expect(prunedWitnessRecords).toHaveLength(1);
    expect(prunedWitnessRecords[0]!.witnessSequence).toBe(2);
    expect(prunedAuthorityTransitions).toHaveLength(1);
    expect(prunedAuthorityTransitions[0]!.authoritySequence).toBe(4);
    expect(prunedQuorumCertificateRecords).toHaveLength(1);
    expect(prunedQuorumCertificateRecords[0]!.quorumCertificateSequence).toBe(2);
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          witnessRecords: prunedWitnessRecords,
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: true,
      issues: [],
    });
    const witnessedTombstoneStoreHead =
      projectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadFromRecord(
        pruningTombstoneRecord,
      );
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          requiredTombstoneStoreHead: witnessedTombstoneStoreHead,
          witnessRecords: prunedWitnessRecords,
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: true,
      tombstoneStoreHead: witnessedTombstoneStoreHead,
      issues: [],
    });
    const tombstoneHeadWitnessLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessLedger();
    const tombstoneHeadWitness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitness(
        tombstoneHeadWitnessLedger,
        {
          ...strictIdentityPolicy,
          authorityTopology: topologyBeforeRotation,
        },
      );
    await expect(
      tombstoneHeadWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        signedTombstoneHeadObservation(
          {
            tenantId: view.tenantId,
            observerId: "pruning-tombstone-monitor",
            observedAt: timestamp("2026-06-03T14:08:05.500Z"),
            head: witnessedTombstoneStoreHead,
          },
          "key-pruning-tombstone-monitor",
        ),
      ),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_initial",
      latestHead: witnessedTombstoneStoreHead,
      issues: [],
    });
    const replayedTombstoneHeadWitness =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await tombstoneHeadWitnessLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      );
    expect(replayedTombstoneHeadWitness).toMatchObject({
      valid: true,
      latestHead: witnessedTombstoneStoreHead,
      issues: [],
    });
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          requiredTombstoneStoreHead:
            replayedTombstoneHeadWitness.latestHead,
          witnessRecords: prunedWitnessRecords,
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: true,
      issues: [],
    });
    await expect(
      tombstoneHeadWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        signedTombstoneHeadObservation(
          {
            tenantId: view.tenantId,
            observerId: "pruning-tombstone-monitor-b",
            observedAt: timestamp("2026-06-03T14:08:05.750Z"),
            head: witnessedTombstoneStoreHead,
          },
          "key-pruning-tombstone-monitor-b",
        ),
      ),
    ).resolves.toMatchObject({
      accepted: true,
      status: "accepted_duplicate",
      latestHead: witnessedTombstoneStoreHead,
      issues: [],
    });
    const tombstoneHeadAuthorityTransition1 =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          authoritySequence: 1,
          transitionId: "pruning_tombstone_head_witness_authority:set_quorum",
          transitionKind: "set_quorum",
          recordedAt: timestamp("2026-06-03T14:08:05.010Z"),
          recordedBy: "authority:pruning-tombstone-head",
          effectiveFromPruningTombstoneSequence: 1,
          requiredWitnesses: 2,
          minimumWitnesses: 1,
        },
      );
    const tombstoneHeadAuthorityTransition2 =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          authoritySequence: 2,
          transitionId:
            "pruning_tombstone_head_witness_authority:admit_monitor_a",
          transitionKind: "admit_witness",
          recordedAt: timestamp("2026-06-03T14:08:05.020Z"),
          recordedBy: "authority:pruning-tombstone-head",
          effectiveFromPruningTombstoneSequence: 1,
          witnessId: "pruning-tombstone-monitor",
          signatureKeyId: "key-pruning-tombstone-monitor",
          signatureAlgorithm: "test-signature-v1",
          signaturePublicKeyFingerprint: "fp:key-pruning-tombstone-monitor",
          previousAuthorityHash:
            tombstoneHeadAuthorityTransition1.authorityHash,
        },
      );
    const tombstoneHeadAuthorityTransition3 =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          authoritySequence: 3,
          transitionId:
            "pruning_tombstone_head_witness_authority:admit_monitor_b",
          transitionKind: "admit_witness",
          recordedAt: timestamp("2026-06-03T14:08:05.030Z"),
          recordedBy: "authority:pruning-tombstone-head",
          effectiveFromPruningTombstoneSequence: 1,
          witnessId: "pruning-tombstone-monitor-b",
          signatureKeyId: "key-pruning-tombstone-monitor-b",
          signatureAlgorithm: "test-signature-v1",
          signaturePublicKeyFingerprint: "fp:key-pruning-tombstone-monitor-b",
          previousAuthorityHash:
            tombstoneHeadAuthorityTransition2.authorityHash,
        },
      );
    const tombstoneHeadAuthorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          transitions: [
            tombstoneHeadAuthorityTransition1,
            tombstoneHeadAuthorityTransition2,
            tombstoneHeadAuthorityTransition3,
          ],
        },
      );
    expect(tombstoneHeadAuthorityTopology).toMatchObject({
      valid: true,
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      eligibleWitnessIds: [
        "pruning-tombstone-monitor",
        "pruning-tombstone-monitor-b",
      ],
      issues: [],
    });
    const replayedTombstoneHeadWitnessQuorum =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await tombstoneHeadWitnessLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      );
    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          witnessReplay: replayedTombstoneHeadWitnessQuorum,
          authorityTopology: tombstoneHeadAuthorityTopology,
        },
      ),
    ).toMatchObject({
      certified: true,
      status: "certified",
      acceptedWitnessIds: [
        "pruning-tombstone-monitor",
        "pruning-tombstone-monitor-b",
      ],
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      authorityBoundary:
        "projection_replay_pruning_tombstone_store_head_witness_quorum",
      issues: [],
    });
    const singleTombstoneHeadAuthorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          transitions: [
            tombstoneHeadAuthorityTransition1,
            tombstoneHeadAuthorityTransition2,
          ],
        },
      );
    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          witnessReplay: replayedTombstoneHeadWitnessQuorum,
          authorityTopology: singleTombstoneHeadAuthorityTopology,
        },
      ),
    ).toMatchObject({
      certified: false,
      status: "witnessed",
      acceptedWitnessIds: ["pruning-tombstone-monitor"],
      invalidWitnessIds: ["pruning-tombstone-monitor-b"],
      requiredWitnesses: 2,
      allowedAction: "collect_more_tombstone_head_witnesses",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_witness_not_authorized",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_not_met",
        }),
      ]),
    });
    const tombstoneHeadAuthorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore();
    await tombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "pruning_tombstone_head_store_backed_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:08:05.040Z"),
        recordedBy: "authority:pruning-tombstone-head",
        effectiveFromPruningTombstoneSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await tombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "pruning_tombstone_head_store_backed_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:08:05.050Z"),
        recordedBy: "authority:pruning-tombstone-head",
        effectiveFromPruningTombstoneSequence: 1,
        witnessId: "pruning-tombstone-monitor",
        signatureKeyId: "key-pruning-tombstone-monitor",
        signatureAlgorithm: "test-signature-v1",
        signaturePublicKeyFingerprint: "fp:key-pruning-tombstone-monitor",
      },
    );
    await tombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "pruning_tombstone_head_store_backed_admit_b",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:08:05.060Z"),
        recordedBy: "authority:pruning-tombstone-head",
        effectiveFromPruningTombstoneSequence: 1,
        witnessId: "pruning-tombstone-monitor-b",
        signatureKeyId: "key-pruning-tombstone-monitor-b",
        signatureAlgorithm: "test-signature-v1",
        signaturePublicKeyFingerprint: "fp:key-pruning-tombstone-monitor-b",
      },
    );
    const storedTombstoneHeadAuthorityTransitions =
      await tombstoneHeadAuthorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    expect(
      storedTombstoneHeadAuthorityTransitions.map((transition) => ({
        sequence: transition.authoritySequence,
        previous: transition.previousAuthorityHash,
      })),
    ).toEqual([
      { sequence: 1, previous: undefined },
      {
        sequence: 2,
        previous: storedTombstoneHeadAuthorityTransitions[0]!.authorityHash,
      },
      {
        sequence: 3,
        previous: storedTombstoneHeadAuthorityTransitions[1]!.authorityHash,
      },
    ]);
    const storeBackedTombstoneHeadCertifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier(
        tombstoneHeadAuthorityStore,
        tombstoneHeadWitnessLedger,
      );
    const storeBackedTombstoneHeadCertificate =
      await storeBackedTombstoneHeadCertifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      );
    expect(storeBackedTombstoneHeadCertificate).toMatchObject({
      certified: true,
      status: "certified",
      acceptedWitnessIds: [
        "pruning-tombstone-monitor",
        "pruning-tombstone-monitor-b",
      ],
      eligibleWitnessIds: [
        "pruning-tombstone-monitor",
        "pruning-tombstone-monitor-b",
      ],
      requiredWitnesses: 2,
      minimumWitnesses: 1,
      authorityTopologyHash:
        storedTombstoneHeadAuthorityTransitions[2]!.authorityHash,
      issues: [],
    });
    const strictTombstoneHeadAuthorityTopologyBeforeSeal =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          transitions: storedTombstoneHeadAuthorityTransitions,
          signaturePolicy: strictIdentityPolicy,
        },
      );
    const unsignedTombstoneHeadWitnessRecords = (
      await tombstoneHeadWitnessLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      )
    ).map((record, index) => {
      if (index !== 0) {
        return record;
      }
      const { signature: _signature, ...unsignedRecord } = record;
      return unsignedRecord;
    });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: unsignedTombstoneHeadWitnessRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            pruningTombstoneHeadAuthorityTopology:
              strictTombstoneHeadAuthorityTopologyBeforeSeal,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_ledger_signature_missing",
        }),
      ]),
    });
    const unsignedTombstoneHeadWitnessLedger = {
      appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecord:
        async () => {
          throw new Error("not used");
        },
      listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords:
        async () => unsignedTombstoneHeadWitnessRecords,
    };
    const unsignedStoreBackedTombstoneHeadCertifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier(
        tombstoneHeadAuthorityStore,
        unsignedTombstoneHeadWitnessLedger,
      );
    await expect(
      unsignedStoreBackedTombstoneHeadCertifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      allowedAction: "correct_tombstone_head_witness_policy",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_witness_replay_invalid",
        }),
      ]),
    });
    const wrongKeyTombstoneHeadSealInput =
      await signedTombstoneHeadAuthorityTransitionInput(
        tombstoneHeadAuthorityStore,
        view,
        {
          transitionId: "pruning_tombstone_head_store_backed_wrong_key_seal",
          transitionKind: "seal_authority_epoch",
          recordedAt: timestamp("2026-06-03T14:08:05.064Z"),
          recordedBy: "authority:pruning-tombstone-head",
          effectiveFromPruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          sealedThroughPruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          sealedAuthorityTopologyHash:
            storeBackedTombstoneHeadCertificate.authorityTopologyHash!,
          sealedQuorumCertificateHash:
            storeBackedTombstoneHeadCertificate.quorumCertificateHash,
        },
        { principalId: "pruning-tombstone-monitor", keyId: "wrong-key" },
      );
    const wrongKeyTombstoneHeadSealTransition =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          ...wrongKeyTombstoneHeadSealInput,
          authoritySequence: storedTombstoneHeadAuthorityTransitions.length + 1,
          previousAuthorityHash:
            storedTombstoneHeadAuthorityTransitions[
              storedTombstoneHeadAuthorityTransitions.length - 1
            ]!.authorityHash,
        },
      );
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          transitions: [
            ...storedTombstoneHeadAuthorityTransitions,
            wrongKeyTombstoneHeadSealTransition,
          ],
          signaturePolicy: strictIdentityPolicy,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_authority_signature_key_mismatch",
        }),
      ]),
    });
    const sealedTombstoneHeadAuthorityTransition =
      await tombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        await signedTombstoneHeadAuthorityTransitionInput(
          tombstoneHeadAuthorityStore,
          view,
          {
            transitionId: "pruning_tombstone_head_store_backed_seal",
            transitionKind: "seal_authority_epoch",
            recordedAt: timestamp("2026-06-03T14:08:05.065Z"),
            recordedBy: "authority:pruning-tombstone-head",
            effectiveFromPruningTombstoneSequence:
              witnessedTombstoneStoreHead.pruningTombstoneSequence,
            sealedThroughPruningTombstoneSequence:
              witnessedTombstoneStoreHead.pruningTombstoneSequence,
            sealedAuthorityTopologyHash:
              storeBackedTombstoneHeadCertificate.authorityTopologyHash!,
            sealedQuorumCertificateHash:
              storeBackedTombstoneHeadCertificate.quorumCertificateHash,
          },
          {
            principalId: "pruning-tombstone-monitor",
            keyId: "key-pruning-tombstone-monitor",
          },
        ),
      );
    await expect(
      tombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          transitionId:
            "pruning_tombstone_head_store_backed_retroactive_revoke_b",
          transitionKind: "revoke_witness",
          recordedAt: timestamp("2026-06-03T14:08:05.066Z"),
          recordedBy: "authority:pruning-tombstone-head",
          effectiveFromPruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          witnessId: "pruning-tombstone-monitor-b",
        },
      ),
    ).rejects.toThrow(/cannot modify sealed pruning tombstone epoch/);
    await tombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "pruning_tombstone_head_store_backed_future_revoke_b",
        transitionKind: "revoke_witness",
        recordedAt: timestamp("2026-06-03T14:08:05.067Z"),
        recordedBy: "authority:pruning-tombstone-head",
        effectiveFromPruningTombstoneSequence:
          witnessedTombstoneStoreHead.pruningTombstoneSequence + 1,
        witnessId: "pruning-tombstone-monitor-b",
      },
    );
    const sealedTombstoneHeadAuthorityTransitions =
      await tombstoneHeadAuthorityStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
        },
      );
    const sealedTombstoneHeadAuthorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          transitions: sealedTombstoneHeadAuthorityTransitions,
        },
      );
    expect(sealedTombstoneHeadAuthorityTopology).toMatchObject({
      valid: true,
      effectiveAuthorityHash:
        storeBackedTombstoneHeadCertificate.authorityTopologyHash,
      sealedThroughPruningTombstoneSequence:
        witnessedTombstoneStoreHead.pruningTombstoneSequence,
      eligibleWitnessIds: [
        "pruning-tombstone-monitor",
        "pruning-tombstone-monitor-b",
      ],
      authorityEpochSeals: [
        expect.objectContaining({
          sealedAuthorityTopologyHash:
            storeBackedTombstoneHeadCertificate.authorityTopologyHash,
          sealedQuorumCertificateHash:
            storeBackedTombstoneHeadCertificate.quorumCertificateHash,
          authorityHash: sealedTombstoneHeadAuthorityTransition.authorityHash,
        }),
      ],
      issues: [],
    });
    const tombstoneHeadQuorumCertificateRecordStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecordStore();
    const signedTombstoneHeadWitnessRecords =
      await tombstoneHeadWitnessLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    const tombstoneHeadQuorumCertificateRecord =
      await tombstoneHeadQuorumCertificateRecordStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate: storeBackedTombstoneHeadCertificate,
          witnessRecords: signedTombstoneHeadWitnessRecords,
          authorityEpochSeal: sealedTombstoneHeadAuthorityTransition,
          signaturePolicy: {
            ...strictIdentityPolicy,
            pruningTombstoneHeadAuthorityTopology:
              sealedTombstoneHeadAuthorityTopology,
          },
          recordedAt: timestamp("2026-06-03T14:08:05.066Z"),
        },
      );
    expect(tombstoneHeadQuorumCertificateRecord).toMatchObject({
      quorumCertificateSequence: 1,
      certificate: {
        quorumCertificateHash:
          storeBackedTombstoneHeadCertificate.quorumCertificateHash,
        certified: true,
      },
      acceptedWitnessEvidence: [
        expect.objectContaining({
          witnessId: "pruning-tombstone-monitor",
          signature: expect.objectContaining({
            principalId: "pruning-tombstone-monitor",
          }),
        }),
        expect.objectContaining({
          witnessId: "pruning-tombstone-monitor-b",
          signature: expect.objectContaining({
            principalId: "pruning-tombstone-monitor-b",
          }),
        }),
      ],
      authorityEpochSeal: expect.objectContaining({
        sealedQuorumCertificateHash:
          storeBackedTombstoneHeadCertificate.quorumCertificateHash,
        signature: expect.objectContaining({
          principalId: "pruning-tombstone-monitor",
        }),
      }),
    });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records:
            await tombstoneHeadQuorumCertificateRecordStore.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecords(
              {
                tenantId: view.tenantId,
              },
            ),
          signaturePolicy: {
            ...strictIdentityPolicy,
            pruningTombstoneHeadAuthorityTopology:
              sealedTombstoneHeadAuthorityTopology,
          },
        },
      ),
    ).toMatchObject({
      valid: true,
      latestCertifiedRecord: expect.objectContaining({
        quorumCertificateRecordHash:
          tombstoneHeadQuorumCertificateRecord.quorumCertificateRecordHash,
      }),
      issues: [],
    });
    const tombstoneHeadQuorumCertificateRecordWithBadEvidence =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecord(
        {
          quorumCertificateSequence: 1,
          certificate: storeBackedTombstoneHeadCertificate,
          acceptedWitnessEvidence:
            tombstoneHeadQuorumCertificateRecord.acceptedWitnessEvidence.map(
              (evidence, index) =>
                index === 0
                  ? {
                      ...evidence,
                      observationHash: "",
                    }
                  : evidence,
            ),
          authorityEpochSeal: sealedTombstoneHeadAuthorityTransition,
          recordedAt: tombstoneHeadQuorumCertificateRecord.recordedAt,
        },
      );
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [tombstoneHeadQuorumCertificateRecordWithBadEvidence],
          signaturePolicy: {
            ...strictIdentityPolicy,
            pruningTombstoneHeadAuthorityTopology:
              sealedTombstoneHeadAuthorityTopology,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_certificate_record_witness_evidence_mismatch",
        }),
      ]),
    });
    const {
      authorityHash: _sealedTombstoneHeadAuthorityHash,
      ...sealedTombstoneHeadAuthorityTransitionPayload
    } = sealedTombstoneHeadAuthorityTransition;
    const mismatchedTombstoneHeadSeal =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          ...sealedTombstoneHeadAuthorityTransitionPayload,
          sealedQuorumCertificateHash: "wrong_tombstone_head_qc_hash",
        },
      );
    const tombstoneHeadQuorumCertificateRecordWithBadSeal =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecord(
        {
          quorumCertificateSequence: 1,
          certificate: storeBackedTombstoneHeadCertificate,
          acceptedWitnessEvidence:
            tombstoneHeadQuorumCertificateRecord.acceptedWitnessEvidence,
          authorityEpochSeal: mismatchedTombstoneHeadSeal,
          recordedAt: tombstoneHeadQuorumCertificateRecord.recordedAt,
        },
      );
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [tombstoneHeadQuorumCertificateRecordWithBadSeal],
          signaturePolicy: {
            ...strictIdentityPolicy,
            pruningTombstoneHeadAuthorityTopology:
              sealedTombstoneHeadAuthorityTopology,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_certificate_record_authority_seal_mismatch",
        }),
      ]),
    });
    await expect(
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecordStore().appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertificateRecord(
        {
          certificate: storeBackedTombstoneHeadCertificate,
          witnessRecords: unsignedTombstoneHeadWitnessRecords,
          authorityEpochSeal: sealedTombstoneHeadAuthorityTransition,
          signaturePolicy: {
            ...strictIdentityPolicy,
            pruningTombstoneHeadAuthorityTopology:
              sealedTombstoneHeadAuthorityTopology,
          },
        },
      ),
    ).rejects.toThrow(/quorum_certificate_record_signature_invalid/);
    await expect(
      storeBackedTombstoneHeadCertifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).resolves.toMatchObject({
      certified: true,
      status: "certified",
      authorityTopologyHash:
        storeBackedTombstoneHeadCertificate.authorityTopologyHash,
      quorumCertificateHash:
        storeBackedTombstoneHeadCertificate.quorumCertificateHash,
      issues: [],
    });
    const tamperedTombstoneHeadAuthorityTransition =
      buildProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
        {
          tenantId: view.tenantId,
          authoritySequence: sealedTombstoneHeadAuthorityTransitions.length + 1,
          transitionId:
            "pruning_tombstone_head_store_backed_tampered_retroactive_revoke_b",
          transitionKind: "revoke_witness",
          recordedAt: timestamp("2026-06-03T14:08:05.068Z"),
          recordedBy: "authority:pruning-tombstone-head",
          effectiveFromPruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          witnessId: "pruning-tombstone-monitor-b",
          previousAuthorityHash:
            sealedTombstoneHeadAuthorityTransitions[
              sealedTombstoneHeadAuthorityTransitions.length - 1
            ]!.authorityHash,
        },
      );
    const tamperedTombstoneHeadAuthorityReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          pruningTombstoneSequence:
            witnessedTombstoneStoreHead.pruningTombstoneSequence,
          transitions: [
            ...sealedTombstoneHeadAuthorityTransitions,
            tamperedTombstoneHeadAuthorityTransition,
          ],
        },
      );
    expect(tamperedTombstoneHeadAuthorityReplay).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_authority_retroactive_transition",
        }),
      ]),
    });
    const tamperedTombstoneHeadAuthorityStore = {
      appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition:
        async () => {
          throw new Error("not used");
        },
      listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitions:
        async () => [
          ...sealedTombstoneHeadAuthorityTransitions,
          tamperedTombstoneHeadAuthorityTransition,
        ],
    };
    const tamperedStoreBackedTombstoneHeadCertifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier(
        tamperedTombstoneHeadAuthorityStore,
        tombstoneHeadWitnessLedger,
      );
    await expect(
      tamperedStoreBackedTombstoneHeadCertifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      allowedAction: "correct_tombstone_head_witness_authority_topology",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_authority_topology_invalid",
        }),
      ]),
    });
    const incompleteTombstoneHeadAuthorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransitionStore();
    await incompleteTombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "pruning_tombstone_head_store_backed_incomplete_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:08:05.070Z"),
        recordedBy: "authority:pruning-tombstone-head",
        effectiveFromPruningTombstoneSequence: 1,
        requiredWitnesses: 2,
        minimumWitnesses: 1,
      },
    );
    await incompleteTombstoneHeadAuthorityStore.appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessAuthorityTransition(
      {
        tenantId: view.tenantId,
        transitionId: "pruning_tombstone_head_store_backed_incomplete_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:08:05.080Z"),
        recordedBy: "authority:pruning-tombstone-head",
        effectiveFromPruningTombstoneSequence: 1,
        witnessId: "pruning-tombstone-monitor",
        signatureKeyId: "key-pruning-tombstone-monitor",
        signatureAlgorithm: "test-signature-v1",
        signaturePublicKeyFingerprint: "fp:key-pruning-tombstone-monitor",
      },
    );
    const incompleteStoreBackedTombstoneHeadCertifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessQuorumCertifier(
        incompleteTombstoneHeadAuthorityStore,
        tombstoneHeadWitnessLedger,
      );
    await expect(
      incompleteStoreBackedTombstoneHeadCertifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        {
          tenantId: view.tenantId,
          head: witnessedTombstoneStoreHead,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      acceptedWitnessIds: [],
      invalidWitnessIds: [],
      requiredWitnesses: 2,
      allowedAction: "correct_tombstone_head_witness_policy",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_quorum_witness_replay_invalid",
        }),
      ]),
    });
    const futureWitnessedTombstoneStoreHeadBody = {
      tenantId: view.tenantId,
      pruningTombstoneSequence:
        witnessedTombstoneStoreHead.pruningTombstoneSequence + 1,
      pruningTombstoneRecordHash: "future_pruning_tombstone_record_hash",
      recordedAt: timestamp("2026-06-03T14:08:06.000Z"),
    };
    const futureWitnessedTombstoneStoreHead = {
      ...futureWitnessedTombstoneStoreHeadBody,
      headHash:
        computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadHash(
          futureWitnessedTombstoneStoreHeadBody,
        ),
    };
    await expect(
      tombstoneHeadWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        signedTombstoneHeadObservation(
          {
            tenantId: view.tenantId,
            observerId: "pruning-tombstone-monitor",
            observedAt: timestamp("2026-06-03T14:08:06.500Z"),
            head: futureWitnessedTombstoneStoreHead,
          },
          "key-pruning-tombstone-monitor",
        ),
      ),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      latestHead: witnessedTombstoneStoreHead,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_consistency_proof_missing",
        }),
      ]),
    });
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          requiredTombstoneStoreHead: futureWitnessedTombstoneStoreHead,
          witnessRecords: prunedWitnessRecords,
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruned_store_tombstone_store_head_stale",
        }),
      ]),
    });
    const forkedWitnessedTombstoneStoreHeadBody = {
      tenantId: witnessedTombstoneStoreHead.tenantId,
      pruningTombstoneSequence:
        witnessedTombstoneStoreHead.pruningTombstoneSequence,
      pruningTombstoneRecordHash: "forked_pruning_tombstone_record_hash",
      recordedAt: witnessedTombstoneStoreHead.recordedAt,
    };
    const forkedWitnessedTombstoneStoreHead = {
      ...forkedWitnessedTombstoneStoreHeadBody,
      headHash:
        computeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadHash(
          forkedWitnessedTombstoneStoreHeadBody,
        ),
    };
    await expect(
      tombstoneHeadWitness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHead(
        signedTombstoneHeadObservation(
          {
            tenantId: view.tenantId,
            observerId: "pruning-tombstone-monitor",
            observedAt: timestamp("2026-06-03T14:08:07.500Z"),
            head: forkedWitnessedTombstoneStoreHead,
          },
          "key-pruning-tombstone-monitor",
        ),
      ),
    ).resolves.toMatchObject({
      accepted: false,
      status: "obstructed",
      latestHead: witnessedTombstoneStoreHead,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_fork",
        }),
      ]),
    });
    const tombstoneHeadWitnessRecords =
      await tombstoneHeadWitnessLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
        },
      );
    expect(tombstoneHeadWitnessRecords).toHaveLength(4);
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: tombstoneHeadWitnessRecords,
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).toMatchObject({
      valid: true,
      latestHead: witnessedTombstoneStoreHead,
      issues: [],
    });
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPruningTombstoneStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: [
            {
              ...tombstoneHeadWitnessRecords[0]!,
              decision: {
                ...tombstoneHeadWitnessRecords[0]!.decision,
                accepted: false,
              },
            },
          ],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_ledger_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruning_tombstone_store_head_witness_ledger_decision_mismatch",
        }),
      ]),
    });
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          requiredTombstoneStoreHead: forkedWitnessedTombstoneStoreHead,
          witnessRecords: prunedWitnessRecords,
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruned_store_tombstone_store_head_fork",
        }),
      ]),
    });
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          requiredTombstoneStoreHead: {
            ...witnessedTombstoneStoreHead,
            headHash: "tampered_tombstone_store_head_hash",
          },
          witnessRecords: prunedWitnessRecords,
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruned_store_tombstone_store_head_hash_mismatch",
        }),
      ]),
    });
    expect(
      verifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessReplayCompactionPrunedStoreContinuity(
        {
          tenantId: view.tenantId,
          tombstoneRecords: [pruningTombstoneRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          witnessRecords: [],
          authorityTransitions: prunedAuthorityTransitions,
          quorumCertificateRecords: prunedQuorumCertificateRecords,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_replay_compaction_pruned_store_witness_suffix_truncated",
        }),
      ]),
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: witnessRecords.slice(1),
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_ledger_sequence_gap",
        }),
      ]),
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: witnessRecords.slice(1),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          compactionCheckpoint: checkpoint,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_ledger_compaction_checkpoint_invalid",
          path: "/compactionCheckpointAdmission",
        }),
      ]),
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: witnessRecords.slice(1),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          compactionCheckpoint: checkpoint,
          compactionCheckpointAdmission: insufficientCheckpointAdmission,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_ledger_compaction_checkpoint_invalid",
          path: "/compactionCheckpointAdmission",
        }),
      ]),
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records: witnessRecords.slice(1),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          compactionCheckpoint: checkpoint,
          compactionCheckpointAdmission: recoveredCheckpointAdmission,
        },
      ),
    ).toMatchObject({
      valid: true,
      acceptedHeads: [
        expect.objectContaining({
          settlementRecordHash: head.settlementRecordHash,
        }),
      ],
      issues: [],
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: authorityTransitions.slice(3),
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_authority_sequence_gap",
        }),
      ]),
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: authorityTransitions.slice(3),
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          compactionCheckpoint: checkpoint,
          compactionCheckpointAdmission: recoveredCheckpointAdmission,
        },
      ),
    ).toMatchObject({
      valid: true,
      principals: expect.arrayContaining([
        expect.objectContaining({
          witnessId: "head-witness-a",
          signatureKeyId: "key-a2",
        }),
      ]),
      issues: [],
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [secondCertificateRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_certificate_record_sequence_gap",
        }),
      ]),
    });

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [secondCertificateRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          compactionCheckpoint: checkpoint,
          compactionCheckpointAdmission: recoveredCheckpointAdmission,
        },
      ),
    ).toMatchObject({
      valid: true,
      latestCertifiedRecord: expect.objectContaining({
        quorumCertificateRecordHash:
          secondCertificateRecord.quorumCertificateRecordHash,
      }),
      issues: [],
    });

    const tamperedCheckpoint = {
      ...checkpoint,
      quorumCertificateRecords: {
        ...checkpoint.quorumCertificateRecords!,
        compactedThroughQuorumCertificateRecordHash:
          "tampered_certificate_record_hash",
      },
    };
    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificateRecords(
        {
          tenantId: view.tenantId,
          records: [secondCertificateRecord],
          signaturePolicy: {
            ...strictIdentityPolicy,
            authorityTopology: topologyBeforeRotation,
          },
          compactionCheckpoint: tamperedCheckpoint,
          compactionCheckpointAdmission: checkpointAdmission,
        },
      ),
    ).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_certificate_record_compaction_checkpoint_invalid",
        }),
      ]),
    });
  });

  it("obstructs store-backed settlement-head quorum when durable topology fails replay", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_store_backed_tamper",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
      headLedger,
    ).observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    const transitions = buildSettlementHeadWitnessAuthorityTransitions(view, [
      {
        transitionId: "settlement_head_quorum_store_backed_tamper_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 1,
        minimumWitnesses: 1,
      },
      {
        transitionId: "settlement_head_quorum_store_backed_tamper_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
      },
    ]);
    const tamperedAuthorityStore = {
      async appendProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransition() {
        throw new Error("not used");
      },
      async listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(input: {
        readonly tenantId: ReturnType<typeof tenantId> | string;
      }) {
        expect(String(input.tenantId)).toBe(String(view.tenantId));
        return [
          {
            ...transitions[0]!,
            requiredWitnesses: 2,
          },
          transitions[1]!,
        ];
      },
    };
    const certifier =
      new StoreBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertifier(
        tamperedAuthorityStore,
        headLedger,
      );

    await expect(
      certifier.certifyProjectionReplayCertificateStoreRootWitnessSettlementStoreHead(
        {
          tenantId: view.tenantId,
          head,
        },
      ),
    ).resolves.toMatchObject({
      certified: false,
      status: "obstructed",
      acceptedWitnessIds: [],
      allowedAction: "correct_head_witness_authority_topology",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_authority_topology_invalid",
        }),
      ]),
    });
  });

  it("does not count non-member settlement-head witnesses toward quorum", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_non_member",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-intruder",
      observedAt: timestamp("2026-06-03T14:06:02.000Z"),
      head,
    });
    const witnessReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: buildSettlementHeadWitnessAuthorityTransitions(view, [
            {
              transitionId: "settlement_head_quorum_non_member_set_quorum",
              transitionKind: "set_quorum",
              recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              requiredWitnesses: 2,
              minimumWitnesses: 1,
            },
            {
              transitionId: "settlement_head_quorum_non_member_admit_a",
              transitionKind: "admit_witness",
              recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-a",
            },
            {
              transitionId: "settlement_head_quorum_non_member_admit_b",
              transitionKind: "admit_witness",
              recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-b",
            },
          ]),
        },
      );

    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head,
          witnessReplay,
          authorityTopology,
        },
      ),
    ).toMatchObject({
      status: "witnessed",
      acceptedWitnessIds: ["head-witness-a"],
      eligibleWitnessIds: ["head-witness-a", "head-witness-b"],
      invalidWitnessIds: ["head-witness-intruder"],
      allowedAction: "collect_more_head_witnesses",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_witness_not_authorized",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_not_met",
        }),
      ]),
    });
  });

  it("does not count equivocated settlement-head witness principals toward quorum", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_equivocated",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-b",
      observedAt: timestamp("2026-06-03T14:06:02.000Z"),
      head,
    });
    const witnessReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: buildSettlementHeadWitnessAuthorityTransitions(view, [
            {
              transitionId: "settlement_head_quorum_equivocated_set_quorum",
              transitionKind: "set_quorum",
              recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              requiredWitnesses: 2,
              minimumWitnesses: 1,
            },
            {
              transitionId: "settlement_head_quorum_equivocated_admit_a",
              transitionKind: "admit_witness",
              recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-a",
            },
            {
              transitionId: "settlement_head_quorum_equivocated_admit_b",
              transitionKind: "admit_witness",
              recordedAt: timestamp("2026-06-03T14:04:02.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-b",
            },
            {
              transitionId: "settlement_head_quorum_equivocated_mark_b",
              transitionKind: "mark_equivocated",
              recordedAt: timestamp("2026-06-03T14:04:03.000Z"),
              recordedBy: "authority:settlement-head-witness",
              effectiveFromSettlementSequence: 1,
              witnessId: "head-witness-b",
              reason: "conflicting settlement-head observation",
            },
          ]),
        },
      );
    expect(authorityTopology.principals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          witnessId: "head-witness-b",
          status: "equivocated",
        }),
      ]),
    );

    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head,
          witnessReplay,
          authorityTopology,
        },
      ),
    ).toMatchObject({
      status: "witnessed",
      acceptedWitnessIds: ["head-witness-a"],
      eligibleWitnessIds: ["head-witness-a"],
      invalidWitnessIds: ["head-witness-b"],
      allowedAction: "collect_more_head_witnesses",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_witness_not_authorized",
        }),
      ]),
    });
  });

  it("obstructs settlement-head quorum certificates when head-witness topology does not replay", async () => {
    const view = baseView();
    const { head } = await buildSettlementHeadFixture(
      view,
      "settlement_head_quorum_tampered_topology",
    );
    const headLedger =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessLedger();
    const witness =
      new LedgerBackedProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitness(
        headLedger,
      );
    await witness.observeProjectionReplayCertificateStoreRootWitnessSettlementStoreHead({
      tenantId: view.tenantId,
      observerId: "head-witness-a",
      observedAt: timestamp("2026-06-03T14:06:01.000Z"),
      head,
    });
    const witnessReplay =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
        {
          tenantId: view.tenantId,
          records:
            await headLedger.listProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessRecords(
              {
                tenantId: view.tenantId,
              },
            ),
        },
      );
    const transitions = buildSettlementHeadWitnessAuthorityTransitions(view, [
      {
        transitionId: "settlement_head_quorum_tampered_set_quorum",
        transitionKind: "set_quorum",
        recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        requiredWitnesses: 1,
        minimumWitnesses: 1,
      },
      {
        transitionId: "settlement_head_quorum_tampered_admit_a",
        transitionKind: "admit_witness",
        recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
        recordedBy: "authority:settlement-head-witness",
        effectiveFromSettlementSequence: 1,
        witnessId: "head-witness-a",
      },
    ]);
    const tamperedTopology =
      replayProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessAuthorityTransitions(
        {
          tenantId: view.tenantId,
          settlementSequence: head.settlementSequence,
          transitions: [
            {
              ...transitions[0]!,
              requiredWitnesses: 2,
            },
            transitions[1]!,
          ],
        },
      );
    expect(tamperedTopology.valid).toBe(false);

    expect(
      evaluateProjectionReplayCertificateStoreRootWitnessSettlementStoreHeadWitnessQuorumCertificate(
        {
          tenantId: view.tenantId,
          head,
          witnessReplay,
          authorityTopology: tamperedTopology,
        },
      ),
    ).toMatchObject({
      status: "obstructed",
      acceptedWitnessIds: [],
      allowedAction: "correct_head_witness_authority_topology",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_store_head_witness_quorum_authority_topology_invalid",
        }),
      ]),
    });
  });

  it("rejects tampered durable witness authority transitions during replay", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_authority_store_tamper",
      eventId: "evt_authority_store_tamper",
      sequence: 42,
      contentHash: "sha256:authority-store-tamper",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });

    const authorityStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessAuthorityTransitionStore();
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessAuthorityTransition({
      tenantId: view.tenantId,
      transitionId: "witness_authority_store_tamper_quorum",
      transitionKind: "set_quorum",
      recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
      recordedBy: "authority:replay-root-settlement",
      effectiveFromRootSequence: 1,
      requiredWitnesses: 1,
      minimumWitnesses: 1,
    });
    await authorityStore.appendProjectionReplayCertificateStoreRootWitnessAuthorityTransition({
      tenantId: view.tenantId,
      transitionId: "witness_authority_store_tamper_admit_a",
      transitionKind: "admit_witness",
      recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
      recordedBy: "authority:replay-root-settlement",
      effectiveFromRootSequence: 1,
      witnessId: "witness-a",
    });
    const transitions =
      await authorityStore.listProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
      });
    const tamperedTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: [
          {
            ...transitions[0]!,
            requiredWitnesses: 2,
          },
          transitions[1]!,
        ],
      });

    expect(tamperedTopology).toMatchObject({
      valid: false,
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_authority_hash_mismatch",
        }),
      ]),
    });

    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology: tamperedTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records: await ledger.listProjectionReplayCertificateStoreRootWitnessRecords({
                tenantId: view.tenantId,
              }),
            }),
          },
        ],
      });

    expect(settlement).toMatchObject({
      status: "obstructed",
      acceptedWitnessIds: [],
      invalidWitnessIds: ["witness-a"],
      allowedAction: "correct_authority_topology",
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_settlement_authority_topology_invalid",
        }),
      ]),
    });
  });

  it("rejects tampered durable settlement records during replay", async () => {
    const view = baseView();
    const store = new InMemoryProjectionReplayCertificateStore();
    const { root } = await recordReplayRoot(store, view, {
      certificateId: "projection_replay_settlement_store_tamper",
      eventId: "evt_settlement_store_tamper",
      sequence: 42,
      contentHash: "sha256:settlement-store-tamper",
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      recordedAt: timestamp("2026-06-03T14:05:31.000Z"),
    });
    const ledger = new InMemoryProjectionReplayCertificateStoreRootWitnessLedger();
    await new LedgerBackedProjectionReplayCertificateStoreRootWitness(
      ledger,
    ).observeProjectionReplayCertificateStoreRoot({
      tenantId: view.tenantId,
      observerId: "agent:witness-a",
      observedAt: timestamp("2026-06-03T14:05:32.000Z"),
      root,
    });
    const authorityTopology =
      replayProjectionReplayCertificateStoreRootWitnessAuthorityTransitions({
        tenantId: view.tenantId,
        rootSequence: root.sequence,
        transitions: buildWitnessAuthorityTransitions(view, [
          {
            transitionId: "witness_authority_settlement_store_tamper_quorum",
            transitionKind: "set_quorum",
            recordedAt: timestamp("2026-06-03T14:04:00.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            requiredWitnesses: 1,
            minimumWitnesses: 1,
          },
          {
            transitionId: "witness_authority_settlement_store_tamper_admit_a",
            transitionKind: "admit_witness",
            recordedAt: timestamp("2026-06-03T14:04:01.000Z"),
            recordedBy: "authority:replay-root-settlement",
            effectiveFromRootSequence: 1,
            witnessId: "witness-a",
          },
        ]),
      });
    const settlement =
      evaluateProjectionReplayCertificateStoreRootWitnessSettlement({
        tenantId: view.tenantId,
        root,
        authorityTopology,
        witnessLedgers: [
          {
            witnessId: "witness-a",
            replay: replayProjectionReplayCertificateStoreRootWitnessRecords({
              tenantId: view.tenantId,
              records: await ledger.listProjectionReplayCertificateStoreRootWitnessRecords({
                tenantId: view.tenantId,
              }),
            }),
          },
        ],
      });
    expect(settlement.status).toBe("settled");

    const settlementStore =
      new InMemoryProjectionReplayCertificateStoreRootWitnessSettlementStore();
    await settlementStore.appendProjectionReplayCertificateStoreRootWitnessSettlementRecord({
      settlement,
      recordedAt: timestamp("2026-06-03T14:06:00.000Z"),
    });
    const records =
      await settlementStore.listProjectionReplayCertificateStoreRootWitnessSettlementRecords({
        tenantId: view.tenantId,
      });
    const tamperedSettlementRecords = [
      {
        ...records[0]!,
        settlement: {
          ...records[0]!.settlement,
          status: "provisional" as const,
          acceptedWitnessIds: [],
        },
      },
    ];

    expect(
      replayProjectionReplayCertificateStoreRootWitnessSettlementRecords({
        tenantId: view.tenantId,
        records: tamperedSettlementRecords,
      }),
    ).toMatchObject({
      valid: false,
      settledRoots: [],
      issues: expect.arrayContaining([
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_record_settlement_hash_mismatch",
        }),
        expect.objectContaining({
          code: "projection_replay_certificate_store_root_witness_settlement_record_hash_mismatch",
        }),
      ]),
    });
  });

  it("refuses durable admission for replay certificates without hash-bound projection identity", () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificate(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      replayedBy: "projection:legacy",
      replayedToPosition: 3,
      transitionRefs: [
        { ref: signalRef, sequence: 1, contentHash: "sha256:signal" },
        { ref: riskRef, sequence: 2, contentHash: "sha256:risk" },
        { ref: decisionRef, sequence: 3, contentHash: "sha256:decision" },
      ],
    });

    expect(() =>
      buildProjectionReplayCertificateRecord({ certificate: replayCertificate }),
    ).toThrow(/requires projectionName before durable admission/);
    expect(() =>
      buildProjectionReplayCertificateRef(replayCertificate, {
        checkedAt: timestamp("2026-06-03T14:05:30.000Z"),
      }),
    ).toThrow(/cannot form a write ref without projectionName/);
  });

  it("refuses to mint a replay certificate from a mismatched frontier", () => {
    const view = baseView();

    expect(() =>
      buildProjectionReplayCertificateFromFrontier(view, {
        replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
        frontier: {
          tenantId: tenantId("tenant_other"),
          projectionName: "arrowhedge/current-state",
          projectionVersion: view.projectionVersion ?? 0,
          replayedToPosition: 1,
          transitionEvents: [
            {
              eventId: "evt_other",
              sequence: 1,
              contentHash: "sha256:other",
            },
          ],
        },
      }),
    ).toThrow(/does not match current state view tenant/);

    expect(() =>
      buildProjectionReplayCertificateFromFrontier(view, {
        replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
        frontier: {
          tenantId: view.tenantId,
          projectionName: "arrowhedge/current-state",
          projectionVersion: (view.projectionVersion ?? 0) + 1,
          replayedToPosition: 1,
          transitionEvents: [
            {
              eventId: "evt_wrong_version",
              sequence: 1,
              contentHash: "sha256:wrong-version",
            },
          ],
        },
      }),
    ).toThrow(/does not match current state view version/);
  });

  it("rejects a replay certificate when the current view changes after certification", () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificate(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      replayedBy: "projection:arrowhedge_cop",
      replayedToPosition: 3,
      transitionRefs: [
        { ref: signalRef, sequence: 1, contentHash: "sha256:signal" },
        { ref: riskRef, sequence: 2, contentHash: "sha256:risk" },
        { ref: decisionRef, sequence: 3, contentHash: "sha256:decision" },
      ],
    });
    const tamperedView = baseView({
      sourceRefs: [signalRef, decisionRef],
      replayCertificate,
    });

    expect(
      evaluateProjectionReplayCertificate(tamperedView).issues.map(
        (issue) => issue.code,
      ),
    ).toEqual(
      expect.arrayContaining([
        "projection_replay_source_refs_mismatch",
        "projection_replay_projection_hash_mismatch",
      ]),
    );
  });

  it("rejects a hash-valid replay certificate that omits the projection version", () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificate(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      replayedBy: "projection:arrowhedge_cop",
      replayedToPosition: 3,
      transitionRefs: [
        { ref: signalRef, sequence: 1, contentHash: "sha256:signal" },
        { ref: riskRef, sequence: 2, contentHash: "sha256:risk" },
        { ref: decisionRef, sequence: 3, contentHash: "sha256:decision" },
      ],
    });
    const {
      certificateHash: _certificateHash,
      projectionVersion: _projectionVersion,
      ...payloadWithoutVersion
    } = replayCertificate;
    const missingVersionCertificate = {
      ...payloadWithoutVersion,
      certificateHash:
        computeProjectionReplayCertificateHash(payloadWithoutVersion),
    };

    expect(
      verifyProjectionReplayCertificateHash(missingVersionCertificate).valid,
    ).toBe(true);
    expect(
      evaluateProjectionReplayCertificate({
        ...view,
        replayCertificate: missingVersionCertificate,
      }).issues.map((issue) => issue.code),
    ).toEqual(expect.arrayContaining(["projection_replay_version_mismatch"]));
  });

  it("refuses private representations as replay transitions", () => {
    const view = baseView();
    const replayCertificate = buildProjectionReplayCertificate(view, {
      replayedAt: timestamp("2026-06-03T14:05:00.000Z"),
      replayedBy: "agent:portfolio-manager-memory",
      replayedToPosition: 0,
      transitionRefs: [
        {
          ref: stateRef("document", "chat-summary-private-memory"),
          sequence: 1,
        },
      ],
    });
    const replayedView = { ...view, replayCertificate };

    expect(
      evaluateProjectionReplayCertificate(replayedView, {
        minimumReplayPosition: 3,
        requireTransitionContentHash: true,
      }).issues.map((issue) => issue.code),
    ).toEqual(
      expect.arrayContaining([
        "projection_replay_transition_kind_invalid",
        "projection_replay_transition_hash_missing",
        "projection_replay_position_regression",
      ]),
    );
  });

  it("recommends would-block policy decisions for high-consequence invariant classes without changing advisory review defaults", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    const policy = evaluateStateReviewInvariantPolicy(
      ["freshness_window", "source_authority"],
      "high",
    );

    expect(review.execution).toMatchObject({
      allowed: true,
      blocking: false,
      enforcementMode: "advisory",
      reason: "advisory_warn_first_v1",
    });
    expect(policy).toEqual({
      consequence: "high",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["freshness_window", "source_authority"],
      advisoryInvariantClasses: [],
      decisions: [
        {
          invariantClass: "freshness_window",
          consequence: "high",
          decision: "blocking",
        },
        {
          invariantClass: "source_authority",
          consequence: "high",
          decision: "blocking",
        },
      ],
    });
  });

  it("keeps lower-consequence policy recommendations advisory unless the matrix says otherwise", () => {
    expect(
      evaluateStateReviewInvariantPolicy(
        ["freshness_window", "projection_version"],
        "low",
      ),
    ).toMatchObject({
      consequence: "low",
      wouldBlock: false,
      wouldBlockInvariantClasses: [],
      advisoryInvariantClasses: ["freshness_window", "projection_version"],
    });

    expect(
      evaluateStateReviewInvariantPolicy(
        ["freshness_window", "source_authority"],
        "medium",
      ),
    ).toMatchObject({
      consequence: "medium",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["source_authority"],
      advisoryInvariantClasses: ["freshness_window"],
    });

    expect(
      evaluateStateReviewInvariantPolicy(["freshness_window"], "low", {
        freshness_window: {
          low: "blocking",
        },
      }),
    ).toMatchObject({
      consequence: "low",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["freshness_window"],
      advisoryInvariantClasses: [],
    });

    expect(
      evaluateStateReviewInvariantPolicy(
        ["freshness_window", "tenant_boundary"],
        "high",
        {
          freshness_window: {
            high: "advisory",
          },
        },
      ),
    ).toMatchObject({
      consequence: "high",
      wouldBlock: true,
      wouldBlockInvariantClasses: ["tenant_boundary"],
      advisoryInvariantClasses: ["freshness_window"],
    });
  });

  it("reviews an action against the original observation contract instead of the current view", () => {
    const originalView = baseView();
    const originalContract =
      buildObservationContractFromCurrentStateView(originalView);
    const changedView = baseView({
      projectionVersion: 2,
      workflowPosition: "blocked_stale_state",
      sourceRefs: [signalRef, decisionRef],
      missingSources: ["risk_state"],
      conflicts: [
        {
          conflictType: "state_disagreement",
          refs: [riskRef, decisionRef],
          message: "risk snapshot no longer matches",
        },
      ],
    });

    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(originalView, {
        observationContract: originalContract,
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      changedView,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        observationContract: originalContract,
      },
    );

    expect(review.observationContract).toEqual(originalContract);
    expect(review.valid).toBe(false);
    expect(review.execution).toMatchObject({
      allowed: true,
      blocking: false,
      enforcementMode: "advisory",
      reason: "advisory_warn_first_v1",
    });
    expect(
      review.observationEvaluation.assertions
        .filter((assertion) => !assertion.passed)
        .map((assertion) => assertion.code),
    ).toEqual([
      "required_source_refs_present",
      "freshness_window_current",
      "projection_version_matches",
      "workflow_position_matches",
      "conflicts_declared",
      "missing_sources_declared",
    ]);
    expect(review.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "current_view_conflict",
        "missing_read_ref",
        "stale_read_ref",
        "projection_version_mismatch",
        "workflow_position_mismatch",
        "required_source_refs_present",
        "freshness_window_current",
      ]),
    );
  });

  it("turns proposal reviews into provenance-linked state-review artifacts", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );

    const artifact = buildStateReviewArtifact(review, {
      artifactId: "artifact_arrowhedge_review_001",
      source: "evals/arrowhedge",
      traceContext: {
        traceparent:
          "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
        spanId: "00f067aa0ba902b7",
      },
      relatedObjects: [
        {
          role: "portfolio_decision",
          ref: stateRef("source_record", "decision:dec_aapl_buy_120"),
        },
      ],
      planId: "portfolio-decision-review-v1",
      actedOnBehalfOf: "tenant:tnt_agent_state",
    });

    expect(artifact).toMatchObject({
      schemaVersion: "state-review-artifact.v1",
      artifactId: "artifact_arrowhedge_review_001",
      eventEnvelope: {
        id: "artifact_arrowhedge_review_001",
        source: "evals/arrowhedge",
        type: "pm.agent_state.action_proposal_reviewed.v1",
        specversion: "1.0",
        subject: "projection:arrowhedge_cop:AAPL",
      },
      provenance: {
        generatedBy: "view_aapl:portfolio.decision.accept:proposal_review",
        associatedAgent: "agent:portfolio-manager",
        actedOnBehalfOf: "tenant:tnt_agent_state",
        planId: "portfolio-decision-review-v1",
      },
    });
    expect(artifact.relatedObjects.map((object) => object.role)).toEqual(
      expect.arrayContaining([
        "primary_subject",
        "action_subject",
        "source_ref",
        "read_set_ref",
        "warning:stale_read_ref",
        "warning:freshness_window_current",
        "portfolio_decision",
      ]),
    );
    expect(artifact.provenance.used).toEqual(
      expect.arrayContaining([view.subject, signalRef, riskRef, decisionRef]),
    );
    expect(artifact.artifactHash).toHaveLength(64);
    expect(verifyStateReviewArtifactHash(artifact).valid).toBe(true);
  });

  it("serializes and imports state-review artifacts with stable replay metadata", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
    );
    const artifact = buildStateReviewArtifact(review, {
      artifactId: "artifact_arrowhedge_json_001",
      metadata: {
        scenarioId: "arrowhedge-distribution-currentness-mismatch",
        fixtureId: "fixtures/arrowhedge/state-review-artifacts/aapl-stale.json",
        clientSurface: "codex",
        provider: "openai",
        sessionId: "session_arrowhedge_001",
        observedReadSet: [
          {
            ref: signalRef,
            observedAt: timestamp("2026-06-03T13:59:00.000Z"),
            validUntil: timestamp("2026-06-03T14:01:00.000Z"),
            authority: "arrowhedge:paper_quote:latest",
            projectionVersion: 0,
            workflowPosition: "risk_refresh_pending",
            tool: "arrowhedge.quote.read",
            source: "broker_snapshot",
          },
        ],
        observedReadSetComparison: compareObservedReadSetToDeclared(
          [],
          [],
          view,
          review.proposedAction.proposedAt,
        ),
      },
    });

    expect(artifact.metadata).toEqual({
      temporalMisalignmentPhase: "observation_to_action",
      invariantClasses: ["freshness_window"],
      scenarioId: "arrowhedge-distribution-currentness-mismatch",
      fixtureId: "fixtures/arrowhedge/state-review-artifacts/aapl-stale.json",
      clientSurface: "codex",
      provider: "openai",
      sessionId: "session_arrowhedge_001",
      observedReadSet: [
        {
          ref: signalRef,
          observedAt: "2026-06-03T13:59:00.000Z",
          validUntil: "2026-06-03T14:01:00.000Z",
          authority: "arrowhedge:paper_quote:latest",
          projectionVersion: 0,
          workflowPosition: "risk_refresh_pending",
          tool: "arrowhedge.quote.read",
          source: "broker_snapshot",
        },
      ],
      observedReadSetComparison: expect.objectContaining({
        valid: false,
        mode: "warn",
        issues: expect.arrayContaining([
          expect.objectContaining({
            code: "declared_but_unobserved",
            path: "/declaredReadSet/1/ref",
          }),
          expect.objectContaining({
            code: "stale_observed_read",
            path: "/observedReadSet/0/validUntil",
          }),
        ]),
      }),
    });

    const json = serializeStateReviewArtifact(artifact);
    const imported = importStateReviewArtifact(json);

    expect(json).toBe(serializeStateReviewArtifact(artifact));
    expect(imported).toMatchObject({
      valid: true,
      issues: [],
      hashValidation: {
        valid: true,
        actualHash: artifact.artifactHash,
        expectedHash: artifact.artifactHash,
      },
    });
    expect(imported.artifact).toEqual(artifact);
  });

  it("imports JSONL artifact corpora and reports tampered hashes without hiding the artifact", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
      { artifactId: "artifact_arrowhedge_jsonl_001" },
    );
    const tampered = {
      ...artifact,
      artifactId: "artifact_arrowhedge_jsonl_002",
      review: {
        ...artifact.review,
        valid: false,
      },
    };

    const imported = importStateReviewArtifactsJsonl(
      serializeStateReviewArtifactsJsonl([artifact, tampered]),
    );

    expect(imported[0]).toMatchObject({
      valid: true,
      issues: [],
      artifact: {
        artifactId: "artifact_arrowhedge_jsonl_001",
      },
    });
    expect(imported[1]).toMatchObject({
      valid: false,
      issues: [
        {
          path: "/artifactHash",
          message: "artifact hash mismatch during replay verification",
        },
      ],
      artifact: {
        artifactId: "artifact_arrowhedge_jsonl_002",
      },
    });
  });

  it("rejects malformed nested artifact shape even when the canonical hash matches", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    );
    const malformedPayload = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        invariantClasses: "freshness_window",
      },
      review: {
        ...artifact.review,
        observationEvaluation: {
          ...artifact.review.observationEvaluation,
          assertions: [{ code: "freshness_window_current", passed: false, severity: "warn" }],
        },
        warnings: [{ source: "read_set", code: "stale_read_ref", severity: "warn" }],
      },
    };
    const { artifactHash: _artifactHash, ...hashPayload } = malformedPayload;
    const malformed = {
      ...malformedPayload,
      artifactHash: computeStateReviewArtifactHash(hashPayload),
    };

    expect(importStateReviewArtifact(malformed)).toMatchObject({
      valid: false,
      hashValidation: {
        valid: true,
      },
      issues: expect.arrayContaining([
        {
          path: "/metadata/invariantClasses",
          message: "expected array",
        },
        {
          path: "/review/observationEvaluation/assertions/0/message",
          message: "expected non-empty string",
        },
        {
          path: "/review/observationEvaluation/assertions/0/refs",
          message: "expected array",
        },
        {
          path: "/review/warnings/0/message",
          message: "expected non-empty string",
        },
        {
          path: "/review/warnings/0/refs",
          message: "expected array",
        },
      ]),
    });
  });

  it("rejects malformed observed read-set issue metadata even when replay hash matches", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    );
    const malformedPayload = {
      ...artifact,
      metadata: {
        ...artifact.metadata,
        observedReadSetComparison: {
          valid: false,
          mode: "warn",
          declaredReadSet: artifact.review.proposedAction.readSet,
          observedReadSet: [],
          issues: [
            {
              code: "declared_but_unobserved",
              path: "/declaredReadSet/0/ref",
              message: "declared ref was not observed",
              declaredIndex: "0",
              observedIndex: -1,
              ref: { kind: "", id: "evt_signal" },
            },
          ],
        },
      },
    };
    const { artifactHash: _artifactHash, ...hashPayload } = malformedPayload;
    const malformed = {
      ...malformedPayload,
      artifactHash: computeStateReviewArtifactHash(hashPayload),
    };

    expect(importStateReviewArtifact(malformed)).toMatchObject({
      valid: false,
      hashValidation: {
        valid: true,
      },
      issues: expect.arrayContaining([
        {
          path: "/metadata/observedReadSetComparison/issues/0/declaredIndex",
          message: "expected non-negative integer",
        },
        {
          path: "/metadata/observedReadSetComparison/issues/0/observedIndex",
          message: "expected non-negative integer",
        },
        {
          path: "/metadata/observedReadSetComparison/issues/0/ref/kind",
          message: "expected non-empty string",
        },
      ]),
    });
  });

  it("turns a state-review artifact into an evidence-linked continuity payload", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(
        actionFrom(view, {
          proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
        }),
        view,
      ),
      { artifactId: "artifact_arrowhedge_continuity_001" },
    );

    expect(
      buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact(artifact, {
        supersedes: ["checkpoint_arrowhedge_previous"],
        contradictedBy: ["evt_risk_refresh_002"],
      }),
    ).toEqual({
      sourceRefs: [signalRef, riskRef, decisionRef],
      validUntil: "2026-06-03T14:10:00.000Z",
      supersedes: ["checkpoint_arrowhedge_previous"],
      contradictedBy: ["evt_risk_refresh_002"],
      authorityRule: "arrowhedge:backtest:bt_aapl_breakout",
      currentStateViewId: "view_aapl",
      stateReviewArtifactId: "artifact_arrowhedge_continuity_001",
      stateReviewArtifactHash: artifact.artifactHash,
      reviewId: "view_aapl:portfolio.decision.accept:proposal_review",
      observationContractId: "view_aapl:observation_contract",
      valid: false,
      warningCodes: ["stale_read_ref", "freshness_window_current"],
    });
  });

  it("detects tampered state-review artifacts during replay verification", () => {
    const view = baseView();
    const artifact = buildStateReviewArtifact(
      reviewProposedActionAgainstCurrentState(actionFrom(view), view),
    );
    const tampered = {
      ...artifact,
      review: {
        ...artifact.review,
        valid: false,
      },
    };

    expect(verifyStateReviewArtifactHash(tampered)).toMatchObject({
      valid: false,
      actualHash: artifact.artifactHash,
    });
  });

  it("admits exactly one hash-valid terminal outcome per stable action id", () => {
    const accepted = actionOutcomeEnvelope();
    const duplicate = { ...accepted };
    const blocked = actionOutcomeEnvelope({
      requestedTerminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "status_check",
          code: "risk_snapshot_stale",
          message: "Risk snapshot changed before acceptance.",
          refs: [riskRef],
          invariantClasses: ["freshness_window"],
        },
      ],
    });

    expect(admitActionOutcomeEnvelope([], accepted)).toMatchObject({
      accepted: true,
      reason: "first_terminal_outcome",
      candidateHashValidation: { valid: true },
    });
    expect(admitActionOutcomeEnvelope([accepted], duplicate)).toMatchObject({
      accepted: true,
      reason: "idempotent_duplicate",
      candidateHashValidation: { valid: true },
      incumbentHashValidation: { valid: true },
    });
    expect(admitActionOutcomeEnvelope([accepted], blocked)).toMatchObject({
      accepted: false,
      reason: "terminal_outcome_conflict",
      candidate: { terminalOutcome: "blocked" },
      incumbent: { terminalOutcome: "accepted" },
      candidateHashValidation: { valid: true },
      incumbentHashValidation: { valid: true },
    });
  });

  it("rejects tampered terminal outcome envelopes before admission", () => {
    const envelope = actionOutcomeEnvelope();
    const tampered = {
      ...envelope,
      terminalOutcome: "blocked" as const,
    };

    expect(verifyActionOutcomeEnvelopeHash(tampered)).toMatchObject({
      valid: false,
      actualHash: envelope.outcomeHash,
    });
    expect(admitActionOutcomeEnvelope([], tampered)).toMatchObject({
      accepted: false,
      reason: "candidate_hash_invalid",
      candidateHashValidation: { valid: false },
    });
  });

  it("builds a terminal outcome index with replay counts and conflict issues", () => {
    const accepted = actionOutcomeEnvelope();
    const duplicate = { ...accepted };
    const conflict = actionOutcomeEnvelope({
      requestedTerminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "policy",
          code: "approval_revoked",
          message: "The approving authority revoked the action.",
          refs: [decisionRef],
          invariantClasses: ["workflow_position"],
        },
      ],
    });
    const invalid = {
      ...actionOutcomeEnvelope({ actionId: "action:invalid_hash" }),
      outcomeHash: "bad_hash",
    };

    const index = buildActionOutcomeTerminalIndex([
      accepted,
      duplicate,
      conflict,
      invalid,
    ]);

    expect(index.valid).toBe(false);
    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({
      key: "tnt_agent_state:action:dec_aapl_buy_120:accept",
      replayCount: 2,
      envelope: {
        terminalOutcome: "accepted",
      },
    });
    expect(index.issues.map((issue) => issue.code)).toEqual([
      "terminal_outcome_conflict",
      "candidate_hash_invalid",
    ]);
  });

  it("keeps stale blocking reviews from becoming accepted terminal outcomes", () => {
    const view = baseView();
    const review = reviewProposedActionAgainstCurrentState(
      actionFrom(view, {
        proposedAt: timestamp("2026-06-03T14:11:00.000Z"),
      }),
      view,
      {
        evaluatedAt: timestamp("2026-06-03T14:11:00.000Z"),
        enforcementMode: "blocking",
      },
    );

    const envelope = actionOutcomeEnvelope({
      proposalReviewId: review.reviewId,
      proposalReview: review,
      requestedTerminalOutcome: "accepted",
    });

    expect(envelope).toMatchObject({
      terminalOutcome: "blocked",
      blockingCauses: [
        {
          source: "proposal_review",
          code: "proposal_review_blocking_policy",
        },
      ],
    });
    expect(verifyActionOutcomeEnvelopeHash(envelope).valid).toBe(true);
  });
});
