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
  buildActionOutcomeEnvelope,
  buildActionOutcomeProviderAuthority,
  buildActionOutcomeTerminalIndex,
  buildObservationContractFromCurrentStateView,
  buildEvidenceLinkedContinuityPayloadFromStateReviewArtifact,
  buildReadSetFromCurrentStateView,
  buildStateReviewArtifact,
  evaluateObservationContract,
  importStateReviewArtifactsJsonl,
  reviewProposedActionAgainstCurrentState,
  serializeStateReviewArtifactsJsonl,
  stateRef,
  type ActionOutcomeEnvelope,
  type ActionOutcomeBlockingCause,
  type ActionOutcomeProviderAuthority,
  type ActionOutcomeTerminalIndex,
  type ActionProposalReviewEnforcementMode,
  type ActionProposalReview,
  type ActionTerminalOutcome,
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
  verifyActionOutcomeEnvelopeHash,
} from "@pm/agent-state";
import {
  checkpointHash,
  findContinuityContradictions,
  verifyContinuityCheckpointChain,
  type ContinuityCheckpoint,
} from "@pm/continuity";
import type {
  EntityId,
  EventId,
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
      fieldMap: {
        allowedActions: "allowedActions",
      },
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
  readonly signalSourceRecordIds: readonly string[];
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

export interface ArrowHedgeExpandedEvidenceDocument {
  readonly id: string;
  readonly sha256: string;
  readonly mimeType: string;
  readonly filename: string;
  readonly ticker?: string;
  readonly sourceUri?: string;
  readonly retrievedAt?: Timestamp;
  readonly freshnessExpiresAt?: Timestamp;
}

export interface ArrowHedgeExpandedRunSnapshot {
  readonly snapshotId: string;
  readonly observedAt: Timestamp;
  readonly authority: string;
  readonly backtestRun: Readonly<Record<string, unknown>>;
  readonly researchRun: Readonly<Record<string, unknown>>;
  readonly ticker: {
    readonly symbol: string;
    readonly assetClass: string;
    readonly exchange?: string;
    readonly currency: string;
  };
  readonly evidence: readonly ArrowHedgeExpandedEvidenceDocument[];
  readonly signal: Readonly<Record<string, unknown>>;
  readonly signals: readonly Readonly<Record<string, unknown>>[];
  readonly risk: Readonly<Record<string, unknown>>;
  readonly portfolio: Readonly<Record<string, unknown>>;
  readonly decision: Readonly<Record<string, unknown>>;
}

export interface ArrowHedgeRunEnvelopeExpansionResult {
  readonly valid: boolean;
  readonly issues: readonly ArrowHedgeValidationIssue[];
  readonly snapshots: readonly ArrowHedgeExpandedRunSnapshot[];
}

export interface ArrowHedgeRunEnvelopeOfflineReviewContext {
  readonly tenantId: TenantId;
  readonly profile: ProfileDefinition;
  readonly adapterStartedAt: Timestamp;
  readonly emittedBy?: string;
  readonly projectionName?: string;
  readonly scopeNodeIdsByTenant?: boolean;
}

export interface ArrowHedgeRunEnvelopeOfflineReview {
  readonly valid: boolean;
  readonly issues: readonly ArrowHedgeValidationIssue[];
  readonly expanded: {
    readonly snapshots: number;
    readonly tickers: readonly string[];
  };
  readonly ingested: {
    readonly nodesCreated: number;
    readonly edgesCreated: number;
    readonly eventsPublished: number;
    readonly eventIds: readonly string[];
    readonly blockedEventIds: readonly string[];
  };
  readonly cop: ArrowHedgeCommonOperatingPictureState;
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
          readonly revision: number;
        };
      }>;
    updateNode(
      input: {
        readonly tenantId: TenantId;
        readonly id: EntityId;
        readonly identity: Readonly<Record<string, unknown>>;
        readonly expectedRevision?: number;
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
  "finance-research/workflow-blocked-invalid-action.v1":
    "workflow-blocked-invalid-action.v1.json",
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

export function expandArrowHedgeRunEnvelope(
  input: unknown,
): ArrowHedgeRunEnvelopeExpansionResult {
  const issues: ArrowHedgeValidationIssue[] = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      issues: [{ path: "", message: "expected object" }],
      snapshots: [],
    };
  }

  const schemaVersion = stringAt(input, "/schemaVersion", issues);
  if (
    schemaVersion !== null &&
    schemaVersion !== "arrowhedge.run-envelope.v1"
  ) {
    issues.push({
      path: "/schemaVersion",
      message: "expected arrowhedge.run-envelope.v1",
    });
  }
  const runId = stringAt(input, "/runId", issues);
  const surface = stringAt(input, "/surface", issues);
  const substrateMode = stringAt(input, "/substrateMode", issues);
  const observedAt = timestampAt(input, "/observedAt", issues);
  const scope = objectAt(input, "/scope", issues);
  const graph = objectAt(input, "/graph", issues);
  const modelConfig = objectAt(input, "/modelConfig", issues);
  const portfolioInput = objectAt(input, "/portfolio", issues);
  const signalsInput = arrayAt(input, "/signals", issues);
  const riskStatesInput = arrayAt(input, "/riskStates", issues);
  const decisionsInput = arrayAt(input, "/decisions", issues);
  const evidenceInput = arrayAt(input, "/evidence", issues);

  if (issues.length > 0) {
    return { valid: false, issues, snapshots: [] };
  }

  const startDate = stringAt(scope!, "/scope/startDate", issues);
  const endDate = stringAt(scope!, "/scope/endDate", issues);
  const rawTickers = arrayField(scope!, "tickers", "/scope/tickers", issues);
  const tickers = rawTickers.flatMap((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      issues.push({
        path: `/scope/tickers/${index}`,
        message: "expected non-empty string",
      });
      return [];
    }
    return [item];
  });

  const runEvidence = [
    ...normalizeRunEnvelopeEvidence(evidenceInput!, issues),
    runEnvelopeEvidenceDocument({
      runId: runId!,
      kind: "graph",
      payload: graph!,
      observedAt: observedAt!,
    }),
    runEnvelopeEvidenceDocument({
      runId: runId!,
      kind: "model_config",
      payload: modelConfig!,
      observedAt: observedAt!,
    }),
  ];

  const snapshots = tickers.flatMap((ticker) => {
    const snapshot = expandTickerRunEnvelopeSnapshot({
      runId: runId!,
      surface: surface!,
      substrateMode: substrateMode!,
      observedAt: observedAt!,
      startDate: startDate!,
      endDate: endDate!,
      ticker,
      modelConfig: modelConfig!,
      portfolioInput: portfolioInput!,
      signalsInput: signalsInput!,
      riskStatesInput: riskStatesInput!,
      decisionsInput: decisionsInput!,
      evidence: runEvidence,
      issues,
    });
    return snapshot ? [snapshot] : [];
  });

  if (issues.length > 0) {
    return { valid: false, issues, snapshots: [] };
  }

  return {
    valid: true,
    issues: [],
    snapshots,
  };
}

