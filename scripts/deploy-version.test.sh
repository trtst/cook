#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output="$(cd "$ROOT_DIR" && ./deploy.sh --version)"

printf '%s\n' "$output" | rg -q '^Release version: v[0-9]{4}\.[0-9]{2}\.[0-9]{2}-[0-9a-f]{7,}$'
printf '%s\n' "$output" | rg -q '^Git commit: [0-9a-f]{7,}$'
printf '%s\n' "$output" | rg -q '^Manifest: \.run-logs/release\.json$'

printf 'deploy version test passed\n'
