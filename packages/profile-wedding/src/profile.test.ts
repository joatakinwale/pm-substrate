/**
 * Profile contract tests.
 *
 * Two purposes:
 *   1. Type-level: prove every wedding concrete entity is structurally
 *      assignable to the Tier-1 interface its profile.ts entry asserts.
 *      If this breaks, the profile is lying about which Tier-1 contract
 *      it implements.
 *   2. Runtime: validate the ProfileDefinition is internally consistent —
 *      every entityType.requiredFields ⊆ optionalFields ∪ requiredFields,
 *      every lifecycle's `transitions[].from` references declared states,
 *      etc.
 */

import { describe, expect, it } from "vitest";

import type {
  Counterparty,
  Engagement,
  Transaction,
  ProfileEntity,
} from "@pm/types";

import type {
  Contract,
  Couple,
  Guest,
  Invoice,
  Payment,
  Vendor,
  Wedding,
} from "./entities.js";
import { EDGE_CATALOG } from "./edges.js";
import {
  CONTRACT_LIFECYCLE,
  INVOICE_LIFECYCLE,
  PAYMENT_LIFECYCLE,
} from "./lifecycles.js";
import { WEDDING_PROFILE } from "./profile.js";

// =============================================================================
// 1. Type-level contract proofs.
//    These compile-time checks would fail typecheck if a concrete type ever
//    drifted from the Tier-1 contract its profile entry asserts.
// =============================================================================

type Assert<T extends true> = T;
type IsAssignable<A, B> = A extends B ? true : false;

// Tier-1 interfaces have minimum-shape `identity` bags, so only the *base*
// shape is required for assignability. Concrete entities can have additional
// fields. Each line below would fail to compile if structural compatibility
// breaks.

// Engagement specializations
type _Wedding_isEngagement = Assert<IsAssignable<Wedding, Engagement>>;

// Counterparty specializations
type _Couple_isCounterparty = Assert<IsAssignable<Couple, Counterparty>>;
type _Guest_isCounterparty = Assert<IsAssignable<Guest, Counterparty>>;
type _Vendor_isCounterparty = Assert<IsAssignable<Vendor, Counterparty>>;

// Transaction specializations
type _Contract_isTransaction = Assert<IsAssignable<Contract, Transaction>>;
type _Payment_isTransaction = Assert<IsAssignable<Payment, Transaction>>;
type _Invoice_isTransaction = Assert<IsAssignable<Invoice, Transaction>>;

// Every wedding entity is at minimum a ProfileEntity
type _Wedding_isProfileEntity = Assert<
  IsAssignable<Wedding, ProfileEntity<Record<string, unknown>>>
>;

// Suppress unused-type-alias warnings: TypeScript treats them as referenced
// when they're used to express constraints, but ESLint can flag them.
// (We have no ESLint config yet — this comment is for future-us.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Refs =
  | _Wedding_isEngagement
  | _Couple_isCounterparty
  | _Guest_isCounterparty
  | _Vendor_isCounterparty
  | _Contract_isTransaction
  | _Payment_isTransaction
  | _Invoice_isTransaction
  | _Wedding_isProfileEntity;

// =============================================================================
// 2. Runtime profile-definition self-consistency.
// =============================================================================

