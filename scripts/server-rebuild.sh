#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/workspace/hjhllm}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1/api/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-20}"
HEALTH_DELAY_SECONDS="${HEALTH_DELAY_SECONDS:-2}"

cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "Missing production env file: $APP_DIR/.env" >&2
  exit 1
fi

echo "==> Building and starting services"
docker compose up -d --build

echo "==> Waiting for health check: $HEALTH_URL"
last_status=0
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  if curl -fsS "$HEALTH_URL" >/tmp/hjhllm-health.json; then
    cat /tmp/hjhllm-health.json
    echo
    echo "==> Health check passed"
    docker compose ps
    exit 0
  fi

  last_status=$?
  echo "Health check attempt $attempt/$HEALTH_ATTEMPTS failed; retrying in ${HEALTH_DELAY_SECONDS}s" >&2
  sleep "$HEALTH_DELAY_SECONDS"
done

echo "Health check failed after $HEALTH_ATTEMPTS attempts" >&2
echo "==> Compose status" >&2
docker compose ps >&2 || true
echo "==> Recent backend/frontend logs" >&2
docker compose logs --tail=120 backend frontend >&2 || true
exit "$last_status"
