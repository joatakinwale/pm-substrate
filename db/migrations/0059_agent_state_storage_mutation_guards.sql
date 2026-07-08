-- 0059_agent_state_storage_mutation_guards.sql
-- Generic storage-level mutation guards for tombstone-gated pruning.

CREATE TABLE IF NOT EXISTS agent_state.storage_mutation_guard_authorizations (
  tenant_id TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  protected_schema TEXT NOT NULL,
  protected_table TEXT NOT NULL,
  operation TEXT NOT NULL,
  authorized_through_sequence BIGINT NOT NULL,
  pruning_tombstone_table TEXT NOT NULL,
  pruning_tombstone_sequence BIGINT NOT NULL,
  pruning_tombstone_record_hash TEXT NOT NULL,
  pruning_admission_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  authorization_hash TEXT NOT NULL,
  PRIMARY KEY (tenant_id, guard_id, operation, authorization_hash),
  UNIQUE (tenant_id, authorization_hash),
  CHECK (operation IN ('DELETE', 'UPDATE')),
  CHECK (authorized_through_sequence >= 0),
  CHECK (pruning_tombstone_sequence >= 0)
);

CREATE INDEX IF NOT EXISTS storage_mutation_guard_authorizations_target_idx
  ON agent_state.storage_mutation_guard_authorizations (
    tenant_id,
    protected_schema,
    protected_table,
    operation,
    authorized_through_sequence
  );

CREATE INDEX IF NOT EXISTS storage_mutation_guard_authorizations_tombstone_idx
  ON agent_state.storage_mutation_guard_authorizations (
    tenant_id,
    pruning_tombstone_table,
    pruning_tombstone_record_hash
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_storage_mutation_guard_authorization_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'storage mutation guard authorizations are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_storage_mutation_guard_authorization_rewrite
  ON agent_state.storage_mutation_guard_authorizations;

CREATE TRIGGER prevent_storage_mutation_guard_authorization_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.storage_mutation_guard_authorizations
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_storage_mutation_guard_authorization_rewrite();

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
     WHERE a.tenant_id = target_tenant
       AND a.guard_id = guard_id
       AND a.protected_schema = TG_TABLE_SCHEMA
       AND a.protected_table = TG_TABLE_NAME
       AND a.operation = TG_OP
       AND a.authorization_hash = authorization_hash
       AND a.authorized_through_sequence >= target_sequence
  ) THEN
    RAISE EXCEPTION 'storage mutation on %.% sequence % is not authorized by tombstone guard %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, target_sequence, guard_id
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON TABLE agent_state.storage_mutation_guard_authorizations IS
  'Append-only storage mutation authorizations. Protected UPDATE/DELETE triggers require one of these tombstone-derived authorization hashes in the current transaction before physical mutation can occur.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorizations.authorization_hash IS
  'Deterministic hash over tenant, guard id, protected table, operation, authorized sequence frontier, tombstone record, pruning admission, and recorded_at. Application replay must recompute this before setting pm_substrate.storage_mutation_authorization_hash.';

COMMENT ON FUNCTION agent_state.enforce_storage_mutation_guard() IS
  'Generic trigger used by compiled storage mutation guards. It blocks protected UPDATE/DELETE unless the transaction presents a matching append-only tombstone-derived authorization hash.';
