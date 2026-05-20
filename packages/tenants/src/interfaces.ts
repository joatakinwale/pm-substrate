import type { TenantId, Timestamp } from "@pm/types";

export interface TenantRecord {
  readonly id: TenantId;
  readonly displayName: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly archivedAt: Timestamp | null;
}

export interface CreateTenantInput {
  readonly id?: TenantId;
  readonly displayName: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface UpdateTenantInput {
  readonly displayName?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface TenantDirectory {
  create(input: CreateTenantInput): Promise<TenantRecord>;
  get(id: TenantId): Promise<TenantRecord | null>;
  require(id: TenantId): Promise<TenantRecord>;
  list(input?: { readonly includeArchived?: boolean }): Promise<readonly TenantRecord[]>;
  update(id: TenantId, input: UpdateTenantInput): Promise<TenantRecord>;
  archive(id: TenantId): Promise<TenantRecord>;
  restore(id: TenantId): Promise<TenantRecord>;
}
