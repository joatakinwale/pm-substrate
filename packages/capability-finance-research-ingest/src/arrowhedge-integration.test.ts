import { describe, expect, it } from "vitest";

import {
  fetchArrowHedgeIntegrationSnapshot,
  validateArrowHedgeIntegrationSnapshot,
  type ArrowHedgeIntegrationFetch,
  type ArrowHedgeIntegrationFetchResponse,
} from "./arrowhedge-integration.js";

function jsonResponse(
  body: unknown,
  status = 200,
): ArrowHedgeIntegrationFetchResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  };
}

describe("ArrowHedge integration API client", () => {
  it("fetches and validates the neutral ArrowHedgeLab integration surface", async () => {
    const calls: Array<{
      url: string;
      method: string | undefined;
      authorization: string | undefined;
      body: unknown;
    }> = [];
    const responses = new Map<string, unknown>([
      [
        "https://arrow.example/integration/v1/capabilities",
        {
          schemaVersion: "arrowhedgelab.integration.capabilities.v1",
          adapterVersion: "integration.v1",
          app: { name: "ai-hedge-fund", version: "2026.6.17" },
          redaction: { apiKeys: "presence_only", rawSecrets: "never" },
          surfaces: [
            "/integration/v1/capabilities",
            "/integration/v1/agents",
            "/integration/v1/graphs/effective",
            "/integration/v1/data/cache/summary",
          ],
        },
      ],
      [
        "https://arrow.example/integration/v1/agents",
        {
          schemaVersion: "arrowhedgelab.integration.agents.v1",
          agents: [
            {
              key: "warren_buffett",
              stable_id: "arrowhedgelab.agent.warren_buffett",
              role: "analyst",
            },
            {
              key: "risk_management",
              stable_id: "arrowhedgelab.agent.risk_management",
              role: "risk_manager",
            },
            {
              key: "portfolio_manager",
              stable_id: "arrowhedgelab.agent.portfolio_manager",
              role: "portfolio_manager",
            },
          ],
        },
      ],
      [
        "https://arrow.example/integration/v1/graphs/effective",
        {
          schemaVersion: "arrowhedgelab.integration.effective-graph.v1",
          nodes: [
            {
              id: "warren_buffett_ab12cd",
              type: "agent",
              base_agent_key: "warren_buffett",
            },
            {
              id: "risk_management_agent_ef34gh",
              type: "agent",
              base_agent_key: "risk_management",
              synthetic: true,
            },
            {
              id: "portfolio_manager_ef34gh",
              type: "agent",
              base_agent_key: "portfolio_manager",
            },
          ],
          edges: [
            {
              id: "warren_buffett_ab12cd__to__risk_management_agent_ef34gh",
              source: "warren_buffett_ab12cd",
              target: "risk_management_agent_ef34gh",
              synthetic: true,
            },
            {
              id: "risk_management_agent_ef34gh__to__portfolio_manager_ef34gh",
              source: "risk_management_agent_ef34gh",
              target: "portfolio_manager_ef34gh",
              synthetic: true,
            },
          ],
          validation: { issues: [] },
        },
      ],
      [
        "https://arrow.example/integration/v1/data/cache/summary",
        {
          schemaVersion: "arrowhedgelab.integration.cache-summary.v1",
          records: [
            {
              kind: "prices",
              cache_key: "AAPL_2024-01-01_2024-01-02",
              row_count: 1,
              sha256: "a".repeat(64),
            },
          ],
        },
      ],
    ]);
    const fetchFn: ArrowHedgeIntegrationFetch = async (url, init) => {
      calls.push({
        url,
        method: init?.method,
        authorization: init?.headers?.authorization,
        body: init?.body === undefined ? undefined : JSON.parse(init.body),
      });
      return jsonResponse(responses.get(url) ?? { error: "not found" }, responses.has(url) ? 200 : 404);
    };

    const snapshot = await fetchArrowHedgeIntegrationSnapshot({
      integrationBaseUrl: "https://arrow.example",
      bearerToken: "substrate-token",
      fetchFn,
      graph: {
        nodes: [
          { id: "warren_buffett_ab12cd", type: "agent" },
          { id: "portfolio_manager_ef34gh", type: "agent" },
        ],
        edges: [
          {
            id: "edge-1",
            source: "warren_buffett_ab12cd",
            target: "portfolio_manager_ef34gh",
          },
        ],
      },
    });
    const validation = validateArrowHedgeIntegrationSnapshot(snapshot);

    expect(calls.map((call) => call.url)).toEqual([
      "https://arrow.example/integration/v1/capabilities",
      "https://arrow.example/integration/v1/agents",
      "https://arrow.example/integration/v1/graphs/effective",
      "https://arrow.example/integration/v1/data/cache/summary",
    ]);
    expect(calls[2]).toMatchObject({
      method: "POST",
      authorization: "Bearer substrate-token",
      body: {
        nodes: [
          { id: "warren_buffett_ab12cd", type: "agent" },
          { id: "portfolio_manager_ef34gh", type: "agent" },
        ],
        edges: [
          {
            id: "edge-1",
            source: "warren_buffett_ab12cd",
            target: "portfolio_manager_ef34gh",
          },
        ],
      },
    });
    expect(validation).toEqual({ ready: true, issues: [] });
    expect(snapshot.evidenceRefs.map((ref) => ref.id)).toEqual([
      "arrowhedgelab:integration_api:capabilities",
      "arrowhedgelab:integration_api:agents",
      "arrowhedgelab:integration_api:effective_graph",
      `arrowhedgelab:cache:prices:AAPL_2024-01-01_2024-01-02:${"a".repeat(64)}`,
    ]);
  });

  it("reports contract issues instead of accepting a partial adapter surface", () => {
    const validation = validateArrowHedgeIntegrationSnapshot({
      capabilities: {
        schemaVersion: "arrowhedgelab.integration.capabilities.v1",
        adapterVersion: "integration.v1",
        app: { name: "ai-hedge-fund", version: "2026.6.17" },
        redaction: { apiKeys: "raw", rawSecrets: "never" },
        surfaces: ["/integration/v1/capabilities"],
      },
      agents: {
        schemaVersion: "arrowhedgelab.integration.agents.v1",
        agents: [
          {
            key: "portfolio_manager",
            stable_id: "arrowhedgelab.agent.portfolio_manager",
          },
        ],
      },
      effectiveGraph: {
        schemaVersion: "arrowhedgelab.integration.effective-graph.v1",
        nodes: [],
        edges: [],
        validation: {
          issues: [{ path: "/edges/0", message: "missing source node" }],
        },
      },
      cacheSummary: {
        schemaVersion: "arrowhedgelab.integration.cache-summary.v1",
        records: [
          {
            kind: "prices",
            cache_key: "AAPL",
            row_count: 1,
            sha256: "",
            rows: [{ close: 185 }],
          },
        ],
      },
      evidenceRefs: [],
    });

    expect(validation.ready).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        "capabilities.redaction.apiKeys must be presence_only",
        "capabilities.surfaces is missing /integration/v1/agents",
        "agents is missing risk_management",
        "effectiveGraph.validation.issues must be empty",
        "cacheSummary.records[0].sha256 is required",
        "cacheSummary.records[0] must not include raw rows",
      ]),
    );
  });
});
