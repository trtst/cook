#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_SOURCE="$(cat "$ROOT_DIR/deploy.sh")"
WORKER_CONFIG="$(cat "$ROOT_DIR/apps/worker/ecosystem.config.cjs" 2>/dev/null || true)"

full_start="$(printf '%s\n' "$DEPLOY_SOURCE" | awk '/^    full\)/ { found = 1; next } found && /^      ;;/ { exit } found { print }')"

printf '%s\n' "$full_start" | rg -q 'prepare_worker'
printf '%s\n' "$full_start" | rg -q 'deploy_api'
printf '%s\n' "$full_start" | rg -q 'deploy_worker'

prepare_line="$(printf '%s\n' "$full_start" | rg -n 'prepare_worker' | cut -d: -f1)"
api_line="$(printf '%s\n' "$full_start" | rg -n 'deploy_api' | cut -d: -f1)"
worker_line="$(printf '%s\n' "$full_start" | rg -n 'deploy_worker' | cut -d: -f1)"
(( prepare_line < api_line && api_line < worker_line ))

printf '%s\n' "$WORKER_CONFIG" | rg -q 'name: "cook-worker"'
printf '%s\n' "$WORKER_CONFIG" | rg -q 'node_args:.*apps/worker/\.env|node_args:.*\.env'
printf '%s\n' "$DEPLOY_SOURCE" | rg -q 'ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED=true'
printf '%s\n' "$DEPLOY_SOURCE" | rg -q 'apps/worker/\.env'
printf '%s\n' "$DEPLOY_SOURCE" | rg -q 'pm2 startOrReload'
printf '%s\n' "$DEPLOY_SOURCE" | rg -q 'pm2 save'
printf '%s\n' "$DEPLOY_SOURCE" | rg -q 'pm2 jlist'
printf '%s\n' "$DEPLOY_SOURCE" | rg -q 'status !== "online"'

printf 'deploy worker integration test passed\n'
