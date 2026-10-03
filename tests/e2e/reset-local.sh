#!/bin/bash
S="$(cd "$(dirname "$0")" && pwd)"
# Recreate the local "courtsie" DB (used by PostgREST) with the voice schema + seed users.
cd "$S/../.."
export PGHOST=/tmp PGPORT=54329 PGUSER=postgres
psql -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname='courtsie' and pid<>pg_backend_pid()" >/dev/null
psql -q -c "drop database if exists courtsie with (force)" -c "create database courtsie" >/dev/null || { echo "reset: drop failed"; exit 1; }
psql -q -d courtsie -f supabase/tests/supabase_stubs.sql >/dev/null 2>&1
for m in supabase/migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d courtsie -1 -f $m >/dev/null 2>&1 || echo "failed $m"; done
psql -q -d courtsie -f $S/rt_mock.sql
psql -q -d courtsie -f $S/seed_voice.sql
psql -q -d courtsie -c "NOTIFY pgrst, 'reload schema'"
