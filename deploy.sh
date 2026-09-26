#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-full}"
MANIFEST_PATH="$ROOT_DIR/.run-logs/release.json"
RELEASE_VERSION=""
GIT_COMMIT=""
DATABASE_STATUS="not_checked"
API_DEPLOYED=false
ADMIN_DEPLOYED=false
SITE_DEPLOYED=false
NGINX_RESTARTED=false

log() {
  printf '[deploy] %s\n' "$*"
}

usage() {
  cat <<'EOF'
Usage:
  ./deploy.sh              # 更新 api + admin + site
  ./deploy.sh full         # 同上
  ./deploy.sh api          # 只更新 api
  ./deploy.sh admin        # 只更新 admin
  ./deploy.sh site         # 只更新 site
  ./deploy.sh --version    # 查看当前 Git 提交对应的发布版本

Notes:
  - 需在服务器项目根目录执行，或直接执行 /srv/cook/deploy.sh
  - 默认会执行 git pull、pnpm install
  - api 模式会在停止 cook-api 后执行迁移预检和迁移；迁移失败时服务保持停止，等待数据库恢复处理
  - admin/site 模式会重新构建对应前端并重启 nginx
EOF
}

init_release_metadata() {
  GIT_COMMIT="$(git rev-parse --short=12 HEAD)"
  local commit_date
  commit_date="$(git show -s --format=%cd --date=format:%Y.%m.%d HEAD)"
  RELEASE_VERSION="${RELEASE_VERSION:-v${commit_date}-${GIT_COMMIT}}"
}

print_release_version() {
  init_release_metadata
  printf 'Release version: %s\n' "$RELEASE_VERSION"
  printf 'Git commit: %s\n' "$GIT_COMMIT"
  printf 'Manifest: .run-logs/release.json\n'
}

database_migration_metadata() {
  local migration_names
  migration_names="$(find "$ROOT_DIR/apps/api/prisma/migrations" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort)"
  MIGRATION_COUNT="$(printf '%s\n' "$migration_names" | sed '/^$/d' | wc -l | tr -d ' ')"
  LATEST_MIGRATION="$(printf '%s\n' "$migration_names" | tail -n 1)"
}

write_release_manifest() {
  init_release_metadata
  database_migration_metadata
  mkdir -p "$(dirname "$MANIFEST_PATH")"
  cat > "$MANIFEST_PATH" <<EOF
{
  "version": "$RELEASE_VERSION",
  "gitCommit": "$GIT_COMMIT",
  "mode": "$MODE",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": {
    "api": $API_DEPLOYED,
    "admin": $ADMIN_DEPLOYED,
    "site": $SITE_DEPLOYED,
    "miniProgram": false,
    "nginxRestarted": $NGINX_RESTARTED
  },
  "database": {
    "status": "$DATABASE_STATUS",
    "migrationCount": $MIGRATION_COUNT,
    "latestMigration": "$LATEST_MIGRATION"
  }
}
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
  log "prisma generate"
  pnpm --filter @next-meal/api prisma:generate

  log "stop cook-api before final migration preflight"
  pm2 stop cook-api

  log "verify migration preflights while API writes are stopped"
  if ! pnpm --filter @next-meal/api run verify:idempotency-migration-preflight \
    || ! pnpm --filter @next-meal/api run verify:fridge-trace-migration-preflight; then
    log "migration preflight failed; restart cook-api without applying migrations"
    pm2 restart cook-api
    return 1
  fi

  log "prisma migrate deploy"
  if ! pnpm --filter @next-meal/api exec prisma migrate deploy --schema prisma/schema.prisma; then
    log "migration failed; cook-api remains stopped for database recovery"
    return 1
  fi

  log "verify prisma migrations"
  pnpm --filter @next-meal/api exec prisma migrate status --schema prisma/schema.prisma
  DATABASE_STATUS="up_to_date"

  log "build api"
  pnpm build:api

  log "restart cook-api"
  pm2 restart cook-api
  API_DEPLOYED=true
}

deploy_admin() {
  log "build admin"
  pnpm build:admin
  ADMIN_DEPLOYED=true
}

deploy_site() {
  log "build site"
  pnpm build:site
  SITE_DEPLOYED=true
}

restart_nginx() {
  log "restart nginx"
  systemctl restart nginx
  NGINX_RESTARTED=true
}

main() {
  cd "$ROOT_DIR"

  case "$MODE" in
    full)
      run_git_pull
      run_install
      deploy_api
      deploy_admin
      deploy_site
      restart_nginx
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
      restart_nginx
      ;;
    site)
      run_git_pull
      run_install
      deploy_site
      restart_nginx
      ;;
    -h|--help|help)
      usage
      ;;
    -v|--version|version)
      print_release_version
      ;;
    *)
      printf 'Unknown mode: %s\n\n' "$MODE" >&2
      usage >&2
      exit 1
      ;;
  esac

  if [[ "$MODE" != "--version" && "$MODE" != "-v" && "$MODE" != "version" && "$MODE" != "help" && "$MODE" != "--help" && "$MODE" != "-h" ]]; then
    write_release_manifest
    log "done version=$RELEASE_VERSION"
    log "manifest $MANIFEST_PATH"
    return
  fi

  log "done"
}

main "$@"
