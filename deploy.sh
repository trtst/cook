#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-full}"

log() {
  printf '[deploy] %s\n' "$*"
}

usage() {
  cat <<'EOF'
Usage:
  ./deploy.sh              # 更新 api + admin
  ./deploy.sh full         # 同上
  ./deploy.sh api          # 只更新 api
  ./deploy.sh admin        # 只更新 admin

Notes:
  - 需在服务器项目根目录执行，或直接执行 /srv/cook/deploy.sh
  - 默认会执行 git pull、pnpm install
  - api 模式会执行 Prisma migrate deploy 并重启 cook-api
  - admin 模式会重新构建后台并重启 nginx
EOF
}

run_git_pull() {
  log "git pull"
  git pull
}

run_install() {
  log "pnpm install"
  pnpm install
}

deploy_api() {
  log "prisma migrate deploy"
  pnpm --filter @next-meal/api exec prisma migrate deploy

  log "build api"
  pnpm build:api

  log "restart cook-api"
  pm2 restart cook-api
}

deploy_admin() {
  log "build admin"
  pnpm build:admin

  log "restart nginx"
  systemctl restart nginx
}

main() {
  cd "$ROOT_DIR"

  case "$MODE" in
    full)
      run_git_pull
      run_install
      deploy_api
      deploy_admin
      ;;
    api)
      run_git_pull
      run_install
      deploy_api
      ;;
    admin)
      run_git_pull
      run_install
      deploy_admin
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      printf 'Unknown mode: %s\n\n' "$MODE" >&2
      usage >&2
      exit 1
      ;;
  esac

  log "done"
}

main "$@"
