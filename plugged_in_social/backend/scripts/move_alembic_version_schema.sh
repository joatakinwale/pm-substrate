#!/usr/bin/env bash
# move_alembic_version_schema.sh
#
# One-time cutover: move alembic_version out of `public` into a private
# `alembic` schema, then PluggedInSocial's backend/alembic/env.py (which
# is already configured with version_table_schema="alembic") will pick it
# up cleanly on the next `alembic upgrade head`.
#
# Why: Supabase exposes everything in `public` through PostgREST and
# requires RLS or schema-segregation for any table that lives there.
# alembic_version is migration metadata, not application data — it should
# not be in `public` at all. (Companion to ADR-style note in PR
# description.)
#
# Idempotent: safe to re-run. Checks state before each step.
#
# Required env vars:
#   DATABASE_URL_SYNC  Postgres connection string (the same Alembic uses).
#
# Usage:
#   DATABASE_URL_SYNC=postgresql+psycopg://... ./move_alembic_version_schema.sh
#   OR with a docker-exec psql wrapper:
#     docker exec pm-substrate-postgres bash -c 'PGURL=... /path/to/script'

set -euo pipefail

if [[ -z "${DATABASE_URL_SYNC:-}" ]]; then
  echo "ERROR: DATABASE_URL_SYNC not set." >&2
  echo "       Export it (matches the value used by backend/alembic/env.py)." >&2
  exit 1
fi

# Strip SQLAlchemy driver prefix if present (psql wants raw libpq URL).
PG_URL="${DATABASE_URL_SYNC#postgresql+psycopg://}"
PG_URL="${PG_URL#postgresql+asyncpg://}"
PG_URL="postgresql://${PG_URL}"

run_sql() {
  if command -v psql >/dev/null 2>&1; then
    psql "$PG_URL" -v ON_ERROR_STOP=1 -tA -c "$1"
  elif docker ps --format '{{.Names}}' | grep -q pm-substrate-postgres; then
    docker exec pm-substrate-postgres psql "$PG_URL" -v ON_ERROR_STOP=1 -tA -c "$1"
  else
    echo "ERROR: no psql binary and no pm-substrate-postgres docker container available." >&2
    exit 1
  fi
}

echo "── Step 1: ensure 'alembic' schema exists ──"
run_sql "CREATE SCHEMA IF NOT EXISTS alembic;"
echo "ok."

echo "── Step 2: check current location of alembic_version ──"
CURRENT_SCHEMA="$(run_sql "SELECT table_schema FROM information_schema.tables WHERE table_name='alembic_version' ORDER BY (table_schema='public') DESC, table_schema LIMIT 1;")"
CURRENT_SCHEMA="$(echo "$CURRENT_SCHEMA" | tr -d '[:space:]')"
echo "current schema: '${CURRENT_SCHEMA:-<not found>}'"

if [[ -z "$CURRENT_SCHEMA" ]]; then
  echo "── Step 3: alembic_version does not exist yet (fresh DB?). Nothing to move. ──"
  echo "When the next alembic upgrade runs, it will create alembic.alembic_version directly."
  exit 0
fi

if [[ "$CURRENT_SCHEMA" == "alembic" ]]; then
  echo "── Step 3: already in alembic schema. Nothing to do. ──"
  exit 0
fi

if [[ "$CURRENT_SCHEMA" != "public" ]]; then
  echo "WARN: alembic_version is in unexpected schema '$CURRENT_SCHEMA'. Refusing to move automatically." >&2
  echo "      Inspect manually and migrate by hand." >&2
  exit 2
fi

echo "── Step 3: move public.alembic_version → alembic.alembic_version ──"
run_sql "ALTER TABLE public.alembic_version SET SCHEMA alembic;"

echo "── Step 4: verify ──"
NEW_SCHEMA="$(run_sql "SELECT table_schema FROM information_schema.tables WHERE table_name='alembic_version';")"
NEW_SCHEMA="$(echo "$NEW_SCHEMA" | tr -d '[:space:]')"
VERSION="$(run_sql "SELECT version_num FROM alembic.alembic_version;")"
VERSION="$(echo "$VERSION" | tr -d '[:space:]')"
echo "alembic_version now in schema: '$NEW_SCHEMA' (version=$VERSION)"

if [[ "$NEW_SCHEMA" != "alembic" ]]; then
  echo "ERROR: move did not land in alembic schema. Got '$NEW_SCHEMA'." >&2
  exit 3
fi

echo ""
echo "✓ Done. Next \`alembic upgrade head\` will use alembic.alembic_version automatically"
echo "  (backend/alembic/env.py sets version_table_schema=\"alembic\")."
echo ""
echo "Optional follow-up: the Supabase lint item 'RLS Disabled in Public' for"
echo "alembic_version will now clear permanently — the table is no longer in the"
echo "public schema PostgREST exposes."
