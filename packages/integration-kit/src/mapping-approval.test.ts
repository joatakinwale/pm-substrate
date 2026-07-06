import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import type { EntityMapping } from "@pm/entity-mapping";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import type { TenantId } from "@pm/types";

import { fetchLiquidRecords, type LiquidMcpClient } from "./liquid-source.js";
import { syncFromLiquid } from "./liquid-sync.js";
import {
  MappingNotApprovedError,
  approveEntityMapping,
  entityMappingHash,
  getMappingApprovalState,
  proposeEntityMapping,
  rejectEntityMapping,
  requireApprovedEntityMapping,
} from "./mapping-approval.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const APP = "liquid_fixture_app";

const MAPPING_A: EntityMapping = {
  profile: null,
  mappingVersion: 1,
  entities: {
    Customer: {
      tier1: "Counterparty",
      concrete: "Counterparty",
      identityFields: ["name"],
      fieldMap: { external_email: "email" },
      schemaVersion: 1,
    },
  },
};

/** The "drift-repaired" variant Liquid would come back with. */
const MAPPING_B: EntityMapping = {
  ...MAPPING_A,
  entities: {
    Customer: {
      ...MAPPING_A.entities["Customer"]!,
      fieldMap: { external_email: "contact_email" },
    },
  },
};

const sidecar: LiquidMcpClient = {
  async callTool(params) {
    if (params.name === "liquid_connect") {
      return {
        structuredContent: { status: "connected", adapter_id: "adp_x" },
      };
    }
    return {
      structuredContent: {
        records: 1,
        data: [{ id: 7, name: "Ada", email: "ada@x.example" }],
      },
    };
  },
};

describeIfDb("mapping approvals — drift is an obstruction (L3)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_map_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    events = new PostgresEventStore(pool);
    graph = new PostgresGraph(pool);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("unapproved mapping blocks the Liquid path outright", async () => {
    await expect(
      syncFromLiquid({ graph, events }, sidecar, {
        tenantId,
        appName: APP,
        mapping: MAPPING_A,
        url: "https://api.x.example",
        sourceName: "Customer",
        externalIdField: "id",
        syncedBy: "map-test",
      }),
    ).rejects.toBeInstanceOf(MappingNotApprovedError);
  });

  it("propose → approve → sync flows; identical re-proposals dedupe", async () => {
    const proposed = await proposeEntityMapping(events, {
      tenantId,
      appName: APP,
      mapping: MAPPING_A,
      proposedBy: "map-test",
      origin: "manual",
    });
    expect(proposed.proposed).toBe(true);

    const duplicate = await proposeEntityMapping(events, {
      tenantId,
      appName: APP,
      mapping: MAPPING_A,
      proposedBy: "map-test",
      origin: "manual",
    });
    expect(duplicate).toMatchObject({ proposed: false, alreadyApproved: false });

    await approveEntityMapping(events, {
      tenantId,
      appName: APP,
      mappingHash: proposed.mappingHash,
      decidedBy: "owner",
    });

    const result = await syncFromLiquid({ graph, events }, sidecar, {
      tenantId,
      appName: APP,
      mapping: MAPPING_A,
      url: "https://api.x.example",
      sourceName: "Customer",
      externalIdField: "id",
      syncedBy: "map-test",
    });
    expect(result).toMatchObject({
      created: 1,
      mappingHash: proposed.mappingHash,
      adapterId: "adp_x",
    });
  });

  it("a drift-repaired mapping obstructs until approved, then supersedes", async () => {
    // Liquid comes back with a repaired map (B). Sync with B must block…
    await expect(
      syncFromLiquid({ graph, events }, sidecar, {
        tenantId,
        appName: APP,
        mapping: MAPPING_B,
        url: "https://api.x.example",
        sourceName: "Customer",
        externalIdField: "id",
        syncedBy: "map-test",
      }),
    ).rejects.toMatchObject({ approvedHash: entityMappingHash(MAPPING_A) });

    // …the repair is recorded as a proposal…
    const proposal = await proposeEntityMapping(events, {
      tenantId,
      appName: APP,
      mapping: MAPPING_B,
      proposedBy: "liquid-sidecar",
      origin: "liquid_repair",
      reason: "upstream renamed email → contact_email",
    });
    expect(proposal.proposed).toBe(true);

    let state = await getMappingApprovalState(events, tenantId, APP);
    expect(state.approvedHash).toBe(entityMappingHash(MAPPING_A));
    expect(state.pending.map((p) => p.origin)).toContain("liquid_repair");

    // …approval supersedes A with B…
    await approveEntityMapping(events, {
      tenantId,
      appName: APP,
      mappingHash: proposal.mappingHash,
      decidedBy: "owner",
    });
    state = await getMappingApprovalState(events, tenantId, APP);
    expect(state.approvedHash).toBe(proposal.mappingHash);
    expect(state.pending).toHaveLength(0);

    // …and now B syncs while A blocks.
    await expect(
      requireApprovedEntityMapping(events, tenantId, APP, MAPPING_B),
    ).resolves.toBe(proposal.mappingHash);
    await expect(
      requireApprovedEntityMapping(events, tenantId, APP, MAPPING_A),
    ).rejects.toBeInstanceOf(MappingNotApprovedError);
  });

  it("rejected proposals close; deciding on unknown hashes refuses", async () => {
    const junk: EntityMapping = {
      ...MAPPING_A,
      description: "junk variant",
    };
    const proposal = await proposeEntityMapping(events, {
      tenantId,
      appName: APP,
      mapping: junk,
      proposedBy: "map-test",
      origin: "liquid_discovery",
    });
    await rejectEntityMapping(events, {
      tenantId,
      appName: APP,
      mappingHash: proposal.mappingHash,
      decidedBy: "owner",
      reason: "not wanted",
    });
    const state = await getMappingApprovalState(events, tenantId, APP);
    expect(state.pending).toHaveLength(0);

    await expect(
      approveEntityMapping(events, {
        tenantId,
        appName: APP,
        mappingHash: "hash_that_never_was",
        decidedBy: "owner",
      }),
    ).rejects.toThrow(/no pending proposal/);
  });

  it("dry run previews the gate's verdict instead of enforcing it", async () => {
    const unapproved: EntityMapping = {
      ...MAPPING_A,
      description: "never-approved variant for the dry-run preview",
    };
    const preview = await syncFromLiquid({ graph, events }, sidecar, {
      tenantId,
      appName: APP,
      mapping: unapproved,
      url: "https://api.x.example",
      sourceName: "Customer",
      externalIdField: "id",
      syncedBy: "map-test",
      dryRun: true,
    });
    expect(preview).toMatchObject({
      dryRun: true,
      mappingApproved: false, // a real run would be REFUSED
      created: 0,
      unchanged: 1, // the record already landed via the approved-A sync above
    });
  });

  it("fetchLiquidRecords stays gate-free (transport), syncFromLiquid is the governed door", async () => {
    // Direct transport fetch works without approval — by design the gate
    // lives at the composition, so nothing can 'forget' it on the sync path.
    const fetched = await fetchLiquidRecords(sidecar, {
      url: "https://api.x.example",
      sourceName: "Customer",
      mapping: MAPPING_B,
      externalIdField: "id",
    });
    expect(fetched.records).toHaveLength(1);
  });
});
