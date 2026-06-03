import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  ADAPTER_ENTITY_MAPPED_EVENT_TYPE,
  planEntityIngestion,
  type EntityMapping,
} from "@pm/entity-mapping";
import {
  analyzeEvalEvents,
  buildAdapterStateProofEvalPair,
} from "@pm/evals";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import {
  PostgresProjectionRunner,
  type Projection,
} from "@pm/projections";
import {
  entityId,
  timestamp,
  type EntityId,
  type PMEvent,
  type TenantId,
} from "@pm/types";

import { AGENCY_PROFILE } from "./profile.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const stevieAgencyMapping: EntityMapping = {
  profile: "agency",
  mappingVersion: 1,
  entities: {
    Organization: {
      tier1: "Counterparty",
      concrete: "ClientOrg",
      identityFields: ["name"],
      fieldMap: { externalRef: "id" },
      schemaVersion: 1,
    },
    Project: {
      tier1: "Engagement",
      concrete: "Project",
      identityFields: [],
      fieldMap: {
        title: "name",
        projectType: "project_type",
        operationalState: "status",
      },
      schemaVersion: 1,
    },
  },
};

interface AdapterMappedProjectionState {
  readonly total: number;
  readonly byConcrete: Readonly<Record<string, number>>;
  readonly sourceRecords: Readonly<Record<string, {
    readonly entityId: EntityId;
    readonly concrete: string;
    readonly sourceName: string;
    readonly identity: Readonly<Record<string, unknown>>;
  }>>;
}

const adapterMappedProjection = (
  name: string,
): Projection<AdapterMappedProjectionState> => ({
  name,
  version: 1,
  consumes: [ADAPTER_ENTITY_MAPPED_EVENT_TYPE],
  initial: () => ({
    total: 0,
    byConcrete: {},
    sourceRecords: {},
  }),
  apply: (state, event: PMEvent) => {
    const payload = event.payload as {
      readonly concrete?: unknown;
      readonly sourceName?: unknown;
      readonly sourceRecordId?: unknown;
      readonly identity?: unknown;
    };
    const concrete =
      typeof payload.concrete === "string" ? payload.concrete : "unknown";
    const sourceName =
      typeof payload.sourceName === "string" ? payload.sourceName : "unknown";
    const sourceRecordId =
      typeof payload.sourceRecordId === "string"
        ? payload.sourceRecordId
        : event.entityId;
    const identity = isRecord(payload.identity) ? payload.identity : {};

    return {
      total: state.total + 1,
      byConcrete: {
        ...state.byConcrete,
        [concrete]: (state.byConcrete[concrete] ?? 0) + 1,
      },
      sourceRecords: {
        ...state.sourceRecords,
        [sourceRecordId]: {
          entityId: event.entityId,
          concrete,
          sourceName,
          identity,
        },
      },
    };
  },
});

describeIfDb("adapter state proof — mapping plan to graph, events, projections", () => {
  let pool: pg.Pool;
  let profileRegistry: PostgresProfileRegistry;
  let graph: PostgresGraph;
  let events: PostgresEventStore;
  let projections: PostgresProjectionRunner;
  const tenants: TenantId[] = [];

  const makeTenant = async (): Promise<TenantId> => {
    const id = `tnt_adapter_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    await profileRegistry.install(id, AGENCY_PROFILE);
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    events = new PostgresEventStore(pool);
    projections = new PostgresProjectionRunner(pool, events);
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("commits mapped rows atomically and projects adapter events into shared state", async () => {
    const tenantId = await makeTenant();
    const projection = adapterMappedProjection(
      `adapter_state_proof_${randomUUID().slice(0, 6)}`,
    );
    await projections.register(projection);

    const plan = planEntityIngestion(stevieAgencyMapping, AGENCY_PROFILE, [
      {
        sourceName: "Organization",
        sourceRecordId: "org_acme",
        id: entityId("00000000-0000-4000-8000-00000000a001"),
        row: { id: "org_acme", name: "Acme Co" },
      },
      {
        sourceName: "Project",
        sourceRecordId: "proj_brand",
        id: entityId("00000000-0000-4000-8000-00000000a002"),
        row: {
          name: "Brand refresh",
          project_type: "branding",
          status: "kickoff",
        },
      },
    ], {
      tenantId,
      emittedBy: "adapter:stevie-agency",
      authority: "mapping:agency:v1",
    });

    expect(plan.valid).toBe(true);
    expect(plan.items).toHaveLength(2);

    for (const item of plan.items) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await graph.createNode(item.node, client);
        expect(result.node.id).toBe(item.event.entityId);
        await events.publishWith(client, item.event);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    }

    const org = await graph.getNode(
      tenantId,
      entityId("00000000-0000-4000-8000-00000000a001"),
    );
    expect(org?.identity).toEqual({
      name: "Acme Co",
      externalRef: "org_acme",
    });

    const adapterEvents = await events.read({
      tenantId,
      typePattern: ADAPTER_ENTITY_MAPPED_EVENT_TYPE,
    });
    expect(adapterEvents).toHaveLength(2);
    expect(adapterEvents.map((event) => event.entityId)).toEqual([
      entityId("00000000-0000-4000-8000-00000000a001"),
      entityId("00000000-0000-4000-8000-00000000a002"),
    ]);
    expect(await events.verifyChain(tenantId)).toMatchObject({
      valid: true,
      checked: 2,
    });

    await projections.catchUp(tenantId, projection.name);
    const state = await projections.getState<AdapterMappedProjectionState>(
      tenantId,
      projection.name,
    );

    expect(state).toEqual({
      total: 2,
      byConcrete: {
        ClientOrg: 1,
        Project: 1,
      },
      sourceRecords: {
        org_acme: {
          entityId: entityId("00000000-0000-4000-8000-00000000a001"),
          concrete: "ClientOrg",
          sourceName: "Organization",
          identity: {
            name: "Acme Co",
            externalRef: "org_acme",
          },
        },
        proj_brand: {
          entityId: entityId("00000000-0000-4000-8000-00000000a002"),
          concrete: "Project",
          sourceName: "Project",
          identity: {
            title: "Brand refresh",
            projectType: "branding",
            operationalState: "kickoff",
          },
        },
      },
    });

    const eventByEntity = new Map(
      adapterEvents.map((event) => [event.entityId, event.id]),
    );
    const evalPair = buildAdapterStateProofEvalPair({
      tenantId,
      observedAt: timestamp("2026-06-03T16:15:00.000Z"),
      agentId: "adapter_state_proof_integration",
      scenarioId: "agency-db-backed-source-row-onboarding",
      source: "packages/profile-agency/src/adapter-state-proof.integration.test.ts",
      sourceRecords: plan.items.map((item) => ({
        sourceRecordId: item.sourceRecordId!,
        graphNodeId: item.event.entityId,
        adapterEventId: eventByEntity.get(item.event.entityId)!,
        concrete: item.node.profile.concrete,
      })),
      projectionId: projection.name,
    });
    const evalMetrics = analyzeEvalEvents(evalPair.events);
    expect(evalMetrics.byFailureClass["representation_loss"]).toMatchObject({
      pairedGroups: 1,
      baselineFailures: 1,
      substrateFailures: 0,
      failureReduction: 1,
      substratePasses: 1,
    });
    expect(evalMetrics.byCoordinationClass["derived_projection"]).toMatchObject({
      pairedGroups: 1,
      failureReduction: 1,
      substratePasses: 1,
    });
  });
});

const isRecord = (v: unknown): v is Readonly<Record<string, unknown>> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
