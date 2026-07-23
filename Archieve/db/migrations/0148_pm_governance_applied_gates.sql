-- 0148_pm_governance_applied_gates.sql
-- Idempotency guard table for @pm/capability-pm-stage-gate (refactor plan
-- Phase 2). Same ADR-0010 pattern as 0009 (budget) and 0010 (lead scoring):
-- a Tier-2 governance capability owns its private schema; the substrate's
-- graph and events layers stay profile-blind.
--
-- PARTITION CHECK (ADR-0005 standing rule): NOT range-partitioned — small
-- idempotency lookup, point access by PRIMARY KEY, same reasoning as 0009/0010.
--
-- The stage-gate handler inserts (tenant_id, gate_event_id) inside its main
-- transaction before advancing WorkItem.state; INSERT ... ON CONFLICT DO
-- NOTHING makes double-application a clean no-op, and the lifecycle UPDATE,
-- this INSERT, and the events append commit or roll back together.

CREATE SCHEMA IF NOT EXISTS pm_governance;

CREATE TABLE IF NOT EXISTS pm_governance.applied_gate_events (
  tenant_id      TEXT        NOT NULL,
  gate_event_id  TEXT        NOT NULL,
  applied_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, gate_event_id)
);

CREATE INDEX IF NOT EXISTS applied_gate_events_tenant_idx
  ON pm_governance.applied_gate_events(tenant_id);
