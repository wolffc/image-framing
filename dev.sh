#!/usr/bin/env bash
# Development entry point. Everything runs inside Docker; the host needs only
# Docker with the compose plugin.
#
#   ./dev.sh install        install dependencies (pnpm install)
#   ./dev.sh start          start the dev app on http://localhost:3000/admin
#   ./dev.sh test           run the unit and integration tests
#   ./dev.sh test-int [db]  run the integration tests: sqlite (default), postgres or mongodb
#   ./dev.sh test-s3        run the storage tests against an S3 server (adobe/s3mock)
#   ./dev.sh test-e2e       run the Playwright tests against the dev app (starts it)
#   ./dev.sh site           start the showcase page on http://localhost:5173/image-framing/
#   ./dev.sh test-site      build the showcase page and run its Playwright tests
#   ./dev.sh screenshots    regenerate docs/images from the dev app (starts it)
#   ./dev.sh typecheck      run tsc on src/ and dev/
#   ./dev.sh build          build the package into dist/
#   ./dev.sh shell          open a shell in the dev container
#   ./dev.sh <cmd …>        run any command in the dev container, e.g. ./dev.sh pnpm add -D foo
#   ./dev.sh reset          remove containers and volumes (node_modules, caches)
set -euo pipefail
cd "$(dirname "$0")"

compose() { docker compose --progress quiet "$@"; }
run() { compose run --rm --service-ports=false dev "$@"; }

ensure_image() {
  if [[ -z "$(docker images -q image-framing-dev 2>/dev/null)" ]]; then
    compose build dev
  fi
}

ensure_deps() {
  ensure_image
  # A fresh node_modules volume is empty: install on first use.
  if ! run test -e node_modules/.modules.yaml; then
    run pnpm install --frozen-lockfile
  fi
}

cmd="${1:-help}"
[[ $# -gt 0 ]] && shift

case "$cmd" in
  help|-h|--help) sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//' ;;
  build-image) compose build dev ;;
  install) ensure_image; run pnpm install "$@" ;;
  start)
    ensure_deps
    echo "Admin: http://localhost:${PORT:-3000}/admin  (dev@payloadcms.com / test)"
    compose up dev "$@"
    ;;
  stop) compose --profile s3 --profile db --profile e2e down ;;
  test) ensure_deps; run pnpm test "$@" ;;
  test-int)
    ensure_deps
    db="${1:-sqlite}"
    [[ $# -gt 0 ]] && shift
    case "$db" in
      sqlite) uri="" ;;
      postgres) uri="postgres://postgres:postgres@postgres:5432/image_framing" ;;
      mongodb) uri="mongodb://mongodb:27017/image_framing" ;;
      *) echo "Unknown database: $db (sqlite, postgres, mongodb)" >&2; exit 1 ;;
    esac
    if [[ -n "$uri" ]]; then
      compose --profile db up -d --force-recreate "$db"
      host="${db}"; port=$([[ "$db" == postgres ]] && echo 5432 || echo 27017)
      run node -e "const net = require('node:net'); const until = Date.now() + 90000; const tryOnce = () => { const s = net.connect($port, '$host', () => { s.end(); setTimeout(() => process.exit(0), 2000) }); s.on('error', () => Date.now() < until ? setTimeout(tryOnce, 1000) : process.exit(1)) }; tryOnce()"
    fi
    compose run --rm -e DATABASE_URI="$uri" dev pnpm test:int "$@"
    ;;
  test-e2e)
    ensure_deps
    compose up -d dev
    echo "Waiting for the dev app…"
    run node -e "const until = Date.now() + 300000; (async () => { while (Date.now() < until) { try { const r = await fetch('http://framing-dev:3000/admin', { signal: AbortSignal.timeout(120000) }); if (r.ok) return } catch {} await new Promise((r) => setTimeout(r, 2000)) } process.exit(1) })()"
    compose --profile e2e run --rm e2e node_modules/.bin/playwright test "$@"
    ;;
  site)
    ensure_deps
    echo "Showcase: http://localhost:${SITE_PORT:-5173}/image-framing/"
    compose run --rm -p "${SITE_PORT:-5173}:5173" dev pnpm site "$@"
    ;;
  test-site)
    ensure_deps
    run pnpm site:build
    compose --profile e2e run --rm e2e node_modules/.bin/playwright test -c site/playwright.config.ts "$@"
    ;;
  screenshots)
    "$0" test-e2e -c playwright.screenshots.config.ts "$@"
    ;;
  test-s3)
    ensure_deps
    compose --profile s3 up -d s3
    # The S3 server takes a few seconds to start.
    run node -e "const until = Date.now() + 90000; (async () => { while (Date.now() < until) { try { await fetch('http://s3:9090'); return } catch { await new Promise((r) => setTimeout(r, 1000)) } } process.exit(1) })()"
    compose run --rm -e S3_ENDPOINT=http://s3:9090 dev pnpm exec vitest run test/int/s3.int.spec.ts "$@"
    ;;
  typecheck) ensure_deps; run pnpm typecheck "$@" ;;
  build) ensure_deps; run pnpm build "$@" ;;
  shell) ensure_deps; compose run --rm dev bash ;;
  reset) compose down --volumes --remove-orphans ;;
  *) ensure_deps; run "$cmd" "$@" ;;
esac
