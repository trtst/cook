#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/local/restart-all.sh
  ./scripts/local/restart-all.sh --with-worker
  ./scripts/local/restart-all.sh api admin

Notes:
  - 默认服务: api client admin site
  - 只重启开发态服务，不执行 build
  - 启动命令走 pnpm dev:*，保留各应用现有热更新能力
  - `--with-worker` 仅在未显式传服务名时追加 worker
EOF
}

services=()
include_worker=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --with-worker)
      include_worker=1
      ;;
    -h|--help|help)
      usage
      exit 0
      ;;
    *)
      if ! is_service "$1"; then
        printf 'Unknown service or option: %s\n' "$1" >&2
        usage >&2
        exit 1
      fi
      services+=("$1")
      ;;
  esac
  shift
done

if [ "${#services[@]}" -eq 0 ]; then
  while IFS= read -r service; do
    services+=("$service")
  done < <(default_services)
  if [ "$include_worker" -eq 1 ]; then
    services+=("worker")
  fi
fi

ensure_run_dirs

printf '[local] target services: %s\n' "${services[*]}"

for service in "${services[@]}"; do
  stop_service "$service"
done

mark_restart

for service in "${services[@]}"; do
  start_service "$service"
done

for service in "${services[@]}"; do
  if ! wait_for_service "$service"; then
    printf '[local] warning: %s did not become ready in time, inspect %s\n' "$service" "$(log_file "$service")"
  fi
done

for service in "${services[@]}"; do
  print_service_status "$service"
done
