import { describe, expect, it } from "vitest";
import type { ContinuityCheckpoint } from "./interfaces.js";
import { resolveOpenWork } from "./context.js";

const cp = (
  overrides: Partial<ContinuityCheckpoint> & Pick<ContinuityCheckpoint, "id" | "title" | "createdAt">,
): ContinuityCheckpoint =>
  ({
    tenantId: "tnt_test",
    agentId: "agent",
    scope: "scope",
    kind: "work",
    summary: "summary",
    evidenceEventIds: [],
    decisionRefs: [],
    status: "open",
    payload: {},
    contentHash: "0".repeat(64),
    priorCheckpointHash: null,
    ...overrides,
  }) as ContinuityCheckpoint;

describe("resolveOpenWork", () => {
  it("hides an open item once a later checkpoint with the same title closes it", () => {
    const open = resolveOpenWork([
      cp({ id: "chk_1", title: "Ship the gate", createdAt: "2026-07-01T00:00:00.000Z" as never }),
      cp({
        id: "chk_2",
        title: "Ship the gate",
        status: "closed",
        createdAt: "2026-07-02T00:00:00.000Z" as never,
      }),
    ]);
    expect(open).toHaveLength(0);
  });

  it("matches titles case- and whitespace-insensitively", () => {
    const open = resolveOpenWork([
      cp({ id: "chk_1", title: "Ship the gate", createdAt: "2026-07-01T00:00:00.000Z" as never }),
      cp({
        id: "chk_2",
        title: "  ship the GATE ",
        status: "closed",
        createdAt: "2026-07-02T00:00:00.000Z" as never,
      }),
    ]);
    expect(open).toHaveLength(0);
  });

  it("shows an item again when it is reopened after closure", () => {
    const open = resolveOpenWork([
      cp({ id: "chk_1", title: "Ship the gate", createdAt: "2026-07-01T00:00:00.000Z" as never }),
      cp({
        id: "chk_2",
        title: "Ship the gate",
        status: "closed",
        createdAt: "2026-07-02T00:00:00.000Z" as never,
      }),
      cp({ id: "chk_3", title: "Ship the gate", createdAt: "2026-07-03T00:00:00.000Z" as never }),
    ]);
    expect(open.map((c) => c.id)).toEqual(["chk_3"]);
  });

  it("keeps unrelated open items, ignores non-work kinds, and orders newest first", () => {
    const open = resolveOpenWork([
      cp({ id: "chk_1", title: "Older item", createdAt: "2026-07-01T00:00:00.000Z" as never }),
      cp({ id: "chk_2", title: "Newer item", createdAt: "2026-07-02T00:00:00.000Z" as never }),
      cp({
        id: "chk_3",
        title: "A decision",
        kind: "decision",
        createdAt: "2026-07-03T00:00:00.000Z" as never,
      }),
    ]);
    expect(open.map((c) => c.id)).toEqual(["chk_2", "chk_1"]);
  });

  it("resolves same-timestamp checkpoints by id so closure wins deterministically", () => {
    const open = resolveOpenWork([
      cp({ id: "chk_b", title: "Ship the gate", status: "closed", createdAt: "2026-07-01T00:00:00.000Z" as never }),
      cp({ id: "chk_a", title: "Ship the gate", createdAt: "2026-07-01T00:00:00.000Z" as never }),
    ]);
    expect(open).toHaveLength(0);
  });
});
