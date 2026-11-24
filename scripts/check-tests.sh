#!/usr/bin/env bash
# Run a test suite and fail if it reports 0 tests (0 tests green is not a pass; see .harness/checks.sh principles).
# usage: check-tests.sh unit | e2e
set -u
cd "$(git rev-parse --show-toplevel)" || exit 2
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

case "${1:-}" in
  unit)
    npx vitest run --reporter=default --reporter=json --outputFile="$tmp/r.json"; rc=$?
    n="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).numTotalTests)' "$tmp/r.json" 2>/dev/null || echo 0)"
    ;;
  e2e)
    npx electron-vite build >/dev/null || { echo 'electron-vite build failed. Run `npm run build` to see the error.'; exit 1; }
    PLAYWRIGHT_JSON_OUTPUT_NAME="$tmp/r.json" npx playwright test --reporter=list,json; rc=$?
    n="$(node -e 'const s=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).stats;console.log(s.expected+s.unexpected+s.flaky)' "$tmp/r.json" 2>/dev/null || echo 0)"
    ;;
  *) echo "usage: $0 unit|e2e"; exit 2 ;;
esac

[ "$rc" -eq 0 ] || { echo "tests failed (exit $rc). Fix the failing test or the code; do not weaken the test."; exit 1; }
[ "${n:-0}" -gt 0 ] || { echo "0 tests ran for '$1'. 0 tests green is a failure: add tests for the spec's acceptance criteria (docs/spec/)."; exit 1; }
echo "$1: $n tests"
