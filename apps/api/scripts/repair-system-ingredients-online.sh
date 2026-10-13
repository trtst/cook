#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
MODE="${1:-preview}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_PATH="${2:-/tmp/cook-system-ingredient-repair-online-${TIMESTAMP}.json}"

cd "$ROOT_DIR"

case "$MODE" in
  preview)
    echo "生成 ONLINE 只读预览，不写入数据库。报告：$REPORT_PATH"
    pnpm --filter @next-meal/api exec tsx scripts/repair-system-ingredient-data.ts \
      --target=ONLINE \
      "--report=$REPORT_PATH"
    ;;
  apply)
    if [[ ! -f "$REPORT_PATH" ]]; then
      echo "找不到已审阅的 dry-run 报告：$REPORT_PATH" >&2
      exit 2
    fi
    if [[ "${3:-}" != "--confirm-online-write" ]]; then
      echo "写入线上需要在第三个参数显式传入 --confirm-online-write" >&2
      exit 2
    fi
    APPLY_REPORT_PATH="${4:-/tmp/cook-system-ingredient-repair-online-applied-${TIMESTAMP}.json}"
    echo "即将按已审阅清单写入 ONLINE。若数据库与清单有变化，程序会拒绝写入。"
    pnpm --filter @next-meal/api exec tsx scripts/repair-system-ingredient-data.ts \
      --target=ONLINE \
      --apply \
      --confirm-online-write \
      "--approved-report=$REPORT_PATH" \
      "--report=$APPLY_REPORT_PATH"
    ;;
  *)
    echo "用法：" >&2
    echo "  $0 preview [报告路径]" >&2
    echo "  $0 apply <已审阅报告路径> --confirm-online-write [执行结果报告路径]" >&2
    exit 2
    ;;
esac