describe("WEDDING_PROFILE definition self-consistency", () => {
  it("identity primacy is a declared concrete entity", () => {
    expect(WEDDING_PROFILE.entityTypes[WEDDING_PROFILE.identityPrimacy]).toBeDefined();
    expect(WEDDING_PROFILE.identityPrimacy).toBe("Wedding");
  });

  it("every entity-type entry's `concrete` matches its key", () => {
    for (const [key, def] of Object.entries(WEDDING_PROFILE.entityTypes)) {
      expect(def.concrete).toBe(key);
    }
  });

  it("every entity-type binds to a valid Tier-1 type name", () => {
    const validTier1 = new Set([
      "Counterparty",
      "Engagement",
      "Transaction",
      "Resource",
      "Communication",
      "Document",
      "Event",
    ]);
    for (const def of Object.values(WEDDING_PROFILE.entityTypes)) {
      expect(validTier1.has(def.tier1)).toBe(true);
    }
  });

  it("required fields and optional fields do not overlap", () => {
    for (const [name, def] of Object.entries(WEDDING_PROFILE.entityTypes)) {
      const reqd = new Set(def.requiredFields);
      for (const opt of def.optionalFields) {
        expect(
          reqd.has(opt),
          `${name}: field "${opt}" is in both required and optional`,
        ).toBe(false);
      }
    }
  });

  it("every edge's fromTypes/toTypes reference declared concrete entities", () => {
    const concrete = new Set(Object.keys(WEDDING_PROFILE.entityTypes));
    for (const [name, edge] of Object.entries(WEDDING_PROFILE.edgeTypes)) {
      for (const t of edge.fromTypes) {
        expect(concrete.has(t), `edge "${name}" references unknown fromType "${t}"`).toBe(true);
      }
      for (const t of edge.toTypes) {
        expect(concrete.has(t), `edge "${name}" references unknown toType "${t}"`).toBe(true);
      }
    }
  });

  it("every edge cardinality is a recognized constraint", () => {
    const re = /^(exactly|at-most|at-least):\d+$|^unbounded$/;
    for (const [name, edge] of Object.entries(WEDDING_PROFILE.edgeTypes)) {
      expect(re.test(edge.fromCardinality), `edge "${name}".from`).toBe(true);
      expect(re.test(edge.toCardinality), `edge "${name}".to`).toBe(true);
    }
  });

  it("every lifecycle's `initial` is a declared state", () => {
    for (const [name, lc] of Object.entries(WEDDING_PROFILE.lifecycles)) {
      expect(lc.states.includes(lc.initial), `${name}: initial not in states`).toBe(true);
    }
  });

  it("every lifecycle's `terminal` states are declared states", () => {
    for (const [name, lc] of Object.entries(WEDDING_PROFILE.lifecycles)) {
      for (const t of lc.terminal) {
        expect(lc.states.includes(t), `${name}: terminal "${t}" not in states`).toBe(true);
      }
    }
  });

  it("every transition's `from` and `to` reference declared states", () => {
    for (const [name, lc] of Object.entries(WEDDING_PROFILE.lifecycles)) {
      const states = new Set(lc.states);
      for (const tr of lc.transitions) {
        expect(states.has(tr.to), `${name}: transition.to "${tr.to}" not in states`).toBe(true);
        for (const f of tr.from) {
          expect(states.has(f), `${name}: transition.from "${f}" not in states`).toBe(true);
        }
      }
    }
  });

  it("Contract lifecycle starts in draft", () => {
    expect(CONTRACT_LIFECYCLE.initial).toBe("draft");
    expect(CONTRACT_LIFECYCLE.terminal).toEqual(["completed", "cancelled"]);
  });

  it("Payment lifecycle starts in scheduled", () => {
    expect(PAYMENT_LIFECYCLE.initial).toBe("scheduled");
  });

  it("Invoice lifecycle starts in draft", () => {
    expect(INVOICE_LIFECYCLE.initial).toBe("draft");
  });
});

// =============================================================================
// 3. The exact-2-principals constraint — the canonical wedding-specific rule.
//    Verifies that the rule "a Wedding has exactly two Couple principals" is
//    actually encoded in the edge catalog (not just in our heads).
// =============================================================================

describe("Wedding profile constraints", () => {
  it("has_principal enforces exactly-2 from a Wedding", () => {
    expect(EDGE_CATALOG.has_principal).toBeDefined();
    expect(EDGE_CATALOG.has_principal!.fromTypes).toEqual(["Wedding"]);
    expect(EDGE_CATALOG.has_principal!.toTypes).toEqual(["Couple"]);
    expect(EDGE_CATALOG.has_principal!.fromCardinality).toBe("exactly:2");
  });

  it("has_guest is unbounded (a wedding can invite any number)", () => {
    expect(EDGE_CATALOG.has_guest!.fromCardinality).toBe("unbounded");
  });

  it("Wedding is the identity-primacy spine", () => {
    expect(WEDDING_PROFILE.identityPrimacy).toBe("Wedding");
  });
});
