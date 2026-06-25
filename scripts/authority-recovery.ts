import {
  auditEvalEventsGraphWriteAuthority,
  buildStrictThreeAxisProofPacket,
  buildThreeAxisProofPacket,
  type EvalEvent,
  type EvalGraphWriteAuthorityResolver,
  type EvalGraphWriteAuthorityRecoverySuite,
  type PostgresEvalEventStore,
  type ThreeAxisProofPacket,
  type ThreeAxisProofPacketSource,
} from "../packages/evals/src/index.js";
import {
  graphWriteAuthorityResolverFromWorkflowEnvelopeStore,
} from "../packages/capability-kit/src/index.js";
import type { GraphWriteAuthorityPolicy } from "../packages/graph/src/index.js";

const STRICT_GRAPH_AUTHORITY_POLICY = {
  requireAuthorityRef: true,
  requireProviderCertificateStatusRef: true,
  requireSubstrateRecord: true,
} as const satisfies GraphWriteAuthorityPolicy;

export async function auditPersistedEvalEventAuthority(
  store: PostgresEvalEventStore,
  events: readonly EvalEvent[],
) {
  return auditEvalEventsGraphWriteAuthority({
    events,
    store,
    resolveAcceptedAuthority: authorityResolverFromStore(store),
    policy: STRICT_GRAPH_AUTHORITY_POLICY,
  });
}

export function buildStrictRunnerProofPacket(input: {
  readonly packetId?: string;
  readonly generatedAt: ThreeAxisProofPacket["generatedAt"];
  readonly events: readonly EvalEvent[];
  readonly sources: readonly ThreeAxisProofPacketSource[];
  readonly authorityRecoverySuite?: EvalGraphWriteAuthorityRecoverySuite;
}): ThreeAxisProofPacket {
  if (input.authorityRecoverySuite !== undefined) {
    return buildStrictThreeAxisProofPacket({
      ...(input.packetId !== undefined ? { packetId: input.packetId } : {}),
      generatedAt: input.generatedAt,
      events: input.events,
      sources: input.sources,
      authorityRecoverySuite: input.authorityRecoverySuite,
    });
  }

  return buildThreeAxisProofPacket({
    ...(input.packetId !== undefined ? { packetId: input.packetId } : {}),
    generatedAt: input.generatedAt,
    events: input.events,
    sources: input.sources,
    authorityRecoveries: [],
    requireAuthorityRecovery: true,
  });
}

export function summarizeThreeAxisProofPacket(packet: ThreeAxisProofPacket) {
  return {
    packetId: packet.packetId,
    status: packet.status,
    eventCount: packet.eventCount,
    verifiedAxes: packet.verifiedAxes,
    blockedAxes: packet.blockedAxes,
    unverifiedAxes: packet.unverifiedAxes,
    verifiedCells: packet.verifiedCells.length,
    terminalProofBackedScenarioPassCells:
      packet.terminalProofBackedScenarioPassCells.length,
    blockedCells: packet.blockedCells.length,
    missingCells: packet.missingCells.length,
    unverifiedCells: packet.unverifiedCells.length,
    authorityRecoveryGate: packet.authorityRecoveryGate,
  };
}

function authorityResolverFromStore(
  store: PostgresEvalEventStore,
): EvalGraphWriteAuthorityResolver {
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
      targetId: "ent_eval_authority_recovery" as never,
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