export async function reviewArrowHedgeRunEnvelopeOffline(
  input: unknown,
  ctx: ArrowHedgeRunEnvelopeOfflineReviewContext,
): Promise<ArrowHedgeRunEnvelopeOfflineReview> {
  const expanded = expandArrowHedgeRunEnvelope(input);
  const projection = createArrowHedgeCommonOperatingPictureProjection(
    ctx.projectionName ?? "arrowhedge_cop_offline_review",
  );
  let cop = projection.initial();
  const eventIds: string[] = [];
  const blockedEventIds: string[] = [];
  let nodesCreated = 0;
  let edgesCreated = 0;
  let eventsPublished = 0;
  const issues: ArrowHedgeValidationIssue[] = [...expanded.issues];
  const runId = isRecord(input) && typeof input["runId"] === "string"
    ? input["runId"]
    : "unknown_run";

  if (!expanded.valid) {
    return {
      valid: false,
      issues,
      expanded: { snapshots: 0, tickers: [] },
      ingested: {
        nodesCreated: 0,
        edgesCreated: 0,
        eventsPublished: 0,
        eventIds: [],
        blockedEventIds: [],
      },
      cop,
    };
  }

  for (const [snapshotIndex, snapshot] of expanded.snapshots.entries()) {
    const plan = buildArrowHedgeIngestionPlan(snapshot, {
      tenantId: ctx.tenantId,
      profile: ctx.profile,
      adapterStartedAt: ctx.adapterStartedAt,
      ...(ctx.emittedBy !== undefined ? { emittedBy: ctx.emittedBy } : {}),
      scopeNodeIdsByTenant: ctx.scopeNodeIdsByTenant ?? true,
    });
    if (!plan.valid) {
      issues.push(
        ...plan.issues.map((issue) => ({
          path: `/snapshots/${snapshotIndex}${issue.path}`,
          message: issue.message,
        })),
      );
      continue;
    }

    nodesCreated += plan.mapping.items.length;
    edgesCreated += plan.edges.length;
    eventsPublished += plan.mapping.items.length + plan.typedEvents.length;
    for (const [index, event] of plan.typedEvents.entries()) {
      const id = offlineReviewEventId(runId, snapshotIndex, index, event.type);
      eventIds.push(id);
      if (event.type.startsWith("workflow.blocked.")) {
        blockedEventIds.push(id);
      }
      cop = await projection.apply(cop, {
        id: id as EventId,
        tenantId: event.tenantId,
        type: event.type,
        entityId: event.entityId,
        emittedBy: event.emittedBy,
        payloadSchema: event.payloadSchema,
        payload: event.payload,
        schemaVersion: 1,
        authority: event.authority ?? event.emittedBy,
        contentHash: sha256StableJson(event),
        priorEventHash: null,
        occurredAt: event.occurredAt!,
        recordedAt: event.occurredAt!,
        causedBy: null,
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    expanded: {
      snapshots: expanded.snapshots.length,
      tickers: expanded.snapshots.map((snapshot) => snapshot.ticker.symbol),
    },
    ingested: {
      nodesCreated,
      edgesCreated,
      eventsPublished,
      eventIds,
      blockedEventIds,
    },
    cop,
  };
}

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
  const signals = optionalArrayAt(input, "/signals", issues);
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
  const signalSourceRecordIds: string[] = [];
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
    const signalRecords = signals && signals.length > 0 ? signals : [signal!];
    for (const [index, rawSignal] of signalRecords.entries()) {
      const signalPath = signals && signals.length > 0 ? `/signals/${index}` : "/signal";
      if (!isRecord(rawSignal)) {
        issues.push({ path: signalPath, message: "expected object" });
        continue;
      }
      const signalId = stringAt(rawSignal, `${signalPath}/id`, issues);
      const sourceRecordId = `signal:${signalId ?? index}`;
      signalSourceRecordIds.push(sourceRecordId);
      pushRecord("AnalystSignalSource", sourceRecordId, {
        kind: "analyst_signal",
        occurredAt: observedAt,
        agentId: stringAt(rawSignal, `${signalPath}/agentId`, issues),
        signal: stringAt(rawSignal, `${signalPath}/signal`, issues),
        confidence: numberAt(rawSignal, `${signalPath}/confidence`, issues),
        evidenceWindowStart: optionalTimestampAt(
          rawSignal,
          `${signalPath}/evidenceWindowStart`,
          issues,
        ),
        evidenceWindowEnd: optionalTimestampAt(
          rawSignal,
          `${signalPath}/evidenceWindowEnd`,
          issues,
        ),
        sourceSnapshotId: snapshotId,
      });
    }
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
      allowedActions: optionalAllowedActionsAt(
        decision!,
        "/decision/allowedActions",
        issues,
      ),
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
      signalSourceRecordIds,
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
            expectedSchemaVersion: item.node.schemaVersion,
            expectedRevision: result.node.revision,
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
  readonly invalidActionBlocks: number;
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
  readonly continuityCheck?: ArrowHedgeContinuityCheck;
}

export interface ArrowHedgeActionOutcomeEnvelopeInput
  extends ArrowHedgeStateReviewArtifactInput {
  readonly actionId?: string;
  readonly requestedTerminalOutcome?: ActionTerminalOutcome;
  readonly decidedAt?: Timestamp;
  readonly decidedBy?: string;
  readonly providerAuthority?: ActionOutcomeProviderAuthority | null;
  readonly terminalPacketRunArm?: ArrowHedgeActionOutcomeEnvelopeRunArm;
  readonly terminalPacketAuthorityRole?: ArrowHedgeActionOutcomeEnvelopeAuthorityRole;
  readonly statusCheckRefs?: readonly StateRef[];
  readonly substrateRefs?: readonly StateRef[];
}

export interface ArrowHedgeContinuityCheck {
  readonly agentId: string;
  readonly checkpoints: readonly ContinuityCheckpoint[];
  readonly requiredDecisionRefs?: readonly string[];
  readonly requiredEvidenceEventIds?: readonly EventId[];
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

export type ArrowHedgeActionOutcomeEnvelopeRunArm = "baseline" | "substrate";

export type ArrowHedgeActionOutcomeEnvelopeAuthorityRole =
  | "comparator_observation"
  | "substrate_authority";

export interface ArrowHedgeStateReviewArtifactCorpus {
  readonly artifacts: readonly StateReviewArtifact[];
  readonly jsonl: string;
  readonly continuityPayloads: readonly StateReviewArtifactContinuityPayload[];
}

export interface ArrowHedgeActionOutcomeEnvelopeCorpusPacket {
  readonly scenarioId: string;
  readonly runArm: ArrowHedgeActionOutcomeEnvelopeRunArm;
  readonly authorityRole: ArrowHedgeActionOutcomeEnvelopeAuthorityRole;
  readonly actionId: string;
  readonly ref: StateRef;
  readonly envelope: ActionOutcomeEnvelope;
  readonly terminalOutcome: ActionTerminalOutcome;
  readonly outcomeHash: string;
  readonly hashValid: boolean;
}

export interface ArrowHedgeActionOutcomeEnvelopeCorpus {
  readonly packets: readonly ArrowHedgeActionOutcomeEnvelopeCorpusPacket[];
  readonly terminalIndex: ActionOutcomeTerminalIndex;
  readonly hashValid: boolean;
  readonly valid: boolean;
  readonly terminalOutcomeCounts: Readonly<Record<ActionTerminalOutcome, number>>;
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

export function buildArrowHedgeActionOutcomeEnvelope(
  input: ArrowHedgeActionOutcomeEnvelopeInput,
): ActionOutcomeEnvelope | null {
  const artifact = buildArrowHedgeStateReviewArtifact(input);
  if (!artifact) return null;

  const continuityRefs = arrowHedgeContinuityRefs(input.continuityCheck);
  const continuityBlockingCauses = buildArrowHedgeContinuityBlockingCauses(
    input.tenantId,
    input.continuityCheck,
  );
  const actionId = input.actionId ?? arrowHedgeActionId(input, artifact);
  const outcomeRef = stateRef(
    "action_outcome_envelope",
    arrowHedgeActionOutcomeRefId(actionId),
    "ArrowHedge ActionOutcomeEnvelope",
  );
  const requestedTerminalOutcome =
    input.requestedTerminalOutcome ??
    (artifact.review.execution.allowed ? "accepted" : "blocked");
  const providerAuthority =
    input.providerAuthority === null
      ? undefined
      : input.providerAuthority ??
        (requestedTerminalOutcome === "accepted" && artifact.review.execution.allowed
          ? buildArrowHedgeActionOutcomeProviderAuthority(
              input.decidedAt ?? artifact.generatedAt,
            )
          : undefined);

  return buildActionOutcomeEnvelope({
    tenantId: input.tenantId,
    actionId,
    subject: artifact.review.currentStateView.subject,
    proposalReviewId: artifact.review.reviewId,
    stateReviewArtifactHash: artifact.artifactHash,
    evidenceAdmissionReviewIds: [],
    ...(input.statusCheckRefs !== undefined
      ? { statusCheckRefs: input.statusCheckRefs }
      : {}),
    ...(providerAuthority !== undefined
      ? {
          providerCertificateId: providerAuthority.providerCertificateId,
          providerCertificateDigest: providerAuthority.providerCertificateDigest,
          providerCertificateStatusRef:
            providerAuthority.providerCertificateStatusRef,
        }
      : {}),
    requestedTerminalOutcome,
    decidedAt: input.decidedAt ?? artifact.generatedAt,
    decidedBy: input.decidedBy ?? "arrowhedge:proposal-review-gate",
    evidenceRefs: uniqueStateRefs([...artifact.provenance.used, ...continuityRefs]),
    substrateRefs: uniqueStateRefs([
      outcomeRef,
      stateRef("state_review_artifact", artifact.artifactId),
      artifact.review.currentStateView.subject,
      ...continuityRefs,
      ...(input.substrateRefs ?? []),
    ]),
    blockingCauses: continuityBlockingCauses,
    proposalReview: artifact.review,
  });
}

export function buildArrowHedgeActionOutcomeTerminalIndex(
  inputs: readonly ArrowHedgeActionOutcomeEnvelopeInput[],
): ActionOutcomeTerminalIndex {
  return buildActionOutcomeTerminalIndex(
    inputs.flatMap((input) => {
      const envelope = buildArrowHedgeActionOutcomeEnvelope(input);
      return envelope === null ? [] : [envelope];
    }),
  );
}

export function buildArrowHedgeActionOutcomeEnvelopeCorpus(
  inputs: readonly ArrowHedgeActionOutcomeEnvelopeInput[],
): ArrowHedgeActionOutcomeEnvelopeCorpus {
  const packets = inputs.flatMap((input) => {
    const envelope = buildArrowHedgeActionOutcomeEnvelope(input);
    if (envelope === null) return [];
    const ref = actionOutcomeEnvelopeRef(envelope);
    const hash = verifyActionOutcomeEnvelopeHash(envelope);
    return [
      {
        scenarioId: input.scenarioId ?? "arrowhedge-unscoped-action",
        runArm: input.terminalPacketRunArm ?? "substrate",
        authorityRole:
          input.terminalPacketAuthorityRole ??
          defaultTerminalPacketAuthorityRole(input.terminalPacketRunArm),
        actionId: envelope.actionId,
        ref,
        envelope,
        terminalOutcome: envelope.terminalOutcome,
        outcomeHash: envelope.outcomeHash,
        hashValid: hash.valid,
      } satisfies ArrowHedgeActionOutcomeEnvelopeCorpusPacket,
    ];
  });
  const terminalIndex = buildActionOutcomeTerminalIndex(
    packets.map((packet) => packet.envelope),
  );
  const terminalOutcomeCounts = emptyTerminalOutcomeCounts();
  for (const packet of packets) {
    terminalOutcomeCounts[packet.terminalOutcome] += 1;
  }
  const hashValid = packets.every((packet) => packet.hashValid);

  return {
    packets,
    terminalIndex,
    hashValid,
    valid: hashValid && terminalIndex.valid,
    terminalOutcomeCounts,
  };
}

export function buildArrowHedgeCanonicalActionOutcomeEnvelopeCorpus(
  input: ArrowHedgeCanonicalStateReviewArtifactCorpusInput,
): ArrowHedgeActionOutcomeEnvelopeCorpus {
  const cleanCase = buildArrowHedgeCleanCurrentFixtureCase(input);
  const temporalCases = buildArrowHedgeTemporalMisalignmentFixtureCases(input);

  return buildArrowHedgeActionOutcomeEnvelopeCorpus([
    ...(cleanCase ? [cleanCase] : []),
    ...temporalCases,
  ]);
}

export function buildArrowHedgeCanonicalPairedActionOutcomeEnvelopeCorpus(
  input: ArrowHedgeCanonicalStateReviewArtifactCorpusInput,
): ArrowHedgeActionOutcomeEnvelopeCorpus {
  const packetCases = [
    ...buildArrowHedgeTemporalMisalignmentFixtureCases(input),
    ...buildArrowHedgeSourceAuthorityConflictFixtureCases(input),
    ...buildArrowHedgeContinuityFixtureCases(input),
  ];
  const pairedInputs = packetCases.flatMap((fixtureCase) => [
    buildBaselineTerminalObservationCase(fixtureCase),
    {
      ...fixtureCase,
      terminalPacketRunArm: "substrate" as const,
      terminalPacketAuthorityRole: "substrate_authority" as const,
    },
  ]);

  return buildArrowHedgeActionOutcomeEnvelopeCorpus(pairedInputs);
}

function buildBaselineTerminalObservationCase(
  input: ArrowHedgeStateReviewArtifactCorpusInput & ArrowHedgeActionOutcomeEnvelopeInput,
): ArrowHedgeActionOutcomeEnvelopeInput {
  const { continuityCheck: _continuityCheck, ...baselineInput } = input;
  const artifact = input.artifact;
  return {
    ...baselineInput,
    actionId: arrowHedgeBaselineObservationActionId(input),
    requestedTerminalOutcome: "accepted",
    enforcementMode: "advisory",
    providerAuthority: null,
    terminalPacketRunArm: "baseline",
    terminalPacketAuthorityRole: "comparator_observation",
    decidedBy: "arrowhedge:baseline-comparator",
    substrateRefs: [
      stateRef(
        "document",
        `${input.scenarioId}:baseline-comparator`,
        "ArrowHedge baseline comparator observation",
      ),
    ],
    artifact: {
      ...artifact,
      artifactId:
        artifact?.artifactId === undefined
          ? `artifact_${input.scenarioId}_baseline_observation`
          : `${artifact.artifactId}_baseline_observation`,
      metadata: {
        ...(artifact?.metadata ?? {}),
        evalEventIds: [
          ...(artifact?.metadata?.evalEventIds ?? []),
          `${input.scenarioId}:baseline`,
        ],
      },
    },
  };
}

export function buildArrowHedgeActionOutcomeProviderAuthority(
  checkedAt: Timestamp,
): ActionOutcomeProviderAuthority {
  return buildActionOutcomeProviderAuthority({
    certificateId: "tapc_arrowhedge_terminal_provider_v1",
    certificateDigest: "sha256:arrowhedge_terminal_provider_v1",
    statusEventHash: "sha256:arrowhedge_terminal_provider_status_v1",
    statusUpdatedAt: "2026-06-03T13:59:30.000Z" as Timestamp,
    checkedAt,
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

export function buildArrowHedgeSourceAuthorityConflictFixtureCases(
  input: ArrowHedgeTemporalMisalignmentFixtureCasesInput,
): readonly ArrowHedgeStateReviewArtifactCorpusInput[] {
  const conflictState = arrowHedgeSourceAuthorityConflictState(
    input.state,
    input.symbol,
  );
  const view = buildArrowHedgeCurrentStateView({
    ...input,
    state: conflictState,
    evaluatedAt: input.observationCapturedAt,
  });
  const ticker = conflictState.tickers[input.symbol];
  const decisionId = ticker?.latestDecision?.decisionId;
  if (!view || !ticker?.latestRiskState || !decisionId) return [];

  return [
    {
      tenantId: input.tenantId,
      projectionName: input.projectionName,
      ...(input.projectionVersion !== undefined
        ? { projectionVersion: input.projectionVersion }
        : {}),
      symbol: input.symbol,
      state: conflictState,
      scenarioId: "arrowhedge-source-authority-risk-snapshot-conflict",
      actionType: "portfolio.decision.accept",
      payload: {
        decisionId,
        authorityConflictId: `risk:${ticker.latestRiskState.sourceSnapshotId}`,
      },
      proposedBy: input.proposedBy ?? "agent:portfolio-manager",
      proposedAt: input.observationCapturedAt,
      readSet: buildReadSetFromCurrentStateView(view, view.authorityRule),
      observationContract: buildObservationContractFromCurrentStateView(view),
      artifact: {
        artifactId: "artifact_arrowhedge_source_authority_conflict_001",
        metadata: {
          temporalMisalignmentPhase: "none",
          invariantClasses: ["source_authority", "state_conflict"],
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/source-authority-risk-snapshot-conflict.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-authority-fixture-risk-snapshot",
          workflowRunId: "arrowhedge-authority-workflow-risk-snapshot",
          evalEventIds: ["eval_arrowhedge_source_authority_conflict"],
        },
      },
    },
  ];
}

export function buildArrowHedgeContinuityFixtureCases(
  input: ArrowHedgeTemporalMisalignmentFixtureCasesInput,
): readonly ArrowHedgeStateReviewArtifactCorpusInput[] {
  const view = buildArrowHedgeCurrentStateView({
    ...input,
    evaluatedAt: input.observationCapturedAt,
  });
  const ticker = input.state.tickers[input.symbol];
  const decisionId = ticker?.latestDecision?.decisionId;
  if (!view || !decisionId) return [];

  const proposedBy = input.proposedBy ?? "agent:portfolio-manager";
  const readSet = buildReadSetFromCurrentStateView(view, view.authorityRule);
  const observationContract = buildObservationContractFromCurrentStateView(view);
  const continuityAgentId = "arrowhedge-axis-a-continuity";

  return [
    {
      tenantId: input.tenantId,
      projectionName: input.projectionName,
      ...(input.projectionVersion !== undefined
        ? { projectionVersion: input.projectionVersion }
        : {}),
      symbol: input.symbol,
      state: input.state,
      scenarioId: "arrowhedge-memory-drift-conflicting-position",
      actionType: "portfolio.decision.accept",
      payload: {
        decisionId,
        memoryCheckpointId: "chk_arrowhedge_memory_drift_new_001",
      },
      proposedBy,
      proposedAt: input.observationCapturedAt,
      readSet,
      observationContract,
      continuityCheck: {
        agentId: continuityAgentId,
        checkpoints: buildArrowHedgeMemoryDriftCheckpoints(
          input.tenantId,
          continuityAgentId,
          decisionId,
        ),
      },
      artifact: {
        artifactId: "artifact_arrowhedge_memory_drift_conflict_001",
        metadata: {
          temporalMisalignmentPhase: "none",
          invariantClasses: ["state_conflict", "required_evidence"],
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/continuity-memory-drift-conflict.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-continuity-fixture-memory-drift",
          workflowRunId: "arrowhedge-continuity-workflow-memory-drift",
          evalEventIds: ["eval_arrowhedge_memory_drift_conflict"],
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
      scenarioId: "arrowhedge-continuity-break-missing-terminal-history",
      actionType: "risk.refresh",
      payload: {
        decisionId,
        refreshId: `refresh:${decisionId}:amnesiac_resume`,
      },
      proposedBy,
      proposedAt: input.observationCapturedAt,
      readSet,
      observationContract,
      continuityCheck: {
        agentId: continuityAgentId,
        checkpoints: buildArrowHedgeContinuityBreakCheckpoints(
          input.tenantId,
          continuityAgentId,
          decisionId,
        ),
        requiredDecisionRefs: [`arrowhedge:terminal:${decisionId}`],
      },
      artifact: {
        artifactId:
          "artifact_arrowhedge_continuity_break_missing_terminal_001",
        metadata: {
          temporalMisalignmentPhase: "none",
          invariantClasses: ["required_evidence", "workflow_position"],
          fixtureId:
            "fixtures/arrowhedge/state-review-artifacts/continuity-break-missing-terminal-history.json",
          clientSurface: "codex",
          provider: "openai",
          sessionId: "arrowhedge-continuity-fixture-break",
          workflowRunId: "arrowhedge-continuity-workflow-break",
          evalEventIds: ["eval_arrowhedge_continuity_break_missing_terminal"],
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
    invalidActionBlocks: ticker.invalidActionBlocks,
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
  const signals = bySourceName.get("AnalystSignalSource") ?? [];
  if (signals.length === 0) {
    throw new Error("expected at least one AnalystSignalSource record");
  }
  const primarySignal = signals[0]!;
  const risk = one(bySourceName, "RiskStateSource");
  const portfolio = one(bySourceName, "PortfolioStateSource");
  const decision = one(bySourceName, "PortfolioDecisionSource");
  const evidence = bySourceName.get("EvidenceDocumentSource") ?? [];

  const edgeSpecs = [
    spec("BacktestRunSource", "researchRun", backtest, research),
    spec("ResearchRunSource", "ticker", research, ticker),
    ...signals.map((signal) => spec("ResearchRunSource", "signal", research, signal)),
    spec("ResearchRunSource", "riskState", research, risk),
    spec("ResearchRunSource", "portfolioState", research, portfolio),
    spec("ResearchRunSource", "decision", research, decision),
    ...signals.flatMap((signal) => [
      spec("AnalystSignalSource", "ticker", signal, ticker),
      ...evidence.map((item) => spec("AnalystSignalSource", "evidence", signal, item)),
    ]),
    spec("RiskStateSource", "ticker", risk, ticker),
    ...evidence.map((item) => spec("RiskStateSource", "evidence", risk, item)),
    spec("PortfolioDecisionSource", "ticker", decision, ticker),
    spec("PortfolioDecisionSource", "riskState", decision, risk),
    spec("PortfolioDecisionSource", "signal", decision, primarySignal),
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
  const signals = items.filter((item) => item.sourceName === "AnalystSignalSource");
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
    allowedActions: decision.node.identity["allowedActions"] ?? null,
    riskSourceSnapshotId: snapshot.decisionRiskSourceSnapshotId,
    signalSourceSnapshotId: snapshot.decisionSignalSourceSnapshotId,
    currentPrice: risk.node.identity["currentPrice"],
    occurredAt: snapshot.observedAt,
  };
  const invalidActionBlock = buildInvalidActionBlock({
    action: decision.node.identity["action"],
    quantity: decision.node.identity["quantity"],
    allowedActions: decision.node.identity["allowedActions"],
  });
  const signalEvents = signals.map((signal) =>
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
  );
  const events: MappingEventInput[] = [
    ...signalEvents,
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
    !isStale(snapshot) &&
    invalidActionBlock === null
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

  if (invalidActionBlock !== null) {
    events.push(
      typedEvent({
        tenantId,
        type: "workflow.blocked.invalid_action",
        entityId: bySource.get("ResearchRunSource")!.event.entityId,
        emittedBy,
        authority: snapshot.authority,
        occurredAt: snapshot.observedAt,
        payloadSchema: "finance-research/workflow-blocked-invalid-action.v1",
        payload: {
          researchRunId,
          blockedEntityId: decisionId,
          reason: invalidActionBlock.reason,
          sourceSnapshotId: snapshot.snapshotId,
          tickerSymbol: snapshot.tickerSymbol,
          action: invalidActionBlock.action,
          quantity: invalidActionBlock.quantity,
          allowedQuantity: invalidActionBlock.allowedQuantity,
          allowedActions: invalidActionBlock.allowedActions,
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
  } else if (event.type === "workflow.blocked.invalid_action") {
    next = {
      ...current,
      invalidActionBlocks: current.invalidActionBlocks + 1,
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
      conflictType: "source_authority_conflict",
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
      conflictType: "source_authority_conflict",
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
  if (ticker.invalidActionBlocks > 0) {
    return "blocked_invalid_action";
  }
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

function arrowHedgeActionId(
  input: ArrowHedgeActionOutcomeEnvelopeInput,
  artifact: StateReviewArtifact,
): string {
  const actionDiscriminator =
    payloadString(input.payload, "refreshId") ??
    payloadString(input.payload, "feedbackId") ??
    payloadString(input.payload, "authorityConflictId") ??
    payloadString(input.payload, "memoryCheckpointId") ??
    missingObservationActionDiscriminator(input.payload) ??
    payloadString(input.payload, "decisionId") ??
    artifact.review.reviewId;
  return [
    input.tenantId,
    input.projectionName,
    input.symbol,
    input.actionType,
    actionDiscriminator,
  ].join(":");
}

function arrowHedgeBaselineObservationActionId(
  input: ArrowHedgeStateReviewArtifactCorpusInput,
): string {
  return [
    input.tenantId,
    input.projectionName,
    input.symbol,
    input.actionType,
    "baseline",
    input.scenarioId,
  ].join(":");
}

function arrowHedgeActionOutcomeRefId(actionId: string): string {
  return `arrowhedge_outcome_${createHash("sha256")
    .update(actionId)
    .digest("hex")
    .slice(0, 32)}`;
}

function defaultTerminalPacketAuthorityRole(
  runArm: ArrowHedgeActionOutcomeEnvelopeRunArm | undefined,
): ArrowHedgeActionOutcomeEnvelopeAuthorityRole {
  return runArm === "baseline"
    ? "comparator_observation"
    : "substrate_authority";
}

function arrowHedgeContinuityRefs(
  continuityCheck: ArrowHedgeContinuityCheck | undefined,
): readonly StateRef[] {
  return uniqueStateRefs(
    (continuityCheck?.checkpoints ?? []).map((checkpoint) =>
      stateRef("continuity_checkpoint", checkpoint.id, checkpoint.title),
    ),
  );
}

function buildArrowHedgeContinuityBlockingCauses(
  tenantId: TenantId,
  continuityCheck: ArrowHedgeContinuityCheck | undefined,
): readonly ActionOutcomeBlockingCause[] {
  if (continuityCheck === undefined) return [];

  const refs = arrowHedgeContinuityRefs(continuityCheck);
  const causes: ActionOutcomeBlockingCause[] = [];
  const report = verifyContinuityCheckpointChain({
    tenantId,
    agentId: continuityCheck.agentId,
    checkpoints: continuityCheck.checkpoints,
  });

  if (!report.valid) {
    causes.push({
      source: "status_check",
      code: "continuity_checkpoint_chain_invalid",
      message:
        "Continuity checkpoint chain failed hash/prior-link verification before terminal action admission.",
      refs,
      invariantClasses: ["required_evidence", "source_authority"],
    });
  }

  const contradictions = findContinuityContradictions(
    continuityCheck.checkpoints,
  );
  if (contradictions.length > 0) {
    causes.push({
      source: "local_view",
      code: "continuity_memory_drift_conflict",
      message:
        "Continuity checkpoints contain conflicting open decision or claim summaries.",
      refs: uniqueStateRefs(
        contradictions.flatMap((finding) => [
          stateRef(
            "continuity_checkpoint",
            finding.older.id,
            finding.older.title,
          ),
          stateRef(
            "continuity_checkpoint",
            finding.newer.id,
            finding.newer.title,
          ),
        ]),
      ),
      invariantClasses: ["state_conflict"],
    });
  }

  const presentDecisionRefs = new Set(
    continuityCheck.checkpoints.flatMap((checkpoint) => checkpoint.decisionRefs),
  );
  const missingDecisionRefs = (continuityCheck.requiredDecisionRefs ?? []).filter(
    (ref) => !presentDecisionRefs.has(ref),
  );
  if (missingDecisionRefs.length > 0) {
    causes.push({
      source: "policy",
      code: "continuity_terminal_history_missing",
      message: `Continuity checkpoints are missing required terminal decision refs: ${missingDecisionRefs.join(", ")}.`,
      refs,
      invariantClasses: ["required_evidence", "workflow_position"],
    });
  }

  const presentEvidenceEventIds = new Set(
    continuityCheck.checkpoints.flatMap((checkpoint) =>
      checkpoint.evidenceEventIds.map(String),
    ),
  );
  const missingEvidenceEventIds = (
    continuityCheck.requiredEvidenceEventIds ?? []
  ).filter((eventId) => !presentEvidenceEventIds.has(String(eventId)));
  if (missingEvidenceEventIds.length > 0) {
    causes.push({
      source: "policy",
      code: "continuity_evidence_history_missing",
      message: `Continuity checkpoints are missing required evidence event ids: ${missingEvidenceEventIds.join(", ")}.`,
      refs,
      invariantClasses: ["required_evidence"],
    });
  }

  return causes;
}

function actionOutcomeEnvelopeRef(envelope: ActionOutcomeEnvelope): StateRef {
  const ref = envelope.substrateRefs.find(
    (candidate) => candidate.kind === "action_outcome_envelope",
  );
  if (ref === undefined) {
    throw new Error(
      `ArrowHedge ActionOutcomeEnvelope ${envelope.actionId} has no action_outcome_envelope substrate ref`,
    );
  }
  return ref;
}

function emptyTerminalOutcomeCounts(): Record<ActionTerminalOutcome, number> {
  return {
    accepted: 0,
    blocked: 0,
    rejected: 0,
    held: 0,
    superseded: 0,
    escalated: 0,
  };
}

function missingObservationActionDiscriminator(
  payload: Readonly<Record<string, unknown>>,
): string | undefined {
  const decisionId = payloadString(payload, "decisionId");
  const missingObservation = payloadString(payload, "missingObservation");
  if (decisionId === undefined || missingObservation === undefined) {
    return undefined;
  }
  return `${decisionId}:missing:${missingObservation}`;
}

function buildArrowHedgeMemoryDriftCheckpoints(
  tenantId: TenantId,
  agentId: string,
  decisionId: string,
): readonly ContinuityCheckpoint[] {
  const first = arrowHedgeContinuityCheckpoint({
    id: "chk_arrowhedge_memory_drift_old_001",
    tenantId,
    agentId,
    scope: "axis-a/arrowhedge/aapl",
    kind: "claim",
    title: `AAPL terminal decision ${decisionId}`,
    summary:
      "Terminal decision is blocked until current risk state is refreshed.",
    evidenceEventIds: ["evt_arrowhedge_risk_1400" as EventId],
    decisionRefs: [`arrowhedge:terminal:${decisionId}:blocked`],
    status: "open",
    payload: {
      symbol: "AAPL",
      failureClass: "memory_drift",
    },
    createdAt: "2026-06-03T14:01:00.000Z" as Timestamp,
    priorCheckpointHash: null,
  });
  const second = arrowHedgeContinuityCheckpoint({
    id: "chk_arrowhedge_memory_drift_new_001",
    tenantId,
    agentId,
    scope: "axis-a/arrowhedge/aapl",
    kind: "claim",
    title: `AAPL terminal decision ${decisionId}`,
    summary:
      "Private resume memory says terminal decision was accepted and can continue.",
    evidenceEventIds: ["evt_arrowhedge_resume_memory" as EventId],
    decisionRefs: [`arrowhedge:terminal:${decisionId}:accepted-from-memory`],
    status: "open",
    payload: {
      symbol: "AAPL",
      failureClass: "memory_drift",
    },
    createdAt: "2026-06-03T14:08:00.000Z" as Timestamp,
    priorCheckpointHash: first.contentHash,
  });
  return [first, second];
}

function buildArrowHedgeContinuityBreakCheckpoints(
  tenantId: TenantId,
  agentId: string,
  decisionId: string,
): readonly ContinuityCheckpoint[] {
  const first = arrowHedgeContinuityCheckpoint({
    id: "chk_arrowhedge_continuity_break_001",
    tenantId,
    agentId,
    scope: "axis-a/arrowhedge/aapl",
    kind: "handoff",
    title: `Resume AAPL decision ${decisionId}`,
    summary:
      "Resume packet carries source evidence but omits the terminal outcome history.",
    evidenceEventIds: ["evt_arrowhedge_risk_1400" as EventId],
    decisionRefs: [`arrowhedge:risk:${decisionId}:observed`],
    status: "open",
    payload: {
      symbol: "AAPL",
      failureClass: "continuity_break",
    },
    createdAt: "2026-06-03T14:09:00.000Z" as Timestamp,
    priorCheckpointHash: null,
  });
  return [first];
}

function arrowHedgeContinuityCheckpoint(
  input: Omit<ContinuityCheckpoint, "contentHash">,
): ContinuityCheckpoint {
  return {
    ...input,
    contentHash: checkpointHash(input),
  };
}

function arrowHedgeSourceAuthorityConflictState(
  state: ArrowHedgeCommonOperatingPictureState,
  symbol: string,
): ArrowHedgeCommonOperatingPictureState {
  const ticker = state.tickers[symbol];
  if (!ticker?.latestRiskState || !ticker.latestDecision) return state;

  const tickers = {
    ...state.tickers,
    [symbol]: {
      ...ticker,
      latestRiskState: {
        ...ticker.latestRiskState,
        eventId: `${ticker.latestRiskState.eventId}:authority_conflict`,
        riskStateId: `${ticker.latestRiskState.riskStateId}:authority_conflict`,
        sourceSnapshotId: `${ticker.latestRiskState.sourceSnapshotId}:revalidated`,
        authority: `${ticker.latestRiskState.authority}:risk_revalidated`,
      },
    },
  };

  return {
    tickers,
    summary: summarizeCop(tickers),
  };
}

function payloadString(
  payload: Readonly<Record<string, unknown>>,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
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

interface ExpandTickerRunEnvelopeSnapshotInput {
  readonly runId: string;
  readonly surface: string;
  readonly substrateMode: string;
  readonly observedAt: Timestamp;
  readonly startDate: string;
  readonly endDate: string;
  readonly ticker: string;
  readonly modelConfig: Readonly<Record<string, unknown>>;
  readonly portfolioInput: Readonly<Record<string, unknown>>;
  readonly signalsInput: readonly unknown[];
  readonly riskStatesInput: readonly unknown[];
  readonly decisionsInput: readonly unknown[];
  readonly evidence: readonly ArrowHedgeExpandedEvidenceDocument[];
  readonly issues: ArrowHedgeValidationIssue[];
}

function expandTickerRunEnvelopeSnapshot(
  input: ExpandTickerRunEnvelopeSnapshotInput,
): ArrowHedgeExpandedRunSnapshot | null {
  const tickerPath = `/scope/tickers/${input.ticker}`;
  const signals = recordsForTicker(
    input.signalsInput,
    input.ticker,
    "/signals",
    input.issues,
  ).flatMap((rawSignal, index) => {
    const path = `${tickerPath}/signals/${index}`;
    const signal = expandRunEnvelopeSignal(
      rawSignal,
      input.runId,
      input.ticker,
      input.observedAt,
      path,
      input.issues,
    );
    return signal ? [signal] : [];
  });
  if (signals.length === 0) {
    input.issues.push({
      path: `${tickerPath}/signals`,
      message: "expected at least one signal for ticker",
    });
    return null;
  }

  const riskState = firstRecordForTicker(
    input.riskStatesInput,
    input.ticker,
    "/riskStates",
    input.issues,
  );
  const decision = firstRecordForTicker(
    input.decisionsInput,
    input.ticker,
    "/decisions",
    input.issues,
  );
  if (!riskState || !decision) return null;

  const snapshotId = `snap_${input.runId}_${idToken(input.ticker)}`;
  const risk = expandRunEnvelopeRiskState(
    riskState,
    input.runId,
    input.ticker,
    input.observedAt,
    input.issues,
  );
  const portfolio = expandRunEnvelopePortfolio(
    input.portfolioInput,
    snapshotId,
    input.issues,
  );
  const expandedDecision = expandRunEnvelopeDecision(
    decision,
    input.runId,
    input.ticker,
    snapshotId,
    input.issues,
  );
  if (!risk || !portfolio || !expandedDecision) return null;

  return {
    snapshotId,
    observedAt: input.observedAt,
    authority: `arrowhedge:${input.surface}:${input.runId}`,
    backtestRun: {
      id: input.runId,
      title: `ArrowHedge ${input.surface} ${input.runId}`,
      scopeStart: input.startDate,
      scopeEnd: input.endDate,
      state: "completed",
      datasetRef: `arrowhedge://runs/${input.runId}`,
      seed: input.runId,
    },
    researchRun: {
      id: `rr_${input.runId}_${idToken(input.ticker)}`,
      title: `ArrowHedge ${input.ticker} ${input.surface} research`,
      scopeStart: input.startDate,
      scopeEnd: input.endDate,
      state: "deciding",
      strategy: `${input.surface}:${input.substrateMode}`,
      modelLock: stableJsonString(input.modelConfig),
      seed: input.runId,
    },
    ticker: {
      symbol: input.ticker,
      assetClass: "equity",
      exchange: "NASDAQ",
      currency: "USD",
    },
    evidence: input.evidence.filter(
      (item) => item.ticker === undefined || item.ticker === input.ticker,
    ),
    signal: signals[0]!,
    signals,
    risk,
    portfolio,
    decision: expandedDecision,
  };
}

function expandRunEnvelopeSignal(
  rawSignal: Readonly<Record<string, unknown>>,
  runId: string,
  ticker: string,
  observedAt: Timestamp,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  const agentId = stringAt(rawSignal, `${path}/agentId`, issues);
  const signal = stringAt(rawSignal, `${path}/signal`, issues);
  const confidence = numberAt(rawSignal, `${path}/confidence`, issues);
  const id = optionalStringAt(rawSignal, `${path}/id`, issues);
  const evidenceWindowStart = optionalTimestampAt(
    rawSignal,
    `${path}/evidenceWindowStart`,
    issues,
  );
  const evidenceWindowEnd = optionalTimestampAt(
    rawSignal,
    `${path}/evidenceWindowEnd`,
    issues,
  );
  if (!agentId || !signal || confidence === null) return null;

  return {
    id: id ?? `sig_${idToken(agentId)}_${idToken(ticker)}_${idToken(runId)}`,
    agentId,
    signal,
    confidence,
    ...(evidenceWindowStart !== null ? { evidenceWindowStart } : {}),
    ...(evidenceWindowEnd !== null ? { evidenceWindowEnd } : {}),
    ticker,
    observedAt,
  };
}

function expandRunEnvelopeRiskState(
  rawRisk: Readonly<Record<string, unknown>>,
  runId: string,
  ticker: string,
  observedAt: Timestamp,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  const path = `/riskStates/${ticker}`;
  const currentPrice = numberAt(rawRisk, `${path}/currentPrice`, issues);
  const remainingPositionLimit = numberAt(
    rawRisk,
    `${path}/remainingPositionLimit`,
    issues,
  );
  const maxShares = numberAt(rawRisk, `${path}/maxShares`, issues);
  const id = optionalStringAt(rawRisk, `${path}/id`, issues);
  const volatility = optionalNumberAt(rawRisk, `${path}/volatility`, issues);
  const bindingConstraint = optionalStringAt(
    rawRisk,
    `${path}/bindingConstraint`,
    issues,
  );
  const freshnessExpiresAt =
    optionalTimestampAt(rawRisk, `${path}/freshnessExpiresAt`, issues) ?? observedAt;
  if (
    currentPrice === null ||
    remainingPositionLimit === null ||
    maxShares === null
  ) {
    return null;
  }

  return {
    id: id ?? `risk_${runId}_${idToken(ticker)}`,
    currentPrice,
    remainingPositionLimit,
    maxShares,
    ...(volatility !== null ? { volatility } : {}),
    ...(bindingConstraint !== null ? { bindingConstraint } : {}),
    freshnessExpiresAt,
  };
}

function expandRunEnvelopePortfolio(
  rawPortfolio: Readonly<Record<string, unknown>>,
  snapshotId: string,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  const cash = numberAt(rawPortfolio, "/portfolio/cash", issues);
  const equity = numberAt(rawPortfolio, "/portfolio/equity", issues);
  const marginRequirement = numberFromFirstField(
    rawPortfolio,
    ["marginRequirement", "margin_requirement"],
    "/portfolio/marginRequirement",
    issues,
  );
  const marginUsed = numberFromFirstField(
    rawPortfolio,
    ["marginUsed", "margin_used"],
    "/portfolio/marginUsed",
    issues,
  );
  if (
    cash === null ||
    equity === null ||
    marginRequirement === null ||
    marginUsed === null
  ) {
    return null;
  }

  return {
    id: `portfolio_${snapshotId}`,
    cash,
    equity,
    marginRequirement,
    marginUsed,
  };
}

function expandRunEnvelopeDecision(
  rawDecision: Readonly<Record<string, unknown>>,
  runId: string,
  ticker: string,
  snapshotId: string,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  const path = `/decisions/${ticker}`;
  const action = stringAt(rawDecision, `${path}/action`, issues);
  const quantity = numberAt(rawDecision, `${path}/quantity`, issues);
  const confidence = numberAt(rawDecision, `${path}/confidence`, issues);
  const id = optionalStringAt(rawDecision, `${path}/id`, issues);
  const rawReasoning = optionalStringAt(rawDecision, `${path}/reasoning`, issues);
  const allowedActions = requiredAllowedActionsAt(
    rawDecision,
    `${path}/allowedActions`,
    issues,
  );
  const accepted = optionalBooleanField(
    rawDecision,
    "accepted",
    `${path}/accepted`,
    issues,
  );
  const rejectionReason = optionalStringAt(
    rawDecision,
    `${path}/rejectionReason`,
    issues,
  );
  if (
    action === null ||
    quantity === null ||
    confidence === null ||
    allowedActions === null
  ) {
    return null;
  }

  const inferredAccepted = action !== "hold" && quantity > 0;
  return {
    id: id ?? `dec_${runId}_${idToken(ticker)}`,
    action,
    quantity,
    confidence,
    reasoning:
      rawReasoning && rawReasoning.trim().length > 0
        ? rawReasoning
        : `ArrowHedge ${ticker} ${action} decision`,
    accepted: accepted ?? inferredAccepted,
    ...(rejectionReason !== null ? { rejectionReason } : {}),
    allowedActions,
    riskSourceSnapshotId: snapshotId,
    signalSourceSnapshotId: snapshotId,
  };
}

function normalizeRunEnvelopeEvidence(
  rawEvidence: readonly unknown[],
  issues: ArrowHedgeValidationIssue[],
): readonly ArrowHedgeExpandedEvidenceDocument[] {
  return rawEvidence.flatMap((item, index) => {
    const path = `/evidence/${index}`;
    if (!isRecord(item)) {
      issues.push({ path, message: "expected object" });
      return [];
    }
    const id = stringAt(item, `${path}/id`, issues);
    const sha256 = stringAt(item, `${path}/sha256`, issues);
    const mimeType = stringAt(item, `${path}/mimeType`, issues);
    const filename = stringAt(item, `${path}/filename`, issues);
    const ticker = optionalStringAt(item, `${path}/ticker`, issues);
    const sourceUri = optionalStringAt(item, `${path}/sourceUri`, issues);
    const retrievedAt = optionalTimestampAt(item, `${path}/retrievedAt`, issues);
    const freshnessExpiresAt = optionalTimestampAt(
      item,
      `${path}/freshnessExpiresAt`,
      issues,
    );
    if (!id || !sha256 || !mimeType || !filename) return [];

    return [
      {
        id,
        sha256,
        mimeType,
        filename,
        ...(ticker !== null ? { ticker } : {}),
        ...(sourceUri !== null ? { sourceUri } : {}),
        ...(retrievedAt !== null ? { retrievedAt } : {}),
        ...(freshnessExpiresAt !== null ? { freshnessExpiresAt } : {}),
      },
    ];
  });
}

function runEnvelopeEvidenceDocument(input: {
  readonly runId: string;
  readonly kind: "graph" | "model_config";
  readonly payload: unknown;
  readonly observedAt: Timestamp;
}): ArrowHedgeExpandedEvidenceDocument {
  return {
    id: `ev_run_${input.kind}_${input.runId}`,
    sha256: sha256StableJson(input.payload),
    mimeType: "application/json",
    filename: `${input.runId}-${input.kind}.json`,
    sourceUri: `arrowhedge://runs/${input.runId}/${input.kind}`,
    retrievedAt: input.observedAt,
    freshnessExpiresAt: input.observedAt,
  };
}

function recordsForTicker(
  input: readonly unknown[],
  ticker: string,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): readonly Readonly<Record<string, unknown>>[] {
  return input.flatMap((item, index) => {
    if (!isRecord(item)) {
      issues.push({ path: `${path}/${index}`, message: "expected object" });
      return [];
    }
    const itemTicker = optionalStringAt(item, `${path}/${index}/ticker`, issues);
    if (itemTicker !== ticker) return [];
    return [item];
  });
}

function firstRecordForTicker(
  input: readonly unknown[],
  ticker: string,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, unknown>> | null {
  const matches = recordsForTicker(input, ticker, path, issues);
  if (matches.length === 0) {
    issues.push({
      path,
      message: `expected record for ticker ${ticker}`,
    });
    return null;
  }
  return matches[0]!;
}

function arrayField(
  input: Readonly<Record<string, unknown>>,
  field: string,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): readonly unknown[] {
  const value = input[field];
  if (!Array.isArray(value)) {
    issues.push({ path, message: "expected array" });
    return [];
  }
  return value;
}

function optionalBooleanField(
  input: Readonly<Record<string, unknown>>,
  field: string,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): boolean | null {
  const value = input[field];
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") {
    issues.push({ path, message: "expected boolean when present" });
    return null;
  }
  return value;
}

function numberFromFirstField(
  input: Readonly<Record<string, unknown>>,
  fields: readonly string[],
  path: string,
  issues: ArrowHedgeValidationIssue[],
): number | null {
  for (const field of fields) {
    const value = input[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      issues.push({ path, message: "expected finite number" });
      return null;
    }
    return value;
  }
  issues.push({ path, message: "expected finite number" });
  return null;
}

function requiredAllowedActionsAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, number>> | null {
  const allowedActions = optionalAllowedActionsAt(input, path, issues);
  if (allowedActions === null && input[path.split("/").at(-1)!] === undefined) {
    issues.push({
      path,
      message: "expected object with finite numeric action limits",
    });
  }
  return allowedActions;
}

function sha256StableJson(value: unknown): string {
  return createHash("sha256").update(stableJsonString(value)).digest("hex");
}

function offlineReviewEventId(
  runId: string,
  snapshotIndex: number,
  eventIndex: number,
  eventType: string,
): string {
  return [
    "evt",
    idToken(runId),
    String(snapshotIndex),
    String(eventIndex),
    idToken(eventType).replaceAll(".", "_"),
  ].join("_");
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJsonValue(item)]),
    );
  }
  return value;
}

function idToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
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

interface ArrowHedgeInvalidActionBlock {
  readonly reason: "action_not_allowed" | "quantity_exceeds_allowed_action";
  readonly action: string;
  readonly quantity: number;
  readonly allowedQuantity: number | null;
  readonly allowedActions: Readonly<Record<string, number>>;
}

function buildInvalidActionBlock(input: {
  readonly action: unknown;
  readonly quantity: unknown;
  readonly allowedActions: unknown;
}): ArrowHedgeInvalidActionBlock | null {
  const allowedActions = allowedActionsFromUnknown(input.allowedActions);
  if (allowedActions === null) return null;
  if (typeof input.action !== "string") return null;
  if (typeof input.quantity !== "number" || !Number.isFinite(input.quantity)) {
    return null;
  }

  const allowedQuantity = allowedActions[input.action];
  if (allowedQuantity === undefined) {
    return {
      reason: "action_not_allowed",
      action: input.action,
      quantity: input.quantity,
      allowedQuantity: null,
      allowedActions,
    };
  }
  if (input.quantity > allowedQuantity) {
    return {
      reason: "quantity_exceeds_allowed_action",
      action: input.action,
      quantity: input.quantity,
      allowedQuantity,
      allowedActions,
    };
  }
  return null;
}

function allowedActionsFromUnknown(
  value: unknown,
): Readonly<Record<string, number>> | null {
  if (!isRecord(value)) return null;
  const out: Record<string, number> = {};
  for (const [action, quantity] of Object.entries(value)) {
    if (
      action.trim().length === 0 ||
      typeof quantity !== "number" ||
      !Number.isFinite(quantity)
    ) {
      return null;
    }
    out[action] = quantity;
  }
  return out;
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
    invalidActionBlocks: 0,
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

function optionalArrayAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): readonly unknown[] | null {
  const value = input[path.slice(1)];
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) {
    issues.push({ path, message: "expected array when present" });
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

function optionalAllowedActionsAt(
  input: Record<string, unknown>,
  path: string,
  issues: ArrowHedgeValidationIssue[],
): Readonly<Record<string, number>> | null {
  const value = input[path.split("/").at(-1)!];
  if (value === undefined || value === null) return null;
  const allowedActions = allowedActionsFromUnknown(value);
  if (allowedActions === null) {
    issues.push({
      path,
      message: "expected object with finite numeric action limits when present",
    });
    return null;
  }
  return allowedActions;
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
