/**
 * Postgres-backed profile registry + validator factory.
 *
 * Storage: profiles.installations (one row per (tenant_id, name)), keyed
 * by tenant. JSONB blob is the serialized ProfileDefinition.
 *
 * Validator caching: built on demand per tenant from installed rows. The
 * validator is stateless (besides the catalog snapshot); callers can keep
 * it for the duration of a request or recreate per call. We don't cache
 * across calls in the registry itself — a fresh validator() is one
 * round-trip + one Map build, both cheap.
 */

import type {
  CardinalityConstraint,
  EdgeTypeDef,
  EntityTypeDef,
  LifecycleDef,
  ProfileDefinition,
  TenantId,
} from "@pm/types";
import pg from "pg";
import { ProfileValidationError } from "./errors.js";
import {
  parseCardinality,
  type EdgeWriteCheck,
  type LifecycleCheck,
  type NodeWriteCheck,
  type ProfileRegistry,
  type ProfileValidator,
} from "./interfaces.js";

interface Row {
  tenant_id: string;
  name: string;
  version: number;
  definition: ProfileDefinition;
}

export class PostgresProfileRegistry implements ProfileRegistry {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async install(
    tenantId: TenantId,
    def: ProfileDefinition,
  ): Promise<void> {
    await this.#pool.query(
      `INSERT INTO profiles.installations (tenant_id, name, version, definition)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (tenant_id, name) DO UPDATE
         SET version = EXCLUDED.version,
             definition = EXCLUDED.definition,
             installed_at = now()`,
      [tenantId, def.name, def.version, JSON.stringify(def)],
    );
  }

  async uninstall(tenantId: TenantId, name: string): Promise<void> {
    await this.#pool.query(
      `DELETE FROM profiles.installations WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name],
    );
  }

  async list(tenantId: TenantId): Promise<readonly ProfileDefinition[]> {
    const r = await this.#pool.query<Row>(
      `SELECT tenant_id, name, version, definition
         FROM profiles.installations
        WHERE tenant_id = $1
        ORDER BY name ASC`,
      [tenantId],
    );
    return r.rows.map((row) => row.definition);
  }

  async get(
    tenantId: TenantId,
    name: string,
  ): Promise<ProfileDefinition | null> {
    const r = await this.#pool.query<Row>(
      `SELECT tenant_id, name, version, definition
         FROM profiles.installations
        WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name],
    );
    return r.rows[0]?.definition ?? null;
  }

  async validator(tenantId: TenantId): Promise<ProfileValidator> {
    const profiles = await this.list(tenantId);
    return new SnapshotValidator(tenantId, profiles);
  }
}

/**
 * Stateless-after-construction validator built from a snapshot of the
 * tenant's installed profiles. The snapshot is taken at construction time;
 * callers should rebuild after install/uninstall events.
 */
class SnapshotValidator implements ProfileValidator {
  readonly #tenantId: TenantId;
  /** Concrete entity type → (profileName, EntityTypeDef). */
  readonly #entityTypes = new Map<string, { profile: string; def: EntityTypeDef }>();
  /** Profile-prefixed edge name ("wedding/has_principal") → EdgeTypeDef. */
  readonly #edgeTypes = new Map<string, EdgeTypeDef>();
  /** (profileName, concreteType) → LifecycleDef. */
  readonly #lifecycles = new Map<string, LifecycleDef>();

  constructor(tenantId: TenantId, profiles: readonly ProfileDefinition[]) {
    this.#tenantId = tenantId;
    for (const p of profiles) {
      for (const [name, def] of Object.entries(p.entityTypes)) {
        // Concrete names are expected globally unique across a tenant's
        // installed profiles; a clash would be a misconfiguration. We
        // surface it as an error if seen.
        if (this.#entityTypes.has(name)) {
          throw new ProfileValidationError(
            `concrete entity type "${name}" declared by multiple installed profiles`,
            tenantId,
            name,
          );
        }
        this.#entityTypes.set(name, { profile: p.name, def });
      }
      for (const [localName, def] of Object.entries(p.edgeTypes)) {
        this.#edgeTypes.set(`${p.name}/${localName}`, def);
      }
      for (const [concrete, lifecycle] of Object.entries(p.lifecycles ?? {})) {
        this.#lifecycles.set(`${p.name}::${concrete}`, lifecycle);
      }
    }
  }

