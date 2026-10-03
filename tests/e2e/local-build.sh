#!/bin/bash
# Build against the local stack and serve it on port $1.
S="$(cd "$(dirname "$0")" && pwd)"
cd "$S/../.."
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/courtsie-test -o '-p 54329 -k /tmp' -l /tmp/pg.log status" >/dev/null 2>&1 || su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/courtsie-test -o '-p 54329 -k /tmp' -l /tmp/pg.log start" >/dev/null
curl -s -o /dev/null http://127.0.0.1:54321/auth/v1/health || bash $S/stack.sh >/dev/null
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTA2MTM1MTIsImV4cCI6MTc5MzIwNTUxMiwicm9sZSI6ImFub24ifQ.4d3fFF6_EeXd3DCqgETUhOqeCYz0ZI21LhKlMoPedlo VITE_SUPABASE_PROJECT_ID=local bun run build > $S/build-local.log 2>&1 || { echo build-failed; tail -20 $S/build-local.log; exit 1; }
bash $S/serve.sh $1
curl -s -o /dev/null -w "serve:%{http_code}\n" http://127.0.0.1:$1/
