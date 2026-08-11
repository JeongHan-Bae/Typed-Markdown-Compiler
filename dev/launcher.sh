#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

SITE_TITLE_VALUE="Personal Blog"
GITHUB_USERNAME_VALUE=""

if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  while IFS= read -r remote_name; do
    remote_url="$(git -C "$ROOT_DIR" remote get-url "$remote_name" 2>/dev/null || true)"

    if [[ "$remote_url" =~ ^(https?://github\.com/|git@github\.com:|ssh://git@github\.com/|git://github\.com/)([^/]+)/[^/]+ ]]; then
      github_short_name="${BASH_REMATCH[2]}"
      github_long_name="$(git -C "$ROOT_DIR" config --get user.name 2>/dev/null || true)"

      if [ -n "$github_long_name" ]; then
        SITE_TITLE_VALUE="${github_long_name}'s Personal Blog"
      else
        SITE_TITLE_VALUE="${github_short_name}'s Personal Blog"
      fi
      GITHUB_USERNAME_VALUE="$github_short_name"
      break
    fi
  done < <(git -C "$ROOT_DIR" remote 2>/dev/null || true)
fi

if [ -n "$SITE_TITLE_VALUE" ]; then
  export SITE_TITLE="$SITE_TITLE_VALUE"
else
  unset SITE_TITLE
fi

if [ -n "$GITHUB_USERNAME_VALUE" ]; then
  export GITHUB_USERNAME="$GITHUB_USERNAME_VALUE"
else
  export GITHUB_USERNAME=""
fi

if [ "${FOOTER_TEXT+x}" = x ]; then
  export FOOTER_TEXT
else
  unset FOOTER_TEXT
fi

"$ROOT_DIR/dev/compiler.sh"

# The compiler and Vite config load the root .env (or ENV_FILE/ENV_DIRECTORY).
# Export only the four allowed non-empty user values for launcher-side setup.
# Protected deployment, identity, server, and test controls are never exported.
eval "$(node --import=tsx "$ROOT_DIR/dev/export-env.ts")"
export HOST="${HOST:-127.0.0.1}"

cd "$ROOT_DIR"
exec "$ROOT_DIR/node_modules/.bin/vite" preview --config "$ROOT_DIR/vite.config.ts"
