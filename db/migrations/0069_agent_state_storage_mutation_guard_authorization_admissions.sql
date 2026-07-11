-- 0069_agent_state_storage_mutation_guard_authorization_admissions.sql
-- Durable admission records for storage mutation guard authorizations.

CREATE TABLE IF NOT EXISTS agent_state.storage_mutation_guard_authorization_admission_records (
  tenant_id TEXT NOT NULL,
  guard_id TEXT NOT NULL,
  protected_schema TEXT NOT NULL,
  protected_table TEXT NOT NULL,
  operation TEXT NOT NULL,
  admission_sequence BIGINT NOT NULL CHECK (admission_sequence >= 1),
  authorization_hash TEXT NOT NULL,
  previous_admission_record_hash TEXT,
  authorization JSONB NOT NULL,
  admission_procedure_id TEXT NOT NULL,
  admission_role TEXT NOT NULL,
  admitted_at TIMESTAMPTZ NOT NULL,
  admitted_by TEXT NOT NULL,
  admission_reason TEXT,
  admission_record_hash TEXT NOT NULL,
  PRIMARY KEY (
    tenant_id,
    guard_id,
    protected_schema,
    protected_table,
    operation,
    admission_sequence
  ),
  UNIQUE (
    tenant_id,
    guard_id,
    protected_schema,
    protected_table,
    operation,
    authorization_hash
  ),
  UNIQUE (tenant_id, admission_record_hash),
  CHECK (operation IN ('DELETE', 'UPDATE'))
);

CREATE INDEX IF NOT EXISTS storage_mutation_guard_authorization_admission_target_idx
  ON agent_state.storage_mutation_guard_authorization_admission_records (
    tenant_id,
    guard_id,
    protected_schema,
    protected_table,
    operation,
    admission_sequence
  );

CREATE OR REPLACE FUNCTION agent_state.prevent_storage_mutation_guard_authorization_admission_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'storage mutation guard authorization admission records are append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS prevent_storage_mutation_guard_authorization_admission_rewrite
  ON agent_state.storage_mutation_guard_authorization_admission_records;

CREATE TRIGGER prevent_storage_mutation_guard_authorization_admission_rewrite
  BEFORE UPDATE OR DELETE ON agent_state.storage_mutation_guard_authorization_admission_records
  FOR EACH ROW
  EXECUTE FUNCTION agent_state.prevent_storage_mutation_guard_authorization_admission_rewrite();

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
        SELECT r.authorization_hash
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
     WHERE a.tenant_id = target_tenant
       AND a.guard_id = guard_id
       AND a.protected_schema = TG_TABLE_SCHEMA
       AND a.protected_table = TG_TABLE_NAME
       AND a.operation = TG_OP
       AND a.authorization_hash = authorization_hash
       AND a.authorized_through_sequence >= target_sequence
  ) THEN
    RAISE EXCEPTION 'storage mutation on %.% sequence % is not authorized by latest admitted tombstone guard %',
      TG_TABLE_SCHEMA, TG_TABLE_NAME, target_sequence, guard_id
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE INSERT, UPDATE, DELETE ON agent_state.storage_mutation_guard_authorizations FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON agent_state.storage_mutation_guard_authorization_admission_records FROM PUBLIC;

COMMENT ON TABLE agent_state.storage_mutation_guard_authorization_admission_records IS
  'Append-only admission records for storage mutation guard authorizations. A row in storage_mutation_guard_authorizations is not sufficient authority by itself; protected UPDATE/DELETE checks require the authorization hash to be the latest admitted record for the tenant, guard, table, and operation.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorization_admission_records.authorization IS
  'Canonical storage mutation guard authorization payload admitted by the guard admission procedure. Replay must recompute the embedded authorization hash and the admission record hash.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorization_admission_records.admission_procedure_id IS
  'Identifier for the well-formed transaction procedure that admitted this authorization. Deployments should grant INSERT on guard authorization tables only to a SECURITY DEFINER procedure that writes both authorization and admission rows.';

COMMENT ON COLUMN agent_state.storage_mutation_guard_authorization_admission_records.admission_role IS
  'Database role under which the guard authorization was admitted. Replay can require this role so application writers cannot mint guard authorization rows directly.';

COMMENT ON FUNCTION agent_state.enforce_storage_mutation_guard() IS
  'Generic trigger used by compiled storage mutation guards. It blocks protected UPDATE/DELETE unless the transaction presents a matching tombstone-derived authorization hash that is also the latest replayed guard authorization admission record.';
