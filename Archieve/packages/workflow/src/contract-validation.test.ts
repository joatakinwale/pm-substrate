/**
 * G6 / ADR-0013 — typed capability contract validation tests.
 *
 * Pure-function tests; no DB. Verifies the install-time compatibility
 * checker accepts compatible contracts and rejects incompatible ones with
 * structured errors.
 */

import { describe, expect, it } from "vitest";
import type {
  Capability,
  EmitContract,
  ReadContract,
  SubscribeContract,
  WriteContract,
} from "@pm/registry";
import type { CapabilityId } from "@pm/types";
import { validateCapabilityContracts } from "./contract-validation.js";
import { WorkflowValidationError } from "./errors.js";

// -----------------------------------------------------------------------
// Fixture builders
// -----------------------------------------------------------------------

const emit = (
  type: string,
  major = 1,
): EmitContract => ({
  schema: {
    type,
    version: { major, minor: 0, patch: 0 },
    schemaPath: `schemas/${type.replace(/\./g, "-")}.v${major}.json`,
  },
});

const subscribe = (
  pattern: string,
  minMajor = 1,
  maxMajor = 1,
): SubscribeContract => ({
  pattern,
  accepts: { minMajor, maxMajor },
});

const reads = (iface: string, fields: string[] = ["id"]): ReadContract => ({
  interface: iface,
  fields,
  cardinality: "exactly-one",
  required: true,
});

const writes = (
  iface: string,
  fields: string[],
  ownership: "owner" | "contributor" | "delegated" = "owner",
): WriteContract => ({
  interface: iface,
  fields,
  ownership,
});

let capCounter = 0;
const cap = (
  name: string,
  opts: {
    emits?: readonly EmitContract[] | readonly string[];
    subscribesTo?: readonly SubscribeContract[] | readonly string[];
    reads?: readonly ReadContract[] | readonly string[];
    writes?: readonly WriteContract[] | readonly string[];
  } = {},
): Capability => ({
  id: `cap_test_${++capCounter}` as CapabilityId,
  name,
  version: 1,
  emits: opts.emits ?? [],
  subscribesTo: opts.subscribesTo ?? [],
  readsInterfaces: opts.reads ?? [],
  writesInterfaces: opts.writes ?? [],
  readsEdges: [],
  writesEdges: [],
  requiredPermissions: [],
  description: `test capability ${name}`,
});

const ctx = (caps: readonly Capability[]) => ({
  capabilities: caps,
  workflowName: "test-workflow",
  workflowVersion: 1,
});

// -----------------------------------------------------------------------
// Compatible cases
// -----------------------------------------------------------------------

describe("validateCapabilityContracts — compatible cases", () => {
  it("empty capability set passes", () => {
    expect(() => validateCapabilityContracts(ctx([]))).not.toThrow();
  });

  it("producer + subscriber on same major version passes", () => {
    const producer = cap("producer", {
      emits: [emit("agency.contract.signed", 1)],
    });
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.contract.signed", 1, 1)],
    });
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber])),
    ).not.toThrow();
  });

  it("subscriber accepting wider major range passes", () => {
    const producer = cap("producer", {
      emits: [emit("agency.task.created", 2)],
    });
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.task.*", 1, 2)],
    });
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber])),
    ).not.toThrow();
  });

  it("subscriber with no matching producer in set passes (events may come from elsewhere)", () => {
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("external.webhook.received", 1, 1)],
    });
    expect(() => validateCapabilityContracts(ctx([subscriber]))).not.toThrow();
  });

  it("two contributors on same write target passes", () => {
    const a = cap("a", { writes: [writes("Counterparty", ["notes"], "contributor")] });
    const b = cap("b", { writes: [writes("Counterparty", ["notes"], "contributor")] });
    expect(() => validateCapabilityContracts(ctx([a, b]))).not.toThrow();
  });

  it("one owner + one contributor on same write target passes", () => {
    const a = cap("a", { writes: [writes("Counterparty", ["score"], "owner")] });
    const b = cap("b", { writes: [writes("Counterparty", ["score"], "contributor")] });
    expect(() => validateCapabilityContracts(ctx([a, b]))).not.toThrow();
  });
});

// -----------------------------------------------------------------------
// Incompatible cases
// -----------------------------------------------------------------------

