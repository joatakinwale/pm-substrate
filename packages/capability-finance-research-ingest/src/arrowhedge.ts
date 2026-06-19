import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  applyEdgeMapping,
  planEntityIngestion,
  type EntityIngestionPlan,
  type EntityIngestionPlanItem,
  type EntityMapping,
  type MappingEdgeInput,
  type MappingEventInput,
  type SourceEntityRecord,
} from "@pm/entity-mapping";
import {
  buildObservationContractFromCurrentStateView,
  buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact,
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  evaluateObservationContract,
  importStateReviewArtifactsJsonl,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifactsJsonl,
  stateRef,
  type ActionProposalReviewEnforcementMode,
  type ActionProposalReview,
  type AllowedAction,
  type CurrentStateView,
  type ObservationContract,
  type ObservationContractEvaluation,
  type ReadSetEntry,
  type StateReviewArtifact,
  type StateReviewArtifactContinuityPayload,
  type StateReviewArtifactOptions,
  type StateConflict,
  type StateRef,
  verifyStateReviewArtifactHash,
} from "@pm/agent-state";
import type {
  EntityId,
  PMEvent,
  ProfileDefinition,
  TenantId,
  Timestamp,
} from "@pm/types";

import { FINANCE_RESEARCH_EVENT_TYPES } from "./capability.js";

export const ARROWHEDGE_ENTITY_MAPPING: EntityMapping = {
  profile: "finance-research",
  mappingVersion: 1,
  entities: {
    BacktestRunSource: {
      tier1: "Engagement",
      concrete: "BacktestRun",
      identityFields: ["title", "scopeStart", "scopeEnd", "state", "datasetRef", "seed"],
      schemaVersion: 1,
      edges: {
        researchRun: {
          target: "ResearchRunSource",
          type: "finance-research/backtest_has_research_run",
          cardinality: "many",
        },
      },
    },
    ResearchRunSource: {
      tier1: "Engagement",
      concrete: "ResearchRun",
      identityFields: ["title", "scopeStart", "scopeEnd", "state"],
      optionalFields: ["strategy", "modelLock", "seed"],
      schemaVersion: 1,
      edges: {
        ticker: {
          target: "TickerSource",
          type: "finance-research/research_run_tracks_ticker",
          cardinality: "many",
        },
        signal: {
          target: "AnalystSignalSource",
          type: "finance-research/research_run_has_signal",
          cardinality: "many",
        },
        riskState: {
          target: "RiskStateSource",
          type: "finance-research/research_run_has_risk_state",
          cardinality: "many",
        },
        portfolioState: {
          target: "PortfolioStateSource",
          type: "finance-research/research_run_has_portfolio_state",
          cardinality: "many",
        },
        decision: {
          target: "PortfolioDecisionSource",
          type: "finance-research/research_run_has_decision",
          cardinality: "many",
        },
      },
    },
    TickerSource: {
      tier1: "Resource",
      concrete: "Ticker",
      identityFields: ["name", "kind", "symbol", "assetClass", "currency"],
      optionalFields: ["exchange", "externalRef"],
      schemaVersion: 1,
    },
    EvidenceDocumentSource: {
      tier1: "Document",
      concrete: "EvidenceDocument",
      identityFields: ["sha256", "mimeType", "filename"],
      optionalFields: ["sourceUri", "retrievedAt", "freshnessExpiresAt"],
      schemaVersion: 1,
    },
    PortfolioStateSource: {
      tier1: "Resource",
      concrete: "PortfolioState",
      identityFields: ["name", "kind", "cash", "equity", "marginRequirement", "marginUsed"],
      optionalFields: ["sourceSnapshotId"],
      schemaVersion: 1,
    },
    AnalystSignalSource: {
      tier1: "Event",
      concrete: "AnalystSignal",
      identityFields: ["kind", "occurredAt", "agentId", "signal", "confidence"],
      optionalFields: ["evidenceWindowStart", "evidenceWindowEnd", "sourceSnapshotId"],
      schemaVersion: 1,
      edges: {
        ticker: {
          target: "TickerSource",
          type: "finance-research/signal_for_ticker",
          cardinality: "exactly_one",
        },
        evidence: {
          target: "EvidenceDocumentSource",
          type: "finance-research/signal_supported_by_evidence",
          cardinality: "many",
        },
      },
    },
    RiskStateSource: {
      tier1: "Event",
      concrete: "RiskState",
      identityFields: [
        "kind",
        "occurredAt",
        "currentPrice",
        "remainingPositionLimit",
        "maxShares",
      ],
      optionalFields: ["volatility", "bindingConstraint", "sourceSnapshotId"],
      schemaVersion: 1,
      edges: {
        ticker: {
          target: "TickerSource",
          type: "finance-research/risk_state_for_ticker",
          cardinality: "exactly_one",
        },
        evidence: {
          target: "EvidenceDocumentSource",
          type: "finance-research/risk_state_supported_by_evidence",
          cardinality: "many",
        },
      },
    },
    PortfolioDecisionSource: {
      tier1: "Event",
      concrete: "PortfolioDecision",
      identityFields: [
        "kind",
        "occurredAt",
        "action",
        "quantity",
        "confidence",
        "reasoning",
        "accepted",
      ],
      optionalFields: ["rejectionReason"],
      schemaVersion: 1,
      edges: {
        ticker: {
          target: "TickerSource",
          type: "finance-research/decision_for_ticker",
          cardinality: "exactly_one",
        },
        riskState: {
          target: "RiskStateSource",
          type: "finance-research/decision_uses_risk_state",
          cardinality: "zero_or_one",
        },
        signal: {
          target: "AnalystSignalSource",
          type: "finance-research/decision_uses_signal",
          cardinality: "many",
        },
      },
    },
  },
};

export interface ArrowHedgeValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ArrowHedgePayloadValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ArrowHedgeValidationIssue[];
}

export interface ParsedArrowHedgeSnapshot {
  readonly snapshotId: string;
  readonly observedAt: Timestamp;
  readonly authority: string;
  readonly tickerSymbol: string;
  readonly riskFreshnessExpiresAt: Timestamp | null;
  readonly decisionRiskSourceSnapshotId: string | null;
  readonly decisionSignalSourceSnapshotId: string | null;
  readonly records: readonly SourceEntityRecord[];
}

export interface ArrowHedgeParseResult {
  readonly valid: boolean;
  readonly issues: readonly ArrowHedgeValidationIssue[];
  readonly records: readonly SourceEntityRecord[];
  readonly snapshot?: ParsedArrowHedgeSnapshot;
}

export interface ArrowHedgeOperationalSample {
  readonly adapterStartedAt: Timestamp;
  readonly firstValidEventAt?: Timestamp;
  readonly mappingAttempts: number;
  readonly mappingRejections: number;
  readonly stateComparisons: number;
  readonly stateDisagreements: number;
}

export interface ArrowHedgeEdgePlan {
  readonly sourceName: string;
  readonly edgeKey: string;
  readonly fromSourceRecordId: string;
  readonly toSourceRecordId: string;
  readonly edge: MappingEdgeInput;
}

export interface ArrowHedgeIngestionPlan {
  readonly valid: boolean;
  readonly issues: readonly ArrowHedgeValidationIssue[];
  readonly mapping: EntityIngestionPlan;
  readonly edges: readonly ArrowHedgeEdgePlan[];
  readonly typedEvents: readonly MappingEventInput[];
  readonly operationalSample: ArrowHedgeOperationalSample;
}

export interface ArrowHedgePlanContext {
  readonly tenantId: TenantId;
  readonly profile: ProfileDefinition;
  readonly adapterStartedAt: Timestamp;
  readonly emittedBy?: string;
  /**
   * When true, deterministic graph node ids are namespaced by tenant. Graph
   * node ids are globally unique across tenants, but content-addressed ids
   * like `ticker:AAPL` are identical for every tenant ingesting the same
   * real-world entity — which collides when more than one tenant shares a
   * process (e.g. the live HTTP ingest route). Defaults to false to preserve
   * legacy single-scope ids (and the committed fixture corpus).
   */
  readonly scopeNodeIdsByTenant?: boolean;
}

export interface ArrowHedgeExecutionResult {
  readonly nodesCreated: number;
  readonly nodesUpdated: number;
  readonly edgesCreated: number;
  readonly eventsPublished: readonly PMEvent[];
}

export interface ArrowHedgeExecutionPorts<TTx = unknown> {
  readonly withTransaction: <T>(fn: (tx: TTx) => Promise<T>) => Promise<T>;
  readonly graph: {
    createNode(
      input: EntityIngestionPlanItem["node"],
      tx: TTx,
    ): Promise<{
      readonly created: boolean;
      readonly node: {
        readonly id: EntityId;
        readonly identity: Readonly<Record<string, unknown>>;
        readonly schemaVersion: number;
      };
    }>;
    updateNode(
      input: {
        readonly tenantId: TenantId;
        readonly id: EntityId;
        readonly identity: Readonly<Record<string, unknown>>;
        readonly expectedSchemaVersion: number;
      },
      tx: TTx,
    ): Promise<unknown>;
    createEdge(input: MappingEdgeInput, tx: TTx): Promise<unknown>;
  };
  readonly events: {
    publishWith(tx: TTx, input: MappingEventInput): Promise<PMEvent>;
  };
}

type JsonSchemaType =
  | "array"
  | "boolean"
  | "integer"
  | "null"
  | "number"
  | "object"
  | "string";

