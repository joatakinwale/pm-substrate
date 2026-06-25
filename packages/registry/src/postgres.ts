/**
 * Postgres-backed capability registry. Day-1 implementation of Layer 3.
 *
 * Design notes:
 *   - register() is idempotent on (tenantId, name, version) via ON CONFLICT
 *     DO UPDATE. Re-registering the same triple updates the descriptor.
 *   - Multiple versions of the same name coexist. get(name) returns the
 *     highest version; getVersion(name, v) pins explicitly. Workflows
 *     should always pin (covered by ADR when the workflow runtime lands).
 *   - subscribersOf() filters in two steps: SQL prefilter using LIKE on the
 *     JSONB-stringified subscribesTo array (fast, indexable later via GIN),
 *     then in-process glob match for correctness on the wildcard semantics.
 *     The SQL prefilter is conservative — it can over-include but never
 *     under-include — so the in-process match is a refinement, not a fixup.
 */

import { randomUUID } from "node:crypto";
import type {
  CapabilityId,
  EmitDecl,
  ReadDecl,
  SubscribeDecl,
  TerminalAdmissionProviderCertificate,
  TerminalAdmissionProviderCertificateStatus,
  TenantId,
  Timestamp,
  WriteDecl,
} from "@pm/types";
import { isSubscribeContract } from "@pm/types";
import pg from "pg";
import {
  verifyTerminalAdmissionProviderCertificateIntegrity,
  verifyTerminalAdmissionProviderCertificateStatusRecord,
  type Capability,
  type Registry,
  type TerminalAdmissionProviderCertificateFindCurrentInput,
  type TerminalAdmissionProviderCertificateLookupInput,
  type TerminalAdmissionProviderCertificateRecordInput,
  type TerminalAdmissionProviderCertificateStatusRecord,
  type TerminalAdmissionProviderCertificateStatusStore,
  type TerminalAdmissionProviderCertificateStatusUpdateInput,
} from "./interfaces.js";
import { matchesPattern } from "./pattern.js";

/**
 * JSONB columns hold mixed V1/V2 declarations during the G6 migration window.
 * V1 entries deserialize as strings; V2 entries deserialize as objects.
 * We keep the row type permissive and let `Capability` carry the union types.
 */
interface Row {
  id: string;
  tenant_id: string;
  name: string;
  version: number;
  reads_interfaces: ReadDecl[];
  writes_interfaces: WriteDecl[];
  reads_edges: string[];
  writes_edges: string[];
  emits: EmitDecl[];
  subscribes_to: SubscribeDecl[];
  required_permissions: string[];
  input_schema: Readonly<Record<string, unknown>> | null;
  description: string;
  registered_at: Date;
}

const rowToCapability = (r: Row): Capability => ({
  id: r.id as CapabilityId,
  name: r.name,
  version: r.version,
  readsInterfaces: r.reads_interfaces ?? [],
  writesInterfaces: r.writes_interfaces ?? [],
  readsEdges: r.reads_edges ?? [],
  writesEdges: r.writes_edges ?? [],
  emits: r.emits ?? [],
  subscribesTo: r.subscribes_to ?? [],
  requiredPermissions: r.required_permissions ?? [],
  ...(r.input_schema ? { inputSchema: r.input_schema } : {}),
  description: r.description ?? "",
});

/**
 * Extract the pattern string from a SubscribeDecl (V1 or V2). Used by
 * `subscribersOf` to do glob matching uniformly across both forms.
 */
const subscribePattern = (d: SubscribeDecl): string =>
  isSubscribeContract(d) ? d.pattern : d;

type Querier = Pick<pg.ClientBase, "query"> | pg.Pool;

const SELECT_COLS = `
  id, tenant_id, name, version,
  reads_interfaces, writes_interfaces, reads_edges, writes_edges,
  emits, subscribes_to, required_permissions, input_schema, description, registered_at
`;

const CERTIFICATE_SELECT_COLS = `
  tenant_id, certificate_id, certificate_digest, subject_capability_name,
  subject_provider_id, certificate, current_status, status_reason,
  superseded_by_certificate_id, status_updated_at, recorded_at
`;

