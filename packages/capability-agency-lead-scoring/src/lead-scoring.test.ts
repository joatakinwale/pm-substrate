/**
 * Integration tests for the agency.lead-scoring capability.
 *
 * Built as the second proof point in the G4 anti-fixation falsification test.
 * Mirrors the structure of @pm/capability-wedding-budget's budget.test.ts:
 *
 *   1. Happy path (lead-bound override): lead-scored event → correct
 *      LeadScoringConfig.currentTotalLeadsScored update + agency.lead.scored
 *      event emitted.
 *   2. User-default fallback: lead has no scored_by edge but is assigned to
 *      a user with a default config; rollup applies to that fallback config.
 *   3. Idempotency: same scoringEventId delivered twice → rollup applied once.
 *   4. No-config-link: lead has neither scored_by nor an assigned user with a
 *      default config → warning logged, no rollup, no error thrown.
 *   5. Atomicity: if event publish fails, both the graph UPDATE and the
 *      applied_scoring_events INSERT are rolled back.
 *
 * If this file ever requires a substrate-internal API to make pass, the
 * G4 finding has flipped — that's exactly what the test is here to detect.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import { PostgresProfileRegistry } from "@pm/profile-registry";
import { PostgresRegistry } from "@pm/registry";
import { AGENCY_PROFILE } from "@pm/profile-agency";
import type { EntityId, TenantId } from "@pm/types";
import {
  AGENCY_LEAD_SCORING_CAPABILITY,
  LeadScoringHandler,
} from "./index.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("agency.lead-scoring capability", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let graph: PostgresGraph;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;
  let handler: LeadScoringHandler;
  let tenantId: TenantId;

  // Shared entity IDs (created in beforeAll, reused across tests).
  let userId: EntityId;
  let scoringConfigOverrideId: EntityId; // The lead-bound config (Path 1).
  let scoringConfigDefaultId: EntityId; // The user's default config (Path 2).
  let leadOverrideId: EntityId; // Lead with explicit lead_scored_by edge.
  let leadFallbackId: EntityId; // Lead without scored_by, but assigned to user.

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    graph = new PostgresGraph(pool); // No validatorFactory — raw mode for speed.
    capRegistry = new PostgresRegistry(pool);
    profileRegistry = new PostgresProfileRegistry(pool);

    tenantId = `tnt_als_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    await profileRegistry.install(tenantId, AGENCY_PROFILE);
    await capRegistry.register(tenantId, AGENCY_LEAD_SCORING_CAPABILITY);

    handler = new LeadScoringHandler({
      pool,
      graph,
      events,
      emittedBy: "agency.lead-scoring.test",
    });

    // AgencyUser staff member.
    const { node: userNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Resource",
        profile: "agency",
        concrete: "AgencyUser",
      },
      identity: {
        name: "Riley Chen",
        email: "riley@agency.example",
        kind: "agency_user",
        role: "account_manager",
      },
      schemaVersion: 1,
    });
    userId = userNode.id;

    // The lead-bound override scoring config. currentTotalLeadsScored = 0.
    const { node: cfgOverrideNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Resource",
        profile: "agency",
        concrete: "LeadScoringConfig",
      },
      identity: {
        name: "Override Config",
        kind: "lead_scoring_config",
        thresholds: { cold: 0, warm: 25, hot: 75 },
        currentTotalLeadsScored: 0,
      },
      schemaVersion: 1,
    });
    scoringConfigOverrideId = cfgOverrideNode.id;

    // The user's default fallback scoring config. currentTotalLeadsScored = 0.
    const { node: cfgDefaultNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Resource",
        profile: "agency",
        concrete: "LeadScoringConfig",
      },
      identity: {
        name: "Default Config",
        kind: "lead_scoring_config",
        thresholds: { cold: 0, warm: 30, hot: 80 },
        currentTotalLeadsScored: 0,
      },
      schemaVersion: 1,
    });
    scoringConfigDefaultId = cfgDefaultNode.id;

    // Lead with explicit lead_scored_by → override config.
    const { node: leadOverrideNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Counterparty",
        profile: "agency",
        concrete: "Lead",
      },
      identity: {
        name: "Lead With Override",
        qualificationStatus: "new",
      },
      schemaVersion: 1,
    });
    leadOverrideId = leadOverrideNode.id;

    // Lead with no scored_by; will fall back through assigned user.
    const { node: leadFallbackNode } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Counterparty",
        profile: "agency",
        concrete: "Lead",
      },
      identity: {
        name: "Lead Falls Back",
        qualificationStatus: "new",
      },
      schemaVersion: 1,
    });
    leadFallbackId = leadFallbackNode.id;

    // Wire: leadOverride → lead_scored_by → override config.
    await graph.createEdge({
      tenantId,
      type: "agency/lead_scored_by",
      fromId: leadOverrideId,
      toId: scoringConfigOverrideId,
      attrs: {},
    });

    // Wire: leadFallback → lead_assigned_to_user → user.
    await graph.createEdge({
      tenantId,
      type: "agency/lead_assigned_to_user",
      fromId: leadFallbackId,
      toId: userId,
      attrs: {},
    });

    // Wire: user → user_default_scoring → default config.
    await graph.createEdge({
      tenantId,
      type: "agency/user_default_scoring",
      fromId: userId,
      toId: scoringConfigDefaultId,
      attrs: {},
    });
  });

  afterAll(async () => {
    await events.close();
    await pool.query(
      `DELETE FROM lead_scoring.applied_scoring_events WHERE tenant_id = $1`,
      [tenantId],
    );
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  // ---------------------------------------------------------------------------
  // Test 1: Happy path (lead-bound override)
  // ---------------------------------------------------------------------------
  it("scoring event for a lead with lead_scored_by → increments override config and emits agency.lead.scored", async () => {
    const scoringEventId = `score_${randomUUID().slice(0, 8)}`;
    const scoreDelta = 50;

    await handler.handle(tenantId, {
      leadId: leadOverrideId,
      scoreDelta,
      scoringEventId,
      recordedAt: new Date().toISOString(),
      reason: "qualified after discovery call",
    });

    const cfg = await graph.getNode(tenantId, scoringConfigOverrideId);
    // Override-config counter rose by exactly 1 from baseline 0.
    expect(cfg?.identity["currentTotalLeadsScored"]).toBe(1);

    // Default-config counter must be untouched.
    const defaultCfg = await graph.getNode(tenantId, scoringConfigDefaultId);
    expect(defaultCfg?.identity["currentTotalLeadsScored"]).toBe(0);

    // The outbound event must have been emitted with the correct payload.
    const evs = await events.read({
      tenantId,
      typePattern: "agency.lead.scored",
      entityId: scoringConfigOverrideId,
    });
    const thisEv = evs.find(
      (e) => e.payload["sourceScoringEventId"] === scoringEventId,
    );
    expect(thisEv).toBeDefined();
    expect(thisEv?.payload).toMatchObject({
      leadScoringConfigId: scoringConfigOverrideId,
      leadId: leadOverrideId,
      scoreDelta,
      newTotalLeadsScored: 1,
      sourceScoringEventId: scoringEventId,
      reason: "qualified after discovery call",
    });
  });

  // ---------------------------------------------------------------------------
  // Test 2: User-default fallback path
  // ---------------------------------------------------------------------------
  it("scoring event for a lead with no scored_by → falls back through assigned user's default config", async () => {
    const cfgBefore = await graph.getNode(tenantId, scoringConfigDefaultId);
    const beforeCount = cfgBefore?.identity["currentTotalLeadsScored"] as number;

    const scoringEventId = `score_fb_${randomUUID().slice(0, 8)}`;

    await handler.handle(tenantId, {
      leadId: leadFallbackId,
      scoreDelta: 10,
      scoringEventId,
      recordedAt: new Date().toISOString(),
    });

    // Default config rose by exactly 1 — fallback path resolved.
    const cfgAfter = await graph.getNode(tenantId, scoringConfigDefaultId);
    expect(cfgAfter?.identity["currentTotalLeadsScored"]).toBe(beforeCount + 1);

    // Override config NOT touched (lead had no override edge).
    const overrideCfg = await graph.getNode(tenantId, scoringConfigOverrideId);
    expect(overrideCfg?.identity["currentTotalLeadsScored"]).toBe(1); // unchanged from Test 1

    const evs = await events.read({
      tenantId,
      typePattern: "agency.lead.scored",
      entityId: scoringConfigDefaultId,
    });
    const thisEv = evs.find(
      (e) => e.payload["sourceScoringEventId"] === scoringEventId,
    );
    expect(thisEv).toBeDefined();
    expect(thisEv?.payload["leadScoringConfigId"]).toBe(scoringConfigDefaultId);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Idempotency — same scoringEventId delivered twice
  // ---------------------------------------------------------------------------
  it("replaying the same scoringEventId does not double-count", async () => {
    const cfgBefore = await graph.getNode(tenantId, scoringConfigOverrideId);
    const beforeCount = cfgBefore?.identity["currentTotalLeadsScored"] as number;

    const scoringEventId = `score_idem_${randomUUID().slice(0, 8)}`;

    await handler.handle(tenantId, {
      leadId: leadOverrideId,
      scoreDelta: 20,
      scoringEventId,
      recordedAt: new Date().toISOString(),
    });

    await handler.handle(tenantId, {
      leadId: leadOverrideId,
      scoreDelta: 20,
      scoringEventId,
      recordedAt: new Date().toISOString(),
    });

    const cfgAfter = await graph.getNode(tenantId, scoringConfigOverrideId);
    // Exactly +1, not +2.
    expect(cfgAfter?.identity["currentTotalLeadsScored"]).toBe(beforeCount + 1);

    const evs = await events.read({
      tenantId,
      typePattern: "agency.lead.scored",
      entityId: scoringConfigOverrideId,
    });
    const matching = evs.filter(
      (e) => e.payload["sourceScoringEventId"] === scoringEventId,
    );
    expect(matching.length).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 4: No-config-link — lead with no edges to any config
  // ---------------------------------------------------------------------------
  it("lead with no scoring config in graph logs warning and skips rollup without throwing", async () => {
    // Create an orphan lead — no edges.
    const { node: orphanLead } = await graph.createNode({
      tenantId,
      profile: {
        tier1: "Counterparty",
        profile: "agency",
        concrete: "Lead",
      },
      identity: {
        name: "Orphan Lead",
        qualificationStatus: "new",
      },
      schemaVersion: 1,
    });

    const overrideBefore = await graph.getNode(tenantId, scoringConfigOverrideId);
    const overrideCountBefore = overrideBefore?.identity[
      "currentTotalLeadsScored"
    ] as number;
    const defaultBefore = await graph.getNode(tenantId, scoringConfigDefaultId);
    const defaultCountBefore = defaultBefore?.identity[
      "currentTotalLeadsScored"
    ] as number;

    const scoringEventId = `score_orphan_${randomUUID().slice(0, 8)}`;

    await expect(
      handler.handle(tenantId, {
        leadId: orphanLead.id,
        scoreDelta: 99_999,
        scoringEventId,
        recordedAt: new Date().toISOString(),
      }),
    ).resolves.toBeUndefined();

    // Neither config was touched.
    const overrideAfter = await graph.getNode(tenantId, scoringConfigOverrideId);
    expect(overrideAfter?.identity["currentTotalLeadsScored"]).toBe(
      overrideCountBefore,
    );
    const defaultAfter = await graph.getNode(tenantId, scoringConfigDefaultId);
    expect(defaultAfter?.identity["currentTotalLeadsScored"]).toBe(
      defaultCountBefore,
    );

    // The scoring event is still marked processed so a replay after topology
    // changes cannot accidentally roll up an old no-link event.
    const res = await pool.query<{ scoring_event_id: string }>(
      `SELECT scoring_event_id FROM lead_scoring.applied_scoring_events
        WHERE tenant_id = $1 AND scoring_event_id = $2`,
      [tenantId, scoringEventId],
    );
    expect(res.rowCount).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Test 5: Atomicity — if event publish fails, graph UPDATE rolls back too
  // ---------------------------------------------------------------------------
  it("if event publish fails, the graph rollup and applied_scoring_events insert both roll back", async () => {
    const cfgBefore = await graph.getNode(tenantId, scoringConfigOverrideId);
    const beforeCount = cfgBefore?.identity["currentTotalLeadsScored"] as number;

    const atomicEventId = `score_atom_${randomUUID().slice(0, 8)}`;

    // Inject a failing event publisher.
    const failingEvents = {
      publish: async (): Promise<never> => {
        throw new Error("simulated events.publish failure");
      },
      publishWith: async (): Promise<never> => {
        throw new Error("simulated events.publishWith failure");
      },
    };

    const failingHandler = new LeadScoringHandler({
      pool,
      graph,
      events: failingEvents as unknown as import("@pm/events").EventPublisher,
      emittedBy: "agency.lead-scoring.atomicity-test",
    });

    await expect(
      failingHandler.handle(tenantId, {
        leadId: leadOverrideId,
        scoreDelta: 1,
        scoringEventId: atomicEventId,
        recordedAt: new Date().toISOString(),
      }),
    ).rejects.toThrow("simulated events.publishWith failure");

    // The config node is unchanged — UPDATE rolled back.
    const cfgAfter = await graph.getNode(tenantId, scoringConfigOverrideId);
    expect(cfgAfter?.identity["currentTotalLeadsScored"]).toBe(beforeCount);

    // applied_scoring_events row absent — INSERT rolled back.
    const res = await pool.query<{ scoring_event_id: string }>(
      `SELECT scoring_event_id FROM lead_scoring.applied_scoring_events
        WHERE tenant_id = $1 AND scoring_event_id = $2`,
      [tenantId, atomicEventId],
    );
    expect(res.rowCount).toBe(0);
  });
});
