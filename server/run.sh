#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="${PM2_APP_NAME:-leadgen-backend}"
ENTRY_FILE="dist/index.js"

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
if [[ ! -f ".env" ]]; then
  fail ".env file not found in $ROOT_DIR. Create it before deploying."
fi

log "Installing packages"
if [[ -f "package-lock.json" ]]; then
  npm ci
else
  npm install
fi

log "Generating Prisma client"
npm run prisma:generate

log "Running Prisma production migrations"
npm run prisma:deploy

log "Running seed if needed"
npm run prisma:seed

log "Building application"
npm run build

[[ -f "$ENTRY_FILE" ]] || fail "Build output not found: $ENTRY_FILE"

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  log "Restarting existing PM2 process: $APP_NAME"
  pm2 restart "$APP_NAME" --update-env
else
  log "Starting new PM2 process: $APP_NAME"
  pm2 start "$ENTRY_FILE" --name "$APP_NAME" --time
fi

log "Saving PM2 process list"
pm2 save

log "Deployment finished successfully"