interface PayloadJsonSchema {
  readonly type?: JsonSchemaType | readonly JsonSchemaType[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, PayloadJsonSchema>>;
  readonly items?: PayloadJsonSchema;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly maximum?: number;
  readonly format?: string;
  readonly additionalProperties?: boolean;
}

const ARROWHEDGE_TYPED_EVENT_PAYLOAD_SCHEMA_FILES = {
  "finance-research/analyst-signal-created.v1": "analyst-signal-created.v1.json",
  "finance-research/risk-state-validated.v1": "risk-state-validated.v1.json",
  "finance-research/portfolio-decision-proposed.v1":
    "portfolio-decision-proposed.v1.json",
  "finance-research/portfolio-decision-accepted.v1":
    "portfolio-decision-accepted.v1.json",
  "finance-research/workflow-blocked-stale-state.v1":
    "workflow-blocked-stale-state.v1.json",
} as const;

const ARROWHEDGE_TYPED_EVENT_PAYLOAD_SCHEMAS: Readonly<
  Record<string, PayloadJsonSchema>
> = Object.freeze(
  Object.fromEntries(
    Object.entries(ARROWHEDGE_TYPED_EVENT_PAYLOAD_SCHEMA_FILES).map(
      ([schemaId, filename]) => [schemaId, loadPayloadSchema(filename)],
    ),
  ),
);

/**
 * Parse + map an ArrowHedge snapshot into source entity records.
 *
 * `idScope` (optional) namespaces the deterministic node ids. Graph node ids
 * are globally unique across tenants, but content-addressed ids like
 * `ticker:AAPL` are identical for every tenant that ingests the same
 * real-world entity — which collides when more than one tenant uses a shared
 * process (e.g. the live HTTP ingest route). Passing the tenant id as idScope
 * keeps node ids deterministic *within* a tenant while avoiding cross-tenant
 * UUID collisions. Omitting it preserves the legacy single-scope behavior.
 */
export function parseArrowHedgeSnapshot(
  input: unknown,
  idScope?: string,
): ArrowHedgeParseResult {
  const issues: ArrowHedgeValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ path: "", message: "expected object" }],
      records: [],
    };
  }

  const snapshotId = stringAt(input, "/snapshotId", issues);
  const observedAt = timestampAt(input, "/observedAt", issues);
  const authority = stringAt(input, "/authority", issues);
  const backtestRun = objectAt(input, "/backtestRun", issues);
  const researchRun = objectAt(input, "/researchRun", issues);
  const ticker = objectAt(input, "/ticker", issues);
  const signal = objectAt(input, "/signal", issues);
  const risk = objectAt(input, "/risk", issues);
  const portfolio = objectAt(input, "/portfolio", issues);
  const decision = objectAt(input, "/decision", issues);
  const evidence = arrayAt(input, "/evidence", issues);

  if (issues.length > 0) {
    return { valid: false, issues, records: [] };
  }

  const tickerSymbol = stringAt(ticker!, "/ticker/symbol", issues);
  const riskFreshnessExpiresAt = optionalTimestampAt(
    risk!,
    "/risk/freshnessExpiresAt",
    issues,
  );
  const decisionRiskSourceSnapshotId = optionalStringAt(
    decision!,
    "/decision/riskSourceSnapshotId",
    issues,
  );
  const decisionSignalSourceSnapshotId = optionalStringAt(
    decision!,
    "/decision/signalSourceSnapshotId",
    issues,
  );

  const records: SourceEntityRecord[] = [];
  const pushRecord = (
    sourceName: string,
    sourceRecordId: string,
    row: Readonly<Record<string, unknown>>,
  ): void => {
    records.push({
      sourceName,
      sourceRecordId,
      id: stableEntityId(idScope ? `${idScope}:${sourceRecordId}` : sourceRecordId),
      observedAt: observedAt!,
      row,
    });
  };

  if (issues.length === 0) {
    pushRecord("BacktestRunSource", `backtest:${stringAt(backtestRun!, "/backtestRun/id", issues)}`, {
      title: stringAt(backtestRun!, "/backtestRun/title", issues),
      scopeStart: stringAt(backtestRun!, "/backtestRun/scopeStart", issues),
      scopeEnd: stringAt(backtestRun!, "/backtestRun/scopeEnd", issues),
      state: stringAt(backtestRun!, "/backtestRun/state", issues),
      datasetRef: stringAt(backtestRun!, "/backtestRun/datasetRef", issues),
      seed: stringAt(backtestRun!, "/backtestRun/seed", issues),
    });
    pushRecord("ResearchRunSource", `research:${stringAt(researchRun!, "/researchRun/id", issues)}`, {
      title: stringAt(researchRun!, "/researchRun/title", issues),
      scopeStart: stringAt(researchRun!, "/researchRun/scopeStart", issues),
      scopeEnd: stringAt(researchRun!, "/researchRun/scopeEnd", issues),
      state: stringAt(researchRun!, "/researchRun/state", issues),
      strategy: optionalStringAt(researchRun!, "/researchRun/strategy", issues),
      modelLock: optionalStringAt(researchRun!, "/researchRun/modelLock", issues),
      seed: optionalStringAt(researchRun!, "/researchRun/seed", issues),
    });
    pushRecord("TickerSource", `ticker:${tickerSymbol}`, {
      name: tickerSymbol,
      kind: "ticker",
      symbol: tickerSymbol,
      assetClass: stringAt(ticker!, "/ticker/assetClass", issues),
      exchange: optionalStringAt(ticker!, "/ticker/exchange", issues),
      currency: stringAt(ticker!, "/ticker/currency", issues),
      externalRef: tickerSymbol,
    });

    for (const [index, rawEvidence] of evidence!.entries()) {
      const at = `/evidence/${index}`;
      if (!isRecord(rawEvidence)) {
        issues.push({ path: at, message: "expected object" });
        continue;
      }
      const evidenceId = stringAt(rawEvidence, `${at}/id`, issues);
      pushRecord("EvidenceDocumentSource", `evidence:${evidenceId}`, {
        sha256: stringAt(rawEvidence, `${at}/sha256`, issues),
        mimeType: stringAt(rawEvidence, `${at}/mimeType`, issues),
        filename: stringAt(rawEvidence, `${at}/filename`, issues),
        sourceUri: optionalStringAt(rawEvidence, `${at}/sourceUri`, issues),
        retrievedAt: optionalTimestampAt(rawEvidence, `${at}/retrievedAt`, issues),
        freshnessExpiresAt: optionalTimestampAt(
          rawEvidence,
          `${at}/freshnessExpiresAt`,
          issues,
        ),
      });
    }

    pushRecord("PortfolioStateSource", `portfolio:${stringAt(portfolio!, "/portfolio/id", issues)}`, {
      name: `Portfolio ${snapshotId}`,
      kind: "portfolio_state",
      cash: numberAt(portfolio!, "/portfolio/cash", issues),
      equity: numberAt(portfolio!, "/portfolio/equity", issues),
      marginRequirement: numberAt(portfolio!, "/portfolio/marginRequirement", issues),
      marginUsed: numberAt(portfolio!, "/portfolio/marginUsed", issues),
      sourceSnapshotId: snapshotId,
    });
    pushRecord("AnalystSignalSource", `signal:${stringAt(signal!, "/signal/id", issues)}`, {
      kind: "analyst_signal",
      occurredAt: observedAt,
      agentId: stringAt(signal!, "/signal/agentId", issues),
      signal: stringAt(signal!, "/signal/signal", issues),
      confidence: numberAt(signal!, "/signal/confidence", issues),
      evidenceWindowStart: optionalTimestampAt(
        signal!,
        "/signal/evidenceWindowStart",
        issues,
      ),
      evidenceWindowEnd: optionalTimestampAt(signal!, "/signal/evidenceWindowEnd", issues),
      sourceSnapshotId: snapshotId,
    });
    pushRecord("RiskStateSource", `risk:${stringAt(risk!, "/risk/id", issues)}`, {
      kind: "risk_state",
      occurredAt: observedAt,
      currentPrice: numberAt(risk!, "/risk/currentPrice", issues),
      remainingPositionLimit: numberAt(risk!, "/risk/remainingPositionLimit", issues),
      maxShares: numberAt(risk!, "/risk/maxShares", issues),
      volatility: optionalNumberAt(risk!, "/risk/volatility", issues),
      bindingConstraint: optionalStringAt(risk!, "/risk/bindingConstraint", issues),
      sourceSnapshotId: snapshotId,
    });
    pushRecord("PortfolioDecisionSource", `decision:${stringAt(decision!, "/decision/id", issues)}`, {
      kind: "portfolio_decision",
      occurredAt: observedAt,
      action: stringAt(decision!, "/decision/action", issues),
      quantity: numberAt(decision!, "/decision/quantity", issues),
      confidence: numberAt(decision!, "/decision/confidence", issues),
      reasoning: stringAt(decision!, "/decision/reasoning", issues),
      accepted: booleanAt(decision!, "/decision/accepted", issues),
      rejectionReason: optionalStringAt(decision!, "/decision/rejectionReason", issues),
    });
  }

  if (issues.length > 0) {
    return { valid: false, issues, records: [] };
  }

  return {
    valid: true,
    issues: [],
    records,
    snapshot: {
      snapshotId: snapshotId!,
      observedAt: observedAt!,
      authority: authority!,
      tickerSymbol: tickerSymbol!,
      riskFreshnessExpiresAt,
      decisionRiskSourceSnapshotId,
      decisionSignalSourceSnapshotId,
      records,
    },
  };
}

