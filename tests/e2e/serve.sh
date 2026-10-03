#!/bin/bash
S="$(cd "$(dirname "$0")" && pwd)"
# The keys below are LOCAL-ONLY JWTs signed with the local dev secret (tests/e2e/pgrst/postgrest.conf), not credentials.
# Start the built worker on port $1 against the local Supabase stack.
cd "$S/../.."
(timeout 1500 ./node_modules/.bin/wrangler dev --port $1 --ip 127.0.0.1 --var EMAIL_DEV_LOG:1 --var SUPABASE_URL:http://127.0.0.1:54321 --var SUPABASE_PUBLISHABLE_KEY:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTA2MTM1MTIsImV4cCI6MTc5MzIwNTUxMiwicm9sZSI6ImFub24ifQ.4d3fFF6_EeXd3DCqgETUhOqeCYz0ZI21LhKlMoPedlo --var SUPABASE_SERVICE_ROLE_KEY:eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3OTA2MTM1MTIsImV4cCI6MTc5MzIwNTUxMiwicm9sZSI6InNlcnZpY2Vfcm9sZSJ9.UgILae8oVVF_j2fWtDQ_H3KIzweND-FZvTer_tWrNGk > $S/wrangler-$1.log 2>&1 &)
for i in $(seq 1 60); do curl -s -o /dev/null http://127.0.0.1:$1/ && break; sleep 1; done
