#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="${PM2_APP_NAME:-leadgen-frontend}"
PORT="${PORT:-4173}"
DIST_DIR="dist"

log() {
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$1"
}

fail() {
  printf '\n[ERROR] %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Required command not found: $1"
}

cd "$ROOT_DIR"

require_command node
require_command npm
require_command pm2

log "Checking environment file"
[[ -f ".env" ]] || fail ".env file not found in $ROOT_DIR. Create it before deploying."

log "Validating VITE_API_URL"
API_URL_LINE="$(grep -E '^[[:space:]]*VITE_API_URL=' .env || true)"
[[ -n "$API_URL_LINE" ]] || fail "VITE_API_URL is missing from .env"

API_URL_VALUE="${API_URL_LINE#*=}"
API_URL_VALUE="${API_URL_VALUE%\"}"
API_URL_VALUE="${API_URL_VALUE#\"}"
API_URL_VALUE="${API_URL_VALUE%\'}"
API_URL_VALUE="${API_URL_VALUE#\'}"
[[ -n "$API_URL_VALUE" ]] || fail "VITE_API_URL is empty in .env"

log "Installing packages"
if [[ -f "package-lock.json" ]]; then
  if ! npm ci; then
    log "npm ci failed because the lockfile is out of sync. Falling back to npm install"
    npm install
  fi
else
  npm install
fi

log "Building application"
npm run build

[[ -d "$DIST_DIR" ]] || fail "Build output not found: $DIST_DIR"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "Restarting existing PM2 process: $APP_NAME"
  pm2 restart "$APP_NAME" --update-env
else
  log "Starting new PM2 static server: $APP_NAME"
  pm2 serve "$DIST_DIR" "$PORT" --name "$APP_NAME" --spa
fi

log "Saving PM2 process list"
pm2 save

log "Frontend deployment finished successfully"