describe("validateCapabilityContracts — incompatible cases", () => {
  it("producer major version above subscriber accepted range rejects", () => {
    const producer = cap("producer", {
      emits: [emit("agency.contract.signed", 2)],
    });
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.contract.signed", 1, 1)],
    });
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber])),
    ).toThrow(WorkflowValidationError);
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber])),
    ).toThrow(/major version 2.*outside.*accepted range/);
  });

  it("producer major version below subscriber accepted range rejects", () => {
    const producer = cap("producer", {
      emits: [emit("agency.task.created", 1)],
    });
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.task.created", 2, 3)],
    });
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber])),
    ).toThrow(WorkflowValidationError);
  });

  it("two owners on same (interface, field) rejects", () => {
    const a = cap("scoring-engine-a", {
      writes: [writes("Lead", ["score"], "owner")],
    });
    const b = cap("scoring-engine-b", {
      writes: [writes("Lead", ["score"], "owner")],
    });
    expect(() => validateCapabilityContracts(ctx([a, b]))).toThrow(
      WorkflowValidationError,
    );
    expect(() => validateCapabilityContracts(ctx([a, b]))).toThrow(
      /both claim ownership/,
    );
  });

  it("two owners on same interface (field-empty) rejects", () => {
    const a = cap("a", { writes: [writes("Project", [], "owner")] });
    const b = cap("b", { writes: [writes("Project", [], "owner")] });
    expect(() => validateCapabilityContracts(ctx([a, b]))).toThrow(
      WorkflowValidationError,
    );
  });

  it("same capability name as both owners (idempotent re-register) does NOT trigger conflict", () => {
    // The check is keyed by capability NAME, not row. Re-registering the
    // same capability with the same owner claim should not be a conflict.
    const a = cap("scoring", { writes: [writes("Lead", ["score"], "owner")] });
    expect(() => validateCapabilityContracts(ctx([a, a]))).not.toThrow();
  });
});

// -----------------------------------------------------------------------
// Strict-mode behavior
// -----------------------------------------------------------------------

describe("validateCapabilityContracts — strict mode", () => {
  it("untyped (V1 string) emits accepted in default mode", () => {
    const producer = cap("producer", { emits: ["legacy.event.fired"] });
    const subscriber = cap("subscriber", {
      subscribesTo: ["legacy.event.fired"],
    });
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber])),
    ).not.toThrow();
  });

  it("untyped (V1 string) emits rejected in strict mode", () => {
    const producer = cap("producer", { emits: ["legacy.event.fired"] });
    expect(() =>
      validateCapabilityContracts(ctx([producer]), { strict: true }),
    ).toThrow(WorkflowValidationError);
    expect(() =>
      validateCapabilityContracts(ctx([producer]), { strict: true }),
    ).toThrow(/untyped \(V1\)/);
  });

  it("untyped subscribesTo rejected in strict mode", () => {
    const subscriber = cap("subscriber", {
      subscribesTo: ["legacy.event.fired"],
    });
    expect(() =>
      validateCapabilityContracts(ctx([subscriber]), { strict: true }),
    ).toThrow(/untyped \(V1\)/);
  });

  it("untyped reads/writes rejected in strict mode", () => {
    const c = cap("c", { reads: ["Counterparty"] });
    expect(() =>
      validateCapabilityContracts(ctx([c]), { strict: true }),
    ).toThrow(/untyped \(V1\)/);
  });

  it("fully-typed capability passes strict mode", () => {
    const producer = cap("producer", {
      emits: [emit("agency.task.created", 1)],
      reads: [reads("Project")],
      writes: [writes("Task", ["id", "title"], "owner")],
    });
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.task.*", 1, 1)],
      reads: [reads("Task")],
    });
    expect(() =>
      validateCapabilityContracts(ctx([producer, subscriber]), {
        strict: true,
      }),
    ).not.toThrow();
  });
});

// -----------------------------------------------------------------------
// Pattern matching for subscribe contracts
// -----------------------------------------------------------------------

describe("validateCapabilityContracts — pattern matching", () => {
  it("wildcard subscriber matches multiple producer types and validates each", () => {
    const a = cap("a", { emits: [emit("agency.task.created", 1)] });
    const b = cap("b", { emits: [emit("agency.task.completed", 1)] });
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.task.*", 1, 1)],
    });
    expect(() =>
      validateCapabilityContracts(ctx([a, b, subscriber])),
    ).not.toThrow();
  });

  it("wildcard subscriber rejects if any matched producer is out of range", () => {
    const a = cap("a", { emits: [emit("agency.task.created", 1)] });
    const b = cap("b", { emits: [emit("agency.task.completed", 3)] }); // bumped
    const subscriber = cap("subscriber", {
      subscribesTo: [subscribe("agency.task.*", 1, 1)],
    });
    expect(() =>
      validateCapabilityContracts(ctx([a, b, subscriber])),
    ).toThrow(WorkflowValidationError);
    expect(() =>
      validateCapabilityContracts(ctx([a, b, subscriber])),
    ).toThrow(/agency\.task\.completed.*major version 3/);
  });
});
