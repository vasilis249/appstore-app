#!/bin/bash
# (Re)start PostgREST + local Supabase proxy; pids in $S/*.pid
S="$(cd "$(dirname "$0")" && pwd)"
for f in $S/pgrst.pid $S/proxy.pid; do [ -f $f ] && kill $(cat $f) 2>/dev/null; done
sleep 1
cd $S/pgrst && (./postgrest postgrest.conf > $S/pgrst.log 2>&1 & echo $! > $S/pgrst.pid)
(node $S/local-supabase.mjs > $S/local-supabase.log 2>&1 & echo $! > $S/proxy.pid)
sleep 2
curl -s -o /dev/null -w "proxy:%{http_code}\n" http://127.0.0.1:54321/auth/v1/health
