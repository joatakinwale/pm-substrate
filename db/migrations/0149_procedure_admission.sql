-- 0149_procedure_admission.sql
-- Durable Procedure Admission Kernel store.
--
-- A deterministic harness result (Pi Harness, browser QA, script, or agent
-- harness) is evidence until an authority-scoped admission record enters this
-- replayable ledger. Current operational procedure state is reconstructed from
-- procedure_admission.admission_records ordered by sequence and checked by the
-- package replay rules.
--
-- PARTITION CHECK (ADR-0005 standing rule): NOT range-partitioned. This is a
-- small admission ledger keyed by tenant/scope/procedure; point and ordered
-- scope replay are the primary access paths. If procedure-run volume becomes
-- event-log scale, split by tenant/scope or promote to an event-backed store.

CREATE SCHEMA IF NOT EXISTS procedure_admission;

CREATE TABLE IF NOT EXISTS procedure_admission.definitions (
  tenant_id             TEXT        NOT NULL,
  procedure_id          TEXT        NOT NULL,
  version               INTEGER     NOT NULL CHECK (version > 0),
  authority_scope       TEXT        NOT NULL,
  runner_kind           TEXT        NOT NULL,
  name                  TEXT        NOT NULL,
  input_contract_hash   TEXT        NOT NULL,
  output_contract_hash  TEXT        NOT NULL,
  allowed_use           JSONB       NOT NULL CHECK (jsonb_typeof(allowed_use) = 'array'),
  created_at            TIMESTAMPTZ NOT NULL,
  definition_hash       TEXT        NOT NULL,
  definition            JSONB       NOT NULL,
  PRIMARY KEY (tenant_id, procedure_id, version),
  UNIQUE (tenant_id, definition_hash),
  FOREIGN KEY (tenant_id) REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  CHECK (definition->>'schemaVersion' = 'procedure-definition.v1')
);

CREATE INDEX IF NOT EXISTS procedure_definitions_tenant_scope_idx
  ON procedure_admission.definitions(tenant_id, authority_scope);

CREATE TABLE IF NOT EXISTS procedure_admission.admission_records (
  tenant_id                 TEXT        NOT NULL,
  authority_scope           TEXT        NOT NULL,
  sequence                  BIGINT      NOT NULL CHECK (sequence > 0),
  admission_id              TEXT        NOT NULL,
  procedure_id              TEXT        NOT NULL,
  procedure_version         INTEGER     NOT NULL CHECK (procedure_version > 0),
  run_id                    TEXT        NOT NULL,
  decision                  TEXT        NOT NULL CHECK (decision IN ('admitted', 'rejected')),
  admitted_at               TIMESTAMPTZ NOT NULL,
  admitted_by               TEXT        NOT NULL,
  previous_admission_hash   TEXT,
  admission_hash            TEXT        NOT NULL,
  run_hash                  TEXT        NOT NULL,
  record                    JSONB       NOT NULL,
  PRIMARY KEY (tenant_id, authority_scope, sequence),
  UNIQUE (tenant_id, admission_id),
  UNIQUE (tenant_id, authority_scope, admission_hash),
  UNIQUE (tenant_id, authority_scope, run_id),
  FOREIGN KEY (tenant_id) REFERENCES substrate.tenants(id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, procedure_id, procedure_version)
    REFERENCES procedure_admission.definitions(tenant_id, procedure_id, version)
    ON DELETE RESTRICT,
  CHECK (record->>'schemaVersion' = 'procedure-admission-record.v1')
);

CREATE INDEX IF NOT EXISTS procedure_admission_records_procedure_idx
  ON procedure_admission.admission_records(tenant_id, procedure_id, procedure_version);

CREATE INDEX IF NOT EXISTS procedure_admission_records_scope_head_idx
  ON procedure_admission.admission_records(tenant_id, authority_scope, sequence DESC);
