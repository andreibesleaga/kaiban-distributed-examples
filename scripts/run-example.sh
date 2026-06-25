#!/usr/bin/env bash
# Start / stop a fully-containerised showcase example (redis + gateway + worker
# nodes), then drop you into the orchestrator's interactive TTY for HITL.
#
#   ./scripts/run-example.sh start trip-planning
#   ./scripts/run-example.sh start trip-planning --kafka
#   ./scripts/run-example.sh stop  trip-planning
#
set -euo pipefail

ACTION="${1:-}"
EXAMPLE="${2:-}"
VARIANT="${3:-}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "$ACTION" || -z "$EXAMPLE" ]]; then
  echo "Usage: $0 <start|stop> <example-dir> [--kafka]"
  echo "Examples: trip-planning | social-media-team | rag-knowledge-base"
  exit 1
fi

COMPOSE="$EXAMPLE/docker-compose.yml"
if [[ "$VARIANT" == "--kafka" ]]; then
  COMPOSE="$EXAMPLE/docker-compose.kafka.yml"
fi
[[ -f "$COMPOSE" ]] || { echo "No compose file: $COMPOSE"; exit 1; }

ENV_ARG=()
[[ -f .env ]] && ENV_ARG=(--env-file .env)

case "$ACTION" in
  start)
    echo "▶ Bringing up $EXAMPLE ($COMPOSE) …"
    docker compose -f "$COMPOSE" "${ENV_ARG[@]}" up -d --build
    echo "✓ Stack up. Board: open viewer/board.html (gateway http://localhost:3000)"
    echo "▶ Starting orchestrator (interactive HITL) …"
    docker compose -f "$COMPOSE" "${ENV_ARG[@]}" run --rm orchestrator || true
    ;;
  stop)
    echo "⏹ Stopping $EXAMPLE …"
    docker compose -f "$COMPOSE" "${ENV_ARG[@]}" down -v
    ;;
  *)
    echo "Unknown action: $ACTION (use start|stop)"; exit 1 ;;
esac
