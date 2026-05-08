/**
 * G6 / ADR-0013 reference migration test.
 *
 * wedding.budget is the canonical first capability migrated from V1 string
 * arrays to V2 typed/versioned contracts. The remaining capability migrations
 * should copy this shape.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeCapability } from "@pm/registry";
import { WEDDING_BUDGET_CAPABILITY } from "./capability.js";

describe("wedding.budget typed capability contract", () => {
  it("is fully typed after normalization", () => {
    const normalized = normalizeCapability(WEDDING_BUDGET_CAPABILITY);

    expect(normalized.untyped).toBe(false);
    expect(normalized.emits).toEqual([
      {
        schema: {
          type: "wedding.budget.actual_spent_updated",
          version: { major: 1, minor: 0, patch: 0 },
          schemaPath: "schemas/actual-spent-updated.v1.json",
        },
        affectsEntities: ["Resource"],
      },
    ]);
    expect(normalized.subscribesTo).toEqual([
      {
        pattern: "wedding.contract.payment_recorded",
        accepts: { minMajor: 1, maxMajor: 1 },
      },
    ]);
    expect(normalized.reads).toHaveLength(3);
    expect(normalized.writes).toEqual([
      {
        interface: "Resource",
        fields: ["actualSpentMinor"],
        ownership: "owner",
      },
    ]);
  });

  it("ships the emitted payload schema referenced by the contract", () => {
    const schema = JSON.parse(
      readFileSync(
        join(process.cwd(), "packages/capability-wedding-budget/schemas/actual-spent-updated.v1.json"),
        "utf8",
      ),
    );

    expect(schema.$id).toBe("wedding.budget.actual_spent_updated.v1");
    expect(schema.required).toEqual([
      "budgetCategoryId",
      "delta",
      "newTotal",
      "sourcePaymentId",
    ]);
    expect(schema.additionalProperties).toBe(false);
  });

  it("documents the consumed payment_recorded payload shape for downstream migration", () => {
    const schema = JSON.parse(
      readFileSync(
        join(process.cwd(), "packages/capability-wedding-budget/schemas/payment-recorded.v1.json"),
        "utf8",
      ),
    );

    expect(schema.$id).toBe("wedding.contract.payment_recorded.v1");
    expect(schema.required).toEqual([
      "contractId",
      "amount",
      "recordedAt",
      "paymentId",
    ]);
    expect(schema.additionalProperties).toBe(false);
  });
});
