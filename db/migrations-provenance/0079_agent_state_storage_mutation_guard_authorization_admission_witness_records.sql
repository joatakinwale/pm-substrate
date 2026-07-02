-- 0079_agent_state_storage_mutation_guard_authorization_admission_witness_records.sql
-- Witness-certified accountability records for storage mutation guard authorization admission rows.

CREATE TABLE IF NOT EXISTS agent_state.storage_mutation_guard_authorization_admission_witness_records (
  tenant_id TEXT NOT NULL,
  guard_authorization_admission_witness_store_id TEXT NOT NULL,
  authority_scope TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  protected_schema TEXT NOT NULL,
  protected_table TEXT NOT NULL,
  operation TEXT NOT NULL,
  witness_sequence BIGINT NOT NULL CHECK (witness_sequence >= 1),
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  authorization_hash TEXT NOT NULL,
  admission_record_hash TEXT NOT NULL,
  admission_certificate JSONB NOT NULL,
  previous_witness_record_hash TEXT,
  witnessed_at TIMESTAMPTZ NOT NULL,
  witnessed_by TEXT NOT NULL,
  witness_reason TEXT,
  witness_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    guard_authorization_admission_witness_store_id,
    witness_sequence,
    witness_record_hash
  ),
  UNIQUE (
    tenant_id,
    guard_authorization_admission_witness_store_id,
    admission_record_hash
  ),
  UNIQUE (
    tenant_id,
    guard_authorization_admission_witness_store_id,
    witness_record_hash
  ),
  CHECK (operation IN ('DELETE', 'UPDATE'))
);

CREATE INDEX IF NOT EXISTS storage_mutation_guard_authorization_admission_witness_scope_idx
  ON agent_state.storage_mutation_guard_authorization_admission_witness_records (
    tenant_id,
    guard_authorization_admission_witness_store_id,
    authority_scope,
    witness_sequence
  );

CREATE INDEX IF NOT EXISTS storage_mutation_guard_authorization_admission_witness_target_idx
  ON agent_state.storage_mutation_guard_authorization_admission_witness_records (
    tenant_id,
    guard_id,
    protected_schema,
    protected_table,
    operation,
    admission_sequence,
    admission_record_hash
  );

CREATE INDEX IF NOT EXISTS storage_mutation_guard_authorization_admission_witness_authorization_idx
  ON agent_state.storage_mutation_guard_authorization_admission_witness_records (
    tenant_id,
    authority_scope,
    authorization_hash,
    admission_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_storage_mutation_guard_authorization_admission_witness_record_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'storage mutation guard authorization admission witness records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_storage_mutation_guard_authorization_admission_witness_record_rewrite
  ON agent_state.storage_mutation_guard_authorization_admission_witness_records;

CREATE TRIGGER prevent_storage_mutation_guard_authorization_admission_witness_record_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.storage_mutation_guard_authorization_admission_witness_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_storage_mutation_guard_authorization_admission_witness_record_rewrite();

CREATE OR REPLACE FUNCTION agent_state.enforce_storage_mutation_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  guard_id TEXT;
  tenant_column TEXT;
  sequence_column TEXT;
  setting_name TEXT;
  authorization_hash TEXT;
  target_row JSONB;
  target_tenant TEXT;
  target_sequence_text TEXT;
  target_sequence BIGINT;
BEGIN
  IF TG_NARGS < 3 THEN
    RAISE EXCEPTION 'storage mutation guard requires guard id, tenant column, and sequence column'
      USING ERRCODE = '22023';
  END IF;

  guard_id := TG_ARGV[0];
  tenant_column := TG_ARGV[1];
  sequence_column := TG_ARGV[2];
  setting_name := COALESCE(NULLIF(TG_ARGV[3], ''), 'pm_substrate.storage_mutation_authorization_hash');
  authorization_hash := NULLIF(current_setting(setting_name, true), '');

  IF authorization_hash IS NULL THEN
    RAISE EXCEPTION 'storage mutation on %.% requires tombstone-derived authorization setting %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, setting_name
      USING ERRCODE = '42501';
  END IF;

  target_row := to_jsonb(OLD);
  target_tenant := target_row ->> tenant_column;
  target_sequence_text := target_row ->> sequence_column;

  IF target_tenant IS NULL OR target_sequence_text IS NULL THEN
    RAISE EXCEPTION 'storage mutation guard % cannot read tenant or sequence column from %.%',
      guard_id, TG_TABLE_SCHEMA, TG_TABLE_NAME
      USING ERRCODE = '22023';
  END IF;

  target_sequence := target_sequence_text::BIGINT;

  IF NOT EXISTS (
    SELECT 1
      FROM agent_state.storage_mutation_guard_authorizations a
      JOIN LATERAL (
        SELECT r.authorization_hash, r.admission_record_hash
          FROM agent_state.storage_mutation_guard_authorization_admission_records r
         WHERE r.tenant_id = target_tenant
           AND r.guard_id = guard_id
           AND r.protected_schema = TG_TABLE_SCHEMA
           AND r.protected_table = TG_TABLE_NAME
           AND r.operation = TG_OP
         ORDER BY r.admission_sequence DESC
         LIMIT 1
      ) latest_admission
        ON latest_admission.authorization_hash = a.authorization_hash
      JOIN agent_state.storage_mutation_guard_authorization_admission_witness_records w
        ON w.tenant_id = target_tenant
       AND w.guard_id = guard_id
       AND w.protected_schema = TG_TABLE_SCHEMA
       AND w.protected_table = TG_TABLE_NAME
       AND w.operation = TG_OP
       AND w.authorization_hash = latest_admission.authorization_hash
       AND w.admission_record_hash = latest_admission.admission_record_hash
     WHERE a.tenant_id = target_tenant
       AND a.guard_id = guard_id
       AND a.protected_schema = TG_TABLE_SCHEMA
       AND a.protected_table = TG_TABLE_NAME
       AND a.operation = TG_OP
       AND a.authorization_hash = authorization_hash
       AND a.authorized_through_sequence >= target_sequence
  ) THEN
    RAISE EXCEPTION 'storage mutation on %.% sequence % is not authorized by latest witnessed tombstone guard admission %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, target_sequence, guard_id
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON agent_state.storage_mutation_guard_authorization_admission_witness_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.storage_mutation_guard_authorization_admission_records FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.storage_mutation_guard_authorizations FROM PUBLIC;

COMMENT ON TABLE agent_state.storage_mutation_guard_authorization_admission_witness_records IS
  'Append-only witness accountability records for storage mutation guard authorization admission rows. Strict storage mutation authorization can require this ledger so a guard-admission row is not sufficient unless a quorum certificate witnesses the exact admission record hash.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorization_admission_witness_records.admission_record_hash IS
  'Deterministic hash of the storage mutation guard authorization admission record being witnessed. The admission certificate subject hash must match this value.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorization_admission_witness_records.admission_certificate IS
  'Quorum certificate over the exact guard, protected table, operation, admission sequence, and admission record hash.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorization_admission_witness_records.witness_record_hash IS
  'Deterministic hash of the storage mutation guard authorization admission witness record, including the witness certificate and hash link to the prior witness record.';

COMMENT ON FUNCTION agent_state.enforce_storage_mutation_guard() IS
  'Generic trigger used by compiled storage mutation guards. It blocks protected UPDATE/DELETE unless the transaction presents a matching tombstone-derived authorization hash that is also the latest admitted and witnessed guard authorization admission record.';
