import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import type { EntityMapping } from "@pm/entity-mapping";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import type { TenantId } from "@pm/types";

import {
  LiquidSourceError,
  deriveTargetModel,
  fetchLiquidRecords,
  type LiquidMcpClient,
} from "./liquid-source.js";
import { runEntityMappingSync } from "./sync-runner.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const MAPPING: EntityMapping = {
  profile: null,
  mappingVersion: 1,
  entities: {
    Customer: {
      tier1: "Counterparty",
      concrete: "Counterparty",
      identityFields: ["name"],
      fieldMap: { external_email: "email" },
      optionalFields: ["city"],
      schemaVersion: 1,
    },
  },
};

/** Scripted sidecar speaking the REAL liquid-mcp result shapes. */
function fakeLiquid(overrides?: {
  connectStatus?: string;
  omitAdapterId?: boolean;
  rows?: readonly Record<string, unknown>[];
  errorOn?: "liquid_connect" | "liquid_fetch";
}): { client: LiquidMcpClient; calls: { name: string; arguments: Record<string, unknown> }[] } {
  const calls: { name: string; arguments: Record<string, unknown> }[] = [];
  const client: LiquidMcpClient = {
    async callTool(params) {
      calls.push(params);
      if (params.name === overrides?.errorOn) {
        return {
          isError: true,
          content: [{ type: "text", text: "upstream exploded" }],
        };
      }
      if (params.name === "liquid_connect") {
        const status = overrides?.connectStatus ?? "connected";
        return {
          structuredContent: {
            status,
            ...(status === "connected" && !overrides?.omitAdapterId
              ? {
                  adapter_id: "adp_fixture",
                  service: "fixture",
                  mapped_fields: ["name", "email"],
                  endpoints: ["/customers"],
                }
              : { detail: "mapping review required" }),
          },
        };
      }
      if (params.name === "liquid_fetch") {
        const data = overrides?.rows ?? [
          { id: 11, name: "Ada Lovelace", email: "ada@fx.example", city: "London" },
          { id: 12, name: "Grace Hopper", email: "grace@fx.example", city: "NYC" },
        ];
        return { structuredContent: { records: data.length, data } };
      }
      throw new Error(`unexpected tool ${params.name}`);
    },
  };
  return { client, calls };
}

describe("liquid source driver (pure, real tool vocabulary)", () => {
  it("derives target_model from the mapping entry — the mapping stays the source of truth", () => {
    expect(deriveTargetModel(MAPPING, "Customer")).toEqual({
      name: "str",
      email: "str",
      city: "str",
    });
    expect(() => deriveTargetModel(MAPPING, "Ghost")).toThrow(
      /not declared in mapping/,
    );
  });

  it("connects with the derived model, fetches, and returns SourceRecords", async () => {
    const { client, calls } = fakeLiquid();
    const result = await fetchLiquidRecords(client, {
      url: "https://api.fixture.example/customers",
      sourceName: "Customer",
      mapping: MAPPING,
      externalIdField: "id",
    });
    expect(calls[0]).toEqual({
      name: "liquid_connect",
      arguments: {
        url: "https://api.fixture.example/customers",
        // externalIdField rides along: records must be identifiable.
        target_model: { name: "str", email: "str", city: "str", id: "str" },
      },
    });
    expect(calls[1]?.name).toBe("liquid_fetch");
    expect(calls[1]?.arguments).toEqual({ adapter_id: "adp_fixture" });
    expect(result.adapterId).toBe("adp_fixture");
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toEqual({
      sourceName: "Customer",
      externalId: "11",
      row: { id: 11, name: "Ada Lovelace", email: "ada@fx.example", city: "London" },
    });
  });

  it("review_needed is an obstruction, never a silent sync", async () => {
    const { client } = fakeLiquid({ connectStatus: "review_needed" });
    await expect(
      fetchLiquidRecords(client, {
        url: "https://api.fixture.example",
        sourceName: "Customer",
        mapping: MAPPING,
        externalIdField: "id",
      }),
    ).rejects.toMatchObject({ code: "review_needed" });
  });

  it("connected without adapter_id is a bad sidecar response", async () => {
    const { client } = fakeLiquid({ omitAdapterId: true });
    await expect(
      fetchLiquidRecords(client, {
        url: "https://api.fixture.example",
        sourceName: "Customer",
        mapping: MAPPING,
        externalIdField: "id",
      }),
    ).rejects.toMatchObject({ code: "bad_response" });
  });

  it("tool errors surface with the sidecar's text; rows without ids are counted out", async () => {
    const { client } = fakeLiquid({ errorOn: "liquid_fetch" });
    await expect(
      fetchLiquidRecords(client, {
        url: "https://x.example",
        sourceName: "Customer",
        mapping: MAPPING,
        externalIdField: "id",
      }),
    ).rejects.toThrow(/upstream exploded/);

    const partial = fakeLiquid({
      rows: [
        { id: 1, name: "Kept", email: "k@x.example" },
        { name: "No Id", email: "n@x.example" },
      ],
    });
    const result = await fetchLiquidRecords(partial.client, {
      url: "https://x.example",
      sourceName: "Customer",
      mapping: MAPPING,
      externalIdField: "id",
    });
    expect(result.records).toHaveLength(1);
    expect(result.skippedMissingId).toBe(1);
    expect(result.records[0]).toBeInstanceOf(Object);
    expect(new LiquidSourceError("x", "tool_error").name).toBe(
      "LiquidSourceError",
    );
  });
});

describeIfDb("liquid records flow through the governed sync unchanged", () => {
  let pool: pg.Pool;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_liq_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("sidecar → driver → runEntityMappingSync, idempotent end-to-end", async () => {
    const { client } = fakeLiquid();
    const graph = new PostgresGraph(pool);
    const events = new PostgresEventStore(pool);
    const fetched = await fetchLiquidRecords(client, {
      url: "https://api.fixture.example/customers",
      sourceName: "Customer",
      mapping: MAPPING,
      externalIdField: "id",
    });
    const first = await runEntityMappingSync(
      { graph, events },
      {
        tenantId,
        appName: "liquid_fixture",
        mapping: MAPPING,
        records: fetched.records,
        syncedBy: "liquid-source-test",
      },
    );
    expect(first).toMatchObject({ created: 2, updated: 0, unchanged: 0 });

    const again = await runEntityMappingSync(
      { graph, events },
      {
        tenantId,
        appName: "liquid_fixture",
        mapping: MAPPING,
        records: (
          await fetchLiquidRecords(client, {
            url: "https://api.fixture.example/customers",
            sourceName: "Customer",
            mapping: MAPPING,
            externalIdField: "id",
          })
        ).records,
        syncedBy: "liquid-source-test",
      },
    );
    expect(again).toMatchObject({ created: 0, updated: 0, unchanged: 2 });
  });
});
