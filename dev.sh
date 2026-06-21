#!/usr/bin/env bash

set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"
FRONTEND_DIR="$ROOT_DIR/frontend"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Required command not found: $1" >&2
    exit 1
  }
}

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${FRONTEND_PID:-}" ]]; then
    kill "$FRONTEND_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

require_command npm

[[ -d "$SERVER_DIR" ]] || { echo "Missing server directory: $SERVER_DIR" >&2; exit 1; }
[[ -d "$FRONTEND_DIR" ]] || { echo "Missing frontend directory: $FRONTEND_DIR" >&2; exit 1; }

echo "Starting backend dev server..."
(
  cd "$SERVER_DIR"
  npm run dev
) &
SERVER_PID=$!

echo "Starting frontend dev server..."
(
  cd "$FRONTEND_DIR"
  npm run dev
) &
FRONTEND_PID=$!

echo "Backend PID: $SERVER_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Press Ctrl+C to stop both."

wait "$SERVER_PID" "$FRONTEND_PID"
