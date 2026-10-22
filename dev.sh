#!/usr/bin/env bash
# Development entry point. Everything runs inside Docker; the host needs only
# Docker with the compose plugin.
#
#   ./dev.sh install        install dependencies (pnpm install)
#   ./dev.sh start          start the dev app on http://localhost:3000/admin
#   ./dev.sh test           run the unit tests
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
  help|-h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//' ;;
  build-image) compose build dev ;;
  install) ensure_image; run pnpm install "$@" ;;
  start)
    ensure_deps
    echo "Admin: http://localhost:${PORT:-3000}/admin  (dev@payloadcms.com / test)"
    compose up dev "$@"
    ;;
  stop) compose down ;;
  test) ensure_deps; run pnpm test "$@" ;;
  typecheck) ensure_deps; run pnpm typecheck "$@" ;;
  build) ensure_deps; run pnpm build "$@" ;;
  shell) ensure_deps; compose run --rm dev bash ;;
  reset) compose down --volumes --remove-orphans ;;
  *) ensure_deps; run "$cmd" "$@" ;;
esac
