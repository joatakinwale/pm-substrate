-- 0003_events_layer.sql
-- Layer 2: append-only event log + subscription registry.
-- LISTEN/NOTIFY drives low-latency fan-out; the events table is the
-- durable record (and the source of truth for projections).

-- Append-only events table. Partition by month; at scale we'll detach
-- old partitions to cold storage (Performance failure mode #5).
CREATE TABLE IF NOT EXISTS events.events (
  id              TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  type            TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  emitted_by      TEXT NOT NULL,
  payload_schema  TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at     TIMESTAMPTZ NOT NULL,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  caused_by       TEXT,
  PRIMARY KEY (recorded_at, id)
) PARTITION BY RANGE (recorded_at);

-- Bootstrap with the first three months. Real partition automation (pg_partman
-- or a periodic substrate job) lands later; manual partitions are fine for now.
CREATE TABLE IF NOT EXISTS events.events_2026_05
  PARTITION OF events.events
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE IF NOT EXISTS events.events_2026_06
  PARTITION OF events.events
  FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE IF NOT EXISTS events.events_2026_07
  PARTITION OF events.events
  FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE INDEX IF NOT EXISTS events_tenant_type_idx  ON events.events(tenant_id, type);
CREATE INDEX IF NOT EXISTS events_tenant_entity_idx ON events.events(tenant_id, entity_id, recorded_at);
CREATE INDEX IF NOT EXISTS events_caused_by_idx     ON events.events(caused_by) WHERE caused_by IS NOT NULL;

-- Declarative subscriptions. Tools register what they care about;
-- the router fans out only to interested subscribers.
CREATE TABLE IF NOT EXISTS events.subscriptions (
  tenant_id              TEXT NOT NULL,
  subscriber_id          TEXT NOT NULL,
  event_type_pattern     TEXT NOT NULL,
  entity_type_filter     TEXT,         -- NULL = no filter
  last_acked_event_id    TEXT,
  last_acked_recorded_at TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, subscriber_id, event_type_pattern)
);

CREATE INDEX IF NOT EXISTS subscriptions_pattern_idx ON events.subscriptions(event_type_pattern);
