#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

WEB_PORT=3000
API_PORT=3001
ML_PORT=8000

ML_DIR="$ROOT_DIR/apps/ml"

PIDS=()

fail() {
  printf '\n[MindRoute ERROR] %s\n' "$1" >&2
  exit 1
}

cleanup() {
  printf '\n[MindRoute] Stopping services...\n'

  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
}

trap 'cleanup; exit 0' INT TERM

kill_port() {
  local port="$1"

  echo "[MindRoute] Checking port $port..."

  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti :"$port" 2>/dev/null || true)"

    if [[ -n "$pids" ]]; then
      echo "[MindRoute] Port $port is occupied. Stopping old process..."
      kill -9 $pids 2>/dev/null || true
      sleep 1
    fi

  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true

  else
    echo "[MindRoute] Could not automatically check port $port."
  fi
}

prefix() {
  local name="$1"

  while IFS= read -r line; do
    printf '[%s] %s\n' "$name" "$line"
  done
}

command -v node >/dev/null 2>&1 || fail "Node.js is required."
command -v pnpm >/dev/null 2>&1 || fail "pnpm is required."

[[ -d "$ROOT_DIR/apps/web" ]] || fail "apps/web not found."
[[ -d "$ROOT_DIR/apps/api" ]] || fail "apps/api not found."
[[ -d "$ML_DIR" ]] || fail "apps/ml not found."

if [[ -x "$ML_DIR/.venv/bin/python" ]]; then
  ML_PYTHON="$ML_DIR/.venv/bin/python"
elif [[ -f "$ML_DIR/.venv/Scripts/python.exe" ]]; then
  ML_PYTHON="$ML_DIR/.venv/Scripts/python.exe"
else
  fail "ML virtual environment not found.

Create it first:

macOS/Linux:
  python3 -m venv apps/ml/.venv

Windows:
  py -m venv apps/ml/.venv"
fi

echo ""
echo "========================================"
echo "       MindRoute Development"
echo "========================================"
echo ""

echo "[MindRoute] Freeing fixed development ports..."

kill_port "$WEB_PORT"
kill_port "$API_PORT"
kill_port "$ML_PORT"

echo ""
echo "Frontend:   http://localhost:$WEB_PORT"
echo "Backend:    http://localhost:$API_PORT"
echo "API Health: http://localhost:$API_PORT/api/health"
echo "ML API:     http://localhost:$ML_PORT"
echo "ML Health:  http://localhost:$ML_PORT/health"
echo ""
echo "Press Ctrl+C to stop everything."
echo "========================================"
echo ""

(
  cd "$ROOT_DIR"

  pnpm --filter web dev \
    > >(prefix "WEB") \
    2> >(prefix "WEB" >&2)
) &

PIDS+=("$!")

(
  cd "$ROOT_DIR"

  PORT="$API_PORT" pnpm --filter api dev \
    > >(prefix "API") \
    2> >(prefix "API" >&2)
) &

PIDS+=("$!")

(
  cd "$ML_DIR"

  "$ML_PYTHON" -m uvicorn src.main:app \
    --host 0.0.0.0 \
    --port "$ML_PORT" \
    --reload \
    > >(prefix "ML") \
    2> >(prefix "ML" >&2)
) &

PIDS+=("$!")

wait "${PIDS[@]}"