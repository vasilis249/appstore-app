#!/usr/bin/env bash
# Local database tests without Docker: a throwaway Postgres 16 DB with Supabase-like
# stubs (auth/storage/realtime schemas, anon/authenticated/service_role), all migrations,
# then each suite prints PASS/FAIL lines. Usage:
#   PGHOST=/tmp PGPORT=54329 PGUSER=postgres bash supabase/tests/run.sh
set -uo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-courtsie_test}
fail=0
for suite in supabase/tests/test_*.sql; do
  psql -q -c "select pg_terminate_backend(pid) from pg_stat_activity where datname = '$DB' and pid <> pg_backend_pid()" >/dev/null
  psql -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB" -c "create database $DB" >/dev/null || exit 1
  psql -q -d "$DB" -f supabase/tests/supabase_stubs.sql >/dev/null 2>&1
  for m in supabase/migrations/*.sql; do
    psql -q -v ON_ERROR_STOP=1 -d "$DB" -1 -f "$m" >/dev/null 2>/tmp/courtsie-migration.err \
      || { echo "migration failed: $m"; grep -v NOTICE /tmp/courtsie-migration.err; exit 1; }
  done
  out=$(psql -q -d "$DB" -f "$suite" 2>&1)
  pass=$(grep -c PASS <<<"$out"); failed=$(grep -c FAIL <<<"$out")
  echo "$(basename "$suite"): PASS $pass FAIL $failed"
  grep FAIL <<<"$out"
  [ "$failed" -eq 0 ] || fail=1
done
exit $fail
