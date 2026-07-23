import { randomUUID } from "node:crypto";
import pg from "pg";
import type { TenantId, Timestamp } from "@pm/types";
import {
  InvalidTenantIdError,
  TenantConflictError,
  TenantNotFoundError,
} from "./errors.js";
import type {
  CreateTenantInput,
  TenantDirectory,
  TenantRecord,
  UpdateTenantInput,
} from "./interfaces.js";

interface TenantRow {
  id: string;
  display_name: string;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
}

const TENANT_ID_RE = /^[a-z0-9][a-z0-9_-]{1,62}[a-z0-9]$/;

const normalizeTenantId = (id: string): TenantId => {
  if (!TENANT_ID_RE.test(id)) throw new InvalidTenantIdError(id);
  return id as TenantId;
};

const generatedTenantId = (): TenantId => `tnt_${randomUUID().replace(/-/g, "").slice(0, 20)}` as TenantId;

const rowToTenant = (r: TenantRow): TenantRecord => ({
  id: r.id as TenantId,
  displayName: r.display_name,
  metadata: r.metadata ?? {},
  createdAt: r.created_at.toISOString() as Timestamp,
  updatedAt: r.updated_at.toISOString() as Timestamp,
  archivedAt: r.archived_at ? (r.archived_at.toISOString() as Timestamp) : null,
});

export class PostgresTenantDirectory implements TenantDirectory {
  readonly #pool: pg.Pool;

  constructor(pool: pg.Pool) {
    this.#pool = pool;
  }

  async create(input: CreateTenantInput): Promise<TenantRecord> {
    const id = input.id ? normalizeTenantId(input.id) : generatedTenantId();
    const displayName = input.displayName.trim();
    if (displayName.length === 0) throw new Error("displayName is required");

    const r = await this.#pool.query<TenantRow>(
      `INSERT INTO substrate.tenants (id, display_name, metadata)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO NOTHING
       RETURNING id, display_name, metadata, created_at, updated_at, archived_at`,
      [id, displayName, JSON.stringify(input.metadata ?? {})],
    );
    if (!r.rows[0]) throw new TenantConflictError(id);
    return rowToTenant(r.rows[0]);
  }

  async get(id: TenantId): Promise<TenantRecord | null> {
    const r = await this.#pool.query<TenantRow>(
      `SELECT id, display_name, metadata, created_at, updated_at, archived_at
         FROM substrate.tenants
        WHERE id = $1
        LIMIT 1`,
      [id],
    );
    return r.rows[0] ? rowToTenant(r.rows[0]) : null;
  }

  async require(id: TenantId): Promise<TenantRecord> {
    const tenant = await this.get(id);
    if (!tenant) throw new TenantNotFoundError(id);
    return tenant;
  }

  async list(input: { readonly includeArchived?: boolean } = {}): Promise<readonly TenantRecord[]> {
    const includeArchived = input.includeArchived === true;
    const r = await this.#pool.query<TenantRow>(
      `SELECT id, display_name, metadata, created_at, updated_at, archived_at
         FROM substrate.tenants
        WHERE ($1::boolean OR archived_at IS NULL)
        ORDER BY created_at DESC, id ASC`,
      [includeArchived],
    );
    return r.rows.map(rowToTenant);
  }

  async update(id: TenantId, input: UpdateTenantInput): Promise<TenantRecord> {
    const displayName = input.displayName?.trim();
    if (input.displayName !== undefined && displayName?.length === 0) {
      throw new Error("displayName cannot be empty");
    }
    const r = await this.#pool.query<TenantRow>(
      `UPDATE substrate.tenants
          SET display_name = COALESCE($2, display_name),
              metadata = COALESCE($3::jsonb, metadata),
              updated_at = now()
        WHERE id = $1
        RETURNING id, display_name, metadata, created_at, updated_at, archived_at`,
      [id, displayName ?? null, input.metadata === undefined ? null : JSON.stringify(input.metadata)],
    );
    if (!r.rows[0]) throw new TenantNotFoundError(id);
    return rowToTenant(r.rows[0]);
  }

  async archive(id: TenantId): Promise<TenantRecord> {
    const r = await this.#pool.query<TenantRow>(
      `UPDATE substrate.tenants
          SET archived_at = COALESCE(archived_at, now()),
              updated_at = now()
        WHERE id = $1
        RETURNING id, display_name, metadata, created_at, updated_at, archived_at`,
      [id],
    );
    if (!r.rows[0]) throw new TenantNotFoundError(id);
    return rowToTenant(r.rows[0]);
  }

  async restore(id: TenantId): Promise<TenantRecord> {
    const r = await this.#pool.query<TenantRow>(
      `UPDATE substrate.tenants
          SET archived_at = NULL,
              updated_at = now()
        WHERE id = $1
        RETURNING id, display_name, metadata, created_at, updated_at, archived_at`,
      [id],
    );
    if (!r.rows[0]) throw new TenantNotFoundError(id);
    return rowToTenant(r.rows[0]);
  }
}
