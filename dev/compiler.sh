#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Error: Node.js is required to compile this site.' >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  printf '%s\n' 'Installing dependencies...'
  npm install
fi

npm run check
npm run build
