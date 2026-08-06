#!/usr/bin/env bash

set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/common.sh"

usage() {
  cat <<'EOF'
Usage:
  ./scripts/local/build-all.sh
  ./scripts/local/build-all.sh --with-worker
  ./scripts/local/build-all.sh api admin

Notes:
  - 默认服务: api client admin site
  - 只执行 build，不重启任何服务
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
  build_service "$service"
done

printf '[local] build complete\n'
