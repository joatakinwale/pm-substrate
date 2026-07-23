-- 0054_agent_state_history_store_head_pruning_tombstone_store_head_witness_quorum_certificates.sql
-- Durable proof records for history-store-head pruning tombstone-store head
-- witness quorum certificates.

CREATE TABLE IF NOT EXISTS agent_state.pt_hsh_ptsh_witness_quorum_certificates (
  tenant_id                                 TEXT NOT NULL,
  quorum_certificate_sequence               BIGINT NOT NULL,
  pruning_tombstone_sequence                BIGINT NOT NULL,
  pruning_tombstone_record_hash             TEXT NOT NULL,
  quorum_certificate_hash                   TEXT NOT NULL,
  authority_topology_hash                   TEXT,
  certificate                               JSONB NOT NULL,
  accepted_witness_evidence                 JSONB NOT NULL,
  authority_epoch_seal                      JSONB,
  previous_quorum_certificate_record_hash   TEXT,
  quorum_certificate_record_hash            TEXT NOT NULL,
  recorded_at                               TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (tenant_id, quorum_certificate_sequence),
  UNIQUE (tenant_id, quorum_certificate_hash),
  UNIQUE (tenant_id, quorum_certificate_record_hash)
);

CREATE INDEX IF NOT EXISTS history_store_head_pruning_tombstone_store_head_witness_qc_by_head
  ON agent_state.pt_hsh_ptsh_witness_quorum_certificates (
    tenant_id,
    pruning_tombstone_sequence,
    pruning_tombstone_record_hash
  );

COMMENT ON TABLE agent_state.pt_hsh_ptsh_witness_quorum_certificates IS
  'Append-only durable proof records for history-store-head pruning tombstone-store head witness quorum certificates.';

COMMENT ON COLUMN agent_state.pt_hsh_ptsh_witness_quorum_certificates.accepted_witness_evidence IS
  'Witness ids, witness ledger sequences, observation hashes, consistency proofs, and signatures that support the history-store-head pruning tombstone-store head quorum certificate.';

COMMENT ON COLUMN agent_state.pt_hsh_ptsh_witness_quorum_certificates.authority_epoch_seal IS
  'Optional seal_authority_epoch transition binding this history-store-head pruning tombstone-store head quorum certificate to an authority finality boundary.';
