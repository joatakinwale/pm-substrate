-- 0007_events_default_partition.sql
-- Safety net for the events partition strategy.
--
-- ADR-0005 documents the failure mode: PG range partitioning has no implicit
-- catch-all, so any insert with a `recorded_at` outside declared partitions
-- raises "no partition of relation found for row" and breaks the publisher.
--
-- A DEFAULT partition stores rows that match no other partition. The
-- application auto-provisioner creates monthly partitions on demand; the
-- DEFAULT only catches rows that fall outside the auto-provisioner's
-- lookahead (e.g. backdated tests, clock skew, manual data fixes).
--
-- Trade-off: when ATTACHing a new monthly partition, PG must scan the
-- DEFAULT to verify no row belongs in the new range. At day-1 sizes this
-- is negligible; if DEFAULT ever holds many rows, we'll detach + sweep.

CREATE TABLE IF NOT EXISTS events.events_default
  PARTITION OF events.events DEFAULT;