export function buildArrowHedgeIngestionPlan(
  input: unknown,
  ctx: ArrowHedgePlanContext,
): ArrowHedgeIngestionPlan {
  const parsed = parseArrowHedgeSnapshot(
    input,
    ctx.scopeNodeIdsByTenant ? ctx.tenantId : undefined,
  );
  if (!parsed.valid || !parsed.snapshot) {
    return invalidPlan(parsed.issues, ctx, parsed.records.length || 1);
  }

  const emittedBy = ctx.emittedBy ?? "finance-research.ingest";
  const mapping = planEntityIngestion(
    ARROWHEDGE_ENTITY_MAPPING,
    ctx.profile,
    parsed.records,
    {
      tenantId: ctx.tenantId,
      emittedBy,
      authority: parsed.snapshot.authority,
      occurredAt: parsed.snapshot.observedAt,
    },
  );
  if (!mapping.valid) {
    return {
      valid: false,
      issues: mapping.issues,
      mapping,
      edges: [],
      typedEvents: [],
      operationalSample: {
        adapterStartedAt: ctx.adapterStartedAt,
        mappingAttempts: parsed.records.length,
        mappingRejections: mapping.issues.length,
        stateComparisons: 0,
        stateDisagreements: 0,
      },
    };
  }

  const edges = buildEdges(ctx.tenantId, parsed.records);
  const typedEvents = buildTypedEvents(ctx.tenantId, emittedBy, parsed.snapshot, mapping.items);
  const typedPayloadIssues = validateTypedEventPayloads(typedEvents);
  if (typedPayloadIssues.length > 0) {
    return {
      valid: false,
      issues: typedPayloadIssues,
      mapping,
      edges: [],
      typedEvents: [],
      operationalSample: {
        adapterStartedAt: ctx.adapterStartedAt,
        mappingAttempts: parsed.records.length,
        mappingRejections: 0,
        stateComparisons: 1,
        stateDisagreements: hasStateDisagreement(parsed.snapshot) ? 1 : 0,
      },
    };
  }
  return {
    valid: true,
    issues: [],
    mapping,
    edges,
    typedEvents,
    operationalSample: {
      adapterStartedAt: ctx.adapterStartedAt,
      ...(typedEvents[0]?.occurredAt ? { firstValidEventAt: typedEvents[0].occurredAt } : {}),
      mappingAttempts: parsed.records.length,
      mappingRejections: 0,
      stateComparisons: 1,
      stateDisagreements: hasStateDisagreement(parsed.snapshot) ? 1 : 0,
    },
  };
}

export async function executeArrowHedgeIngestionPlan<TTx>(
  plan: ArrowHedgeIngestionPlan,
  ports: ArrowHedgeExecutionPorts<TTx>,
): Promise<ArrowHedgeExecutionResult> {
  if (!plan.valid) {
    throw new Error(`cannot execute invalid ArrowHedge plan: ${plan.issues[0]?.message ?? "invalid"}`);
  }

  const typedPayloadIssues = validateTypedEventPayloads(plan.typedEvents);
  if (typedPayloadIssues.length > 0) {
    const first = typedPayloadIssues[0]!;
    throw new Error(
      `invalid ArrowHedge typed event payload: ${first.path} ${first.message}`,
    );
  }

  return ports.withTransaction(async (tx) => {
    let nodesCreated = 0;
    let nodesUpdated = 0;
    let edgesCreated = 0;
    const eventsPublished: PMEvent[] = [];

    for (const item of plan.mapping.items) {
      const result = await ports.graph.createNode(item.node, tx);
      if (result.created) {
        nodesCreated += 1;
      } else if (!sameIdentity(result.node.identity, item.node.identity)) {
        await ports.graph.updateNode(
          {
            tenantId: item.node.tenantId,
            id: result.node.id,
            identity: item.node.identity,
            expectedSchemaVersion: result.node.schemaVersion,
          },
          tx,
        );
        nodesUpdated += 1;
      }
      eventsPublished.push(await ports.events.publishWith(tx, item.event));
    }

    for (const edge of plan.edges) {
      await ports.graph.createEdge(edge.edge, tx);
      edgesCreated += 1;
    }

    for (const event of plan.typedEvents) {
      eventsPublished.push(await ports.events.publishWith(tx, event));
    }

    return {
      nodesCreated,
      nodesUpdated,
      edgesCreated,
      eventsPublished,
    };
  });
}

export interface ArrowHedgeTickerCop {
  readonly symbol: string;
  readonly latestSignal?: {
    readonly eventId: string;
    readonly signalId: string;
    readonly signal: string;
    readonly confidence: number;
    readonly sourceSnapshotId: string;
    readonly evidenceDocumentIds: readonly string[];
    readonly observedAt: Timestamp;
    readonly authority: string;
  };
  readonly latestRiskState?: {
    readonly eventId: string;
    readonly riskStateId: string;
    readonly currentPrice: number;
    readonly maxShares: number;
    readonly sourceSnapshotId: string;
    readonly freshnessExpiresAt: string | null;
    readonly observedAt: Timestamp;
    readonly authority: string;
  };
  readonly latestDecision?: {
    readonly eventId: string;
    readonly decisionId: string;
    readonly action: string;
    readonly quantity: number;
    readonly accepted: boolean;
    readonly riskSourceSnapshotId: string | null;
    readonly signalSourceSnapshotId: string | null;
    readonly observedAt: Timestamp;
    readonly authority: string;
  };
  readonly authorityGate: {
    readonly passes: number;
    readonly failures: number;
  };
  readonly stateDisagreements: number;
  readonly staleBlocks: number;
}

export interface ArrowHedgeCommonOperatingPictureState {
  readonly tickers: Readonly<Record<string, ArrowHedgeTickerCop>>;
  readonly summary: {
    readonly validEventCount: number;
    readonly authorityGatePassRate: number | null;
    readonly stateDisagreementRate: number | null;
  };
}

export interface ArrowHedgeCurrentStateViewInput {
  readonly tenantId: TenantId;
  readonly projectionName: string;
  readonly projectionVersion?: number;
  readonly symbol: string;
  readonly state: ArrowHedgeCommonOperatingPictureState;
  readonly evaluatedAt?: Timestamp;
}

export interface ArrowHedgeCurrentStateViewsInput {
  readonly tenantId: TenantId;
  readonly projectionName: string;
  readonly projectionVersion?: number;
  readonly state: ArrowHedgeCommonOperatingPictureState;
}

export interface ArrowHedgeObservationReportInput
  extends ArrowHedgeCurrentStateViewInput {
  readonly evaluatedAt?: Timestamp;
}

export interface ArrowHedgeObservationReport {
  readonly currentStateView: CurrentStateView;
  readonly observationContract: ObservationContract;
  readonly evaluation: ObservationContractEvaluation;
}

export interface ArrowHedgeProposalReviewInput
  extends ArrowHedgeCurrentStateViewInput {
  readonly actionType: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly proposedBy: string;
  readonly proposedAt: Timestamp;
  readonly readSet?: readonly ReadSetEntry[];
  readonly observationContract?: ObservationContract;
  readonly enforcementMode?: ActionProposalReviewEnforcementMode;
}

export interface ArrowHedgeStateReviewArtifactInput
  extends ArrowHedgeProposalReviewInput {
  readonly artifact?: StateReviewArtifactOptions;
  readonly scenarioId?: string;
}

export interface ArrowHedgeStateReviewArtifactCorpusInput
  extends ArrowHedgeStateReviewArtifactInput {
  readonly scenarioId: string;
}

export interface ArrowHedgeTemporalMisalignmentFixtureCasesInput
  extends ArrowHedgeCurrentStateViewInput {
  readonly observationCapturedAt: Timestamp;
  readonly observationToActionProposedAt: Timestamp;
  readonly actionToFeedbackProposedAt: Timestamp;
  readonly feedbackToObservationProposedAt: Timestamp;
  readonly proposedBy?: string;
}

export interface ArrowHedgeCanonicalStateReviewArtifactCorpusInput
  extends ArrowHedgeTemporalMisalignmentFixtureCasesInput {}

export interface ArrowHedgeStateReviewArtifactCorpus {
  readonly artifacts: readonly StateReviewArtifact[];
  readonly jsonl: string;
  readonly continuityPayloads: readonly StateReviewArtifactContinuityPayload[];
}

export interface ArrowHedgeStateReviewArtifactCorpusEquivalenceSource {
  readonly label: string;
  readonly inputs: readonly ArrowHedgeStateReviewArtifactCorpusInput[];
}

export interface ArrowHedgeStateReviewArtifactCorpusEquivalenceInput {
  readonly fixture: ArrowHedgeStateReviewArtifactCorpusEquivalenceSource;
  readonly projected: ArrowHedgeStateReviewArtifactCorpusEquivalenceSource;
}

export interface ArrowHedgeStateReviewArtifactCorpusEquivalenceSnapshot {
  readonly label: string;
  readonly inputCount: number;
  readonly artifactCount: number;
  readonly canonicalArtifactJsonl: string;
  readonly importValid: readonly boolean[];
  readonly replayHashValid: readonly boolean[];
  readonly artifactIds: readonly string[];
  readonly artifactHashes: readonly string[];
  readonly continuityArtifactIds: readonly string[];
  readonly continuityArtifactHashes: readonly string[];
  readonly continuityReviewIds: readonly string[];
  readonly continuityWarningCodes: readonly (readonly string[])[];
  readonly warningCodes: readonly (readonly string[])[];
  readonly temporalPhases: readonly string[];
  readonly invariantClasses: readonly (readonly string[])[];
}

