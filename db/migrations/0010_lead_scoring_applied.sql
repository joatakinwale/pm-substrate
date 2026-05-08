-- 0010_lead_scoring_applied.sql
-- Idempotency guard table for the @pm/capability-agency-lead-scoring handler.
--
-- This is the agency-profile mirror of 0009_budget_applied_payments.sql.
-- Same pattern, different domain. Built as part of the G4 anti-fixation work
-- (research/discovery-engine/pm-substrate-research-gap-audit-2026-05-05.md):
-- a Tier-2 capability owns its own private schema following the same rules
-- the wedding budget capability set in ADR-0010.
--
-- PARTITION CHECK (ADR-0005 standing rule):
-- This table is NOT range-partitioned. Rationale: applied_scoring_events is
-- a small idempotency lookup, not a high-volume time-series. Access is
-- point-lookups by (tenant_id, scoring_event_id) via the PRIMARY KEY.
-- Same reasoning as 0009: ADR-0005 obligation does not apply.
--
-- When `agency.lead.qualified` (or any other lead-scoring trigger) arrives,
-- the handler inserts a row here (inside its main transaction) before
-- updating LeadScoringConfig.currentTotalLeadsScored. The PRIMARY KEY on
-- (tenant_id, scoring_event_id) makes double-application a conflict:
-- ON CONFLICT DO NOTHING returns rowCount=0 and the handler exits cleanly.
--
-- Atomicity: the INSERT into applied_scoring_events and the UPDATE on
-- graph.nodes (plus the events.events append) all run in the same Postgres
-- transaction. If any step fails, all three are rolled back together.
--
-- Capability-private: only @pm/capability-agency-lead-scoring reads or writes
-- this table. The substrate's graph and events layers stay profile-blind.

CREATE SCHEMA IF NOT EXISTS lead_scoring;

CREATE TABLE IF NOT EXISTS lead_scoring.applied_scoring_events (
  tenant_id         TEXT        NOT NULL,
  scoring_event_id  TEXT        NOT NULL,
  applied_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, scoring_event_id)
);

CREATE INDEX IF NOT EXISTS applied_scoring_events_tenant_idx
  ON lead_scoring.applied_scoring_events(tenant_id);