export class PostgresRegistry implements Registry {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async register(
    tenantId: TenantId,
    cap: Capability,
    tx?: pg.ClientBase,
  ): Promise<void> {
    const q = this.#q(tx);
    // The row's `id` is per-tenant. The caller's `cap.id` is a stable type
    // identifier (e.g. cap_common_audit_log_v1) shared across tenants for
    // the same capability — and is NOT the row PK. Always generate a fresh
    // row id per insert; ON CONFLICT below handles the (tenant, name, version)
    // dedup. (Earlier impl reused cap.id as the PK, causing collisions when
    // the same capability descriptor was registered against two tenants.
    // Caught by capability-audit Tier-1 cross-tenant test.)
    const id = `cap_${randomUUID()}`;
    await q.query(
      `INSERT INTO registry.capabilities (
         id, tenant_id, name, version,
         reads_interfaces, writes_interfaces, reads_edges, writes_edges,
         emits, subscribes_to, required_permissions, input_schema, description
       )
       VALUES (
         $1,$2,$3,$4,
         $5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,
         $9::jsonb,$10::jsonb,$11::jsonb,$12::jsonb,$13
       )
       ON CONFLICT (tenant_id, name, version) DO UPDATE SET
         reads_interfaces     = EXCLUDED.reads_interfaces,
         writes_interfaces    = EXCLUDED.writes_interfaces,
         reads_edges          = EXCLUDED.reads_edges,
         writes_edges         = EXCLUDED.writes_edges,
         emits                = EXCLUDED.emits,
         subscribes_to        = EXCLUDED.subscribes_to,
         required_permissions = EXCLUDED.required_permissions,
         input_schema         = EXCLUDED.input_schema,
         description          = EXCLUDED.description,
         registered_at        = now()`,
      [
        id,
        tenantId,
        cap.name,
        cap.version,
        JSON.stringify(cap.readsInterfaces ?? []),
        JSON.stringify(cap.writesInterfaces ?? []),
        JSON.stringify(cap.readsEdges ?? []),
        JSON.stringify(cap.writesEdges ?? []),
        JSON.stringify(cap.emits ?? []),
        JSON.stringify(cap.subscribesTo ?? []),
        JSON.stringify(cap.requiredPermissions ?? []),
        cap.inputSchema ? JSON.stringify(cap.inputSchema) : null,
        cap.description ?? "",
      ],
    );
  }

  async unregister(
    tenantId: TenantId,
    name: string,
    tx?: pg.ClientBase,
  ): Promise<void> {
    const q = this.#q(tx);
    await q.query(
      `DELETE FROM registry.capabilities WHERE tenant_id = $1 AND name = $2`,
      [tenantId, name],
    );
  }

  async get(
    tenantId: TenantId,
    name: string,
    tx?: pg.ClientBase,
  ): Promise<Capability | null> {
    const q = this.#q(tx);
    const r = await q.query<Row>(
      `SELECT ${SELECT_COLS}
         FROM registry.capabilities
        WHERE tenant_id = $1 AND name = $2
        ORDER BY version DESC
        LIMIT 1`,
      [tenantId, name],
    );
    return r.rows[0] ? rowToCapability(r.rows[0]) : null;
  }

  async getVersion(
    tenantId: TenantId,
    name: string,
    version: number,
    tx?: pg.ClientBase,
  ): Promise<Capability | null> {
    const q = this.#q(tx);
    const r = await q.query<Row>(
      `SELECT ${SELECT_COLS}
         FROM registry.capabilities
        WHERE tenant_id = $1 AND name = $2 AND version = $3
        LIMIT 1`,
      [tenantId, name, version],
    );
    return r.rows[0] ? rowToCapability(r.rows[0]) : null;
  }

  async list(
    tenantId: TenantId,
    tx?: pg.ClientBase,
  ): Promise<readonly Capability[]> {
    const q = this.#q(tx);
    // Latest version of each name. DISTINCT ON keyed by name, ordered by
    // version DESC.
    const r = await q.query<Row>(
      `SELECT DISTINCT ON (name) ${SELECT_COLS}
         FROM registry.capabilities
        WHERE tenant_id = $1
        ORDER BY name ASC, version DESC`,
      [tenantId],
    );
    return r.rows.map(rowToCapability);
  }

  async subscribersOf(
    tenantId: TenantId,
    eventType: string,
  ): Promise<readonly Capability[]> {
    // Pull all capabilities for the tenant, then filter by glob in process.
    // At small scale this is fine; once registry size is large enough to
    // notice, we can add a GIN index on subscribes_to and prefilter in SQL.
    // (Backfill ADR will document this.)
    const all = await this.list(tenantId);
    return all.filter((cap) =>
      cap.subscribesTo.some((d) => matchesPattern(subscribePattern(d), eventType)),
    );
  }

  #q(tx?: pg.ClientBase): Querier {
    return (tx as Querier | undefined) ?? this.#pool;
  }
}

interface CertificateRow {
  tenant_id: string;
  certificate_id: string;
  certificate_digest: string;
  subject_capability_name: string;
  subject_provider_id: string;
  certificate: TerminalAdmissionProviderCertificate;
  current_status: TerminalAdmissionProviderCertificateStatus;
  status_reason: string | null;
  superseded_by_certificate_id: string | null;
  status_updated_at: Date | string;
  recorded_at: Date | string;
}

const timestampFromDb = (value: Date | string): Timestamp =>
  (value instanceof Date ? value.toISOString() : new Date(value).toISOString()) as Timestamp;

const rowToCertificateStatusRecord = (
  row: CertificateRow,
): TerminalAdmissionProviderCertificateStatusRecord => ({
  tenantId: row.tenant_id as TenantId,
  certificate: row.certificate,
  currentStatus: row.current_status,
  statusUpdatedAt: timestampFromDb(row.status_updated_at),
  recordedAt: timestampFromDb(row.recorded_at),
  ...(row.status_reason !== null ? { statusReason: row.status_reason } : {}),
  ...(row.superseded_by_certificate_id !== null
    ? { supersededByCertificateId: row.superseded_by_certificate_id }
    : {}),
});

