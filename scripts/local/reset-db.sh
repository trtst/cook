#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

printf '[local] reset database from migrations\n'
(
  cd "$ROOT_DIR/apps/api"
  pnpm exec prisma migrate reset --force --skip-generate --skip-seed --schema prisma/schema.prisma
  printf '[local] regenerate prisma client\n'
  pnpm prisma:generate
  printf '[local] reseed local baseline data\n'
  pnpm prisma:seed
)

printf '[local] reset complete\n'
