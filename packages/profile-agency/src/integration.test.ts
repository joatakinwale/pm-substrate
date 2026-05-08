/**
 * Cross-profile substrate integration test (G4 Phase 2).
 *
 * What this proves:
 *   1. The substrate accepts AGENCY_PROFILE installation with no special-casing.
 *   2. PostgresGraph + PostgresProfileRegistry validate agency-shaped writes
 *      (nodes, edges, lifecycle states) using only profile-declared rules —
 *      no agency-aware code anywhere in the substrate.
 *   3. The Tier-1 audit capability (@pm/capability-audit) runs against an
 *      agency tenant identically to how it runs against a wedding tenant
 *      and a raw Tier-1 tenant. The same projection state shape comes out.
 *
 * What it does NOT prove:
 *   - End-to-end HTTP contract (that lives in @pm/substrate-http tests).
 *   - Tier-2 capability portability — that's the next test, after
 *     capability-agency-lead-scoring is implemented.
 *
 * Anti-fixation guarantee: this test imports only from public package
 * exports. It does not reach into private substrate internals. If any test
 * here ever needs an agency-specific code path inside the substrate,
 * the layered ontology has leaked.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { PostgresEventStore } from "@pm/events";
import { PostgresGraph } from "@pm/graph";
import {
  PostgresProfileRegistry,
  ProfileValidationError,
} from "@pm/profile-registry";
import { PostgresProjectionRunner } from "@pm/projections";
import { PostgresRegistry } from "@pm/registry";
import { AUDIT_CAPABILITY, auditProjection } from "@pm/capability-audit";
import type { AuditState } from "@pm/capability-audit";
import { WEDDING_PROFILE } from "@pm/profile-wedding";
import type { TenantId } from "@pm/types";

import { AGENCY_PROFILE } from "./profile.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

describeIfDb("AGENCY_PROFILE — substrate integration (G4 Phase 2)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let runner: PostgresProjectionRunner;
  let capRegistry: PostgresRegistry;
  let profileRegistry: PostgresProfileRegistry;
  let graph: PostgresGraph;

  const tenants: TenantId[] = [];
  const makeTenant = async (
    suffix: string,
  ): Promise<TenantId> => {
    const id = `tnt_ag_${suffix}_${randomUUID().slice(0, 6)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [id],
    );
    tenants.push(id);
    return id;
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    events = new PostgresEventStore(pool);
    runner = new PostgresProjectionRunner(pool, events);
    capRegistry = new PostgresRegistry(pool);
    profileRegistry = new PostgresProfileRegistry(pool);
    graph = new PostgresGraph(pool, {
      validatorFactory: (t) => profileRegistry.validator(t),
    });
    await runner.register(auditProjection);
  });

  afterAll(async () => {
    await events.close();
    for (const t of tenants) {
      await pool.query(`DELETE FROM graph.edges WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM graph.nodes WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM events.subscriptions WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.state WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM projections.cursors WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM registry.capabilities WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM profiles.installations WHERE tenant_id = $1`, [t]);
      await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [t]);
    }
    await pool.end();
  });

  it("installs AGENCY_PROFILE without substrate edits", async () => {
    const t = await makeTenant("install");
    await profileRegistry.install(t, AGENCY_PROFILE);
    const got = await profileRegistry.get(t, "agency");
    expect(got?.name).toBe("agency");
    expect(got?.identityPrimacy).toBe("Project");
  });

  it("validates agency node writes against profile-declared types", async () => {
    const t = await makeTenant("nodes");
    await profileRegistry.install(t, AGENCY_PROFILE);

    // Profile-bound write — substrate validates required fields.
    const project = await graph.createNode({
      tenantId: t,
      profile: { tier1: "Engagement", profile: "agency", concrete: "Project" },
      identity: {
        title: "Q3 Brand Refresh",
        projectType: "branding",
        operationalState: "kickoff",
        kickoffDate: "2026-07-01",
        targetEndDate: "2026-09-30",
      },
      schemaVersion: 1,
    });
    expect(project.created).toBe(true);
    expect(project.node.profile.concrete).toBe("Project");

    const client = await graph.createNode({
      tenantId: t,
      profile: { tier1: "Counterparty", profile: "agency", concrete: "ClientOrg" },
      identity: {
        name: "Acme Corp",
        industry: "manufacturing",
        website: "https://acme.example",
        revenueRange: "$10-50M",
        externalRef: null,
      },
      schemaVersion: 1,
    });
    expect(client.created).toBe(true);

    // Missing required field — substrate must reject without knowing it's
    // an "agency" thing. Validation is purely schema-driven.
    await expect(
      graph.createNode({
        tenantId: t,
        profile: { tier1: "Engagement", profile: "agency", concrete: "Project" },
        identity: { title: "no projectType, no state" }, // missing required
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);

    // Unknown concrete type for a registered profile is rejected too.
    await expect(
      graph.createNode({
        tenantId: t,
        profile: {
          tier1: "Engagement",
          profile: "agency",
          concrete: "NotAnAgencyType",
        },
        identity: {},
        schemaVersion: 1,
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("enforces agency edge cardinality with the same engine that enforces wedding's", async () => {
    const t = await makeTenant("edges");
    await profileRegistry.install(t, AGENCY_PROFILE);

    const client = await graph.createNode({
      tenantId: t,
      profile: { tier1: "Counterparty", profile: "agency", concrete: "ClientOrg" },
      identity: { name: "Acme" },
      schemaVersion: 1,
    });
    const project = await graph.createNode({
      tenantId: t,
      profile: { tier1: "Engagement", profile: "agency", concrete: "Project" },
      identity: {
        title: "P1",
        projectType: "social",
        operationalState: "kickoff",
      },
      schemaVersion: 1,
    });

    await graph.createEdge({
      tenantId: t,
      type: "agency/client_has_project",
      fromId: client.node.id,
      toId: project.node.id,
      attrs: {},
    });

    // A second client tries to claim the same Project. The agency edge
    // catalog declares client_has_project.toCardinality = "exactly:1",
    // i.e. a Project must be reachable from exactly one ClientOrg.
    // The substrate enforces this with no agency-aware code.
    const otherClient = await graph.createNode({
      tenantId: t,
      profile: { tier1: "Counterparty", profile: "agency", concrete: "ClientOrg" },
      identity: { name: "Beta" },
      schemaVersion: 1,
    });

    await expect(
      graph.createEdge({
        tenantId: t,
        type: "agency/client_has_project",
        fromId: otherClient.node.id,
        toId: project.node.id,
        attrs: {},
      }),
    ).rejects.toBeInstanceOf(ProfileValidationError);
  });

  it("Tier-1 audit capability runs unchanged on a wedding, agency, and raw tenant", async () => {
    // Three tenants. Same six events on each. Same audit state on each.
    const weddingT = await makeTenant("audit_w");
    const agencyT = await makeTenant("audit_a");
    const rawT = await makeTenant("audit_r");
    await profileRegistry.install(weddingT, WEDDING_PROFILE);
    await profileRegistry.install(agencyT, AGENCY_PROFILE);
    // rawT: no profile installed — raw Tier-1.

    await capRegistry.register(weddingT, AUDIT_CAPABILITY);
    await capRegistry.register(agencyT, AUDIT_CAPABILITY);
    await capRegistry.register(rawT, AUDIT_CAPABILITY);

    const eventTypes = [
      "thing.created",
      "thing.updated",
      "agency.lead.scored", // agency-flavored type — audit is type-blind
      "wedding.contract.signed",
      "anything.else.happened",
      "thing.deleted",
    ];

    for (const t of [weddingT, agencyT, rawT]) {
      for (const type of eventTypes) {
        await events.publish({
          tenantId: t,
          type,
          entityId: `ent_${randomUUID().slice(0, 6)}`,
          emittedBy: "cap.test-emitter",
          payloadSchema: `${type}/v1`,
          payload: { sample: "data" },
        });
      }
    }

    await runner.catchUp(weddingT, "common/audit-log");
    await runner.catchUp(agencyT, "common/audit-log");
    await runner.catchUp(rawT, "common/audit-log");

    const wState = await runner.getState<AuditState>(weddingT, "common/audit-log");
    const aState = await runner.getState<AuditState>(agencyT, "common/audit-log");
    const rState = await runner.getState<AuditState>(rawT, "common/audit-log");

    expect(wState?.count).toBe(6);
    expect(aState?.count).toBe(6);
    expect(rState?.count).toBe(6);

    // The byType breakdown is identical across all three tenants. Audit
    // does not know what profile is installed; it counts event types.
    expect(aState?.byType).toEqual(wState?.byType);
    expect(aState?.byType).toEqual(rState?.byType);
    expect(aState?.byType).toEqual({
      "thing.created": 1,
      "thing.updated": 1,
      "agency.lead.scored": 1,
      "wedding.contract.signed": 1,
      "anything.else.happened": 1,
      "thing.deleted": 1,
    });

    // Entry shapes are identical (modulo unique ids), proving the projection
    // path took no agency- or wedding-specific branch.
    const shape = (s: AuditState) =>
      s.entries.map((e) => ({
        type: e.type,
        emittedBy: e.emittedBy,
        hasEntityId: !!e.entityId,
      }));
    expect(shape(aState!)).toEqual(shape(wState!));
    expect(shape(aState!)).toEqual(shape(rState!));
  });

  it("agency lifecycle declarations are enforced by the substrate (Project kickoff→active)", async () => {
    const t = await makeTenant("lifecycle");
    await profileRegistry.install(t, AGENCY_PROFILE);

    const project = await graph.createNode({
      tenantId: t,
      profile: { tier1: "Engagement", profile: "agency", concrete: "Project" },
      identity: {
        title: "P1",
        projectType: "branding",
        operationalState: "kickoff",
      },
      schemaVersion: 1,
    });
    expect(project.node.profile.profile).toBe("agency");

    // The validator answers "is this transition legal?" purely from the
    // profile's declared lifecycle. No agency-aware code was needed.
    const validator = await profileRegistry.validator(t);
    const projectBinding = {
      tier1: "Engagement" as const,
      profile: "agency",
      concrete: "Project",
    };

    // Legal: kickoff -> active.
    expect(() =>
      validator.validateLifecycleTransition({
        tenantId: t,
        profile: projectBinding,
        currentState: "kickoff",
        proposedState: "active",
      }),
    ).not.toThrow();

    // Illegal: kickoff -> completed (must go through active first).
    expect(() =>
      validator.validateLifecycleTransition({
        tenantId: t,
        profile: projectBinding,
        currentState: "kickoff",
        proposedState: "completed",
      }),
    ).toThrow();

    // Legal: active -> on_hold.
    expect(() =>
      validator.validateLifecycleTransition({
        tenantId: t,
        profile: projectBinding,
        currentState: "active",
        proposedState: "on_hold",
      }),
    ).not.toThrow();
  });
});
