#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUN_DIR="$ROOT_DIR/.run-logs/local-dev"
PID_DIR="$RUN_DIR/pids"
LOG_DIR="$RUN_DIR/logs"
SKIP_FILE="$RUN_DIR/restart.stamp"

ensure_run_dirs() {
  mkdir -p "$PID_DIR" "$LOG_DIR"
}

is_service() {
  case "${1:-}" in
    api|client|admin|site|worker) return 0 ;;
    *) return 1 ;;
  esac
}

default_services() {
  printf '%s\n' api client admin site
}

service_label() {
  case "$1" in
    api) printf 'api' ;;
    client) printf 'client' ;;
    admin) printf 'admin' ;;
    site) printf 'site' ;;
    worker) printf 'worker' ;;
  esac
}

service_dev_script() {
  case "$1" in
    api) printf 'dev:api' ;;
    client) printf 'dev:client' ;;
    admin) printf 'dev:admin' ;;
    site) printf 'dev:site' ;;
    worker) printf 'dev:worker' ;;
  esac
}

service_build_script() {
  case "$1" in
    api) printf 'build:api' ;;
    client) printf 'build:client' ;;
    admin) printf 'build:admin' ;;
    site) printf 'build:site' ;;
    worker) printf 'build:worker' ;;
  esac
}

service_port() {
  case "$1" in
    api) printf '%s' "${API_PORT:-3100}" ;;
    admin) printf '%s' "${ADMIN_PORT:-5174}" ;;
    site) printf '%s' "${SITE_PORT:-5176}" ;;
    *) printf '' ;;
  esac
}

service_pattern() {
  printf 'pnpm %s' "$(service_dev_script "$1")"
}

collect_port_pids() {
  local service="$1"
  local port pid seen=" "

  port="$(service_port "$service")"
  [ -n "$port" ] || return 0

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    case "$seen" in
      *" $pid "*) continue ;;
    esac
    printf '%s\n' "$pid"
    seen="$seen$pid "
  done < <(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
}

pid_file() {
  printf '%s/%s.pid' "$PID_DIR" "$1"
}

log_file() {
  printf '%s/%s.log' "$LOG_DIR" "$1"
}

is_pid_live() {
  local pid="$1"
  ps -p "$pid" >/dev/null 2>&1
}

read_tracked_pid() {
  local service="$1"
  local file pid

  file="$(pid_file "$service")"
  if [ ! -f "$file" ]; then
    return 1
  fi

  pid="$(cat "$file" 2>/dev/null || true)"
  if [ -n "$pid" ] && is_pid_live "$pid"; then
    printf '%s\n' "$pid"
    return 0
  fi

  rm -f "$file"
  return 1
}

collect_service_pids() {
  local service="$1"
  local seen=" " pid

  if pid="$(read_tracked_pid "$service" 2>/dev/null || true)"; then
    printf '%s\n' "$pid"
    seen="$seen$pid "
  fi

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    case "$seen" in
      *" $pid "*) continue ;;
    esac
    if is_pid_live "$pid"; then
      printf '%s\n' "$pid"
      seen="$seen$pid "
    fi
  done < <(collect_port_pids "$service")

  if [ -n "$(service_port "$service")" ]; then
    return 0
  fi

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    case "$seen" in
      *" $pid "*) continue ;;
    esac
    if is_pid_live "$pid"; then
      printf '%s\n' "$pid"
      seen="$seen$pid "
    fi
  done < <(pgrep -f "$(service_pattern "$service")" 2>/dev/null || true)
}

stop_pid_tree() {
  local pid="$1"
  local child wait_step

  while IFS= read -r child; do
    [ -n "$child" ] || continue
    stop_pid_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)

  kill -TERM "$pid" 2>/dev/null || true

  wait_step=0
  while [ "$wait_step" -lt 20 ]; do
    if ! is_pid_live "$pid"; then
      return 0
    fi
    sleep 0.25
    wait_step=$((wait_step + 1))
  done

  kill -KILL "$pid" 2>/dev/null || true
}

stop_service() {
  local service="$1"
  local stopped=1 pid

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    stop_pid_tree "$pid"
    stopped=0
  done < <(collect_service_pids "$service")

  rm -f "$(pid_file "$service")"

  if [ "$stopped" -eq 0 ]; then
    printf '[local] stopped %s\n' "$(service_label "$service")"
  else
    printf '[local] %s already stopped\n' "$(service_label "$service")"
  fi
}