export interface ArrowHedgeStateReviewArtifactCorpusEquivalenceMismatch {
  readonly field: string;
  readonly fixture: unknown;
  readonly projected: unknown;
}

export interface ArrowHedgeStateReviewArtifactCorpusEquivalence {
  readonly valid: boolean;
  readonly mismatches: readonly ArrowHedgeStateReviewArtifactCorpusEquivalenceMismatch[];
  readonly fixture: ArrowHedgeStateReviewArtifactCorpusEquivalenceSnapshot;
  readonly projected: ArrowHedgeStateReviewArtifactCorpusEquivalenceSnapshot;
}

export function createArrowHedgeCommonOperatingPictureProjection(name: string) {
  return {
    name,
    version: 1,
    consumes: [...FINANCE_RESEARCH_EVENT_TYPES],
    initial: (): ArrowHedgeCommonOperatingPictureState => ({
      tickers: {},
      summary: {
        validEventCount: 0,
        authorityGatePassRate: null,
        stateDisagreementRate: null,
      },
    }),
    apply: (
      state: ArrowHedgeCommonOperatingPictureState,
      event: PMEvent,
    ): ArrowHedgeCommonOperatingPictureState => updateCop(state, event),
  };
}

export function buildArrowHedgeCurrentStateViews(
  input: ArrowHedgeCurrentStateViewsInput,
): readonly CurrentStateView[] {
  return Object.keys(input.state.tickers).flatMap((symbol) => {
    const view = buildArrowHedgeCurrentStateView({ ...input, symbol });
    return view ? [view] : [];
  });
}

export function buildArrowHedgeCurrentStateView(
  input: ArrowHedgeCurrentStateViewInput,
): CurrentStateView | null {
  const ticker = input.state.tickers[input.symbol];
  if (!ticker) return null;

  const observedAt = latestTickerTimestamp(ticker);
  const authorityRule = latestTickerAuthority(ticker);
  if (!observedAt || !authorityRule) return null;

  const asOf = input.evaluatedAt ?? observedAt;
  const sourceRefs = tickerSourceRefs(ticker);
  const missingSources = tickerMissingSources(ticker);
  const conflicts = tickerConflicts(ticker, asOf);
  const workflowPosition = tickerWorkflowPosition(ticker, conflicts, asOf);
  const allowedActions = tickerAllowedActions(sourceRefs);
  const validUntil = ticker.latestRiskState?.freshnessExpiresAt;

  return {
    tenantId: input.tenantId,
    viewId: `${input.projectionName}:${input.symbol}:current_state_view`,
    subject: stateRef(
      "projection",
      `${input.projectionName}:${input.symbol}`,
      `ArrowHedge COP ${input.symbol}`,
    ),
    observedAt,
    ...(validUntil !== undefined && validUntil !== null
      ? { validUntil: validUntil as Timestamp }
      : {}),
    authorityRule,
    ...(input.projectionVersion !== undefined
      ? { projectionVersion: input.projectionVersion }
      : {}),
    workflowPosition,
    sourceRefs,
    missingSources,
    conflicts,
    allowedActions,
  };
}

export function buildArrowHedgeObservationReport(
  input: ArrowHedgeObservationReportInput,
): ArrowHedgeObservationReport | null {
  const currentStateView = buildArrowHedgeCurrentStateView(input);
  if (!currentStateView) return null;

  const observationContract =
    buildObservationContractFromCurrentStateView(currentStateView);
  const evaluation = evaluateObservationContract(
    observationContract,
    currentStateView,
    input.evaluatedAt ?? currentStateView.observedAt,
  );

  return {
    currentStateView,
    observationContract,
    evaluation,
  };
}

export function buildArrowHedgeProposalReview(
  input: ArrowHedgeProposalReviewInput,
): ActionProposalReview | null {
  const currentStateView = buildArrowHedgeCurrentStateView({
    ...input,
    evaluatedAt: input.evaluatedAt ?? input.proposedAt,
  });
  if (!currentStateView) return null;

  return reviewProposedActionAgainstCurrentState(
    {
      tenantId: input.tenantId,
      actionType: input.actionType,
      subject: currentStateView.subject,
      payload: input.payload,
      readSet:
        input.readSet ??
        buildReadSetFromCurrentStateView(
          currentStateView,
          currentStateView.authorityRule,
        ),
      ...(input.observationContract !== undefined
        ? { observationContract: input.observationContract }
        : {}),
      proposedBy: input.proposedBy,
      proposedAt: input.proposedAt,
    },
    currentStateView,
    {
      evaluatedAt: input.proposedAt,
      ...(input.observationContract !== undefined
        ? { observationContract: input.observationContract }
        : {}),
      // Enforce by default: a failed read-set or observation-contract check
      // must block the proposal, not merely warn. Advisory-by-default made the
      // proposal-review layer non-enforcing (Audit 2026-06-19: the dashboard
      // "policy" column showed allowed=true even on contract failures). Callers
      // can still opt into "advisory" explicitly for shadow/observe-only runs.
      enforcementMode: input.enforcementMode ?? "blocking",
    },
  );
}

