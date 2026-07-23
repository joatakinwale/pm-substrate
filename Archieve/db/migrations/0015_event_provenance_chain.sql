-- 0015_event_provenance_chain.sql
-- ADR-0030 — event-log provenance / chain-of-custody metadata.
--
-- The event log is not just a message bus; it is the substrate's record of
-- coordinated reality under change. These columns make every event
-- individually attributable and chain-verifiable without interpreting the
-- payload.

ALTER TABLE events.events
  ADD COLUMN IF NOT EXISTS schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS authority TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS prior_event_hash TEXT;

CREATE INDEX IF NOT EXISTS events_tenant_hash_idx
  ON events.events(tenant_id, content_hash)
  WHERE content_hash IS NOT NULL;

COMMENT ON COLUMN events.events.schema_version IS
  'ADR-0030: event envelope schema version. Distinct from payload_schema.';
COMMENT ON COLUMN events.events.authority IS
  'ADR-0030: capability, permission grant, or external authority under which this event was admitted.';
COMMENT ON COLUMN events.events.content_hash IS
  'ADR-0030: sha256 over canonical event envelope fields for chain-of-custody verification.';
COMMENT ON COLUMN events.events.prior_event_hash IS
  'ADR-0030: content_hash of the immediately prior recorded event for this tenant, if one exists.';