build_service() {
  local service="$1"
  local script

  script="$(service_build_script "$service")"
  printf '[local] build %s via pnpm %s\n' "$(service_label "$service")" "$script"
  (
    cd "$ROOT_DIR"
    pnpm "$script"
  )
}

service_is_running() {
  local service="$1" pid port

  port="$(service_port "$service")"
  if [ -n "$port" ] && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    return 0
  fi

  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    return 0
  done < <(collect_service_pids "$service")

  return 1
}

prepare_service() {
  local service="$1"

  case "$service" in
    api)
      printf '[local] prepare api via prisma migrate deploy + prisma generate\n'
      (
        cd "$ROOT_DIR/apps/api"
        pnpm exec prisma migrate deploy --schema prisma/schema.prisma
        pnpm exec prisma generate --schema prisma/schema.prisma
      )
      ;;
  esac
}

start_service() {
  local service="$1"
  local script log_file_path pid_file_path pid

  if service_is_running "$service"; then
    printf '[local] %s already running\n' "$(service_label "$service")"
    return 0
  fi

  prepare_service "$service"

  script="$(service_dev_script "$service")"
  log_file_path="$(log_file "$service")"
  pid_file_path="$(pid_file "$service")"

  : > "$log_file_path"

  nohup bash -lc 'cd "$1" && exec pnpm "$2"' _ "$ROOT_DIR" "$script" </dev/null >>"$log_file_path" 2>&1 &
  pid="$!"
  printf '%s\n' "$pid" > "$pid_file_path"
  disown "$pid" 2>/dev/null || true

  printf '[local] started %s pid=%s log=%s\n' "$(service_label "$service")" "$pid" "$log_file_path"
}

wait_for_service() {
  local service="$1"
  local port step

  port="$(service_port "$service")"
  step=0
  while [ "$step" -lt 30 ]; do
    if [ -n "$port" ]; then
      if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        return 0
      fi
    else
      if read_tracked_pid "$service" >/dev/null 2>&1; then
        return 0
      fi
    fi

    sleep 0.5
    step=$((step + 1))
  done

  return 1
}

mark_restart() {
  date +%s > "$SKIP_FILE"
}

skip_start() {
  local stamp now age

  if [ ! -f "$SKIP_FILE" ]; then
    return 1
  fi

  stamp="$(cat "$SKIP_FILE" 2>/dev/null || true)"
  rm -f "$SKIP_FILE"
  [ -n "$stamp" ] || return 1

  now="$(date +%s)"
  age=$((now - stamp))
  [ "$age" -ge 0 ] && [ "$age" -le 30 ]
}

print_service_status() {
  local service="$1"
  local port tracked_pid pid_list

  port="$(service_port "$service")"
  tracked_pid="$(read_tracked_pid "$service" 2>/dev/null || true)"

  if [ -n "$tracked_pid" ]; then
    if [ -n "$port" ] && lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      printf '[local] %-6s running  pid=%s port=%s log=%s\n' "$service" "$tracked_pid" "$port" "$(log_file "$service")"
    elif [ -n "$port" ]; then
      printf '[local] %-6s running  pid=%s port=%s(waiting) log=%s\n' "$service" "$tracked_pid" "$port" "$(log_file "$service")"
    else
      printf '[local] %-6s running  pid=%s log=%s\n' "$service" "$tracked_pid" "$(log_file "$service")"
    fi
    return 0
  fi

  pid_list=""
  while IFS= read -r tracked_pid; do
    [ -n "$tracked_pid" ] || continue
    pid_list="$pid_list${pid_list:+,}$tracked_pid"
  done < <(collect_service_pids "$service")

  if [ -n "$pid_list" ]; then
    if [ -n "$port" ]; then
      printf '[local] %-6s running  pid=%s(untracked) port=%s log=%s\n' "$service" "$pid_list" "$port" "$(log_file "$service")"
    else
      printf '[local] %-6s running  pid=%s(untracked) log=%s\n' "$service" "$pid_list" "$(log_file "$service")"
    fi
  else
    printf '[local] %-6s stopped  log=%s\n' "$service" "$(log_file "$service")"
  fi
}
