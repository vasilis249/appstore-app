#!/bin/bash
# Production deploy (container or Mac). Needs, as environment variables:
#   SUPABASE_ANON_KEY        the project's publishable (anon) key — goes into the client bundle
#   CLOUDFLARE_API_TOKEN     + CLOUDFLARE_ACCOUNT_ID — wrangler (not needed on a Mac where `npx wrangler login` was done)
#   SUPABASE_ACCESS_TOKEN    (only with --migrate) Management API token, applies the given migration files
# Usage:
#   bash scripts/deploy-prod.sh                       # build + checks + deploy the Worker
#   bash scripts/deploy-prod.sh --dry-run             # build + checks only
#   bash scripts/deploy-prod.sh --migrate f1.sql …    # apply these migrations first (each in one transaction), then deploy
# The bundle is refused if it lacks the project URL / anon key, or carries a service-role key or a local URL
# (incident 2026-09-29: a bundle without the Supabase config went live).
set -euo pipefail
cd "$(dirname "$0")/.."
REF=gqmzxxygegmlifeewbzy
URL="https://$REF.supabase.co"
DRY=0; MIG=()
while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=1 ;;
    --migrate) shift; while [ $# -gt 0 ] && [ "${1#--}" = "$1" ]; do MIG+=("$1"); shift; done; continue ;;
    *) echo "unknown argument $1"; exit 2 ;;
  esac
  shift
done
: "${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is not set}"
role=$(cut -d. -f2 <<<"$SUPABASE_ANON_KEY" | tr '_-' '/+' | base64 -d 2>/dev/null | grep -o '"role":"[a-z_]*"' || true)
case "$SUPABASE_ANON_KEY" in sb_publishable_*) ;; *) [ "$role" = '"role":"anon"' ] || { echo "SUPABASE_ANON_KEY is not an anon / publishable key"; exit 1; } ;; esac

if [ ${#MIG[@]} -gt 0 ]; then
  : "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN is not set (needed for --migrate)}"
  for f in "${MIG[@]}"; do
    echo "▸ migration $f"
    body=$(python3 -c 'import json,sys; print(json.dumps({"query": "BEGIN;\n" + open(sys.argv[1]).read() + "\nCOMMIT;"}))' "$f")
    out=$(curl -sS -w '\n%{http_code}' -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
      -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary "$body")
    code=$(tail -n1 <<<"$out")
    [ "$code" = 200 ] || [ "$code" = 201 ] || { echo "  failed ($code): $(head -c 600 <<<"$out")"; exit 1; }
  done
fi

echo "▸ build"
rm -rf .output
VITE_SUPABASE_URL="$URL" VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_ANON_KEY" VITE_SUPABASE_PROJECT_ID="$REF" bun run build >/dev/null
assets=.output/public/assets
grep -rqF "$URL" "$assets" || { echo "bundle has no Supabase URL"; exit 1; }
grep -rqF "$SUPABASE_ANON_KEY" "$assets" || { echo "bundle has no anon key"; exit 1; }
# (supabase-js itself contains the text "sb_secret_" as a prefix check, so look for real keys only)
if grep -rqE '127\.0\.0\.1:5432|sb_secret_[A-Za-z0-9_-]{20,}' "$assets"; then echo "bundle has a local URL or a secret key"; exit 1; fi
for j in $(grep -rohE 'eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+' "$assets" | sort -u); do
  if cut -d. -f2 <<<"$j" | tr '_-' '/+' | base64 -d 2>/dev/null | grep -q '"role":"service_role"'; then echo "bundle has a service-role key"; exit 1; fi
done
echo "  bundle checks ok"

if [ "$DRY" = 1 ]; then npx wrangler deploy --dry-run >/dev/null && echo "▸ dry run ok"; exit 0; fi
echo "▸ deploy"
npx wrangler deploy | grep -E "Uploaded|Deployed|Current Version|https://"
code=$(curl -s -o /dev/null -w '%{http_code}' https://courtsie.vasilis-har.workers.dev/auth)
echo "▸ live /auth → $code"
