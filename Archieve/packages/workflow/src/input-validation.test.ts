/**
 * Pure-function tests for the input-validation gate (G12 / ADR-0026).
 *
 * Tests cover `builtinInputValidator()` (the substrate-shipped default
 * for capabilities that declare an inputSchema). The runtime integration
 * is exercised in postgres.test.ts.
 */

import { describe, expect, it } from "vitest";
import {
  acceptAllInputValidator,
  builtinInputValidator,
  rejectAllInputValidator,
} from "./input-validation.js";
import type { InputValidationCheck } from "./input-validation.js";

const ctx = (
  inputs: Record<string, unknown>,
  inputSchema?: Record<string, unknown>,
): InputValidationCheck => ({
  capability: "test/cap",
  inputs,
  ...(inputSchema ? { inputSchema } : {}),
  tenantId: "tnt_test",
  workflowId: "wf_test",
  nodeId: "n1",
});

describe("acceptAllInputValidator", () => {
  it("returns valid for any inputs", async () => {
    const v = acceptAllInputValidator();
    await expect(v.validate(ctx({}))).resolves.toEqual({ valid: true });
    await expect(v.validate(ctx({ anything: 1 }, { type: "object" }))).resolves.toEqual({ valid: true });
  });
});

describe("rejectAllInputValidator", () => {
  it("rejects with the supplied reason", async () => {
    const v = rejectAllInputValidator("for test");
    const out = await v.validate(ctx({}));
    expect(out.valid).toBe(false);
    if (!out.valid) expect(out.reason).toBe("for test");
  });

  it("uses a default reason if none supplied", async () => {
    const v = rejectAllInputValidator();
    const out = await v.validate(ctx({}));
    expect(out.valid).toBe(false);
  });
});

describe("builtinInputValidator", () => {
  const v = builtinInputValidator();

  it("accepts when no inputSchema is declared (legacy)", async () => {
    await expect(v.validate(ctx({ anything: "ok" }))).resolves.toEqual({ valid: true });
  });

  it("accepts a valid object against required + properties", async () => {
    const schema = {
      type: "object",
      required: ["id", "amount"],
      properties: {
        id: { type: "string" },
        amount: { type: "number" },
        memo: { type: "string" },
      },
    };
    const out = await v.validate(
      ctx({ id: "x", amount: 42, memo: "hi" }, schema),
    );
    expect(out).toEqual({ valid: true });
  });

  it("rejects when a required field is missing", async () => {
    const schema = {
      type: "object",
      required: ["id", "amount"],
      properties: {
        id: { type: "string" },
        amount: { type: "number" },
      },
    };
    const out = await v.validate(ctx({ id: "x" }, schema));
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.issues?.some((i) => i.path === "/amount")).toBe(true);
    }
  });

  it("rejects when a required field is null", async () => {
    const schema = {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } },
    };
    const out = await v.validate(ctx({ id: null }, schema));
    expect(out.valid).toBe(false);
  });

  it("rejects on type mismatch", async () => {
    const schema = {
      type: "object",
      required: ["amount"],
      properties: { amount: { type: "number" } },
    };
    const out = await v.validate(ctx({ amount: "not a number" }, schema));
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.issues?.some((i) => i.path === "/amount")).toBe(true);
    }
  });

  it("validates integer vs number distinction", async () => {
    const schema = {
      type: "object",
      required: ["n"],
      properties: { n: { type: "integer" } },
    };
    await expect(v.validate(ctx({ n: 7 }, schema))).resolves.toEqual({ valid: true });
    const out = await v.validate(ctx({ n: 7.5 }, schema));
    expect(out.valid).toBe(false);
  });

  it("permits null on a non-required typed field", async () => {
    const schema = {
      type: "object",
      properties: { memo: { type: "string" } },
    };
    await expect(v.validate(ctx({ memo: null }, schema))).resolves.toEqual({ valid: true });
  });

  it("rejects unknown properties when additionalProperties: false", async () => {
    const schema = {
      type: "object",
      properties: { id: { type: "string" } },
      additionalProperties: false,
    };
    const out = await v.validate(ctx({ id: "x", extra: 1 }, schema));
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.issues?.some((i) => i.path === "/extra")).toBe(true);
    }
  });

  it("ignores unknown properties when additionalProperties is not set", async () => {
    const schema = {
      type: "object",
      properties: { id: { type: "string" } },
    };
    await expect(v.validate(ctx({ id: "x", extra: 1 }, schema))).resolves.toEqual({ valid: true });
  });

  it("rejects array type when schema top-level is not object", async () => {
    const schema = { type: "array" };
    const out = await v.validate(ctx({}, schema));
    expect(out.valid).toBe(false);
    if (!out.valid) {
      expect(out.reason).toContain("top-level");
    }
  });

  it("accepts when type is omitted entirely (object inferred)", async () => {
    const schema = { required: ["id"], properties: { id: { type: "string" } } };
    await expect(v.validate(ctx({ id: "x" }, schema))).resolves.toEqual({ valid: true });
  });

  it("handles array typed property", async () => {
    const schema = {
      type: "object",
      properties: { tags: { type: "array" } },
    };
    await expect(v.validate(ctx({ tags: [1, 2] }, schema))).resolves.toEqual({ valid: true });
    const out = await v.validate(ctx({ tags: "not array" }, schema));
    expect(out.valid).toBe(false);
  });

  it("returns multiple issues when multiple things wrong", async () => {
    const schema = {
      type: "object",
      required: ["a", "b"],
      properties: { a: { type: "string" }, b: { type: "number" } },
      additionalProperties: false,
    };
    const out = await v.validate(ctx({ a: 1, c: "x" }, schema));
    expect(out.valid).toBe(false);
    if (!out.valid) {
      // missing b, wrong type a, unknown c — 3 issues
      expect(out.issues?.length).toBeGreaterThanOrEqual(3);
    }
  });
});
