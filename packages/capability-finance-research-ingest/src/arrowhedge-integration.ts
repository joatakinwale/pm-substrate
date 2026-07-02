import { createHash } from "node:crypto";
import { stateRef, type StateRef } from "@pm/agent-state";

export interface ArrowHedgeIntegrationFetchResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly statusText?: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export interface ArrowHedgeIntegrationFetchInit {
  readonly method?: "GET" | "POST";
  readonly headers?: Record<string, string>;
  readonly body?: string;
}

export type ArrowHedgeIntegrationFetch = (
  url: string,
  init?: ArrowHedgeIntegrationFetchInit,
) => Promise<ArrowHedgeIntegrationFetchResponse>;

export interface ArrowHedgeIntegrationClientInput {
  readonly integrationBaseUrl: string;
  readonly bearerToken?: string;
  readonly headers?: Record<string, string>;
  readonly fetchFn?: ArrowHedgeIntegrationFetch;
}

export interface ArrowHedgeIntegrationGraphPayload {
  readonly nodes: readonly Record<string, unknown>[];
  readonly edges: readonly Record<string, unknown>[];
}

export interface ArrowHedgeIntegrationSnapshotFetchInput
  extends ArrowHedgeIntegrationClientInput {
  readonly graph?: ArrowHedgeIntegrationGraphPayload;
  readonly flowIds?: readonly number[];
  readonly runIds?: readonly number[];
  readonly runEventIds?: readonly number[];
  readonly backtestRunIds?: readonly number[];
}

