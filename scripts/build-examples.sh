#!/usr/bin/env bash
# Builds every runnable example (examples/*/package.json) against the package
# as it would be published: packs it once, installs each example with the
# tarball in a scratch directory, checks its committed import map, runs its
# scripts if any and `next build`.
#
#   scripts/build-examples.sh [example …]   (default: all)
#   UPDATE_IMPORT_MAPS=1 scripts/build-examples.sh   writes the import maps back
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$root"

# prepack builds dist/. pnpm, not npm: only pnpm applies publishConfig.exports.
pnpm pack --pack-destination "$work" >/dev/null
tarball="$(ls "$work"/*.tgz)"

examples=("$@")
if [ ${#examples[@]} -eq 0 ]; then
  for dir in examples/*/; do
    [ -f "$dir/package.json" ] && examples+=("$(basename "$dir")")
  done
fi

for name in "${examples[@]}"; do
  echo "== examples/$name"
  app="$work/$name"
  mkdir -p "$app"
  tar -C "examples/$name" --exclude=node_modules --exclude=.next --exclude='payload.db*' -cf - . | tar -C "$app" -xf -
  (
    cd "$app"
    # The package from the tarball; the rest as the example lists it.
    node -e "
      const fs = require('fs')
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
      pkg.dependencies['@wolffc/payload-image-framing'] = 'file:$tarball'
      pkg.packageManager = require('$root/package.json').packageManager
      pkg.pnpm = { onlyBuiltDependencies: require('$root/package.json').pnpm.onlyBuiltDependencies }
      fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
    "
    echo 'node-linker=hoisted' > .npmrc
    pnpm install --silent >/dev/null
    export PAYLOAD_SECRET=example-build-secret DATABASE_URI="file:$app/payload.db" NEXT_TELEMETRY_DISABLED=1

    map='app/(payload)/admin/importMap.js'
    cp "$map" "$map.committed"
    pnpm -s payload generate:importmap >/dev/null
    if ! diff -q "$map" "$map.committed" >/dev/null; then
      if [ "${UPDATE_IMPORT_MAPS:-}" = "1" ]; then
        cp "$map" "$root/examples/$name/$map"
        echo "     updated the import map"
      else
        echo "examples/$name: the committed import map is out of date; run UPDATE_IMPORT_MAPS=1 $0 $name" >&2
        diff "$map.committed" "$map" >&2 || true
        exit 1
      fi
    fi
    rm "$map.committed"

    if ls scripts/*.ts >/dev/null 2>&1; then
      # One photo, so the example's scripts have something to work on.
      cat > seed-for-build.ts <<'TS'
import config from '@payload-config'
import { getPayload } from 'payload'
import sharp from 'sharp'

const payload = await getPayload({ config })
const data = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#3a7bd5' } })
  .jpeg()
  .toBuffer()
await payload.create({
  collection: 'media',
  data: { alt: 'seeded for the build' },
  file: { data, mimetype: 'image/jpeg', name: 'seed.jpg', size: data.length },
})
process.exit(0)
TS
      pnpm -s payload run seed-for-build.ts >/dev/null
      rm seed-for-build.ts
      for script in scripts/*.ts; do
        output="$(pnpm -s payload run "$script" 2>&1)"
        echo "ok   payload run $script: $(echo "$output" | grep -oE '(Backfilled|Rebuilt)[^.]*' | head -1)"
      done
    fi

    pnpm -s exec next build > build.log 2>&1 || { tail -60 build.log >&2; exit 1; }
    echo "ok   next build"

    # Start it: the page and the admin answer. Production doesn't push the
    # schema, so a script run (development) creates the tables first.
    cat > push-schema.ts <<'TS'
import config from '@payload-config'
import { getPayload } from 'payload'

await getPayload({ config })
process.exit(0)
TS
    pnpm -s payload run push-schema.ts >/dev/null
    # Next's own binary, so $! is the server and `kill` stops it.
    node node_modules/next/dist/bin/next start -p 3999 > start.log 2>&1 &
    server=$!
    for path in / /admin; do
      code=""
      for _ in $(seq 1 60); do
        code="$(node -e "fetch('http://localhost:3999$path', { redirect: 'manual' }).then((r) => console.log(r.status)).catch(() => console.log(0))")"
        [ "$code" != "0" ] && break
        sleep 1
      done
      if [ "$code" != "200" ] && [ "$code" != "307" ]; then
        echo "examples/$name: GET $path answered $code" >&2
        tail -40 start.log >&2
        kill $server
    wait $server 2>/dev/null || true 2>/dev/null || true
        exit 1
      fi
      echo "ok   GET $path: $code"
    done
    kill $server
    wait $server 2>/dev/null || true
  )
done
