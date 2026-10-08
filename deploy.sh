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
WORKER_DEPLOYED=false
NGINX_RESTARTED=false

log() {
  printf '[deploy] %s\n' "$*"
}

usage() {
  cat <<'EOF'
Usage:
  ./deploy.sh              # 更新 api + worker + admin + site
  ./deploy.sh full         # 同上
  ./deploy.sh api          # 只更新 api
  ./deploy.sh admin        # 只更新 admin
  ./deploy.sh site         # 只更新 site
  ./deploy.sh --version    # 查看当前 Git 提交对应的发布版本

Notes:
  - 需在服务器项目根目录执行，或直接执行 /srv/cook/deploy.sh
  - 默认会执行 git pull、pnpm install
  - api 模式会在停止 cook-api 后执行迁移预检和迁移；迁移失败时服务保持停止，等待数据库恢复处理
  - full/api 模式要求 apps/api/.env 配置 ARK_API_KEY 和 ARK_IMAGE_MODEL；预检只报告缺项，不输出密钥
  - 完整发布要求 apps/worker/.env 配置生产 DATABASE_URL 和 ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED=true；迁移成功后自动构建并通过 PM2 启动/重载 cook-worker
  - API 迁移成功后会自动分批回填菜谱版本食材索引，无需单独执行脚本
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
    "worker": $WORKER_DEPLOYED,
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

verify_image_generation_env() {
  local api_env="$ROOT_DIR/apps/api/.env"
  if [[ ! -r "$api_env" ]]; then
    log "missing $api_env; configure production API environment before deploying the image-generation workbench"
    return 1
  fi

  if ! node --env-file="$api_env" -e '
    if (!process.env.ARK_API_KEY?.trim() || !process.env.ARK_IMAGE_MODEL?.trim()) {
      console.error("apps/api/.env must set ARK_API_KEY and ARK_IMAGE_MODEL. Secret values are not printed.");
      process.exit(1);
    }
  '; then
    log "Ark image-generation configuration is incomplete"
    return 1
  fi
}

verify_api_health() {
  local api_env="$ROOT_DIR/apps/api/.env"
  local api_port
  local health_url

  local api_online=false
  for attempt in {1..15}; do
    if pm2 jlist | node -e '
      let output = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", chunk => { output += chunk; });
      process.stdin.on("end", () => {
        try {
          const apps = JSON.parse(output);
          const api = apps.find(app => app.name === "cook-api");
          if (!api || api.pm2_env?.status !== "online") process.exitCode = 1;
        } catch {
          process.exitCode = 1;
        }
      });
    ' >/dev/null 2>&1; then
      api_online=true
      break
    fi
    sleep 2
  done

  if [[ "$api_online" != true ]]; then
    log "cook-api did not reach online state; inspect pm2 logs cook-api"
    return 1
  fi

  api_port="$(node --env-file="$api_env" -p 'process.env.PORT || "3100"')"
  health_url="${API_HEALTH_URL:-http://127.0.0.1:${api_port}/api/app-config}"
  log "checking the local API health endpoint"
  for attempt in {1..15}; do
    if curl --silent --fail --output /dev/null "$health_url"; then
      log "API health check passed"
      return 0
    fi
    sleep 2
  done

  log "API health check failed; inspect pm2 logs cook-api"
  return 1
}

prepare_worker() {
  local worker_env="$ROOT_DIR/apps/worker/.env"
  if [[ ! -r "$worker_env" ]]; then
    log "missing $worker_env; create it from apps/worker/.env.example and configure production values"
    return 1
  fi

  if ! node --env-file="$worker_env" -e '
    const enabled = (process.env.ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED || "").toLowerCase();
    if (!process.env.DATABASE_URL?.trim() || !["1", "true", "yes"].includes(enabled)) {
      console.error("Worker .env must set DATABASE_URL and ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED=true.");
      process.exit(1);
    }
  '; then
    log "invalid Worker environment; require Node.js with --env-file support, DATABASE_URL, and ARTICLE_SCHEDULED_PUBLISH_WORKER_ENABLED=true"
    return 1
  fi

  log "build worker"
  pnpm build:worker
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

  log "backfill recipe-version ingredient index"
  if ! pnpm --filter @next-meal/api run backfill:recipe-version-ingredients -- --apply; then
    log "recipe-version ingredient backfill failed; cook-api remains stopped, rerun deployment after recovery"
    return 1
  fi

  log "build api"
  pnpm build:api

  log "restart cook-api"
  pm2 restart cook-api
  verify_api_health
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

deploy_worker() {
  log "start or reload cook-worker through PM2"
  pm2 startOrReload "$ROOT_DIR/apps/worker/ecosystem.config.cjs" --env production
  if ! pm2 jlist | node -e '
    let output = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => { output += chunk; });
    process.stdin.on("end", () => {
      const apps = JSON.parse(output);
      const worker = apps.find(app => app.name === "cook-worker");
      if (!worker || worker.pm2_env?.status !== "online") {
        console.error("PM2 process cook-worker is not online.");
        process.exitCode = 1;
      }
    });
  '; then
    log "cook-worker did not reach online state; inspect pm2 logs cook-worker"
    return 1
  fi
  pm2 save
  WORKER_DEPLOYED=true
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
      verify_image_generation_env
      run_install
      prepare_worker
      deploy_api
      deploy_worker
      deploy_admin
      deploy_site
      restart_nginx
      ;;
    api)
      run_git_pull
      verify_image_generation_env
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
