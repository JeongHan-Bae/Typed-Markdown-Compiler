#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${RT_TEST_HOST:-127.0.0.1}"
PORT="${RT_TEST_PORT:-4174}"
BASE_URL="http://${HOST}:${PORT}"
TEST_CONTENT_DIRECTORY="${RT_TEST_CONTENT_DIRECTORY:-dev/rt-test/fixtures/content}"
TEST_PUBLIC_DIRECTORY="${RT_TEST_PUBLIC_DIRECTORY:-dev/rt-test/fixtures/public}"
STARTUP_ATTEMPTS=60
STARTUP_DELAY_SECONDS="0.1"
LOG_FILE="$(mktemp "${TMPDIR:-/tmp}/typed-markdown-rt-test.XXXXXX.log")"
SERVER_PID=""

cleanup() {
  if [[ -n "$SERVER_PID" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  rm -f "$LOG_FILE"
}

fail() {
  printf 'Runtime test failed: %s\n' "$1" >&2
  if [[ -s "$LOG_FILE" ]]; then
    sed -n '1,120p' "$LOG_FILE" >&2
  fi
  exit 1
}

assert_page() {
  local path="$1"
  local body
  body="$(curl --fail --silent --show-error "$BASE_URL$path")" \
    || fail "GET $path did not return a successful response"

  [[ "$body" == *'href="/"'* ]] \
    || fail "$path does not contain a root-relative root link"
  [[ "$body" == *'href="/entries/branch/leaf/"'* ]] \
    || fail "$path does not contain the nested route link"
  [[ "$body" == *'src="/assets/icons/runtime-marker.svg"'* ]] \
    || fail "$path does not contain the root-relative SVG image"
  [[ "$body" != *'href="../'* && "$body" != *'src="../'* ]] \
    || fail "$path contains a relative parent URL"
 [[ "$body" != *'{max-width='* && "$body" != *'{width='* ]] \
   || fail "$path contains an unconsumed image sizing annotation"
  [[ "$body" != *'<script'* ]] \
    || fail "$path contains browser JavaScript"

  case "$path" in
    /)
      printf '%s' "$body" | grep -Eq 'alt="Runtime marker"[^>]*style="[^"]*width:[[:space:]]*25%;[^"]*max-width:[[:space:]]*100%' \
        || fail "$path does not force the declared 25% image width"
      [[ "$body" == *'href="https://example.com"'* ]] \
        || fail "$path does not preserve the HTTPS link"
      [[ "$body" == *'href="mailto:runtime@example.com"'* ]] \
        || fail "$path does not preserve the mailto link"
      [[ "$body" == *'href="/feed.xml"'* ]] \
        || fail "$path does not preserve the RSS link"
      [[ "$body" == *'<table>'* ]] \
        || fail "$path does not render the Markdown table"
      ;;
    /about)
      printf '%s' "$body" | grep -Eq 'alt="Runtime marker"[^>]*style="[^"]*max-width:[[:space:]]*30%' \
        || fail "$path does not apply the declared 30% image maximum"
      ;;
    /entries/branch/leaf)
      printf '%s' "$body" | grep -Eq 'alt="Runtime marker"[^>]*>' \
        || fail "$path does not render the default-sized image"
      printf '%s' "$body" | grep -Eq 'alt="Runtime marker"[^>]*style=' \
        && fail "$path unexpectedly adds an image sizing declaration"
      ;;
  esac

  printf 'OK %s\n' "$BASE_URL$path"
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
CONTENT_DIRECTORY="$TEST_CONTENT_DIRECTORY" \
PUBLIC_DIRECTORY="$TEST_PUBLIC_DIRECTORY" \
VITE_BASE_PATH="" \
  "$ROOT_DIR/dev/compiler.sh"

(
  cd "$ROOT_DIR"
  exec env HOST="$HOST" PORT="$PORT" VITE_BASE_PATH="" "$ROOT_DIR/node_modules/.bin/vite" preview \
   --config "$ROOT_DIR/vite.config.ts"
) >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

server_ready=0
for _ in $(seq 1 "$STARTUP_ATTEMPTS"); do
  if curl --fail --silent --show-error --output /dev/null "$BASE_URL/"; then
    server_ready=1
    break
  fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    fail "Vite exited before becoming ready"
  fi
  sleep "$STARTUP_DELAY_SECONDS"
done

if (( server_ready == 0 )); then
  fail "Vite did not become ready at $BASE_URL"
fi

assert_page "/"
assert_page "/about"
assert_page "/notes"
assert_page "/entries/branch"
assert_page "/entries/branch/leaf"

asset_body="$(curl --fail --silent --show-error "$BASE_URL/assets/icons/runtime-marker.svg")" \
  || fail "SVG asset did not return a successful response"
[[ "$asset_body" == *"<svg"* ]] || fail "SVG asset response is not SVG content"
printf 'OK %s/assets/icons/runtime-marker.svg\n' "$BASE_URL"

printf 'Runtime test passed; server will be stopped automatically.\n'