  validateNode(input: NodeWriteCheck): void {
    const { profile, identity } = input;

    // Raw Tier-1 writes are unrestricted at this layer. Tier-1 type names
    // are validated by the graph migration's CHECK constraint.
    if (profile.profile === null) return;

    const entry = this.#entityTypes.get(profile.concrete);
    if (!entry) {
      throw new ProfileValidationError(
        `unknown concrete type "${profile.concrete}" — not declared by any installed profile`,
        this.#tenantId,
        profile.concrete,
      );
    }
    if (entry.profile !== profile.profile) {
      throw new ProfileValidationError(
        `concrete type "${profile.concrete}" belongs to profile "${entry.profile}", not "${profile.profile}"`,
        this.#tenantId,
        profile.concrete,
      );
    }
    if (entry.def.tier1 !== profile.tier1) {
      throw new ProfileValidationError(
        `concrete type "${profile.concrete}" maps to tier1 "${entry.def.tier1}", not "${profile.tier1}"`,
        this.#tenantId,
        profile.concrete,
      );
    }
    for (const f of entry.def.requiredFields) {
      if (!(f in identity)) {
        throw new ProfileValidationError(
          `missing required field "${f}" on ${profile.concrete}`,
          this.#tenantId,
          profile.concrete,
        );
      }
    }
    if (input.schemaVersion !== entry.def.schemaVersion) {
      throw new ProfileValidationError(
        `schemaVersion mismatch for ${profile.concrete}: caller=${input.schemaVersion}, profile=${entry.def.schemaVersion}`,
        this.#tenantId,
        profile.concrete,
      );
    }
  }

  validateLifecycleTransition(input: LifecycleCheck): void {
    const { profile, currentState, proposedState } = input;
    if (profile.profile === null) {
      throw new ProfileValidationError(
        `lifecycle transitions require a profile binding (raw Tier-1 has no lifecycle)`,
        this.#tenantId,
        profile.concrete,
      );
    }
    const lc = this.#lifecycles.get(`${profile.profile}::${profile.concrete}`);
    if (!lc) {
      throw new ProfileValidationError(
        `no lifecycle declared for ${profile.profile}::${profile.concrete}`,
        this.#tenantId,
        profile.concrete,
      );
    }
    if (!lc.states.includes(currentState)) {
      throw new ProfileValidationError(
        `currentState "${currentState}" is not in declared states for ${profile.concrete}: ${lc.states.join(", ")}`,
        this.#tenantId,
        profile.concrete,
      );
    }
    if (!lc.states.includes(proposedState)) {
      throw new ProfileValidationError(
        `proposedState "${proposedState}" is not in declared states for ${profile.concrete}: ${lc.states.join(", ")}`,
        this.#tenantId,
        profile.concrete,
      );
    }
    const legal = lc.transitions.some(
      (t) => t.from.includes(currentState) && t.to === proposedState,
    );
    if (!legal) {
      throw new ProfileValidationError(
        `illegal transition for ${profile.concrete}: ${currentState} → ${proposedState}`,
        this.#tenantId,
        profile.concrete,
      );
    }
  }

  validateEdge(input: EdgeWriteCheck): void {
    const def = this.#edgeTypes.get(input.type);
    if (!def) {
      // Unknown edge type — could be a Tier-1 cross-profile edge OR a typo.
      // Day-1 policy: if the type isn't profile-prefixed (no "/"), permit
      // it as raw. Otherwise reject.
      if (input.type.includes("/")) {
        throw new ProfileValidationError(
          `unknown edge type "${input.type}"`,
          this.#tenantId,
          input.type,
        );
      }
      return;
    }
    if (!def.fromTypes.includes(input.fromConcrete)) {
      throw new ProfileValidationError(
        `edge "${input.type}" cannot start at ${input.fromConcrete}; declared from-types: ${def.fromTypes.join(", ")}`,
        this.#tenantId,
        input.type,
      );
    }
    if (!def.toTypes.includes(input.toConcrete)) {
      throw new ProfileValidationError(
        `edge "${input.type}" cannot end at ${input.toConcrete}; declared to-types: ${def.toTypes.join(", ")}`,
        this.#tenantId,
        input.type,
      );
    }
    enforceCardinality(
      def.fromCardinality,
      input.existingFromCount + 1,
      input.type,
      "from",
      this.#tenantId,
    );
    enforceCardinality(
      def.toCardinality,
      input.existingToCount + 1,
      input.type,
      "to",
      this.#tenantId,
    );
  }
}

const enforceCardinality = (
  c: CardinalityConstraint,
  proposedCount: number,
  edgeType: string,
  side: "from" | "to",
  tenantId: TenantId,
): void => {
  const { op, n } = parseCardinality(c);
  if (op === "unbounded") return;
  if (op === "at-most" && proposedCount > n) {
    throw new ProfileValidationError(
      `edge "${edgeType}" ${side}-cardinality at-most:${n} would be exceeded (proposed count ${proposedCount})`,
      tenantId,
      edgeType,
    );
  }
  if (op === "exactly" && proposedCount > n) {
    throw new ProfileValidationError(
      `edge "${edgeType}" ${side}-cardinality exactly:${n} would be exceeded (proposed count ${proposedCount})`,
      tenantId,
      edgeType,
    );
  }
  // "at-least" is a floor, not a ceiling — we can't enforce it on a single
  // write (a node may legitimately have 0 of a type during construction).
  // Floor enforcement belongs in a tenant-config validation step that runs
  // after the wedding doc is "finalized". Logged for P2.
};