export class PostgresTerminalAdmissionProviderCertificateStore
  implements TerminalAdmissionProviderCertificateStatusStore {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async recordCertificate(
    input: TerminalAdmissionProviderCertificateRecordInput,
    tx?: pg.ClientBase,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord> {
    const integrity = verifyTerminalAdmissionProviderCertificateIntegrity(
      input.certificate,
    );
    if (!integrity.valid) {
      throw new Error(
        `terminal-admission provider certificate failed integrity validation: ${integrity.issues
          .map((issue) => issue.code)
          .join(", ")}`,
      );
    }

    const existing = await this.getCertificateRecord(
      {
        tenantId: input.tenantId,
        certificateId: input.certificate.certificateId,
      },
      tx,
    );
    if (existing !== null) {
      if (
        existing.certificate.certificateDigest !==
        input.certificate.certificateDigest
      ) {
        throw new Error(
          `terminal-admission provider certificate ${input.certificate.certificateId} already exists with a different digest`,
        );
      }
      return existing;
    }

    const q = this.#q(tx);
    const currentStatus = input.currentStatus ?? input.certificate.status;
    const result = await q.query<CertificateRow>(
      `INSERT INTO registry.terminal_admission_provider_certificates (
         tenant_id, certificate_id, certificate_digest,
         subject_capability_name, subject_provider_id, certificate,
         current_status, status_reason, superseded_by_certificate_id,
         status_updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10)
       RETURNING ${CERTIFICATE_SELECT_COLS}`,
      [
        input.tenantId,
        input.certificate.certificateId,
        input.certificate.certificateDigest,
        input.certificate.subject.capabilityName,
        input.certificate.subject.providerId,
        JSON.stringify(input.certificate),
        currentStatus,
        input.statusReason ?? null,
        input.supersededByCertificateId ?? null,
        input.statusUpdatedAt,
      ],
    );
    return rowToCertificateStatusRecord(result.rows[0]!);
  }

  async getCertificateRecord(
    input: TerminalAdmissionProviderCertificateLookupInput,
    tx?: pg.ClientBase,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null> {
    const q = this.#q(tx);
    const result = await q.query<CertificateRow>(
      `SELECT ${CERTIFICATE_SELECT_COLS}
         FROM registry.terminal_admission_provider_certificates
        WHERE tenant_id = $1 AND certificate_id = $2
        LIMIT 1`,
      [input.tenantId, input.certificateId],
    );
    return result.rows[0]
      ? rowToCertificateStatusRecord(result.rows[0])
      : null;
  }

  async setCertificateStatus(
    input: TerminalAdmissionProviderCertificateStatusUpdateInput,
    tx?: pg.ClientBase,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null> {
    const q = this.#q(tx);
    const result = await q.query<CertificateRow>(
      `UPDATE registry.terminal_admission_provider_certificates
          SET current_status = $3,
              status_reason = $4,
              superseded_by_certificate_id = $5,
              status_updated_at = $6
        WHERE tenant_id = $1 AND certificate_id = $2
        RETURNING ${CERTIFICATE_SELECT_COLS}`,
      [
        input.tenantId,
        input.certificateId,
        input.status,
        input.statusReason ?? null,
        input.supersededByCertificateId ?? null,
        input.statusUpdatedAt,
      ],
    );
    return result.rows[0]
      ? rowToCertificateStatusRecord(result.rows[0])
      : null;
  }

  async findCurrentCertificate(
    input: TerminalAdmissionProviderCertificateFindCurrentInput,
    tx?: pg.ClientBase,
  ): Promise<TerminalAdmissionProviderCertificateStatusRecord | null> {
    const q = this.#q(tx);
    const params: unknown[] = [input.tenantId, input.capabilityName];
    const providerClause =
      input.providerId === undefined ? "" : "AND subject_provider_id = $3";
    if (input.providerId !== undefined) params.push(input.providerId);

    const result = await q.query<CertificateRow>(
      `SELECT ${CERTIFICATE_SELECT_COLS}
         FROM registry.terminal_admission_provider_certificates
        WHERE tenant_id = $1
          AND subject_capability_name = $2
          AND current_status = 'valid'
          ${providerClause}
        ORDER BY status_updated_at DESC, recorded_at DESC`,
      params,
    );

    for (const row of result.rows) {
      const record = rowToCertificateStatusRecord(row);
      if (input.checkedAt === undefined) return record;
      const decision = verifyTerminalAdmissionProviderCertificateStatusRecord({
        record,
        checkedAt: input.checkedAt,
        capabilityName: input.capabilityName,
        ...(input.providerId !== undefined ? { providerId: input.providerId } : {}),
      });
      if (decision.valid) return record;
    }
    return null;
  }

  #q(tx?: pg.ClientBase): Querier {
    return (tx as Querier | undefined) ?? this.#pool;
  }
}
