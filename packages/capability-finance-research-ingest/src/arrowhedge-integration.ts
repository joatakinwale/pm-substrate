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

export interface ArrowHedgeIntegrationSnapshot {
  readonly capabilities: ArrowHedgeIntegrationCapabilities;
  readonly agents: ArrowHedgeIntegrationAgents;
  readonly effectiveGraph: ArrowHedgeIntegrationEffectiveGraph;
  readonly cacheSummary: ArrowHedgeIntegrationCacheSummary;
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
const ADAPTER_VERSION = "integration.v1";

const REQUIRED_SURFACES = [
  "/integration/v1/capabilities",
  "/integration/v1/agents",
  "/integration/v1/graphs/effective",
  "/integration/v1/data/cache/summary",
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
  const [capabilities, agents, effectiveGraph, cacheSummary] = await Promise.all([
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
  ]);
  const snapshot = {
    capabilities,
    agents,
    effectiveGraph,
    cacheSummary,
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
