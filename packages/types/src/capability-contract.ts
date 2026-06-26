import type { CapabilityId, Timestamp } from "./common.js";

/**
 * Typed, versioned capability contracts (G6 / ADR-0013).
 *
 * Replaces the stringly-typed `emits`/`subscribesTo`/`reads`/`writes` arrays
 * on `Capability` with structured contracts that carry versioned schema
 * references. The substrate's workflow installer validates producer/subscriber
 * compatibility at install time.
 *
 * No runtime. No I/O. No business logic. Just declared shapes.
 *
 * See docs/adr/0013-typed-capability-contracts.md for the design rationale.
 */

/**
 * Semver-style integer triple. Major bumps are breaking changes (a producer
 * that bumps `major` is signaling that subscribers must widen their
 * `accepts.maxMajor` before they can keep consuming).
 */
export interface SchemaVersion {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * A reference to a JSON Schema file shipped alongside the capability's source.
 *
 * - `type` is the stable event-type string (e.g. "agency.lead.qualified").
 *   It must match the topic pattern subscribers use.
 * - `version` is the schema's semver. Field-additive changes are minor/patch;
 *   field-removal or required-narrowing is major.
 * - `schemaPath` is relative to the capability package root, e.g.
 *   "schemas/payment-recorded.v1.json". The substrate resolves it lazily at
 *   workflow install time, never at runtime publish.
 */
export interface PayloadSchemaRef {
  readonly type: string;
  readonly version: SchemaVersion;
  readonly schemaPath: string;
}

/** A capability declares what it emits with full schema context. */
export interface EmitContract {
  readonly schema: PayloadSchemaRef;
  /**
   * Optional: declare which graph entity types this emit accompanies a write
   * to. Used by G7 + G8 to reason about cascade impact without parsing
   * payloads.
   */
  readonly affectsEntities?: readonly string[];
}

/** A capability declares what events it consumes, with version range. */
export interface SubscribeContract {
  /**
   * Pattern matches `PayloadSchemaRef.type`. Wildcards allowed (e.g.
   * "agency.lead.*"). Wildcard semantics match `@pm/registry`'s
   * `matchesPattern`.
   */
  readonly pattern: string;
  /**
   * Range of producer-side `schema.version.major` this subscriber accepts.
   * If a producer emits a version outside this range, the workflow installer
   * refuses to wire the subscription.
   *
   * Convention: a v1 subscriber declares `{ minMajor: 1, maxMajor: 1 }`.
   * Widening to `{ minMajor: 1, maxMajor: 2 }` signals readiness for v2.
   */
  readonly accepts: { readonly minMajor: number; readonly maxMajor: number };
  /**
   * If true, the subscriber will silently drop events whose schema can't be
   * resolved (forward compatibility). If false, drops are errors.
   * Default: false (strict).
   */
  readonly tolerateUnknown?: boolean;
}

/**
 * A capability declares what graph state it reads, at field granularity.
 * Field lists are the foundation that G7's least-privilege checks build on.
 */
export interface ReadContract {
  /** Tier-1 or profile interface name, e.g. "Counterparty/Couple". */
  readonly interface: string;
  /**
   * Specific fields the capability reads. The substrate's read API will
   * (in G7) refuse to return fields not declared here.
   */
  readonly fields: readonly string[];
  /**
   * Cardinality the capability expects. If the substrate cannot satisfy it,
   * workflow execution errors loudly — no silent zero-rows return.
   */
  readonly cardinality: "exactly-one" | "at-most-one" | "many";
  readonly required: boolean;
}

/**
 * A discoverable terminal-admission provider for a write contract.
 *
 * The provider ref is declarative metadata, not an admission decision. Runtime
 * write paths still have to call the provider and verify the resulting
 * terminal proof before accepting a mutation.
 */
export interface TerminalAdmissionProviderRef {
  /** Stable provider identifier. Convention: "<profile>.<boundary>.<kind>.vN". */
  readonly providerId: string;
  readonly kind: "action_outcome_envelope";
  /** Contract version consumed by the declaring write surface. */
  readonly contractVersion: SchemaVersion;
  /** Package and export that supply the provider implementation. */
  readonly packageName: string;
  readonly exportName: string;
  /** Action types this provider can partition into terminal outcomes. */
  readonly actionTypes: readonly string[];
  /** Optional profiles where this provider is intended to apply. */
  readonly profiles?: readonly string[];
  /** Evidence ref kinds the provider may require before accepting a write. */
  readonly evidenceRefKinds?: readonly string[];
  /** Substrate ref kinds the provider emits for replay/resume. */
  readonly substrateRefKinds?: readonly string[];
}

export type TerminalAdmissionProviderAvailability =
  | "available"
  | "unavailable"
  | "deprecated";

/**
 * Runtime/provider-side manifest used to check that a declarative provider ref
 * still points at an available and compatible implementation.
 */
export interface TerminalAdmissionProviderManifest
  extends TerminalAdmissionProviderRef {
  readonly availability: TerminalAdmissionProviderAvailability;
}

export type TerminalAdmissionProviderCertificateStatus =
  | "valid"
  | "revoked"
  | "superseded";

export interface TerminalAdmissionProviderCertificateSubject {
  readonly capabilityId: CapabilityId;
  readonly capabilityName: string;
  readonly capabilityVersion: number;
  readonly writeInterface: string;
  readonly writeFields: readonly string[];
  readonly writeOwnership: "owner" | "contributor" | "delegated";
  readonly providerId: string;
}

/**
 * Durable proof that a capability write surface was checked against a provider
 * manifest at install/runtime handoff. Certificates are still status-bearing:
 * runtimes must check status and validity windows before dispatch.
 */
export interface TerminalAdmissionProviderCertificate {
  readonly schemaVersion: "pm.terminal_admission_provider_certificate.v1";
  readonly certificateId: string;
  readonly certificateDigest: string;
  readonly issuer: string;
  readonly issuedAt: Timestamp;
  readonly validUntil: Timestamp;
  readonly status: TerminalAdmissionProviderCertificateStatus;
  readonly subject: TerminalAdmissionProviderCertificateSubject;
  readonly provider: TerminalAdmissionProviderRef;
  readonly manifest: TerminalAdmissionProviderManifest;
  readonly manifestDigest: string;
}

/**
 * A capability declares what graph state it writes, with ownership semantics.
 *
 * Ownership rules enforced by the workflow installer:
 *   - Two capabilities may not both claim `ownership: "owner"` for the same
 *     `(interface, field)` tuple within a single tenant.
 *   - `"contributor"` writers may overlap; conflict resolution is the
 *     capability's responsibility.
 *   - `"delegated"` means the capability never writes directly; it calls
 *     another capability's API. Useful for documenting indirection.
 */
export interface WriteContract {
  readonly interface: string;
  readonly fields: readonly string[];
  readonly ownership: "owner" | "contributor" | "delegated";
  /**
   * Optional terminal-admission providers for this write surface. When present,
   * registry and verifier tooling can discover coverage from capability
   * metadata instead of relying on hand-maintained transport inventories.
   */
  readonly terminalAdmissionProviders?: readonly TerminalAdmissionProviderRef[];
}

/**
 * Marker types — let the registry runtime distinguish v1 (string-array) from
 * v2 (typed) contract declarations during the migration window. After the
 * migration window closes (per ADR-0013 sequencing step 4), v1 is removed.
 */
export type EmitDeclV1 = string;
export type EmitDeclV2 = EmitContract;
export type EmitDecl = EmitDeclV1 | EmitDeclV2;

export type SubscribeDeclV1 = string;
export type SubscribeDeclV2 = SubscribeContract;
export type SubscribeDecl = SubscribeDeclV1 | SubscribeDeclV2;

export type ReadDeclV1 = string;
export type ReadDeclV2 = ReadContract;
export type ReadDecl = ReadDeclV1 | ReadDeclV2;

export type WriteDeclV1 = string;
export type WriteDeclV2 = WriteContract;
export type WriteDecl = WriteDeclV1 | WriteDeclV2;

/**
 * Type predicates for runtime discrimination. Old-form declarations are
 * plain strings; new-form are objects.
 */
export const isEmitContract = (d: EmitDecl): d is EmitContract =>
  typeof d === "object" && d !== null && "schema" in d;

export const isSubscribeContract = (d: SubscribeDecl): d is SubscribeContract =>
  typeof d === "object" && d !== null && "pattern" in d && "accepts" in d;

export const isReadContract = (d: ReadDecl): d is ReadContract =>
  typeof d === "object" && d !== null && "interface" in d && "cardinality" in d;

export const isWriteContract = (d: WriteDecl): d is WriteContract =>
  typeof d === "object" && d !== null && "interface" in d && "ownership" in d;
