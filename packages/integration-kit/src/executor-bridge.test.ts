import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";

import {
  buildActionOutcomeEnvelope,
  stateRef,
  type ActionOutcomeEnvelope,
} from "@pm/agent-state-core";
import { PostgresEventStore } from "@pm/events";
import type { TenantId, Timestamp } from "@pm/types";

import {
  EXECUTOR_DISPATCHED_EVENT_TYPE,
  EXECUTOR_FAILED_EVENT_TYPE,
  EXECUTOR_REFUSED_EVENT_TYPE,
  executeAdmittedAction,
} from "./executor-bridge.js";

const DATABASE_URL = process.env["PM_DATABASE_URL"];
const describeIfDb = DATABASE_URL ? describe : describe.skip;

const now = (): Timestamp => new Date().toISOString() as Timestamp;

function makeEnvelope(
  tenantId: TenantId,
  outcome: "accepted" | "blocked",
): ActionOutcomeEnvelope {
  return buildActionOutcomeEnvelope({
    tenantId,
    actionId: `act_${randomUUID().slice(0, 8)}`,
    subject: stateRef("projection", "fixture_subject", "fixture"),
    proposalReviewId: `rev_${randomUUID().slice(0, 8)}`,
    stateReviewArtifactHash: "hash_fixture",
    requestedTerminalOutcome: "accepted",
    decidedAt: now(),
    decidedBy: "executor-bridge-test",
    ...(outcome === "blocked"
      ? {
          blockingCauses: [
            {
              source: "proposal_review",
              code: "stale_basis",
              message: "fixture: basis moved",
              refs: [],
            },
          ],
        }
      : {}),
  });
}

describeIfDb("executor bridge (admitted envelope → existing app API)", () => {
  let pool: pg.Pool;
  let events: PostgresEventStore;
  let tenantId: TenantId;
  let server: Server;
  let endpoint: string;
  let mode: "ok" | "fail" = "ok";
  const seen: { url: string; body: string }[] = [];

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: DATABASE_URL });
    tenantId = `tnt_exec_${randomUUID().slice(0, 8)}` as TenantId;
    await pool.query(
      `INSERT INTO substrate.tenants(id, display_name) VALUES ($1, $1)
       ON CONFLICT DO NOTHING`,
      [tenantId],
    );
    events = new PostgresEventStore(pool);
    server = createServer((req, res) => {
      let body = "";
      req.on("data", (c: Buffer) => (body += c.toString()));
      req.on("end", () => {
        seen.push({ url: req.url ?? "", body });
        res
          .writeHead(mode === "ok" ? 200 : 500, {
            "content-type": "application/json",
          })
          .end(JSON.stringify({ ok: mode === "ok" }));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/actions`;
  });

  afterAll(async () => {
    await new Promise((r) => server.close(r));
    await pool.query(`DELETE FROM events.events WHERE tenant_id = $1`, [tenantId]);
    await pool.query(`DELETE FROM substrate.tenants WHERE id = $1`, [tenantId]);
    await pool.end();
  });

  it("a blocked envelope NEVER reaches the app; the refusal is on the log", async () => {
    const blocked = makeEnvelope(tenantId, "blocked");
    expect(blocked.terminalOutcome).toBe("blocked"); // auto-derived by the gate
    const result = await executeAdmittedAction(events, {
      tenantId,
      envelope: blocked,
      target: { name: "fixture_api", endpoint },
      executedBy: "executor-bridge-test",
    });
    expect(result).toEqual({ executed: false, reason: "not_accepted" });
    expect(seen).toHaveLength(0);
    const refusals = await events.read({
      tenantId,
      typePattern: EXECUTOR_REFUSED_EVENT_TYPE,
    });
    expect(refusals).toHaveLength(1);
    expect(
      (refusals[0]?.payload as { blockingCauseCodes: string[] })
        .blockingCauseCodes,
    ).toContain("stale_basis");
  });

  it("an accepted envelope dispatches exactly once (outcomeHash dedupe)", async () => {
    const accepted = makeEnvelope(tenantId, "accepted");
    const first = await executeAdmittedAction(events, {
      tenantId,
      envelope: accepted,
      target: { name: "fixture_api", endpoint },
      executedBy: "executor-bridge-test",
      body: { command: "publish_post", postId: "p-1" },
    });
    expect(first).toMatchObject({ executed: true, reason: "dispatched", httpStatus: 200 });
    expect(seen).toHaveLength(1);
    const request = JSON.parse(seen[0]!.body) as {
      outcomeHash: string;
      body: { command: string };
    };
    expect(request.outcomeHash).toBe(accepted.outcomeHash);
    expect(request.body.command).toBe("publish_post");

    const replay = await executeAdmittedAction(events, {
      tenantId,
      envelope: accepted,
      target: { name: "fixture_api", endpoint },
      executedBy: "executor-bridge-test",
    });
    expect(replay).toEqual({ executed: false, reason: "already_dispatched" });
    expect(seen).toHaveLength(1); // the app never saw a second call

    const receipts = await events.read({
      tenantId,
      typePattern: EXECUTOR_DISPATCHED_EVENT_TYPE,
    });
    expect(receipts).toHaveLength(1);
  });

  it("endpoint failure is recorded, does not count as dispatched, and a retry succeeds", async () => {
    const accepted = makeEnvelope(tenantId, "accepted");
    mode = "fail";
    const failed = await executeAdmittedAction(events, {
      tenantId,
      envelope: accepted,
      target: { name: "fixture_api", endpoint },
      executedBy: "executor-bridge-test",
    });
    expect(failed).toMatchObject({
      executed: false,
      reason: "endpoint_error",
      httpStatus: 500,
    });
    const failures = await events.read({
      tenantId,
      typePattern: EXECUTOR_FAILED_EVENT_TYPE,
    });
    expect(failures).toHaveLength(1);

    mode = "ok";
    const retried = await executeAdmittedAction(events, {
      tenantId,
      envelope: accepted,
      target: { name: "fixture_api", endpoint },
      executedBy: "executor-bridge-test",
    });
    expect(retried).toMatchObject({ executed: true, reason: "dispatched" });
  });
});
