#!/usr/bin/env bash
# One-shot deploy: Supabase migrations → web build → Cloudflare Worker → runtime secrets
# → Supabase Auth settings → .env for the iOS shell (and, on a Mac, open Xcode).
#
# Run it on your Mac:   bun run deploy:all
# It asks for what it needs. Everything can also come from environment variables:
#   SUPABASE_ANON_KEY          Project settings → API Keys → anon / publishable   (asked if missing)
#   SUPABASE_SERVICE_ROLE_KEY  Project settings → API Keys → service_role / secret (asked if missing)
#   SUPABASE_DB_PASSWORD       database password (the Supabase CLI asks if missing)
#   SUPABASE_ACCESS_TOKEN      optional — otherwise `supabase login` opens the browser;
#                              with it the script also applies the Auth settings for you
#   CLOUDFLARE_API_TOKEN (+ CLOUDFLARE_ACCOUNT_ID)  optional — otherwise `wrangler login` opens the browser
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL  optional — custom SMTP for auth emails;
#                              with them email confirmation is turned ON, without them it stays OFF
#                              (Supabase's built-in mailer only reaches members of your organisation)
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="gqmzxxygegmlifeewbzy"
SUPABASE_URL="https://${PROJECT_REF}.supabase.co"

ask_secret() { # name, prompt
  if [ -z "${!1:-}" ]; then
    read -r -s -p "$2: " value; echo
    [ -n "$value" ] || { echo "  $1 is required" >&2; exit 1; }
    printf -v "$1" '%s' "$value"
  fi
}
ask_secret SUPABASE_ANON_KEY "Supabase anon / publishable key"
ask_secret SUPABASE_SERVICE_ROLE_KEY "Supabase service_role / secret key (stays on Cloudflare)"

echo "▸ 1/6 Database migrations"
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ]; then export SUPABASE_ACCESS_TOKEN; else npx --yes supabase login; fi
PW_ARGS=()
[ -n "${SUPABASE_DB_PASSWORD:-}" ] && PW_ARGS=(--password "$SUPABASE_DB_PASSWORD")
npx --yes supabase link --project-ref "$PROJECT_REF" ${PW_ARGS[@]+"${PW_ARGS[@]}"}
npx --yes supabase db push --include-all ${PW_ARGS[@]+"${PW_ARGS[@]}"}

echo "▸ 2/6 Build (only public values are baked into the client)"
VITE_SUPABASE_URL="$SUPABASE_URL" \
VITE_SUPABASE_PUBLISHABLE_KEY="$SUPABASE_ANON_KEY" \
VITE_SUPABASE_PROJECT_ID="$PROJECT_REF" \
  bun run build

echo "▸ 3/6 Deploy to Cloudflare"
if [ -n "${CLOUDFLARE_API_TOKEN:-}" ]; then
  export CLOUDFLARE_API_TOKEN
  [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] && export CLOUDFLARE_ACCOUNT_ID
elif ! npx wrangler whoami 2>/dev/null | grep -q "You are logged in"; then
  npx wrangler login
fi
DEPLOY_LOG="$(mktemp)"
npx wrangler deploy | tee "$DEPLOY_LOG"
APP_URL="$(grep -Eo 'https://[a-zA-Z0-9.-]+\.workers\.dev' "$DEPLOY_LOG" | head -1 || true)"

echo "▸ 4/6 Runtime secrets (SUPABASE_URL is a plain var in wrangler.jsonc)"
put() { printf '%s' "$2" | npx wrangler secret put "$1" >/dev/null && echo "  set $1"; }
put SUPABASE_PUBLISHABLE_KEY "$SUPABASE_ANON_KEY"
put SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"

echo "▸ 5/6 Auth settings (redirect URLs + security)"
AUTH_JSON='"password_min_length":8,"mailer_secure_email_change_enabled":true,"security_update_password_require_reauthentication":true,"security_refresh_token_reuse_interval":10,"refresh_token_rotation_enabled":true'
if [ -n "${SMTP_HOST:-}" ] && [ -n "${SMTP_PASS:-}" ]; then
  AUTH_JSON="${AUTH_JSON},\"mailer_autoconfirm\":false,\"smtp_host\":\"${SMTP_HOST}\",\"smtp_port\":\"${SMTP_PORT:-587}\",\"smtp_user\":\"${SMTP_USER:-}\",\"smtp_pass\":\"${SMTP_PASS}\",\"smtp_admin_email\":\"${SMTP_SENDER_EMAIL:-${SMTP_USER:-}}\",\"smtp_sender_name\":\"Speak\",\"rate_limit_email_sent\":100"
else
  AUTH_JSON="${AUTH_JSON},\"mailer_autoconfirm\":true"
fi
if [ -n "$APP_URL" ]; then
  AUTH_JSON="${AUTH_JSON},\"site_url\":\"${APP_URL}\",\"uri_allow_list\":\"${APP_URL}/**,courtsie://**\""
fi
if [ -n "${SUPABASE_ACCESS_TOKEN:-}" ] && curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
     -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" -H "Content-Type: application/json" \
     -d "{${AUTH_JSON}}" >/dev/null; then
  echo "  auth settings updated"
else
  echo "  ! Set these by hand in Supabase → Authentication:"
  echo "    URL Configuration: Site URL = ${APP_URL:-<your workers.dev URL>}"
  echo "                       Redirect URLs = ${APP_URL:-<url>}/**  and  courtsie://**"
  echo "    Sign In / Providers → Email: minimum password length 8; Confirm email ON only with custom SMTP"
fi

echo "▸ 6/6 .env for the iOS app (public values only)"
touch .env
set_env() { # key, value — replace or append
  grep -v "^$1=" .env > .env.tmp || true
  printf '%s="%s"\n' "$1" "$2" >> .env.tmp
  mv .env.tmp .env
}
set_env VITE_SUPABASE_URL "$SUPABASE_URL"
set_env VITE_SUPABASE_PUBLISHABLE_KEY "$SUPABASE_ANON_KEY"
[ -n "$APP_URL" ] && set_env CAP_SERVER_URL "$APP_URL"
grep -q '^CAP_APP_ID=' .env || set_env CAP_APP_ID "gr.innera.courtsie"

echo
echo "✔ Web app live: ${APP_URL:-<see wrangler output above>}"
if [ "$(uname)" = "Darwin" ] && [ -n "$APP_URL" ]; then
  bun run ios:sync
  bun run ios:open
  echo "  Xcode is opening — pick a simulator or your iPhone and press ▶ (see docs/ios-setup.md §4)."
fi
