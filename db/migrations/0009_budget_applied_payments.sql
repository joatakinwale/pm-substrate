-- 0009_budget_applied_payments.sql
-- Idempotency guard table for the @pm/capability-wedding-budget rollup handler.
--
-- When `wedding.contract.payment_recorded` arrives, the handler inserts a row
-- here (inside its main transaction) before incrementing
-- BudgetCategory.actualSpentMinor. The PRIMARY KEY on (tenant_id, payment_id)
-- makes double-application a conflict: ON CONFLICT DO NOTHING returns rowCount=0
-- and the handler exits cleanly without a second rollup.
--
-- Atomicity: the INSERT into applied_payments and the UPDATE on graph.nodes
-- (plus the events.events append) all run in the same Postgres transaction.
-- If any step fails, all three are rolled back together. See ADR-0010.
--
-- Capability-private: only @pm/capability-wedding-budget reads or writes this
-- table. The substrate's graph and events layers are profile-blind; this table
-- is the capability's own state, not a shared substrate primitive.

CREATE SCHEMA IF NOT EXISTS budget;

CREATE TABLE IF NOT EXISTS budget.applied_payments (
  tenant_id  TEXT        NOT NULL,
  payment_id TEXT        NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, payment_id)
);

CREATE INDEX IF NOT EXISTS applied_payments_tenant_idx
  ON budget.applied_payments(tenant_id);
