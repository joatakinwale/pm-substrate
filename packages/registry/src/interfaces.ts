import type {
  CapabilityId,
  EmitDecl,
  EmitContract,
  ReadDecl,
  ReadContract,
  SubscribeDecl,
  SubscribeContract,
  TenantId,
  WriteDecl,
  WriteContract,
} from "@pm/types";
import {
  isEmitContract,
  isSubscribeContract,
  isReadContract,
  isWriteContract,
} from "@pm/types";

/**
 * A registered capability. Tools register declaratively at install time;
 * the substrate uses these declarations to (a) validate workflows reference
 * existing capabilities and (b) wire SubscriptionRouter automatically.
 *
 * G6 / ADR-0013 migration window:
 *   `emits`, `subscribesTo`, `readsInterfaces`, `writesInterfaces` accept
 *   both legacy (string) and typed (contract object) entries. The registry
 *   stores them verbatim in JSONB. The workflow installer normalizes via
 *   `normalizeCapability()` before validating compatibility.
 *
 *   After ADR-0013 sequencing step 4, the V1 string forms are removed.
 */
export interface Capability {
  readonly id: CapabilityId;

  /** Stable name, globally unique. Convention: "<profile>/<role>" or "common/<role>". */
  readonly name: string;
  readonly version: number;

  /**
   * Tier-1 interface shapes the capability reads/writes.
   * V1: array of interface-name strings.
   * V2: array of {ReadContract, WriteContract} with field-level granularity.
   */
  readonly readsInterfaces: readonly ReadDecl[];
  readonly writesInterfaces: readonly WriteDecl[];

  /** Edge types this capability uses. (Not yet typed; see ADR-0013 — G7+G8.) */
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];

  /**
   * Event types this capability emits.
   * V1: array of type strings.
   * V2: array of EmitContract with versioned schema refs.
   */
  readonly emits: readonly EmitDecl[];

  /**
   * Event-type patterns the capability subscribes to.
   * V1: array of pattern strings.
   * V2: array of SubscribeContract with version-range acceptance.
   */
  readonly subscribesTo: readonly SubscribeDecl[];

  /** Permission strings (grammar in G7 / ADR-0014). */
  readonly requiredPermissions: readonly string[];

  readonly description: string;
}

/**
 * Normalized capability — every declaration is in its V2/typed form. Used
 * internally by the workflow installer's compatibility checker.
 *
 * V1 entries are converted with conservative defaults:
 *   - emits "x.y.z" -> { schema: { type: "x.y.z", version: {1,0,0}, schemaPath: "" } }
 *   - subscribesTo "x.y.*" -> { pattern: "x.y.*", accepts: { minMajor: 1, maxMajor: 1 } }
 *   - readsInterfaces "Foo" -> { interface: "Foo", fields: [], cardinality: "many", required: false }
 *   - writesInterfaces "Foo" -> { interface: "Foo", fields: [], ownership: "contributor" }
 *
 * The `untyped` flag on the result tells the installer that this capability
 * was migrated from V1; --strict mode rejects when `untyped` is true.
 */
export interface NormalizedCapability {
  readonly id: CapabilityId;
  readonly name: string;
  readonly version: number;
  readonly emits: readonly EmitContract[];
  readonly subscribesTo: readonly SubscribeContract[];
  readonly reads: readonly ReadContract[];
  readonly writes: readonly WriteContract[];
  readonly readsEdges: readonly string[];
  readonly writesEdges: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly description: string;
  /** True if any field was V1 (string) at normalization time. */
  readonly untyped: boolean;
}

const normalizeEmit = (d: EmitDecl): { contract: EmitContract; untyped: boolean } => {
  if (isEmitContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      schema: {
        type: d,
        version: { major: 1, minor: 0, patch: 0 },
        schemaPath: "",
      },
    },
    untyped: true,
  };
};

const normalizeSubscribe = (
  d: SubscribeDecl,
): { contract: SubscribeContract; untyped: boolean } => {
  if (isSubscribeContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      pattern: d,
      accepts: { minMajor: 1, maxMajor: 1 },
    },
    untyped: true,
  };
};

const normalizeRead = (d: ReadDecl): { contract: ReadContract; untyped: boolean } => {
  if (isReadContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      interface: d,
      fields: [],
      cardinality: "many",
      required: false,
    },
    untyped: true,
  };
};

const normalizeWrite = (d: WriteDecl): { contract: WriteContract; untyped: boolean } => {
  if (isWriteContract(d)) return { contract: d, untyped: false };
  return {
    contract: {
      interface: d,
      fields: [],
      ownership: "contributor",
    },
    untyped: true,
  };
};

/**
 * Convert a capability with mixed V1/V2 declarations into fully-V2 form.
 * Sets `untyped: true` if any V1 entries were normalized.
 */
export const normalizeCapability = (cap: Capability): NormalizedCapability => {
  let untyped = false;

  const emits = cap.emits.map(normalizeEmit);
  const subscribesTo = cap.subscribesTo.map(normalizeSubscribe);
  const reads = cap.readsInterfaces.map(normalizeRead);
  const writes = cap.writesInterfaces.map(normalizeWrite);

  for (const e of emits) untyped = untyped || e.untyped;
  for (const s of subscribesTo) untyped = untyped || s.untyped;
  for (const r of reads) untyped = untyped || r.untyped;
  for (const w of writes) untyped = untyped || w.untyped;

  return {
    id: cap.id,
    name: cap.name,
    version: cap.version,
    emits: emits.map((x) => x.contract),
    subscribesTo: subscribesTo.map((x) => x.contract),
    reads: reads.map((x) => x.contract),
    writes: writes.map((x) => x.contract),
    readsEdges: cap.readsEdges,
    writesEdges: cap.writesEdges,
    requiredPermissions: cap.requiredPermissions,
    description: cap.description,
    untyped,
  };
};

export interface Registry {
  /**
   * Register or upgrade a capability. Idempotent on (tenantId, name, version):
   * re-registering the same triple updates the descriptor in place.
   * Registering a new version of an existing name leaves prior versions in
   * place (multiple versions can coexist; the workflow layer pins to one).
   */
  register(tenantId: TenantId, capability: Capability): Promise<void>;

  /** Unregister a capability by name (all versions). */
  unregister(tenantId: TenantId, name: string): Promise<void>;

  /**
   * Look up a capability by name. If multiple versions are registered,
   * returns the highest. (Workflows should pin a specific version explicitly.)
   */
  get(tenantId: TenantId, name: string): Promise<Capability | null>;

  /** Look up a specific (name, version). */
  getVersion(
    tenantId: TenantId,
    name: string,
    version: number,
  ): Promise<Capability | null>;

  /** Enumerate all capabilities for a tenant (latest version of each name). */
  list(tenantId: TenantId): Promise<readonly Capability[]>;

  /**
   * Reverse index: capabilities whose subscribesTo patterns match the given
   * concrete event type. Used by the workflow runtime + SubscriptionRouter
   * to fan out events to interested capabilities at install time.
   */
  subscribersOf(
    tenantId: TenantId,
    eventType: string,
  ): Promise<readonly Capability[]>;
}