export function buildArrowHedgeStateReviewArtifact(
  input: ArrowHedgeStateReviewArtifactInput,
): StateReviewArtifact | null {
  const review = buildArrowHedgeProposalReview(input);
  if (!review) return null;

  const artifactOptions = input.artifact ?? {};
  const metadata = {
    ...(artifactOptions.metadata ?? {}),
    ...(input.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
  };
  return buildStateReviewArtifact(review, {
    ...artifactOptions,
    artifactId:
      artifactOptions.artifactId ?? `${review.reviewId}:state_review_artifact`,
    source: artifactOptions.source ?? `arrowhedge/${input.projectionName}`,
    metadata,
    relatedObjects: [
      {
        role: "ticker_symbol",
        ref: stateRef(
          "source_record",
          `ticker:${input.symbol}`,
          `ArrowHedge ticker ${input.symbol}`,
        ),
      },
      ...(artifactOptions.relatedObjects ?? []),
    ],
  });
}

export function buildArrowHedgeStateReviewArtifactCorpus(
  inputs: readonly ArrowHedgeStateReviewArtifactCorpusInput[],
): ArrowHedgeStateReviewArtifactCorpus {
  const artifacts = inputs.flatMap((input) => {
    const artifact = buildArrowHedgeStateReviewArtifact(input);
    return artifact === null ? [] : [artifact];
  });

  return {
    artifacts,
    jsonl: serializeStateReviewArtifactsJsonl(artifacts),
    continuityPayloads: artifacts.map((artifact) =>
      buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact(artifact),
    ),
  };
}

export function buildArrowHedgeCanonicalStateReviewArtifactCorpus(
  input: ArrowHedgeCanonicalStateReviewArtifactCorpusInput,
): ArrowHedgeStateReviewArtifactCorpus {
  const cleanCase = buildArrowHedgeCleanCurrentFixtureCase(input);
  const temporalCases = buildArrowHedgeTemporalMisalignmentFixtureCases(input);

  return buildArrowHedgeStateReviewArtifactCorpus([
    ...(cleanCase ? [cleanCase] : []),
    ...temporalCases,
  ]);
}

export function buildArrowHedgeTemporalMisalignmentFixtureCases(
  input: ArrowHedgeTemporalMisalignmentFixtureCasesInput,
): readonly ArrowHedgeStateReviewArtifactCorpusInput[] {
  const originalView = buildArrowHedgeCurrentStateView({
    ...input,
    evaluatedAt: input.observationCapturedAt,
  });
  const ticker = input.state.tickers[input.symbol];
  const decisionId = ticker?.latestDecision?.decisionId;
  if (!originalView || !decisionId) return [];

  const originalObservation =
    buildObservationContractFromCurrentStateView(originalView);
  const proposedBy = input.proposedBy ?? "agent:portfolio-manager";
  const feedbackReadSet = buildReadSetFromCurrentStateView(
    originalView,
    `arrowhedge:execution-feedback:${input.symbol}`,
  ).map((entry) => ({
    ...entry,
    ...(input.projectionVersion !== undefined
      ? { projectionVersion: input.projectionVersion - 1 }
      : {}),
  }));
  const feedbackObservationState = omitLatestRiskState(input.state, input.symbol);
  const feedbackObservationView = buildArrowHedgeCurrentStateView({
    ...input,
    state: feedbackObservationState,
    evaluatedAt: input.feedbackToObservationProposedAt,
  });
  if (!feedbackObservationView) return [];

  return [
    {
      tenantId: input.tenantId,
      projectionName: input.projectionName,
      ...(input.projectionVersion !== undefined
        ? { projectionVersion: input.projectionVersion }
        : {}),
      symbol: input.symbol,
      state: input.state,
      scenarioId: "arrowhedge-observation-to-action-stale-risk",
      actionType: "portfolio.decision.accept",
      payload: { decisionId },
      proposedBy,
      proposedAt: input.observationToActionProposedAt,
      readSet: buildReadSetFromCurrentStateView(
        originalView,
        originalView.authorityRule,
      ),
      observationContract: originalObservation,
      artifact: {
        artifactId: "artifact_arrowhedge_observation_to_action_stale_risk_001",
        metadata: {
          temporalMisalignmentPhase: "observation_to_action",
          invariantClasses: [
            "freshness_window",
            "workflow_position",
            "state_conflict",
          ],
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/temporal-observation-to-action-stale-risk.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-temporal-fixture-observation-action",
          workflowRunId: "arrowhedge-temporal-workflow-observation-action",
          evalEventIds: ["eval_arrowhedge_observation_to_action"],
        },
      },
    },
    {
      tenantId: input.tenantId,
      projectionName: input.projectionName,
      ...(input.projectionVersion !== undefined
        ? { projectionVersion: input.projectionVersion }
        : {}),
      symbol: input.symbol,
      state: input.state,
      scenarioId: "arrowhedge-action-to-feedback-authority-drift",
      actionType: "risk.refresh",
      payload: {
        decisionId,
        feedbackId: `feedback:${decisionId}:post_action_authority`,
      },
      proposedBy,
      proposedAt: input.actionToFeedbackProposedAt,
      readSet: feedbackReadSet,
      observationContract: originalObservation,
      artifact: {
        artifactId: "artifact_arrowhedge_action_to_feedback_authority_001",
        metadata: {
          temporalMisalignmentPhase: "action_to_feedback",
          invariantClasses: ["source_authority", "projection_version"],
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/temporal-action-to-feedback-authority.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-temporal-fixture-action-feedback",
          workflowRunId: "arrowhedge-temporal-workflow-action-feedback",
          evalEventIds: ["eval_arrowhedge_action_to_feedback"],
        },
      },
    },
    {
      tenantId: input.tenantId,
      projectionName: input.projectionName,
      ...(input.projectionVersion !== undefined
        ? { projectionVersion: input.projectionVersion }
        : {}),
      symbol: input.symbol,
      state: feedbackObservationState,
      scenarioId: "arrowhedge-feedback-to-observation-missing-risk",
      actionType: "risk.refresh",
      payload: {
        decisionId,
        missingObservation: "risk_state",
      },
      proposedBy,
      proposedAt: input.feedbackToObservationProposedAt,
      readSet: buildReadSetFromCurrentStateView(
        feedbackObservationView,
        feedbackObservationView.authorityRule,
      ),
      observationContract: originalObservation,
      artifact: {
        artifactId:
          "artifact_arrowhedge_feedback_to_observation_missing_risk_001",
        metadata: {
          temporalMisalignmentPhase: "feedback_to_observation",
          invariantClasses: ["required_evidence"],
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/temporal-feedback-to-observation-missing-risk.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-temporal-fixture-feedback-observation",
          workflowRunId: "arrowhedge-temporal-workflow-feedback-observation",
          evalEventIds: ["eval_arrowhedge_feedback_to_observation"],
        },
      },
    },
  ];
}

export interface ArrowHedgeCleanCurrentFixtureCaseInput
  extends ArrowHedgeCurrentStateViewInput {
  /** Time the (fresh) observation was captured; also used as the proposal time. */
  readonly observationCapturedAt: Timestamp;
  readonly proposedBy?: string;
}

/**
 * Clean accepted/current ArrowHedge artifact fixture (research frontier item
 * 4): a positive metrics baseline where the observation is fresh, the read
 * set matches the current state view, the contract evaluates clean, and the
 * review is valid with zero warnings and temporal phase `none`.
 */
export function buildArrowHedgeCleanCurrentFixtureCase(
  input: ArrowHedgeCleanCurrentFixtureCaseInput,
): ArrowHedgeStateReviewArtifactCorpusInput | null {
  const view = buildArrowHedgeCurrentStateView({
    ...input,
    evaluatedAt: input.observationCapturedAt,
  });
  const ticker = input.state.tickers[input.symbol];
  const decisionId = ticker?.latestDecision?.decisionId;
  if (!view || !decisionId) return null;

  return {
    tenantId: input.tenantId,
    projectionName: input.projectionName,
    ...(input.projectionVersion !== undefined
      ? { projectionVersion: input.projectionVersion }
      : {}),
    symbol: input.symbol,
    state: input.state,
    scenarioId: "arrowhedge-clean-current-accepted",
    actionType: "risk.refresh",
    payload: { decisionId, refreshId: `refresh:${decisionId}:clean_current` },
    proposedBy: input.proposedBy ?? "agent:portfolio-manager",
    proposedAt: input.observationCapturedAt,
    readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
    observationContract: buildObservationContractFromCurrentStateView(view),
    artifact: {
      artifactId: "artifact_arrowhedge_clean_current_accepted_001",
      metadata: {
        temporalMisalignmentPhase: "none",
        invariantClasses: [],
        fixtureId:
          "fixtures/arrowhedge/state-review-artifacts/clean-current-accepted.json",
        clientSurface: "codex",
        provider: "openai",
        sessionId: "arrowhedge-clean-current-fixture",
        workflowRunId: "arrowhedge-clean-current-workflow",
        evalEventIds: ["eval_arrowhedge_clean_current_accepted"],
      },
    },
  };
}

function omitLatestRiskState(
  state: ArrowHedgeCommonOperatingPictureState,
  symbol: string,
): ArrowHedgeCommonOperatingPictureState {
  const ticker = state.tickers[symbol];
  if (!ticker) return state;

  const tickerWithoutRiskState: ArrowHedgeTickerCop = {
    symbol: ticker.symbol,
    ...(ticker.latestSignal !== undefined
      ? { latestSignal: ticker.latestSignal }
      : {}),
    ...(ticker.latestDecision !== undefined
      ? { latestDecision: ticker.latestDecision }
      : {}),
    authorityGate: ticker.authorityGate,
    stateDisagreements: ticker.stateDisagreements,
    staleBlocks: ticker.staleBlocks,
  };
  return {
    ...state,
    tickers: {
      ...state.tickers,
      [symbol]: tickerWithoutRiskState,
    },
  };
}

export function compareArrowHedgeStateReviewArtifactCorpusEquivalence(
  input: ArrowHedgeStateReviewArtifactCorpusEquivalenceInput,
): ArrowHedgeStateReviewArtifactCorpusEquivalence {
  const fixture = summarizeStateReviewArtifactCorpusEquivalenceSource(
    input.fixture,
  );
  const projected = summarizeStateReviewArtifactCorpusEquivalenceSource(
    input.projected,
  );
  const comparedFields: readonly (keyof Omit<
    ArrowHedgeStateReviewArtifactCorpusEquivalenceSnapshot,
    "label"
  >)[] = [
    "inputCount",
    "artifactCount",
    "canonicalArtifactJsonl",
    "importValid",
    "replayHashValid",
    "artifactIds",
    "artifactHashes",
    "continuityArtifactIds",
    "continuityArtifactHashes",
    "continuityReviewIds",
    "continuityWarningCodes",
    "warningCodes",
    "temporalPhases",
    "invariantClasses",
  ];
  const mismatches: ArrowHedgeStateReviewArtifactCorpusEquivalenceMismatch[] = [];

  for (const field of comparedFields) {
    if (!sameEquivalenceValue(fixture[field], projected[field])) {
      mismatches.push({
        field,
        fixture: fixture[field],
        projected: projected[field],
      });
    }
  }

  appendValidityFailures(input.fixture.label, fixture, mismatches);
  appendValidityFailures(input.projected.label, projected, mismatches);

  return {
    valid: mismatches.length === 0,
    mismatches,
    fixture,
    projected,
  };
}

function summarizeStateReviewArtifactCorpusEquivalenceSource(
  source: ArrowHedgeStateReviewArtifactCorpusEquivalenceSource,
): ArrowHedgeStateReviewArtifactCorpusEquivalenceSnapshot {
  const corpus = buildArrowHedgeStateReviewArtifactCorpus(source.inputs);
  const imported = importStateReviewArtifactsJsonl(corpus.jsonl);

  return {
    label: source.label,
    inputCount: source.inputs.length,
    artifactCount: corpus.artifacts.length,
    canonicalArtifactJsonl: corpus.jsonl,
    importValid: imported.map((result) => result.valid),
    replayHashValid: corpus.artifacts.map(
      (artifact) => verifyStateReviewArtifactHash(artifact).valid,
    ),
    artifactIds: corpus.artifacts.map((artifact) => artifact.artifactId),
    artifactHashes: corpus.artifacts.map((artifact) => artifact.artifactHash),
    continuityArtifactIds: corpus.continuityPayloads.map(
      (payload) => payload.stateReviewArtifactId,
    ),
    continuityArtifactHashes: corpus.continuityPayloads.map(
      (payload) => payload.stateReviewArtifactHash,
    ),
    continuityReviewIds: corpus.continuityPayloads.map(
      (payload) => payload.reviewId,
    ),
    continuityWarningCodes: corpus.continuityPayloads.map((payload) =>
      sortedStrings(payload.warningCodes),
    ),
    warningCodes: corpus.artifacts.map((artifact) =>
      sortedStrings(artifact.review.warnings.map((warning) => warning.code)),
    ),
    temporalPhases: corpus.artifacts.map(
      (artifact) => artifact.metadata.temporalMisalignmentPhase,
    ),
    invariantClasses: corpus.artifacts.map((artifact) =>
      sortedStrings(artifact.metadata.invariantClasses),
    ),
  };
}

function appendValidityFailures(
  label: string,
  snapshot: ArrowHedgeStateReviewArtifactCorpusEquivalenceSnapshot,
  mismatches: ArrowHedgeStateReviewArtifactCorpusEquivalenceMismatch[],
): void {
  if (snapshot.inputCount === 0) {
    mismatches.push({
      field: `${label}.inputCount`,
      fixture: "at least 1",
      projected: snapshot.inputCount,
    });
  } else if (snapshot.artifactCount !== snapshot.inputCount) {
    mismatches.push({
      field: `${label}.artifactCount`,
      fixture: snapshot.inputCount,
      projected: snapshot.artifactCount,
    });
  }
  if (snapshot.importValid.some((valid) => !valid)) {
    mismatches.push({
      field: `${label}.importValid`,
      fixture: snapshot.importValid.map(() => true),
      projected: snapshot.importValid,
    });
  }
  if (snapshot.replayHashValid.some((valid) => !valid)) {
    mismatches.push({
      field: `${label}.replayHashValid`,
      fixture: snapshot.replayHashValid.map(() => true),
      projected: snapshot.replayHashValid,
    });
  }
}

function sameEquivalenceValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sortedStrings(values: readonly string[]): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function validateArrowHedgeTypedEventPayload(
  event: MappingEventInput,
): ArrowHedgePayloadValidationResult {
  const schema = payloadSchemaFor(event.payloadSchema);
  if (!schema) {
    return {
      valid: false,
      issues: [
        {
          path: "/payloadSchema",
          message: `unknown ArrowHedge payload schema: ${event.payloadSchema}`,
        },
      ],
    };
  }

  const issues: ArrowHedgeValidationIssue[] = [];
  validateSchemaValue(event.payload, schema, "", issues);
  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
}

function buildEdges(
  tenantId: TenantId,
  records: readonly SourceEntityRecord[],
): readonly ArrowHedgeEdgePlan[] {
  const bySourceName = groupRecords(records);
  const backtest = one(bySourceName, "BacktestRunSource");
  const research = one(bySourceName, "ResearchRunSource");
  const ticker = one(bySourceName, "TickerSource");
  const signal = one(bySourceName, "AnalystSignalSource");
  const risk = one(bySourceName, "RiskStateSource");
  const portfolio = one(bySourceName, "PortfolioStateSource");
  const decision = one(bySourceName, "PortfolioDecisionSource");
  const evidence = bySourceName.get("EvidenceDocumentSource") ?? [];

  const edgeSpecs = [
    spec("BacktestRunSource", "researchRun", backtest, research),
    spec("ResearchRunSource", "ticker", research, ticker),
    spec("ResearchRunSource", "signal", research, signal),
    spec("ResearchRunSource", "riskState", research, risk),
    spec("ResearchRunSource", "portfolioState", research, portfolio),
    spec("ResearchRunSource", "decision", research, decision),
    spec("AnalystSignalSource", "ticker", signal, ticker),
    ...evidence.map((item) => spec("AnalystSignalSource", "evidence", signal, item)),
    spec("RiskStateSource", "ticker", risk, ticker),
    ...evidence.map((item) => spec("RiskStateSource", "evidence", risk, item)),
    spec("PortfolioDecisionSource", "ticker", decision, ticker),
    spec("PortfolioDecisionSource", "riskState", decision, risk),
    spec("PortfolioDecisionSource", "signal", decision, signal),
  ];

  return edgeSpecs.map((edgeSpec) => ({
    sourceName: edgeSpec.sourceName,
    edgeKey: edgeSpec.edgeKey,
    fromSourceRecordId: edgeSpec.from.sourceRecordId!,
    toSourceRecordId: edgeSpec.to.sourceRecordId!,
    edge: applyEdgeMapping(
      ARROWHEDGE_ENTITY_MAPPING,
      edgeSpec.sourceName,
      edgeSpec.edgeKey,
      { fromId: edgeSpec.from.id!, toId: edgeSpec.to.id! },
      {
        tenantId,
        attrs: {
          fromSourceRecordId: edgeSpec.from.sourceRecordId,
          toSourceRecordId: edgeSpec.to.sourceRecordId,
        },
      },
    ),
  }));
}

function buildTypedEvents(
  tenantId: TenantId,
  emittedBy: string,
  snapshot: ParsedArrowHedgeSnapshot,
  items: readonly EntityIngestionPlanItem[],
): readonly MappingEventInput[] {
  const bySource = new Map(items.map((item) => [item.sourceName, item]));
  const research = bySource.get("ResearchRunSource")!;
  const ticker = bySource.get("TickerSource")!;
  const signal = bySource.get("AnalystSignalSource")!;
  const risk = bySource.get("RiskStateSource")!;
  const decision = bySource.get("PortfolioDecisionSource")!;
  const researchRunId = research.event.entityId;
  const tickerId = ticker.event.entityId;
  const decisionId = decision.event.entityId;
  const riskStateId = risk.event.entityId;
  const evidenceDocumentIds = items
    .filter((item) => item.sourceName === "EvidenceDocumentSource")
    .map((item) => item.event.entityId);
  const decisionPayload = {
    researchRunId,
    tickerId,
    decisionId,
    riskStateId,
    sourceSnapshotId: snapshot.snapshotId,
    tickerSymbol: snapshot.tickerSymbol,
    action: decision.node.identity["action"],
    quantity: decision.node.identity["quantity"],
    confidence: decision.node.identity["confidence"],
    reasoning: decision.node.identity["reasoning"],
    accepted: decision.node.identity["accepted"],
    riskSourceSnapshotId: snapshot.decisionRiskSourceSnapshotId,
    signalSourceSnapshotId: snapshot.decisionSignalSourceSnapshotId,
    currentPrice: risk.node.identity["currentPrice"],
    occurredAt: snapshot.observedAt,
  };
  const events: MappingEventInput[] = [
    typedEvent({
      tenantId,
      type: "analyst.signal.created",
      entityId: signal.event.entityId,
      emittedBy,
      authority: snapshot.authority,
      occurredAt: snapshot.observedAt,
      payloadSchema: "finance-research/analyst-signal-created.v1",
      payload: {
        researchRunId,
        tickerId,
        sourceSnapshotId: snapshot.snapshotId,
        tickerSymbol: snapshot.tickerSymbol,
        signal: signal.node.identity["signal"],
        confidence: signal.node.identity["confidence"],
        agentId: signal.node.identity["agentId"],
        occurredAt: snapshot.observedAt,
        evidenceDocumentIds,
      },
    }),
    typedEvent({
      tenantId,
      type: "risk.state.validated",
      entityId: risk.event.entityId,
      emittedBy,
      authority: snapshot.authority,
      occurredAt: snapshot.observedAt,
      payloadSchema: "finance-research/risk-state-validated.v1",
      payload: {
        researchRunId,
        tickerId,
        riskStateId,
        sourceSnapshotId: snapshot.snapshotId,
        tickerSymbol: snapshot.tickerSymbol,
        currentPrice: risk.node.identity["currentPrice"],
        remainingPositionLimit: risk.node.identity["remainingPositionLimit"],
        maxShares: risk.node.identity["maxShares"],
        bindingConstraint: risk.node.identity["bindingConstraint"] ?? null,
        freshnessExpiresAt: snapshot.riskFreshnessExpiresAt,
        occurredAt: snapshot.observedAt,
      },
    }),
    typedEvent({
      tenantId,
      type: "portfolio.decision.proposed",
      entityId: decision.event.entityId,
      emittedBy,
      authority: snapshot.authority,
      occurredAt: snapshot.observedAt,
      payloadSchema: "finance-research/portfolio-decision-proposed.v1",
      payload: decisionPayload,
    }),
  ];

  // Acceptance is gated by BOTH authority checks: a decision may only be
  // accepted if there is no state disagreement AND the backing state is not
  // stale. Previously only disagreement was checked, so a stale-but-agreeing
  // decision emitted BOTH accepted and blocked.stale_state for the same
  // decision — the stale protection was advisory, not enforced. (Audit
  // 2026-06-18: GOOG/NVDA/TSLA were accepted while also stale-blocked.)
  if (
    decision.node.identity["accepted"] === true &&
    !hasStateDisagreement(snapshot) &&
    !isStale(snapshot)
  ) {
    events.push(
      typedEvent({
        tenantId,
        type: "portfolio.decision.accepted",
        entityId: decision.event.entityId,
        emittedBy,
        authority: snapshot.authority,
        occurredAt: snapshot.observedAt,
        payloadSchema: "finance-research/portfolio-decision-accepted.v1",
        payload: decisionPayload,
      }),
    );
  }

  if (hasStateDisagreement(snapshot) || isStale(snapshot)) {
    events.push(
      typedEvent({
        tenantId,
        type: "workflow.blocked.stale_state",
        entityId: bySource.get("ResearchRunSource")!.event.entityId,
        emittedBy,
        authority: snapshot.authority,
        occurredAt: snapshot.observedAt,
        payloadSchema: "finance-research/workflow-blocked-stale-state.v1",
        payload: {
          researchRunId,
          blockedEntityId: decisionId,
          reason: blockedReason(snapshot),
          invalidatingEventId: null,
          sourceSnapshotId: snapshot.snapshotId,
          tickerSymbol: snapshot.tickerSymbol,
          riskSourceSnapshotId: snapshot.decisionRiskSourceSnapshotId,
          signalSourceSnapshotId: snapshot.decisionSignalSourceSnapshotId,
          riskFreshnessExpiresAt: snapshot.riskFreshnessExpiresAt,
          occurredAt: snapshot.observedAt,
        },
      }),
    );
  }

  return events;
}

function updateCop(
  state: ArrowHedgeCommonOperatingPictureState,
  event: PMEvent,
): ArrowHedgeCommonOperatingPictureState {
  const payload = event.payload;
  const symbol = typeof payload["tickerSymbol"] === "string" ? payload["tickerSymbol"] : null;
  if (!symbol) return state;
  const current = state.tickers[symbol] ?? emptyTicker(symbol);
  let next = current;

  if (event.type === "analyst.signal.created") {
    next = {
      ...current,
      latestSignal: {
        eventId: event.id,
        signalId: event.entityId,
        signal: String(payload["signal"]),
        confidence: Number(payload["confidence"]),
        sourceSnapshotId: String(payload["sourceSnapshotId"]),
        evidenceDocumentIds: stringArray(payload["evidenceDocumentIds"]),
        observedAt: event.occurredAt,
        authority: eventAuthority(event),
      },
    };
  } else if (event.type === "risk.state.validated") {
    next = {
      ...current,
      latestRiskState: {
        eventId: event.id,
        riskStateId: String(payload["riskStateId"]),
        currentPrice: Number(payload["currentPrice"]),
        maxShares: Number(payload["maxShares"]),
        sourceSnapshotId: String(payload["sourceSnapshotId"]),
        freshnessExpiresAt:
          typeof payload["freshnessExpiresAt"] === "string"
            ? payload["freshnessExpiresAt"]
            : null,
        observedAt: event.occurredAt,
        authority: eventAuthority(event),
      },
    };
  } else if (event.type === "portfolio.decision.proposed") {
    const riskDisagrees =
      current.latestRiskState !== undefined &&
      typeof payload["riskSourceSnapshotId"] === "string" &&
      payload["riskSourceSnapshotId"] !== current.latestRiskState.sourceSnapshotId;
    const signalDisagrees =
      current.latestSignal !== undefined &&
      typeof payload["signalSourceSnapshotId"] === "string" &&
      payload["signalSourceSnapshotId"] !== current.latestSignal.sourceSnapshotId;
    next = {
      ...current,
      latestDecision: {
        eventId: event.id,
        decisionId: String(payload["decisionId"]),
        action: String(payload["action"]),
        quantity: Number(payload["quantity"]),
        accepted: Boolean(payload["accepted"]),
        riskSourceSnapshotId:
          typeof payload["riskSourceSnapshotId"] === "string"
            ? payload["riskSourceSnapshotId"]
            : null,
        signalSourceSnapshotId:
          typeof payload["signalSourceSnapshotId"] === "string"
            ? payload["signalSourceSnapshotId"]
            : null,
        observedAt: event.occurredAt,
        authority: eventAuthority(event),
      },
      stateDisagreements:
        current.stateDisagreements + (riskDisagrees || signalDisagrees ? 1 : 0),
    };
  } else if (event.type === "portfolio.decision.accepted") {
    next = {
      ...current,
      authorityGate: {
        ...current.authorityGate,
        passes: current.authorityGate.passes + 1,
      },
    };
  } else if (event.type === "workflow.blocked.stale_state") {
    next = {
      ...current,
      staleBlocks: current.staleBlocks + 1,
      authorityGate: {
        ...current.authorityGate,
        failures: current.authorityGate.failures + 1,
      },
    };
  }

  const tickers = { ...state.tickers, [symbol]: next };
  return {
    tickers,
    summary: summarizeCop(tickers),
  };
}

function tickerSourceRefs(ticker: ArrowHedgeTickerCop): readonly StateRef[] {
  return uniqueStateRefs([
    ticker.latestSignal
      ? stateRef("event", ticker.latestSignal.eventId, "analyst.signal.created")
      : null,
    ticker.latestRiskState
      ? stateRef("event", ticker.latestRiskState.eventId, "risk.state.validated")
      : null,
    ticker.latestDecision
      ? stateRef(
          "event",
          ticker.latestDecision.eventId,
          "portfolio.decision.proposed",
        )
      : null,
    ...(ticker.latestSignal?.evidenceDocumentIds.map((id) =>
      stateRef("document", id, "evidence_document"),
    ) ?? []),
  ]);
}

function tickerMissingSources(ticker: ArrowHedgeTickerCop): readonly string[] {
  const missing: string[] = [];
  if (!ticker.latestSignal) missing.push("analyst_signal");
  if (!ticker.latestRiskState) missing.push("risk_state");
  if (!ticker.latestDecision) missing.push("portfolio_decision");
  return missing;
}

function tickerConflicts(
  ticker: ArrowHedgeTickerCop,
  asOf: Timestamp,
): readonly StateConflict[] {
  const conflicts: StateConflict[] = [];

  if (
    ticker.latestDecision?.riskSourceSnapshotId !== null &&
    ticker.latestDecision?.riskSourceSnapshotId !== undefined &&
    ticker.latestRiskState !== undefined &&
    ticker.latestDecision.riskSourceSnapshotId !== ticker.latestRiskState.sourceSnapshotId
  ) {
    conflicts.push({
      conflictType: "state_disagreement",
      refs: presentStateRefs([
        ticker.latestDecision
          ? stateRef(
              "event",
              ticker.latestDecision.eventId,
              "portfolio.decision.proposed",
            )
          : null,
        stateRef("event", ticker.latestRiskState.eventId, "risk.state.validated"),
      ]),
      message:
        "Decision risk snapshot does not match the current ArrowHedge risk state.",
    });
  }

  if (
    ticker.latestDecision?.signalSourceSnapshotId !== null &&
    ticker.latestDecision?.signalSourceSnapshotId !== undefined &&
    ticker.latestSignal !== undefined &&
    ticker.latestDecision.signalSourceSnapshotId !== ticker.latestSignal.sourceSnapshotId
  ) {
    conflicts.push({
      conflictType: "state_disagreement",
      refs: presentStateRefs([
        ticker.latestDecision
          ? stateRef(
              "event",
              ticker.latestDecision.eventId,
              "portfolio.decision.proposed",
            )
          : null,
        stateRef("event", ticker.latestSignal.eventId, "analyst.signal.created"),
      ]),
      message:
        "Decision signal snapshot does not match the current ArrowHedge analyst signal.",
    });
  }

  if (tickerRiskStateIsStale(ticker, asOf)) {
    conflicts.push({
      conflictType: "stale_observation",
      refs: presentStateRefs([
        ticker.latestRiskState
          ? stateRef("event", ticker.latestRiskState.eventId, "risk.state.validated")
          : null,
      ]),
      message:
        "Current ArrowHedge risk state is past its freshness window for this proposal.",
    });
  }

  return conflicts;
}

function tickerWorkflowPosition(
  ticker: ArrowHedgeTickerCop,
  conflicts: readonly StateConflict[],
  asOf: Timestamp,
): string {
  if (ticker.staleBlocks > 0 || conflicts.length > 0 || tickerRiskStateIsStale(ticker, asOf)) {
    return "blocked_stale_state";
  }
  if (ticker.latestDecision?.accepted === true && ticker.authorityGate.passes > 0) {
    return "accepted";
  }
  return "decision_pending";
}

function tickerAllowedActions(sourceRefs: readonly StateRef[]): readonly AllowedAction[] {
  return [
    {
      actionType: "portfolio.decision.accept",
      label: "Accept portfolio decision",
      requiredRefs: sourceRefs,
      requiredWorkflowPosition: "decision_pending",
    },
    {
      actionType: "workflow.block",
      label: "Block workflow",
      requiredRefs: sourceRefs,
      requiredWorkflowPosition: "blocked_stale_state",
    },
    {
      actionType: "risk.refresh",
      label: "Refresh risk state",
      requiredRefs: [],
    },
  ];
}

function latestTickerTimestamp(ticker: ArrowHedgeTickerCop): Timestamp | null {
  return maxTimestamp([
    ticker.latestSignal?.observedAt,
    ticker.latestRiskState?.observedAt,
    ticker.latestDecision?.observedAt,
  ]);
}

function latestTickerAuthority(ticker: ArrowHedgeTickerCop): string | null {
  return (
    ticker.latestDecision?.authority ??
    ticker.latestRiskState?.authority ??
    ticker.latestSignal?.authority ??
    null
  );
}

function tickerRiskStateIsStale(
  ticker: ArrowHedgeTickerCop,
  observedAt: Timestamp,
): boolean {
  const validUntil = ticker.latestRiskState?.freshnessExpiresAt;
  return typeof validUntil === "string" && Date.parse(validUntil) < Date.parse(observedAt);
}

function uniqueStateRefs(refs: readonly (StateRef | null)[]): readonly StateRef[] {
  const seen = new Set<string>();
  const out: StateRef[] = [];
  for (const ref of refs) {
    if (!ref) continue;
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  return out;
}

function presentStateRefs(refs: readonly (StateRef | null)[]): readonly StateRef[] {
  return refs.filter((ref): ref is StateRef => ref !== null);
}

function maxTimestamp(values: readonly (Timestamp | undefined)[]): Timestamp | null {
  const present = values.filter((value): value is Timestamp => value !== undefined);
  if (present.length === 0) return null;
  return present.reduce((latest, candidate) =>
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest,
  );
}

function eventAuthority(event: PMEvent): string {
  return event.authority ?? event.emittedBy;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function invalidPlan(
  issues: readonly ArrowHedgeValidationIssue[],
  ctx: ArrowHedgePlanContext,
  attempts: number,
): ArrowHedgeIngestionPlan {
  return {
    valid: false,
    issues,
    mapping: { valid: false, issues, items: [] },
    edges: [],
    typedEvents: [],
    operationalSample: {
      adapterStartedAt: ctx.adapterStartedAt,
      mappingAttempts: attempts,
      mappingRejections: issues.length,
      stateComparisons: 0,
      stateDisagreements: 0,
    },
  };
}

function typedEvent(input: MappingEventInput): MappingEventInput {
  return input;
}

function loadPayloadSchema(filename: string): PayloadJsonSchema {
  const url = new URL(`../schemas/${filename}`, import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as PayloadJsonSchema;
}

function payloadSchemaFor(schemaId: string): PayloadJsonSchema | undefined {
  const normalized = schemaId.endsWith(".json") ? schemaId.slice(0, -5) : schemaId;
  return ARROWHEDGE_TYPED_EVENT_PAYLOAD_SCHEMAS[normalized];
}

function validateTypedEventPayloads(
  events: readonly MappingEventInput[],
): readonly ArrowHedgeValidationIssue[] {
  return events.flatMap((event, index) =>
    validateArrowHedgeTypedEventPayload(event).issues.map((issue) => ({
      path: `/typedEvents/${index}${issue.path}`,
      message: issue.message,
    })),
  );
}

function validateSchemaValue(
  value: unknown,
  schema: PayloadJsonSchema,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): void {
  const expectedTypes = normalizeSchemaTypes(schema.type);
  if (expectedTypes.length > 0 && !expectedTypes.some((type) => matchesType(value, type))) {
    issues.push({
      path,
      message: `expected type ${expectedTypes.join(" or ")}, got ${actualSchemaType(value)}`,
    });
    return;
  }

  if (schema.enum && !schema.enum.some((candidate) => Object.is(candidate, value))) {
    issues.push({
      path,
      message: `expected one of ${schema.enum.map((candidate) => JSON.stringify(candidate)).join(", ")}`,
    });
  }

  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) {
      issues.push({ path, message: `expected number >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      issues.push({ path, message: `expected number <= ${schema.maximum}` });
    }
  }

  if (
    schema.format === "date-time" &&
    typeof value === "string" &&
    Number.isNaN(Date.parse(value))
  ) {
    issues.push({ path, message: "expected format date-time" });
  }

  if (isRecord(value)) {
    validateObjectSchema(value, schema, path, issues);
  } else if (Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      validateSchemaValue(item, schema.items!, `${path}/${index}`, issues);
    });
  }
}

function validateObjectSchema(
  value: Readonly<Record<string, unknown>>,
  schema: PayloadJsonSchema,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): void {
  const properties = schema.properties ?? {};
  for (const field of schema.required ?? []) {
    if (value[field] === undefined || value[field] === null) {
      issues.push({
        path: `${path}/${field}`,
        message: "required field missing or null",
      });
    }
  }

  for (const [field, fieldSchema] of Object.entries(properties)) {
    if (!(field in value)) continue;
    validateSchemaValue(value[field], fieldSchema, `${path}/${field}`, issues);
  }

  if (schema.additionalProperties === false) {
    const declared = new Set(Object.keys(properties));
    for (const field of Object.keys(value)) {
      if (!declared.has(field)) {
        issues.push({
          path: `${path}/${field}`,
          message: "unknown field (additionalProperties: false)",
        });
      }
    }
  }
}

function normalizeSchemaTypes(
  type: PayloadJsonSchema["type"],
): readonly JsonSchemaType[] {
  if (!type) return [];
  if (typeof type === "string") return [type];
  return type;
}

function matchesType(value: unknown, expected: JsonSchemaType): boolean {
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return typeof value === "number" && Number.isInteger(value);
  if (expected === "null") return value === null;
  if (expected === "object") return isRecord(value);
  return typeof value === expected;
}

function actualSchemaType(value: unknown): JsonSchemaType {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  if (typeof value === "number") return "number";
  if (isRecord(value)) return "object";
  return typeof value as JsonSchemaType;
}

function blockedReason(snapshot: ParsedArrowHedgeSnapshot): string {
  const reasons: string[] = [];
  if (hasStateDisagreement(snapshot)) reasons.push("state_disagreement");
  if (isStale(snapshot)) reasons.push("stale_observation");
  return reasons.length === 0 ? "state_blocked" : reasons.join("+");
}

function stableEntityId(input: string): EntityId {
  const hex = createHash("sha256").update(`arrowhedge:${input}`).digest("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-") as EntityId;
}

function groupRecords(
  records: readonly SourceEntityRecord[],
): Map<string, readonly SourceEntityRecord[]> {
  const out = new Map<string, SourceEntityRecord[]>();
  for (const record of records) {
    const group = out.get(record.sourceName) ?? [];
    group.push(record);
    out.set(record.sourceName, group);
  }
  return out;
}

function one(
  groups: ReadonlyMap<string, readonly SourceEntityRecord[]>,
  sourceName: string,
): SourceEntityRecord {
  const record = groups.get(sourceName)?.[0];
  if (!record) throw new Error(`missing parsed source record: ${sourceName}`);
  return record;
}

function spec(
  sourceName: string,
  edgeKey: string,
  from: SourceEntityRecord,
  to: SourceEntityRecord,
) {
  return { sourceName, edgeKey, from, to };
}

function hasStateDisagreement(snapshot: ParsedArrowHedgeSnapshot): boolean {
  return (
    (snapshot.decisionRiskSourceSnapshotId !== null &&
      snapshot.decisionRiskSourceSnapshotId !== snapshot.snapshotId) ||
    (snapshot.decisionSignalSourceSnapshotId !== null &&
      snapshot.decisionSignalSourceSnapshotId !== snapshot.snapshotId)
  );
}

function isStale(snapshot: ParsedArrowHedgeSnapshot): boolean {
  if (!snapshot.riskFreshnessExpiresAt) return false;
  return Date.parse(snapshot.riskFreshnessExpiresAt) < Date.parse(snapshot.observedAt);
}

function sameIdentity(
  a: Readonly<Record<string, unknown>>,
  b: Readonly<Record<string, unknown>>,
): boolean {
  return JSON.stringify(sortObject(a)) === JSON.stringify(sortObject(b));
}

function sortObject(input: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).sort(([a], [b]) => a.localeCompare(b)));
}

function emptyTicker(symbol: string): ArrowHedgeTickerCop {
  return {
    symbol,
    authorityGate: { passes: 0, failures: 0 },
    stateDisagreements: 0,
    staleBlocks: 0,
  };
}

function summarizeCop(
  tickers: Readonly<Record<string, ArrowHedgeTickerCop>>,
): ArrowHedgeCommonOperatingPictureState["summary"] {
  const values = Object.values(tickers);
  const validEventCount = values.reduce(
    (acc, ticker) =>
      acc +
      (ticker.latestSignal ? 1 : 0) +
      (ticker.latestRiskState ? 1 : 0) +
      (ticker.latestDecision ? 1 : 0) +
      ticker.authorityGate.passes +
      ticker.authorityGate.failures,
    0,
  );
  const passes = values.reduce((acc, ticker) => acc + ticker.authorityGate.passes, 0);
  const failures = values.reduce((acc, ticker) => acc + ticker.authorityGate.failures, 0);
  const comparisons = values.reduce(
    (acc, ticker) => acc + (ticker.latestDecision && ticker.latestRiskState ? 1 : 0),
    0,
  );
  const disagreements = values.reduce(
    (acc, ticker) => acc + ticker.stateDisagreements,
    0,
  );
  return {
    validEventCount,
    authorityGatePassRate: passes + failures === 0 ? null : passes / (passes + failures),
    stateDisagreementRate: comparisons === 0 ? null : disagreements / comparisons,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Record<string, unknown> | null {
  const value = input[path.slice(1)];
  if (!isRecord(value)) {
    issues.push({ path, message: "expected object" });
    return null;
  }
  return value;
}

function arrayAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): readonly unknown[] | null {
  const value = input[path.slice(1)];
  if (!Array.isArray(value)) {
    issues.push({ path, message: "expected array" });
    return null;
  }
  return value;
}

function stringAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): string | null {
  const value = input[path.split("/").at(-1)!];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "expected non-empty string" });
    return null;
  }
  return value;
}

function optionalStringAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): string | null {
  const value = input[path.split("/").at(-1)!];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    issues.push({ path, message: "expected string when present" });
    return null;
  }
  return value;
}

function numberAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): number | null {
  const value = input[path.split("/").at(-1)!];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path, message: "expected finite number" });
    return null;
  }
  return value;
}

function optionalNumberAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): number | null {
  const value = input[path.split("/").at(-1)!];
  if (value === undefined || value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ path, message: "expected finite number when present" });
    return null;
  }
  return value;
}

function booleanAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): boolean | null {
  const value = input[path.split("/").at(-1)!];
  if (typeof value !== "boolean") {
    issues.push({ path, message: "expected boolean" });
    return null;
  }
  return value;
}

function timestampAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Timestamp | null {
  const value = stringAt(input, path, issues);
  if (value === null) return null;
  if (Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: "expected ISO timestamp" });
    return null;
  }
  return value as Timestamp;
}

function optionalTimestampAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Timestamp | null {
  const value = optionalStringAt(input, path, issues);
  if (value === null) return null;
  if (Number.isNaN(Date.parse(value))) {
    issues.push({ path, message: "expected ISO timestamp when present" });
    return null;
  }
  return value as Timestamp;
}
