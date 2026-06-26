-- 0019_event_sequence.sql
--
-- Fix: deterministic, monotonic event ordering for hash-chain provenance.
--
-- Events published inside one transaction share a frozen now() for
-- recorded_at (Postgres freezes now() per transaction). Both the publish-time
-- prior-event lookup and verifyChain() tie-broke on the random event id, so
-- any multi-event transaction could fork the per-tenant hash chain
-- (two events claiming the same prior). Surfaced by the ArrowHedge adapter
-- DB proof, which publishes 13 events in a single ingestion transaction.
--
-- A global monotonic sequence gives publish and verification a total order
-- that matches insertion order regardless of timestamp ties.

CREATE SEQUENCE IF NOT EXISTS events.events_seq;

ALTER TABLE events.events
  ADD COLUMN IF NOT EXISTS seq BIGINT NOT NULL DEFAULT nextval('events.events_seq');

-- Backfill determinism note: existing rows received sequence values during the
-- ALTER in physical order. Re-number them in (recorded_at, id) order so
-- pre-migration history verifies in the same order it previously read back.
WITH ordered AS (
  SELECT recorded_at, id,
         row_number() OVER (ORDER BY recorded_at ASC, id ASC) AS rn
    FROM events.events
)
UPDATE events.events e
   SET seq = ordered.rn
  FROM ordered
 WHERE e.recorded_at = ordered.recorded_at AND e.id = ordered.id;

-- Keep the sequence ahead of all backfilled values.
SELECT setval(
  'events.events_seq',
  GREATEST((SELECT COALESCE(MAX(seq), 0) FROM events.events), 1)
);

CREATE INDEX IF NOT EXISTS events_tenant_seq_idx
  ON events.events (tenant_id, seq);
