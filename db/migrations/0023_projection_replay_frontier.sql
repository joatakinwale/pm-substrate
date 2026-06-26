-- 0023_projection_replay_frontier.sql
--
-- Projection replay identity needs the same admitted ordering as the event
-- chain. recorded_at is useful display metadata, but it is not a stable replay
-- cursor when multiple events share a transaction timestamp.

ALTER TABLE projections.cursors
  ADD COLUMN IF NOT EXISTS last_event_seq BIGINT;

UPDATE projections.cursors c
   SET last_event_seq = e.seq
  FROM events.events e
 WHERE c.last_event_seq IS NULL
   AND c.last_event_id IS NOT NULL
   AND e.tenant_id = c.tenant_id
   AND e.id = c.last_event_id;

CREATE INDEX IF NOT EXISTS projections_cursors_replay_frontier_idx
  ON projections.cursors (tenant_id, projection_name, projection_version, last_event_seq);
