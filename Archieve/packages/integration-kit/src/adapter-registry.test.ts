import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import { PostgresEventStore } from "@pm/events";
import type { TenantId } from "@pm/types";

import {
  externalAdapterContentHash,
  listExternalAdapters,
  parseExternalAdapterContract,
  registerExternalAdapter,
} from "./adapter-registry.js";
import {
  CANARY_ADAPTER,
  KNOWN_EXTERNAL_ADAPTERS,
  PI_HARNESS_ADAPTER,
} from "./known-adapters.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

/** Same content, reversed key insertion order everywhere (arrays untouched). */
const reverseKeyOrder = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(reverseKeyOrder)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .reverse()
            .map(([k, v]) => [k, reverseKeyOrder(v)]),
        )
      : value;

describe("external adapter contracts (pure)", () => {
  it("content hash is key-order independent", () => {
    const reordered = reverseKeyOrder(
      PI_HARNESS_ADAPTER,
    ) as typeof PI_HARNESS_ADAPTER;
    expect(externalAdapterContentHash(reordered)).toBe(
      externalAdapterContentHash(PI_HARNESS_ADAPTER),
    );
  });

  it("rejects contracts with unpinned or malformed sources", () => {
    expect(() =>
      parseExternalAdapterContract({
        ...PI_HARNESS_ADAPTER,
        source: { url: "https://github.com/earendil-works/pi", commit: "main" },
      }),
    ).toThrow(/commit sha/);
    expect(() =>
      parseExternalAdapterContract({ ...CANARY_ADAPTER, id: "Bad-Id" }),
    ).toThrow(/snake_case/);
  });

  it("known adapters all validate against the schema", () => {
    for (const contract of KNOWN_EXTERNAL_ADAPTERS) {
      expect(parseExternalAdapterContract(contract)).toEqual(contract);
    }
  });
});

describeIfDb("external adapter registry (admitted-log fold)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let tenantId: TenantId;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_adpt_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    events = new PostgresEventStore(pool);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [
      tenantId,
    ]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("registers, lists back, and no-ops on identical re-registration", async () => {
    const first = await registerExternalAdapter(events, {
      tenantId,
      registeredBy: "adapter-registry-test",
      contract: PI_HARNESS_ADAPTER,
    });
    expect(first).toMatchObject({
      adapterId: "pi_harness",
      version: 1,
      registered: true,
      contentHash: externalAdapterContentHash(PI_HARNESS_ADAPTER),
    });

    const again = await registerExternalAdapter(events, {
      tenantId,
      registeredBy: "adapter-registry-test",
      contract: PI_HARNESS_ADAPTER,
    });
    expect(again).toMatchObject({ version: 1, registered: false });

    const listed = await listExternalAdapters(events, tenantId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.contract).toEqual(PI_HARNESS_ADAPTER);
    expect(listed[0]?.version).toBe(1);
  });

  it("changed content appends the next version; fold returns latest", async () => {
    const evolved = {
      ...PI_HARNESS_ADAPTER,
      capabilities: [...PI_HARNESS_ADAPTER.capabilities, "queue_drain_modes"],
    };
    const bumped = await registerExternalAdapter(events, {
      tenantId,
      registeredBy: "adapter-registry-test",
      contract: evolved,
    });
    expect(bumped).toMatchObject({ version: 2, registered: true });

    const listed = await listExternalAdapters(events, tenantId);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.version).toBe(2);
    expect(listed[0]?.contract.capabilities).toContain("queue_drain_modes");
  });

  it("registry holds independent adapters side by side", async () => {
    await registerExternalAdapter(events, {
      tenantId,
      registeredBy: "adapter-registry-test",
      contract: CANARY_ADAPTER,
    });
    const listed = await listExternalAdapters(events, tenantId);
    expect(listed.map((a) => a.contract.id)).toEqual([
      "canary_web_inspector",
      "pi_harness",
    ]);
  });
});
