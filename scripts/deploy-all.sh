#!/usr/bin/env bash
# One-shot deploy: Supabase migrations → web build → Cloudflare Worker → runtime secrets
# → Supabase Auth redirect URLs. Reads everything from environment variables:
#
#   required: SUPABASE_ACCESS_TOKEN  (supabase.com → Account → Access tokens)
#             SUPABASE_DB_PASSWORD   (Project settings → Database)
#             SUPABASE_ANON_KEY      (Project settings → API → anon/publishable)
#             SUPABASE_SERVICE_ROLE_KEY (Project settings → API → service_role; server only)
#             CLOUDFLARE_API_TOKEN   (Cloudflare → My profile → API tokens → "Edit Cloudflare Workers")
#             CLOUDFLARE_ACCOUNT_ID
#   optional: GOOGLE_MAPS_API_KEY, DEEPL_API_KEY
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="gqmzxxygegmlifeewbzy"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

for v in SUPABASE_ACCESS_TOKEN SUPABASE_DB_PASSWORD SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY \
         CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID; do
  if [ -z "${!v:-}" ]; then echo "Missing env var: $v" >&2; exit 1; fi
done
export SUPABASE_ACCESS_TOKEN CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID

echo "▸ 1/5 Database migrations"
npx --yes supabase link --project-ref "$PROJECT_REF" --password "$SUPABASE_DB_PASSWORD"
npx --yes supabase db push --password "$SUPABASE_DB_PASSWORD" --include-all --yes

echo "▸ 2/5 Build (only public values are baked into the client)"
VITE_SUPABASE_URL="$SUPABASE_URL" \
VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_ANON_KEY" \
VITE_SUPABASE_PROJECT_ID="$PROJECT_REF" \
  bun run build

echo "▸ 3/5 Deploy Worker"
DEPLOY_LOG="$(mktemp)"
npx wrangler deploy | tee "$DEPLOY_LOG"
APP_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"

echo "▸ 4/5 Runtime secrets"
put() { printf '%s' "$2" | npx wrangler secret put "$1" >/dev/null && echo "  set $1"; }
put SUPABASE_URL "$SUPABASE_URL"
put SUPABASE_PUBLISHABLE_KEY "$SUPABASE_ANON_KEY"
put SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
[ -n "${GOOGLE_MAPS_API_KEY:-}" ] && put GOOGLE_MAPS_API_KEY "$GOOGLE_MAPS_API_KEY"
[ -n "${DEEPL_API_KEY:-}" ] && put DEEPL_API_KEY "$DEEPL_API_KEY"

echo "▸ 5/5 Auth settings (redirect URLs + security)"
AUTH_JSON='"password_min_length":8,"mailer_autoconfirm":false,"mailer_secure_email_change_enabled":true,"security_update_password_require_reauthentication":true,"security_refresh_token_reuse_interval":10,"refresh_token_rotation_enabled":true'
if [ -n "$APP_URL" ]; then
  AUTH_JSON="${AUTH_JSON},\"site_url\":\"${APP_URL}\",\"uri_allow_list\":\"${APP_URL}/**,courtsie://**\""
fi
curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" \
  -d "{${AUTH_JSON}}" >/dev/null \
  && echo "  auth settings updated ${APP_URL:+(site URL = ${APP_URL})}" \
  || echo "  ! could not update auth settings — set them in the dashboard (docs/supabase-setup.md)"

echo
echo "✔ Done. Open: ${APP_URL:-<see wrangler output above>}"
echo "  Set CAP_SERVER_URL=${APP_URL:-<url>} in .env before 'bun run ios:sync' on the Mac."
