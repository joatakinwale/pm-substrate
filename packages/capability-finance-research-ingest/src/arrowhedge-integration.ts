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
  readonly flows: ArrowHedgeIntegrationFlows;
  readonly flowDetails: readonly ArrowHedgeIntegrationFlow[];
  readonly runDetails: readonly ArrowHedgeIntegrationFlowRun[];
  readonly runEvents: readonly ArrowHedgeIntegrationRunEvents[];
  readonly backtests: ArrowHedgeIntegrationBacktests;
  readonly backtestDetails: readonly ArrowHedgeIntegrationBacktest[];
  readonly backtestDays: readonly ArrowHedgeIntegrationBacktestDays[];
  readonly modelConfig: ArrowHedgeIntegrationModelConfig;
  readonly apiKeySummary: ArrowHedgeIntegrationApiKeySummary;
  readonly evidenceRefs: readonly StateRef[];
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
  "/integration/v1/flows",
  "/integration/v1/flows/{id}",
  "/integration/v1/flows/{id}/runs",
  "/integration/v1/runs/{id}",
  "/integration/v1/runs/{id}/events",
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
    flows,
    flowDetails,
    runDetails,
    runEvents,
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
