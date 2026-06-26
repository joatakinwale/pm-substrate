-- 0031_agent_state_projection_replay_head_witness_quorum_certificates.sql
-- Durable proof records for settlement-head witness quorum certificates.

CREATE TABLE IF NOT EXISTS agent_state.projection_replay_settlement_head_witness_quorum_certificates (
  tenant_id TEXT NOT NULL,
  quorum_certificate_sequence BIGINT NOT NULL,
  settlement_sequence BIGINT NOT NULL,
  settlement_record_hash TEXT NOT NULL,
  quorum_certificate_hash TEXT NOT NULL,
  authority_topology_hash TEXT,
  certificate JSONB NOT NULL,
  accepted_witness_evidence JSONB NOT NULL,
  authority_epoch_seal JSONB,
  previous_quorum_certificate_record_hash TEXT,
  quorum_certificate_record_hash TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, quorum_certificate_sequence),
  UNIQUE (tenant_id, quorum_certificate_hash),
  UNIQUE (tenant_id, quorum_certificate_record_hash)
);

CREATE INDEX IF NOT EXISTS projection_replay_settlement_head_witness_qc_by_head
  ON agent_state.projection_replay_settlement_head_witness_quorum_certificates (
    tenant_id,
    settlement_sequence,
    settlement_record_hash
  );

COMMENT ON TABLE agent_state.projection_replay_settlement_head_witness_quorum_certificates IS
  'Append-only durable settlement-head witness quorum certificate proof records.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_quorum_certificates.accepted_witness_evidence IS
  'Witness ids, witness ledger sequences, observation hashes, and signatures that support the quorum certificate.';

COMMENT ON COLUMN agent_state.projection_replay_settlement_head_witness_quorum_certificates.authority_epoch_seal IS
  'Optional seal_authority_epoch transition binding this quorum certificate to a finality boundary.';