export interface ArrowHedgeIntegrationCapabilities {
  readonly schemaVersion: string;
  readonly adapterVersion: string;
  readonly app: {
    readonly name: string;
    readonly version?: string;
    readonly [key: string]: unknown;
  };
  readonly surfaces: readonly string[];
  readonly redaction: {
    readonly apiKeys: string;
    readonly rawSecrets?: string;
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationAgent {
  readonly key: string;
  readonly stable_id: string;
  readonly role?: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationAgents {
  readonly schemaVersion: string;
  readonly agents: readonly ArrowHedgeIntegrationAgent[];
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationGraphNode {
  readonly id: string;
  readonly type?: string;
  readonly base_agent_key?: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationEffectiveGraph {
  readonly schemaVersion: string;
  readonly nodes: readonly ArrowHedgeIntegrationGraphNode[];
  readonly edges: readonly ArrowHedgeIntegrationGraphEdge[];
  readonly validation: {
    readonly issues: readonly ArrowHedgeIntegrationValidationIssue[];
    readonly [key: string]: unknown;
  };
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationValidationIssue {
  readonly path: string;
  readonly message: string;
}

export interface ArrowHedgeIntegrationCacheRecord {
  readonly kind: string;
  readonly cache_key: string;
  readonly row_count: number;
  readonly sha256: string;
  readonly min_observed_at?: string;
  readonly max_observed_at?: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationCacheSummary {
  readonly schemaVersion: string;
  readonly records: readonly ArrowHedgeIntegrationCacheRecord[];
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationSourceArtifact {
  readonly id: string;
  readonly schemaVersion: string;
  readonly provider: string;
  readonly kind: string;
  readonly cache_key: string;
  readonly ticker?: string | null;
  readonly request: Record<string, unknown>;
  readonly observed: Record<string, unknown>;
  readonly row_count: number;
  readonly sha256: string;
  readonly matched_by?: readonly string[];
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationSourceArtifacts {
  readonly schemaVersion: string;
  readonly provider: string;
  readonly artifacts: readonly ArrowHedgeIntegrationSourceArtifact[];
  readonly count: number;
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationRunSourceArtifacts {
  readonly schemaVersion: string;
  readonly run_id: number;
  readonly flow_id?: number;
  readonly request: Record<string, unknown>;
  readonly artifacts: readonly ArrowHedgeIntegrationSourceArtifact[];
  readonly count: number;
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationFlowSummary {
  readonly schemaVersion: string;
  readonly id: number;
  readonly name?: string | null;
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationFlows {
  readonly schemaVersion: string;
  readonly flows: readonly ArrowHedgeIntegrationFlowSummary[];
  readonly count: number;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationFlow extends ArrowHedgeIntegrationFlowSummary {
  readonly nodes?: readonly Record<string, unknown>[];
  readonly edges?: readonly Record<string, unknown>[];
  readonly data?: Record<string, unknown>;
  readonly effectiveGraph?: ArrowHedgeIntegrationEffectiveGraph;
}

export interface ArrowHedgeIntegrationFlowRunSummary {
  readonly schemaVersion: string;
  readonly id: number;
  readonly flow_id: number;
  readonly status?: string;
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationFlowRun extends ArrowHedgeIntegrationFlowRunSummary {
  readonly requestData?: Record<string, unknown>;
  readonly results?: Record<string, unknown>;
}

export interface ArrowHedgeIntegrationRunEvent {
  readonly id: string;
  readonly sequence: number;
  readonly type: string;
  readonly occurred_at?: string | null;
  readonly payload: Record<string, unknown>;
  readonly payload_sha256: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationRunEvents {
  readonly schemaVersion: string;
  readonly run_id: number;
  readonly flow_id?: number;
  readonly count: number;
  readonly events: readonly ArrowHedgeIntegrationRunEvent[];
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationBacktestSummary {
  readonly schemaVersion: string;
  readonly id: number;
  readonly run_id: number;
  readonly flow_id: number;
  readonly status?: string;
  readonly day_count: number;
  readonly first_date?: string | null;
  readonly last_date?: string | null;
  readonly performance_metrics?: Record<string, unknown>;
  readonly final_portfolio?: Record<string, unknown> | null;
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationBacktests {
  readonly schemaVersion: string;
  readonly backtests: readonly ArrowHedgeIntegrationBacktestSummary[];
  readonly count: number;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationBacktest
  extends ArrowHedgeIntegrationBacktestSummary {
  readonly portfolioValues?: readonly Record<string, unknown>[];
}

export interface ArrowHedgeIntegrationBacktestDay {
  readonly sequence: number;
  readonly date?: string;
  readonly sha256: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationBacktestDays {
  readonly schemaVersion: string;
  readonly run_id: number;
  readonly flow_id?: number;
  readonly count: number;
  readonly days: readonly ArrowHedgeIntegrationBacktestDay[];
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationModelRecord {
  readonly display_name: string;
  readonly model_name: string;
  readonly provider: string;
  readonly source: string;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationModelConfig {
  readonly schemaVersion: string;
  readonly defaults: {
    readonly model_name: string;
    readonly provider: string;
    readonly [key: string]: unknown;
  };
  readonly models: readonly ArrowHedgeIntegrationModelRecord[];
  readonly providers: readonly Record<string, unknown>[];
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationApiKeySummaryRecord {
  readonly provider: string;
  readonly has_key: boolean;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationApiKeySummary {
  readonly schemaVersion: string;
  readonly redaction: {
    readonly apiKeys: string;
    readonly rawSecrets?: string;
    readonly [key: string]: unknown;
  };
  readonly apiKeys: readonly ArrowHedgeIntegrationApiKeySummaryRecord[];
  readonly hashes?: Record<string, string | undefined>;
  readonly [key: string]: unknown;
}

export interface ArrowHedgeIntegrationSnapshot {
  readonly capabilities: ArrowHedgeIntegrationCapabilities;
  readonly agents: ArrowHedgeIntegrationAgents;
  readonly effectiveGraph: ArrowHedgeIntegrationEffectiveGraph;
  readonly cacheSummary: ArrowHedgeIntegrationCacheSummary;
  readonly sourceArtifacts: ArrowHedgeIntegrationSourceArtifacts;
  readonly flows: ArrowHedgeIntegrationFlows;
  readonly flowDetails: readonly ArrowHedgeIntegrationFlow[];
  readonly runDetails: readonly ArrowHedgeIntegrationFlowRun[];
  readonly runEvents: readonly ArrowHedgeIntegrationRunEvents[];
  readonly runSourceArtifacts: readonly ArrowHedgeIntegrationRunSourceArtifacts[];
  readonly backtests: ArrowHedgeIntegrationBacktests;
  readonly backtestDetails: readonly ArrowHedgeIntegrationBacktest[];
  readonly backtestDays: readonly ArrowHedgeIntegrationBacktestDays[];
  readonly modelConfig: ArrowHedgeIntegrationModelConfig;
  readonly apiKeySummary: ArrowHedgeIntegrationApiKeySummary;
  readonly evidenceRefs: readonly StateRef[];
}

export interface ArrowHedgeIntegrationRunEnvelope {
  readonly schemaVersion: "arrowhedge.run-envelope.v1";
  readonly runId: string;
  readonly surface: string;
  readonly substrateMode: string;
  readonly observedAt: string;
  readonly scope: {
    readonly startDate: string;
    readonly endDate: string;
    readonly tickers: readonly string[];
  };
  readonly graph: Record<string, unknown>;
  readonly modelConfig: Record<string, unknown>;
  readonly portfolio: Record<string, unknown>;
  readonly signals: readonly Record<string, unknown>[];
  readonly riskStates: readonly Record<string, unknown>[];
  readonly decisions: readonly Record<string, unknown>[];
  readonly evidence: readonly Record<string, unknown>[];
}

export interface ArrowHedgeIntegrationRunEnvelopeBuildInput {
  readonly snapshot: ArrowHedgeIntegrationSnapshot;
  readonly runId: number;
  readonly substrateMode?: string;
  readonly surface?: string;
  readonly backtestDaySequence?: number;
}

export interface ArrowHedgeIntegrationRunEnvelopeBuildResult {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly envelope?: ArrowHedgeIntegrationRunEnvelope;
}

export interface ArrowHedgeIntegrationRunEnvelopePairInput {
  readonly baseline: ArrowHedgeIntegrationRunEnvelope;
  readonly substrate: ArrowHedgeIntegrationRunEnvelope;
}

export interface ArrowHedgeIntegrationRunEnvelopePairFingerprints {
  readonly scopeEqual: boolean;
  readonly graphEqual: boolean;
  readonly modelConfigEqual: boolean;
  readonly portfolioEqual: boolean;
  readonly sourceDataEqual: boolean;
  readonly baseline: {
    readonly scopeSha256: string;
    readonly graphSha256: string;
    readonly modelConfigSha256: string;
    readonly portfolioSha256: string;
    readonly sourceDataSha256: string;
  };
  readonly substrate: {
    readonly scopeSha256: string;
    readonly graphSha256: string;
    readonly modelConfigSha256: string;
    readonly portfolioSha256: string;
    readonly sourceDataSha256: string;
  };
}

export interface ArrowHedgeIntegrationRunEnvelopePairGate {
  readonly ready: boolean;
  readonly issues: readonly string[];
  readonly fingerprints: ArrowHedgeIntegrationRunEnvelopePairFingerprints;
}

export interface ArrowHedgeIntegrationValidationResult {
  readonly ready: boolean;
  readonly issues: readonly string[];
}

export class ArrowHedgeIntegrationFetchError extends Error {
  readonly url: string;
  readonly status: number;
  readonly body: string;

  constructor(url: string, status: number, body: string) {
    super(`ArrowHedge integration request failed: ${status} ${url}`);
    this.name = "ArrowHedgeIntegrationFetchError";
    this.url = url;
    this.status = status;
    this.body = body;
  }
}

const CAPABILITIES_SCHEMA = "arrowhedgelab.integration.capabilities.v1";
const AGENTS_SCHEMA = "arrowhedgelab.integration.agents.v1";
const EFFECTIVE_GRAPH_SCHEMA = "arrowhedgelab.integration.effective-graph.v1";
const CACHE_SUMMARY_SCHEMA = "arrowhedgelab.integration.cache-summary.v1";
const SOURCE_ARTIFACTS_SCHEMA = "arrowhedgelab.integration.source-artifacts.v1";
const SOURCE_ARTIFACT_SCHEMA = "arrowhedgelab.integration.source-artifact.v1";
const RUN_SOURCE_ARTIFACTS_SCHEMA = "arrowhedgelab.integration.run-source-artifacts.v1";
const FLOWS_SCHEMA = "arrowhedgelab.integration.flows.v1";
const FLOW_SCHEMA = "arrowhedgelab.integration.flow.v1";
const FLOW_RUN_SCHEMA = "arrowhedgelab.integration.flow-run.v1";
const RUN_EVENTS_SCHEMA = "arrowhedgelab.integration.run-events.v1";
const BACKTESTS_SCHEMA = "arrowhedgelab.integration.backtests.v1";
const BACKTEST_SCHEMA = "arrowhedgelab.integration.backtest.v1";
const BACKTEST_DAYS_SCHEMA = "arrowhedgelab.integration.backtest-days.v1";
const MODEL_CONFIG_SCHEMA = "arrowhedgelab.integration.model-config.v1";
const API_KEY_SUMMARY_SCHEMA = "arrowhedgelab.integration.api-key-summary.v1";
const ADAPTER_VERSION = "integration.v1";

const REQUIRED_SURFACES = [
  "/integration/v1/capabilities",
  "/integration/v1/agents",
  "/integration/v1/graphs/effective",
  "/integration/v1/data/cache/summary",
  "/integration/v1/data/source-artifacts",
  "/integration/v1/flows",
  "/integration/v1/flows/{id}",
  "/integration/v1/flows/{id}/runs",
  "/integration/v1/runs/{id}",
  "/integration/v1/runs/{id}/events",
  "/integration/v1/runs/{id}/source-artifacts",
  "/integration/v1/backtests",
  "/integration/v1/backtests/{id}",
  "/integration/v1/backtests/{id}/days",
  "/integration/v1/config/models",
  "/integration/v1/config/api-keys",
] as const;

const REQUIRED_AGENT_KEYS = [
  "risk_management",
  "portfolio_manager",
] as const;

export async function fetchArrowHedgeIntegrationSnapshot(
  input: ArrowHedgeIntegrationSnapshotFetchInput,
): Promise<ArrowHedgeIntegrationSnapshot> {
  const client = buildIntegrationClient(input);
  const graph = input.graph ?? { nodes: [], edges: [] };
  const [
    capabilities,
    agents,
    effectiveGraph,
    cacheSummary,
    sourceArtifacts,
    flows,
    backtests,
    modelConfig,
    apiKeySummary,
  ] = await Promise.all([
    fetchIntegrationJson<ArrowHedgeIntegrationCapabilities>(
      client,
      "/capabilities",
    ),
    fetchIntegrationJson<ArrowHedgeIntegrationAgents>(client, "/agents"),
    fetchIntegrationJson<ArrowHedgeIntegrationEffectiveGraph>(
      client,
      "/graphs/effective",
      { method: "POST", body: graph },
    ),
    fetchIntegrationJson<ArrowHedgeIntegrationCacheSummary>(
      client,
      "/data/cache/summary",
    ),
    fetchIntegrationJson<ArrowHedgeIntegrationSourceArtifacts>(
      client,
      "/data/source-artifacts",
    ),
    fetchIntegrationJson<ArrowHedgeIntegrationFlows>(client, "/flows"),
    fetchIntegrationJson<ArrowHedgeIntegrationBacktests>(client, "/backtests"),
    fetchIntegrationJson<ArrowHedgeIntegrationModelConfig>(
      client,
      "/config/models",
    ),
    fetchIntegrationJson<ArrowHedgeIntegrationApiKeySummary>(
      client,
      "/config/api-keys",
    ),
  ]);
  const runEventIds = uniqueNumbers([
    ...(input.runIds ?? []),
    ...(input.runEventIds ?? []),
  ]);
  const backtestRunIds = uniqueNumbers(input.backtestRunIds ?? []);
  const [
    flowDetails,
    runDetails,
    runEvents,
    runSourceArtifacts,
    backtestDetails,
    backtestDays,
  ] = await Promise.all([
    Promise.all(
      (input.flowIds ?? []).map((flowId) =>
        fetchIntegrationJson<ArrowHedgeIntegrationFlow>(
          client,
          `/flows/${encodeURIComponent(String(flowId))}`,
        ),
      ),
    ),
    Promise.all(
      (input.runIds ?? []).map((runId) =>
        fetchIntegrationJson<ArrowHedgeIntegrationFlowRun>(
          client,
          `/runs/${encodeURIComponent(String(runId))}`,
        ),
      ),
    ),
    Promise.all(
      runEventIds.map((runId) =>
        fetchIntegrationJson<ArrowHedgeIntegrationRunEvents>(
          client,
          `/runs/${encodeURIComponent(String(runId))}/events`,
        ),
      ),
    ),
    Promise.all(
      runEventIds.map((runId) =>
        fetchIntegrationJson<ArrowHedgeIntegrationRunSourceArtifacts>(
          client,
          `/runs/${encodeURIComponent(String(runId))}/source-artifacts`,
        ),
      ),
    ),
    Promise.all(
      backtestRunIds.map((runId) =>
        fetchIntegrationJson<ArrowHedgeIntegrationBacktest>(
          client,
          `/backtests/${encodeURIComponent(String(runId))}`,
        ),
      ),
    ),
    Promise.all(
      backtestRunIds.map((runId) =>
        fetchIntegrationJson<ArrowHedgeIntegrationBacktestDays>(
          client,
          `/backtests/${encodeURIComponent(String(runId))}/days`,
        ),
      ),
    ),
  ]);
  const snapshot = {
    capabilities,
    agents,
    effectiveGraph,
    cacheSummary,
    sourceArtifacts,
    flows,
    flowDetails,
    runDetails,
    runEvents,
    runSourceArtifacts,
    backtests,
    backtestDetails,
    backtestDays,
    modelConfig,
    apiKeySummary,
    evidenceRefs: [] as readonly StateRef[],
  };

  return {
    ...snapshot,
    evidenceRefs: buildArrowHedgeIntegrationEvidenceRefs(snapshot),
  };
}

export function buildArrowHedgeRunEnvelopeFromIntegrationSnapshot(
  input: ArrowHedgeIntegrationRunEnvelopeBuildInput,
): ArrowHedgeIntegrationRunEnvelopeBuildResult {
  const issues: string[] = [];
  const run = input.snapshot.runDetails.find((candidate) => candidate.id === input.runId);
  if (run === undefined) {
    return {
      valid: false,
      issues: [`runDetails is missing run ${input.runId}`],
    };
  }

  const runId = String(run.id);
  const flow = input.snapshot.flowDetails.find((candidate) => candidate.id === run.flow_id);
  const runSources = input.snapshot.runSourceArtifacts.find(
    (candidate) => candidate.run_id === input.runId,
  );
  const backtest = input.snapshot.backtestDetails.find(
    (candidate) => candidate.run_id === input.runId,
  ) ?? input.snapshot.backtests.backtests.find((candidate) => candidate.run_id === input.runId);
  const backtestDays = input.snapshot.backtestDays.find(
    (candidate) => candidate.run_id === input.runId,
  );
  const selectedDay = selectBacktestDay(backtestDays, input.backtestDaySequence);
  const runResult = recordOrUndefined(run.results);
  const runProvenance = recordOrUndefined(runResult?.["provenance"]);
  const resultRecord = selectedDay === undefined
    ? runResult
    : {
        ...selectedDay,
        ...(runProvenance === undefined ? {} : { provenance: runProvenance }),
      };

  if (resultRecord === undefined) {
    issues.push(`run ${input.runId} has no backtest day or result payload to envelope`);
  }

  const tickers = extractEnvelopeTickers({
    run,
    runSources,
    resultRecord,
  });
  if (tickers.length === 0) {
    issues.push(`run ${input.runId} has no tickers in request or results`);
  }

  const startDate = stringField(recordOrUndefined(run.requestData), "start_date")
    ?? stringField(recordOrUndefined(runSources?.request), "start_date")
    ?? backtest?.first_date
    ?? stringField(resultRecord, "date");
  const endDate = stringField(recordOrUndefined(run.requestData), "end_date")
    ?? stringField(recordOrUndefined(runSources?.request), "end_date")
    ?? backtest?.last_date
    ?? stringField(resultRecord, "date");
  if (startDate === undefined) {
    issues.push(`run ${input.runId} has no start_date`);
  }
  if (endDate === undefined) {
    issues.push(`run ${input.runId} has no end_date`);
  }

  const observedAt = firstTimestamp([
    stringField(run, "completed_at"),
    stringField(run, "updated_at"),
    stringField(run, "created_at"),
    endDate,
  ]);
  if (observedAt === undefined) {
    issues.push(`run ${input.runId} has no valid observed timestamp`);
  }

  const sourceArtifacts =
    runSources !== undefined && runSources.artifacts.length > 0
      ? runSources.artifacts
      : input.snapshot.sourceArtifacts.artifacts.filter((artifact) =>
          artifact.ticker === undefined || tickers.includes(String(artifact.ticker)),
        );

  const envelopeEvidence = [
    ...sourceArtifacts.map(sourceArtifactToEnvelopeEvidence),
    ...(selectedDay === undefined
      ? []
      : backtestDayToEnvelopeEvidence(selectedDay, runId, tickers, observedAt)),
  ];

  const signals = resultRecord === undefined
    ? []
    : buildEnvelopeSignals(resultRecord, runId, tickers, observedAt, envelopeEvidence, issues);
  const riskStates = resultRecord === undefined
    ? []
    : buildEnvelopeRiskStates(resultRecord, tickers, runId, observedAt, envelopeEvidence, issues);
  const decisions = resultRecord === undefined
    ? []
    : buildEnvelopeDecisions(resultRecord, tickers, runId, envelopeEvidence, issues);
  const portfolio = buildEnvelopePortfolio({
    resultRecord,
    backtest,
    run,
  });

  if (issues.length > 0) {
    return { valid: false, issues };
  }

  return {
    valid: true,
    issues: [],
    envelope: {
      schemaVersion: "arrowhedge.run-envelope.v1",
      runId,
      surface: input.surface ?? (backtest !== undefined ? "backtest" : "flow-run"),
      substrateMode: input.substrateMode ?? "observe",
      observedAt: observedAt!,
      scope: {
        startDate: startDate!,
        endDate: endDate!,
        tickers,
      },
      graph: flowToEnvelopeGraph(flow, input.snapshot.effectiveGraph),
      modelConfig: modelConfigToEnvelope(input.snapshot.modelConfig),
      portfolio,
      signals,
      riskStates,
      decisions,
      evidence: envelopeEvidence,
    },
  };
}

export function compareArrowHedgeIntegrationRunEnvelopePair(
  input: ArrowHedgeIntegrationRunEnvelopePairInput,
): ArrowHedgeIntegrationRunEnvelopePairGate {
  const baseline = integrationEnvelopeFingerprints(input.baseline);
  const substrate = integrationEnvelopeFingerprints(input.substrate);
  const fingerprints = {
    scopeEqual: baseline.scopeSha256 === substrate.scopeSha256,
    graphEqual: baseline.graphSha256 === substrate.graphSha256,
    modelConfigEqual: baseline.modelConfigSha256 === substrate.modelConfigSha256,
    portfolioEqual: baseline.portfolioSha256 === substrate.portfolioSha256,
    sourceDataEqual: baseline.sourceDataSha256 === substrate.sourceDataSha256,
    baseline,
    substrate,
  };
  const issues = [
    ...(input.baseline.schemaVersion !== "arrowhedge.run-envelope.v1"
      ? ["baseline schemaVersion must be arrowhedge.run-envelope.v1"]
      : []),
    ...(input.substrate.schemaVersion !== "arrowhedge.run-envelope.v1"
      ? ["substrate schemaVersion must be arrowhedge.run-envelope.v1"]
      : []),
    ...(fingerprints.scopeEqual ? [] : ["scope hash mismatch"]),
    ...(fingerprints.graphEqual ? [] : ["graph hash mismatch"]),
    ...(fingerprints.modelConfigEqual ? [] : ["modelConfig hash mismatch"]),
    ...(fingerprints.portfolioEqual ? [] : ["portfolio hash mismatch"]),
    ...(fingerprints.sourceDataEqual ? [] : ["sourceData hash mismatch"]),
  ];
  return {
    ready: issues.length === 0,
    issues,
    fingerprints,
  };
}

export function validateArrowHedgeIntegrationSnapshot(
  snapshot: ArrowHedgeIntegrationSnapshot,
): ArrowHedgeIntegrationValidationResult {
  const issues: string[] = [];

  if (snapshot.capabilities.schemaVersion !== CAPABILITIES_SCHEMA) {
    issues.push(`capabilities.schemaVersion must be ${CAPABILITIES_SCHEMA}`);
  }
  if (snapshot.capabilities.adapterVersion !== ADAPTER_VERSION) {
    issues.push(`capabilities.adapterVersion must be ${ADAPTER_VERSION}`);
  }
  if (snapshot.capabilities.app.name !== "ai-hedge-fund") {
    issues.push("capabilities.app.name must be ai-hedge-fund");
  }
  if (snapshot.capabilities.redaction.apiKeys !== "presence_only") {
    issues.push("capabilities.redaction.apiKeys must be presence_only");
  }
  for (const surface of REQUIRED_SURFACES) {
    if (!snapshot.capabilities.surfaces.includes(surface)) {
      issues.push(`capabilities.surfaces is missing ${surface}`);
    }
  }

  if (snapshot.agents.schemaVersion !== AGENTS_SCHEMA) {
    issues.push(`agents.schemaVersion must be ${AGENTS_SCHEMA}`);
  }
  const agentKeys = new Set(snapshot.agents.agents.map((agent) => agent.key));
  for (const agentKey of REQUIRED_AGENT_KEYS) {
    if (!agentKeys.has(agentKey)) {
      issues.push(`agents is missing ${agentKey}`);
    }
  }
  snapshot.agents.agents.forEach((agent, index) => {
    if (agent.stable_id === "") {
      issues.push(`agents[${index}].stable_id is required`);
    }
    if (Object.prototype.hasOwnProperty.call(agent, "agent_func")) {
      issues.push(`agents[${index}] must not expose agent_func`);
    }
  });

  if (snapshot.effectiveGraph.schemaVersion !== EFFECTIVE_GRAPH_SCHEMA) {
    issues.push(`effectiveGraph.schemaVersion must be ${EFFECTIVE_GRAPH_SCHEMA}`);
  }
  if (snapshot.effectiveGraph.validation.issues.length > 0) {
    issues.push("effectiveGraph.validation.issues must be empty");
  }
  const graphNodeKeys = new Set(
    snapshot.effectiveGraph.nodes.map((node) => node.base_agent_key),
  );
  if (
    graphNodeKeys.has("portfolio_manager") &&
    !graphNodeKeys.has("risk_management")
  ) {
    issues.push("effectiveGraph is missing risk_management before portfolio_manager");
  }

  if (snapshot.cacheSummary.schemaVersion !== CACHE_SUMMARY_SCHEMA) {
    issues.push(`cacheSummary.schemaVersion must be ${CACHE_SUMMARY_SCHEMA}`);
  }
  snapshot.cacheSummary.records.forEach((record, index) => {
    if (record.sha256 === "") {
      issues.push(`cacheSummary.records[${index}].sha256 is required`);
    }
    if (record.row_count < 0) {
      issues.push(`cacheSummary.records[${index}].row_count must be non-negative`);
    }
    if (Object.prototype.hasOwnProperty.call(record, "rows")) {
      issues.push(`cacheSummary.records[${index}] must not include raw rows`);
    }
  });
  if (snapshot.sourceArtifacts.schemaVersion !== SOURCE_ARTIFACTS_SCHEMA) {
    issues.push(`sourceArtifacts.schemaVersion must be ${SOURCE_ARTIFACTS_SCHEMA}`);
  }
  if (snapshot.sourceArtifacts.count !== snapshot.sourceArtifacts.artifacts.length) {
    issues.push("sourceArtifacts.count must match artifacts.length");
  }
  validateSourceArtifacts("sourceArtifacts.artifacts", snapshot.sourceArtifacts.artifacts, issues);
  snapshot.runSourceArtifacts.forEach((sourceArtifacts, index) => {
    if (sourceArtifacts.schemaVersion !== RUN_SOURCE_ARTIFACTS_SCHEMA) {
      issues.push(`runSourceArtifacts[${index}].schemaVersion must be ${RUN_SOURCE_ARTIFACTS_SCHEMA}`);
    }
    if (sourceArtifacts.count !== sourceArtifacts.artifacts.length) {
      issues.push(`runSourceArtifacts[${index}].count must match artifacts.length`);
    }
    validateSourceArtifacts(
      `runSourceArtifacts[${index}].artifacts`,
      sourceArtifacts.artifacts,
      issues,
    );
  });

  if (snapshot.flows.schemaVersion !== FLOWS_SCHEMA) {
    issues.push(`flows.schemaVersion must be ${FLOWS_SCHEMA}`);
  }
  if (snapshot.flows.count !== snapshot.flows.flows.length) {
    issues.push("flows.count must match flows.length");
  }
  snapshot.flows.flows.forEach((flow, index) => {
    if (flow.schemaVersion !== FLOW_SCHEMA) {
      issues.push(`flows.flows[${index}].schemaVersion must be ${FLOW_SCHEMA}`);
    }
    if (flow.hashes?.nodesSha256 === undefined || flow.hashes.nodesSha256 === "") {
      issues.push(`flows.flows[${index}].hashes.nodesSha256 is required`);
    }
  });
  snapshot.flowDetails.forEach((flow, index) => {
    if (flow.schemaVersion !== FLOW_SCHEMA) {
      issues.push(`flowDetails[${index}].schemaVersion must be ${FLOW_SCHEMA}`);
    }
    if (JSON.stringify(flow).includes("sk-")) {
      issues.push(`flowDetails[${index}] must not expose raw API keys`);
    }
  });
  snapshot.runDetails.forEach((run, index) => {
    if (run.schemaVersion !== FLOW_RUN_SCHEMA) {
      issues.push(`runDetails[${index}].schemaVersion must be ${FLOW_RUN_SCHEMA}`);
    }
    if (includesRawSecret(run)) {
      issues.push(`runDetails[${index}] must not expose raw API keys`);
    }
  });
  snapshot.runEvents.forEach((runEvents, index) => {
    if (runEvents.schemaVersion !== RUN_EVENTS_SCHEMA) {
      issues.push(`runEvents[${index}].schemaVersion must be ${RUN_EVENTS_SCHEMA}`);
    }
    if (runEvents.count !== runEvents.events.length) {
      issues.push(`runEvents[${index}].count must match events.length`);
    }
    runEvents.events.forEach((event, eventIndex) => {
      if (event.payload_sha256 === "") {
        issues.push(`runEvents[${index}].events[${eventIndex}].payload_sha256 is required`);
      }
    });
    if (includesRawSecret(runEvents)) {
      issues.push(`runEvents[${index}] must not expose raw API keys`);
    }
  });

  if (snapshot.backtests.schemaVersion !== BACKTESTS_SCHEMA) {
    issues.push(`backtests.schemaVersion must be ${BACKTESTS_SCHEMA}`);
  }
  if (snapshot.backtests.count !== snapshot.backtests.backtests.length) {
    issues.push("backtests.count must match backtests.length");
  }
  snapshot.backtests.backtests.forEach((backtest, index) => {
    if (backtest.schemaVersion !== BACKTEST_SCHEMA) {
      issues.push(`backtests.backtests[${index}].schemaVersion must be ${BACKTEST_SCHEMA}`);
    }
    if (backtest.day_count < 0) {
      issues.push(`backtests.backtests[${index}].day_count must be non-negative`);
    }
    if (backtest.hashes?.daysSha256 === undefined || backtest.hashes.daysSha256 === "") {
      issues.push(`backtests.backtests[${index}].hashes.daysSha256 is required`);
    }
    if (includesRawSecret(backtest)) {
      issues.push(`backtests.backtests[${index}] must not expose raw API keys`);
    }
  });
  snapshot.backtestDetails.forEach((backtest, index) => {
    if (backtest.schemaVersion !== BACKTEST_SCHEMA) {
      issues.push(`backtestDetails[${index}].schemaVersion must be ${BACKTEST_SCHEMA}`);
    }
    if (backtest.hashes?.daysSha256 === undefined || backtest.hashes.daysSha256 === "") {
      issues.push(`backtestDetails[${index}].hashes.daysSha256 is required`);
    }
    if (includesRawSecret(backtest)) {
      issues.push(`backtestDetails[${index}] must not expose raw API keys`);
    }
  });
  snapshot.backtestDays.forEach((days, index) => {
    if (days.schemaVersion !== BACKTEST_DAYS_SCHEMA) {
      issues.push(`backtestDays[${index}].schemaVersion must be ${BACKTEST_DAYS_SCHEMA}`);
    }
    if (days.count !== days.days.length) {
      issues.push(`backtestDays[${index}].count must match days.length`);
    }
    days.days.forEach((day, dayIndex) => {
      if (day.sha256 === "") {
        issues.push(`backtestDays[${index}].days[${dayIndex}].sha256 is required`);
      }
    });
    if (includesRawSecret(days)) {
      issues.push(`backtestDays[${index}] must not expose raw API keys`);
    }
  });

  if (snapshot.modelConfig.schemaVersion !== MODEL_CONFIG_SCHEMA) {
    issues.push(`modelConfig.schemaVersion must be ${MODEL_CONFIG_SCHEMA}`);
  }
  if (snapshot.modelConfig.defaults.model_name === "") {
    issues.push("modelConfig.defaults.model_name is required");
  }
  if (snapshot.modelConfig.defaults.provider === "") {
    issues.push("modelConfig.defaults.provider is required");
  }
  if (snapshot.modelConfig.models.length === 0) {
    issues.push("modelConfig.models must include at least one model");
  }
  if (snapshot.modelConfig.hashes?.modelsSha256 === "") {
    issues.push("modelConfig.hashes.modelsSha256 is required");
  }

  if (snapshot.apiKeySummary.schemaVersion !== API_KEY_SUMMARY_SCHEMA) {
    issues.push(`apiKeySummary.schemaVersion must be ${API_KEY_SUMMARY_SCHEMA}`);
  }
  if (snapshot.apiKeySummary.redaction.apiKeys !== "presence_only") {
    issues.push("apiKeySummary.redaction.apiKeys must be presence_only");
  }
  snapshot.apiKeySummary.apiKeys.forEach((apiKey, index) => {
    if (Object.prototype.hasOwnProperty.call(apiKey, "key_value")) {
      issues.push(`apiKeySummary.apiKeys[${index}] must not expose key_value`);
    }
    if (includesRawSecret(apiKey)) {
      issues.push(`apiKeySummary.apiKeys[${index}] must not expose raw key values`);
    }
  });

  return {
    ready: issues.length === 0,
    issues,
  };
}

export function buildArrowHedgeIntegrationEvidenceRefs(
  snapshot: Omit<ArrowHedgeIntegrationSnapshot, "evidenceRefs">,
): readonly StateRef[] {
  return uniqueStateRefs([
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:capabilities",
      "ArrowHedgeLab integration capabilities",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:agents",
      "ArrowHedgeLab integration agents",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:effective_graph",
      "ArrowHedgeLab effective orchestration graph",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:flows",
      "ArrowHedgeLab saved flow list",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:source_artifacts",
      "ArrowHedgeLab source artifact inventory",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:model_config",
      "ArrowHedgeLab model configuration inventory",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:backtests",
      "ArrowHedgeLab saved backtest inventory",
    ),
    stateRef(
      "source_record",
      "arrowhedgelab:integration_api:api_key_summary",
      "ArrowHedgeLab redacted API key summary",
    ),
    ...snapshot.flows.flows.map((flow) =>
      stateRef(
        "source_record",
        `arrowhedgelab:flow:${flow.id}`,
        "ArrowHedgeLab saved flow summary",
      ),
    ),
    ...snapshot.flowDetails.map((flow) =>
      stateRef(
        "source_record",
        `arrowhedgelab:flow:${flow.id}`,
        "ArrowHedgeLab saved flow",
      ),
    ),
    ...snapshot.runDetails.map((run) =>
      stateRef(
        "source_record",
        `arrowhedgelab:flow-run:${run.id}`,
        "ArrowHedgeLab saved flow run",
      ),
    ),
    ...snapshot.runEvents.flatMap((runEvents) =>
      runEvents.events.map((event) =>
        stateRef(
          "source_record",
          `arrowhedgelab:flow-run-event:${runEvents.run_id}:${event.sequence}:${event.payload_sha256}`,
          "ArrowHedgeLab saved flow run event",
        ),
      ),
    ),
    ...snapshot.sourceArtifacts.artifacts.map((artifact) =>
      stateRef(
        "source_record",
        `arrowhedgelab:source-artifact:${artifact.kind}:${artifact.cache_key}:${artifact.sha256}`,
        "ArrowHedgeLab source artifact",
      ),
    ),
    ...snapshot.runSourceArtifacts.flatMap((sourceArtifacts) =>
      sourceArtifacts.artifacts.map((artifact) =>
        stateRef(
          "source_record",
          `arrowhedgelab:run-source-artifact:${sourceArtifacts.run_id}:${artifact.kind}:${artifact.cache_key}:${artifact.sha256}`,
          "ArrowHedgeLab run source artifact",
        ),
      ),
    ),
    ...snapshot.backtests.backtests.map((backtest) =>
      stateRef(
        "source_record",
        `arrowhedgelab:backtest:${backtest.run_id}`,
        "ArrowHedgeLab saved backtest summary",
      ),
    ),
    ...snapshot.backtestDetails.map((backtest) =>
      stateRef(
        "source_record",
        `arrowhedgelab:backtest:${backtest.run_id}`,
        "ArrowHedgeLab saved backtest",
      ),
    ),
    ...snapshot.backtestDays.flatMap((days) =>
      days.days.map((day) =>
        stateRef(
          "source_record",
          `arrowhedgelab:backtest-day:${days.run_id}:${day.date ?? day.sequence}:${day.sha256}`,
          "ArrowHedgeLab saved backtest day",
        ),
      ),
    ),
    ...snapshot.cacheSummary.records.map((record) =>
      stateRef(
        "source_record",
        `arrowhedgelab:cache:${record.kind}:${record.cache_key}:${record.sha256}`,
        `ArrowHedgeLab ${record.kind} cache summary`,
      ),
    ),
  ]);
}

function normalizeIntegrationBaseUrl(value: string): string {
  const trimmed = value.replace(/\/+$/, "");
  return trimmed.endsWith("/integration/v1")
    ? trimmed
    : `${trimmed}/integration/v1`;
}

function buildIntegrationClient(
  input: ArrowHedgeIntegrationClientInput,
): {
  readonly baseUrl: string;
  readonly fetchFn: ArrowHedgeIntegrationFetch;
  readonly headers: Record<string, string>;
} {
  const fetchFn =
    input.fetchFn ??
    (globalThis as unknown as { fetch?: ArrowHedgeIntegrationFetch }).fetch;
  if (fetchFn === undefined) {
    throw new Error(
      "No fetch implementation available for ArrowHedge integration client",
    );
  }

  return {
    baseUrl: normalizeIntegrationBaseUrl(input.integrationBaseUrl),
    fetchFn,
    headers: {
      accept: "application/json",
      ...(input.bearerToken === undefined
        ? {}
        : { authorization: `Bearer ${input.bearerToken}` }),
      ...(input.headers ?? {}),
    },
  };
}

async function fetchIntegrationJson<T>(
  client: {
    readonly baseUrl: string;
    readonly fetchFn: ArrowHedgeIntegrationFetch;
    readonly headers: Record<string, string>;
  },
  path: string,
  options?: {
    readonly method: "POST";
    readonly body: unknown;
  },
): Promise<T> {
  const url = `${client.baseUrl}${path}`;
  const init =
    options === undefined
      ? { headers: client.headers }
      : {
          method: options.method,
          headers: {
            ...client.headers,
            "content-type": "application/json",
          },
          body: JSON.stringify(options.body),
        };
  const response = await client.fetchFn(url, init);
  if (!response.ok) {
    let body = "";
    try {
      body = await response.text();
    } catch {
      body = response.statusText ?? "";
    }
    throw new ArrowHedgeIntegrationFetchError(url, response.status, body);
  }
  return (await response.json()) as T;
}

function uniqueStateRefs(refs: readonly StateRef[]): readonly StateRef[] {
  return [...new Map(refs.map((ref) => [`${ref.kind}:${ref.id}`, ref])).values()];
}

function uniqueNumbers(values: readonly number[]): readonly number[] {
  return [...new Set(values)];
}

function includesRawSecret(value: unknown): boolean {
  return JSON.stringify(value)?.includes("sk-") ?? false;
}

function recordOrUndefined(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(
  record: Record<string, unknown> | undefined,
  field: string,
): string | undefined {
  const value = record?.[field];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function numberField(
  record: Record<string, unknown> | undefined,
  field: string,
): number | undefined {
  const value = record?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function numberFromFields(
  record: Record<string, unknown> | undefined,
  fields: readonly string[],
): number | undefined {
  for (const field of fields) {
    const value = numberField(record, field);
    if (value !== undefined) return value;
  }
  return undefined;
}

function dateToTimestamp(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00.000Z`
    : value;
  return Number.isNaN(Date.parse(normalized))
    ? undefined
    : new Date(normalized).toISOString();
}

function firstTimestamp(values: readonly (string | null | undefined)[]): string | undefined {
  for (const value of values) {
    const timestamp = dateToTimestamp(value ?? undefined);
    if (timestamp !== undefined) return timestamp;
  }
  return undefined;
}

function selectBacktestDay(
  backtestDays: ArrowHedgeIntegrationBacktestDays | undefined,
  sequence: number | undefined,
): ArrowHedgeIntegrationBacktestDay | undefined {
  if (backtestDays === undefined || backtestDays.days.length === 0) return undefined;
  if (sequence !== undefined) {
    return backtestDays.days.find((day) => day.sequence === sequence);
  }
  return backtestDays.days.at(-1);
}

function extractEnvelopeTickers(input: {
  readonly run: ArrowHedgeIntegrationFlowRun;
  readonly runSources: ArrowHedgeIntegrationRunSourceArtifacts | undefined;
  readonly resultRecord: Record<string, unknown> | undefined;
}): readonly string[] {
  const requestTickers = arrayOfStrings(recordOrUndefined(input.run.requestData)?.["tickers"]);
  const sourceTickers = arrayOfStrings(input.runSources?.request["tickers"]);
  const currentPrices = recordOrUndefined(input.resultRecord?.["current_prices"]);
  const decisionTickers = recordOrUndefined(input.resultRecord?.["decisions"]);
  return uniqueStrings([
    ...requestTickers,
    ...sourceTickers,
    ...Object.keys(currentPrices ?? {}),
    ...Object.keys(decisionTickers ?? {}),
  ]);
}

function arrayOfStrings(value: unknown): readonly string[] {
  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) =>
    typeof item === "string" && item.trim().length > 0 ? [item] : [],
  );
}

function arrayOfRecords(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = recordOrUndefined(item);
    return record === undefined ? [] : [record];
  });
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sourceArtifactToEnvelopeEvidence(
  artifact: ArrowHedgeIntegrationSourceArtifact,
): Record<string, unknown> {
  const observed = recordOrUndefined(artifact.observed);
  const retrievedAt = firstTimestamp([
    stringField(observed, "max_observed_at"),
    stringField(observed, "min_observed_at"),
  ]);
  return {
    id: `ev_source_${sanitizeToken(artifact.kind)}_${sanitizeToken(artifact.cache_key)}`,
    sourceArtifactId: artifact.id,
    sha256: artifact.sha256,
    mimeType: "application/json",
    filename: `${sanitizeToken(artifact.cache_key)}.json`,
    sourceUri: `arrowhedge://source-artifacts/${encodeURIComponent(artifact.cache_key)}`,
    ...(typeof artifact.ticker === "string" ? { ticker: artifact.ticker } : {}),
    ...(retrievedAt !== undefined ? { retrievedAt, freshnessExpiresAt: retrievedAt } : {}),
  };
}

function backtestDayToEnvelopeEvidence(
  day: ArrowHedgeIntegrationBacktestDay,
  runId: string,
  tickers: readonly string[],
  observedAt: string | undefined,
): readonly Record<string, unknown>[] {
  return tickers.map((ticker) => ({
    id: tickers.length === 1
      ? `ev_backtest_day_${runId}_${day.sequence}`
      : `ev_backtest_day_${runId}_${day.sequence}_${sanitizeToken(ticker)}`,
    ticker,
    sha256: day.sha256,
    mimeType: "application/json",
    filename: `${runId}-backtest-day-${day.sequence}-${sanitizeToken(ticker)}.json`,
    sourceUri: `arrowhedge://backtests/${runId}/days/${day.sequence}`,
    retrievedAt: firstTimestamp([day.date, observedAt]),
    freshnessExpiresAt: firstTimestamp([day.date, observedAt]),
  }));
}

function buildEnvelopeSignals(
  resultRecord: Record<string, unknown>,
  runId: string,
  tickers: readonly string[],
  observedAt: string | undefined,
  evidence: readonly Record<string, unknown>[],
  issues: string[],
): readonly Record<string, unknown>[] {
  const analystSignals = recordOrUndefined(resultRecord["analyst_signals"]);
  const occurredAt = firstTimestamp([stringField(resultRecord, "date"), observedAt]);
  const signals: Record<string, unknown>[] = [];
  for (const ticker of tickers) {
    let tickerSignalCount = 0;
    for (const [agentId, agentPayload] of Object.entries(analystSignals ?? {})) {
      const agentRecord = recordOrUndefined(agentPayload);
      const signalRecord = recordOrUndefined(agentRecord?.[ticker]);
      if (signalRecord === undefined) continue;
      const signal = stringField(signalRecord, "signal");
      if (signal === undefined) continue;
      signals.push({
        id: `sig_${sanitizeToken(agentId)}_${sanitizeToken(ticker)}_${sanitizeToken(runId)}`,
        ticker,
        agentId,
        signal,
        confidence: numberField(signalRecord, "confidence") ?? 0.5,
        ...(occurredAt !== undefined
          ? { evidenceWindowStart: occurredAt, evidenceWindowEnd: occurredAt }
          : {}),
        ...runtimeProvenanceField({
          resultRecord,
          evidence,
          collection: "agentOutputs",
          ticker,
          agentId,
        }),
        evidenceDocumentIds: evidenceIdsForTicker(evidence, ticker),
      });
      tickerSignalCount += 1;
    }
    if (tickerSignalCount === 0) {
      issues.push(`run ${runId} is missing analyst signal for ${ticker}`);
    }
  }
  return signals;
}

function buildEnvelopeRiskStates(
  resultRecord: Record<string, unknown>,
  tickers: readonly string[],
  runId: string,
  observedAt: string | undefined,
  evidence: readonly Record<string, unknown>[],
  issues: string[],
): readonly Record<string, unknown>[] {
  const currentPrices = recordOrUndefined(resultRecord["current_prices"]);
  const decisions = recordOrUndefined(resultRecord["decisions"]);
  const executedTrades = recordOrUndefined(resultRecord["executed_trades"]);
  const cash = numberField(resultRecord, "cash") ?? 0;
  return tickers.flatMap((ticker) => {
    const currentPrice = numberField(currentPrices, ticker);
    if (currentPrice === undefined) {
      issues.push(`run ${runId} is missing current price for ${ticker}`);
      return [];
    }
    const decision = recordOrUndefined(decisions?.[ticker]);
    const requestedQuantity =
      numberField(decision, "quantity") ?? Math.abs(numberField(executedTrades, ticker) ?? 0);
    const maxShares = currentPrice > 0
      ? Math.max(Math.floor(cash / currentPrice), requestedQuantity)
      : requestedQuantity;
    return [
      {
        id: `risk_${sanitizeToken(runId)}_${sanitizeToken(ticker)}`,
        ticker,
        agentId: "risk_management",
        currentPrice,
        remainingPositionLimit: cash,
        maxShares,
        bindingConstraint: "cash_available",
        freshnessExpiresAt: firstTimestamp([stringField(resultRecord, "date"), observedAt]),
        evidenceDocumentIds: evidenceIdsForTicker(evidence, ticker),
      },
    ];
  });
}

function buildEnvelopeDecisions(
  resultRecord: Record<string, unknown>,
  tickers: readonly string[],
  runId: string,
  evidence: readonly Record<string, unknown>[],
  issues: string[],
): readonly Record<string, unknown>[] {
  const decisions = recordOrUndefined(resultRecord["decisions"]);
  const executedTrades = recordOrUndefined(resultRecord["executed_trades"]);
  return tickers.flatMap((ticker) => {
    const decision = recordOrUndefined(decisions?.[ticker]);
    if (decision === undefined) {
      issues.push(`run ${runId} is missing portfolio decision for ${ticker}`);
      return [];
    }
    const action = stringField(decision, "action");
    if (action === undefined) {
      issues.push(`run ${runId} decision for ${ticker} is missing action`);
      return [];
    }
    const quantity = numberField(decision, "quantity") ?? Math.abs(numberField(executedTrades, ticker) ?? 0);
    return [
      {
        id: `dec_${sanitizeToken(runId)}_${sanitizeToken(ticker)}`,
        ticker,
        action,
        quantity,
        confidence: numberField(decision, "confidence") ?? 0.5,
        reasoning: stringField(decision, "reasoning") ?? `ArrowHedge ${ticker} ${action} decision`,
        accepted: action !== "hold" && quantity > 0,
        allowedActions: allowedActionsForDecision(action, quantity),
        ...runtimeProvenanceField({
          resultRecord,
          evidence,
          collection: "decisions",
          ticker,
        }),
        evidenceDocumentIds: evidenceIdsForTicker(evidence, ticker),
      },
    ];
  });
}

function buildEnvelopePortfolio(input: {
  readonly resultRecord: Record<string, unknown> | undefined;
  readonly backtest: ArrowHedgeIntegrationBacktestSummary | undefined;
  readonly run: ArrowHedgeIntegrationFlowRun;
}): Record<string, unknown> {
  const backtestPortfolio = recordOrUndefined(input.backtest?.final_portfolio);
  const runPortfolio = recordOrUndefined(input.run["finalPortfolio"]);
  const source = backtestPortfolio ?? runPortfolio ?? input.resultRecord;
  const cash = numberField(source, "cash") ?? numberField(input.resultRecord, "cash") ?? 0;
  const equity = numberFromFields(source, ["equity", "portfolio_value"])
    ?? numberField(input.resultRecord, "portfolio_value")
    ?? cash;
  return {
    cash,
    equity,
    margin_requirement: numberFromFields(source, ["marginRequirement", "margin_requirement"]) ?? 0.25,
    margin_used: numberFromFields(source, ["marginUsed", "margin_used"]) ?? 0,
  };
}

function allowedActionsForDecision(action: string, quantity: number): Record<string, number> {
  return {
    hold: 0,
    [action]: Math.max(quantity, 0),
  };
}

function evidenceIdsForTicker(
  evidence: readonly Record<string, unknown>[],
  ticker: string,
): readonly string[] {
  return evidence.flatMap((item) => {
    const id = stringField(item, "id");
    if (id === undefined) return [];
    const itemTicker = item["ticker"];
    if (typeof itemTicker === "string" && itemTicker !== ticker) return [];
    return [id];
  });
}

function runtimeProvenanceField(input: {
  readonly resultRecord: Record<string, unknown>;
  readonly evidence: readonly Record<string, unknown>[];
  readonly collection: "agentOutputs" | "decisions";
  readonly ticker: string;
  readonly agentId?: string;
}): Record<string, unknown> {
  const provenance = runtimeProvenanceRecord(input);
  if (provenance === undefined) return {};
  const sourceArtifactIds = arrayOfStrings(provenance["sourceArtifactIds"]);
  return {
    runtimeProvenance: {
      ...(stringField(provenance, "outputPath") === undefined
        ? {}
        : { outputPath: stringField(provenance, "outputPath") }),
      ...(stringField(provenance, "outputSha256") === undefined
        ? {}
        : { outputSha256: stringField(provenance, "outputSha256") }),
      ...(arrayOfStrings(provenance["inputAgentIds"]).length === 0
        ? {}
        : { inputAgentIds: arrayOfStrings(provenance["inputAgentIds"]) }),
      sourceArtifactIds,
      evidenceDocumentIds: evidenceIdsForSourceArtifactIds(
        input.evidence,
        sourceArtifactIds,
      ),
    },
  };
}

function runtimeProvenanceRecord(input: {
  readonly resultRecord: Record<string, unknown>;
  readonly collection: "agentOutputs" | "decisions";
  readonly ticker: string;
  readonly agentId?: string;
}): Record<string, unknown> | undefined {
  const provenance = recordOrUndefined(input.resultRecord["provenance"]);
  const records = arrayOfRecords(provenance?.[input.collection]);
  return records.find((record) => {
    if (stringField(record, "ticker") !== input.ticker) return false;
    if (input.agentId === undefined) return true;
    return stringField(record, "agent_id") === input.agentId;
  });
}

function evidenceIdsForSourceArtifactIds(
  evidence: readonly Record<string, unknown>[],
  sourceArtifactIds: readonly string[],
): readonly string[] {
  const evidenceBySourceArtifactId = new Map(
    evidence.flatMap((item) => {
      const sourceArtifactId = stringField(item, "sourceArtifactId");
      const evidenceId = stringField(item, "id");
      return sourceArtifactId === undefined || evidenceId === undefined
        ? []
        : [[sourceArtifactId, evidenceId] as const];
    }),
  );
  return sourceArtifactIds.flatMap((sourceArtifactId) => {
    const evidenceId = evidenceBySourceArtifactId.get(sourceArtifactId);
    return evidenceId === undefined ? [] : [evidenceId];
  });
}

function flowToEnvelopeGraph(
  flow: ArrowHedgeIntegrationFlow | undefined,
  effectiveGraph: ArrowHedgeIntegrationEffectiveGraph,
): Record<string, unknown> {
  return {
    ...(flow === undefined ? {} : { flowId: flow.id, name: flow.name }),
    nodes: flow?.nodes ?? effectiveGraph.nodes,
    edges: flow?.edges ?? effectiveGraph.edges,
    effectiveGraph: flow?.effectiveGraph ?? effectiveGraph,
  };
}

function modelConfigToEnvelope(
  modelConfig: ArrowHedgeIntegrationModelConfig,
): Record<string, unknown> {
  return {
    defaults: modelConfig.defaults,
    models: modelConfig.models,
    providers: modelConfig.providers,
    hashes: modelConfig.hashes ?? {},
  };
}

function integrationEnvelopeFingerprints(
  envelope: ArrowHedgeIntegrationRunEnvelope,
): ArrowHedgeIntegrationRunEnvelopePairFingerprints["baseline"] {
  return {
    scopeSha256: sha256StableJson({
      startDate: envelope.scope.startDate,
      endDate: envelope.scope.endDate,
      tickers: [...envelope.scope.tickers].sort(),
    }),
    graphSha256: sha256StableJson(envelope.graph),
    modelConfigSha256: sha256StableJson(envelope.modelConfig),
    portfolioSha256: sha256StableJson(envelope.portfolio),
    sourceDataSha256: sha256StableJson(
      sourceDataEvidenceFingerprint(envelope.evidence),
    ),
  };
}

function sourceDataEvidenceFingerprint(
  evidence: readonly Record<string, unknown>[],
): readonly Record<string, unknown>[] {
  return evidence
    .filter((item) => isSourceArtifactEvidence(item))
    .map((item) => ({
      id: stringField(item, "id"),
      sha256: stringField(item, "sha256"),
      sourceUri: stringField(item, "sourceUri"),
      ticker: stringField(item, "ticker"),
    }))
    .sort((left, right) => {
      const leftKey = `${left.id ?? ""}:${left.ticker ?? ""}`;
      const rightKey = `${right.id ?? ""}:${right.ticker ?? ""}`;
      return leftKey.localeCompare(rightKey);
    });
}

function isSourceArtifactEvidence(item: Record<string, unknown>): boolean {
  const id = stringField(item, "id");
  const sourceUri = stringField(item, "sourceUri");
  return (
    (id?.startsWith("ev_source_") ?? false) ||
    (sourceUri?.startsWith("arrowhedge://source-artifacts/") ?? false)
  );
}

function sha256StableJson(value: unknown): string {
  return createHash("sha256").update(stableJsonString(value)).digest("hex");
}

function stableJsonString(value: unknown): string {
  return JSON.stringify(stableJsonValue(value));
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stableJsonValue(item));
  }
  const record = recordOrUndefined(value);
  if (record !== undefined) {
    return Object.fromEntries(
      Object.entries(record)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJsonValue(item)]),
    );
  }
  return value;
}

function sanitizeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9_.-]+/g, "_");
}

function validateSourceArtifacts(
  path: string,
  artifacts: readonly ArrowHedgeIntegrationSourceArtifact[],
  issues: string[],
): void {
  artifacts.forEach((artifact, index) => {
    if (artifact.schemaVersion !== SOURCE_ARTIFACT_SCHEMA) {
      issues.push(`${path}[${index}].schemaVersion must be ${SOURCE_ARTIFACT_SCHEMA}`);
    }
    if (artifact.provider === "") {
      issues.push(`${path}[${index}].provider is required`);
    }
    if (artifact.kind === "") {
      issues.push(`${path}[${index}].kind is required`);
    }
    if (artifact.cache_key === "") {
      issues.push(`${path}[${index}].cache_key is required`);
    }
    if (artifact.row_count < 0) {
      issues.push(`${path}[${index}].row_count must be non-negative`);
    }
    if (artifact.sha256 === "") {
      issues.push(`${path}[${index}].sha256 is required`);
    }
    if (Object.prototype.hasOwnProperty.call(artifact, "rows")) {
      issues.push(`${path}[${index}] must not include raw rows`);
    }
    if (includesRawSecret(artifact)) {
      issues.push(`${path}[${index}] must not expose raw API keys`);
    }
  });
}
