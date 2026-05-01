-- 0001_init_schemas.sql
-- Bootstraps the five substrate schemas. Each layer of the architecture
-- gets its own schema so the boundaries are visible at the database level.
--
-- Architecture rule: partition by tenant from commit one. Every domain table
-- has a tenant_id column. We are not using schema-per-tenant at this stage —
-- one schema per architectural concern, with tenant_id as a partition key.

CREATE SCHEMA IF NOT EXISTS graph;
CREATE SCHEMA IF NOT EXISTS events;
CREATE SCHEMA IF NOT EXISTS projections;
CREATE SCHEMA IF NOT EXISTS registry;
CREATE SCHEMA IF NOT EXISTS workflow;

-- A bookkeeping schema for migration tracking and substrate-wide metadata.
CREATE SCHEMA IF NOT EXISTS substrate;

CREATE TABLE IF NOT EXISTS substrate.applied_migrations (
  filename     TEXT PRIMARY KEY,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  checksum_sha256 TEXT NOT NULL
);

-- Tenant directory. Day-1 we store one row per tenant; tenant lifecycle
-- (provisioning, archival) lives in the substrate schema.
CREATE TABLE IF NOT EXISTS substrate.tenants (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ
);
