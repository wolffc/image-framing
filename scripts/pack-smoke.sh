#!/usr/bin/env bash
# Packs the package like a release would and installs the tarball into a
# scratch project: checks the file list, imports every entry point in Node,
# typechecks an import of every entry point, and builds a Payload + Next app
# that uses the plugin with its defaults (test/consumer).
#
# SKIP_APP_BUILD=1 skips the app build, the slow part.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
cd "$root"

# The versions to install the package with: the dev versions, unless the
# caller overrides them (CI does, for the lowest supported Payload).
dev_version() { node -p "require('./package.json').devDependencies['$1']"; }
PAYLOAD_VERSION="${PAYLOAD_VERSION:-$(dev_version payload)}"
NEXT_VERSION="${NEXT_VERSION:-$(dev_version next)}"

# prepack builds dist/. pnpm, not npm: only pnpm applies publishConfig.exports (dist instead of src).
pnpm pack --pack-destination "$work" >/dev/null
tarball="$(ls "$work"/*.tgz)"

echo "== files in $(basename "$tarball")"
tar -tzf "$tarball" | sort | tee "$work/files.txt"
if unexpected="$(grep -vE '^package/(dist/.+|README\.md|LICENSE|CHANGELOG\.md|package\.json)$' "$work/files.txt")"; then
  echo "Unexpected files in the package:" >&2
  echo "$unexpected" >&2
  exit 1
fi
for required in package/dist/index.js package/dist/index.d.ts package/LICENSE package/README.md; do
  grep -qx "$required" "$work/files.txt" || { echo "Missing $required" >&2; exit 1; }
done

echo "== installing into a scratch project (payload $PAYLOAD_VERSION, next $NEXT_VERSION)"
mkdir "$work/app"
cd "$work/app"
# Same pnpm and allowed build scripts as this repo.
node -e "
const root = require('$root/package.json')
const pkg = { name: 'pack-smoke', private: true, type: 'module', packageManager: root.packageManager,
  pnpm: { onlyBuiltDependencies: root.pnpm.onlyBuiltDependencies } }
require('fs').writeFileSync('package.json', JSON.stringify(pkg, null, 2))
"
# A flat node_modules, as npm makes it: what most apps have, and Payload's
# SQLite adapter (3.39) finds its native driver only that way.
echo 'node-linker=hoisted' > .npmrc
pnpm add --silent "$tarball" "payload@$PAYLOAD_VERSION" "@payloadcms/ui@$PAYLOAD_VERSION" \
  "@payloadcms/next@$PAYLOAD_VERSION" "@payloadcms/db-sqlite@$PAYLOAD_VERSION" "next@$NEXT_VERSION" \
  react@19 react-dom@19 sharp graphql@16 @aws-sdk/client-s3 typescript@5 @types/react@19 @types/react-dom@19 @types/node@24 esbuild \
  >/dev/null

# Every entry point exports these names, at runtime and in its types.
cat > expected.json <<'JSON'
{
  "@wolffc/payload-image-framing": ["imageFramingPlugin", "localDiskStorage", "DEFAULT_EDITOR_PATH"],
  "@wolffc/payload-image-framing/core": ["resolveFraming", "visibleRect", "objectPosition", "matchFrames"],
  "@wolffc/payload-image-framing/server": ["cropToken", "readCropToken", "frameImage", "cropUrl"],
  "@wolffc/payload-image-framing/client": ["FramingEditor", "UsageFramingField", "FramingCanvas", "PreviewStrip"],
  "@wolffc/payload-image-framing/next": ["frameImage", "FramedImage"],
  "@wolffc/payload-image-framing/s3": ["s3FramingStorage"]
}
JSON

echo "== importing every entry point in Node"
cat > import.mjs <<'JS'
import fs from 'node:fs'

const expected = JSON.parse(fs.readFileSync('expected.json', 'utf8'))
let failed = false
for (const [specifier, names] of Object.entries(expected)) {
  // The client entry needs a bundler (Payload's UI imports CSS); resolve it and check its source.
  if (specifier.endsWith('/client')) {
    const file = new URL(import.meta.resolve(specifier))
    const source = fs.readFileSync(file, 'utf8')
    const missing = names.filter((name) => !source.includes(name))
    const ok = source.startsWith("'use client'") && missing.length === 0
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${specifier} (resolved, 'use client')`)
    if (!ok) failed = true
    continue
  }
  const mod = await import(specifier)
  const missing = names.filter((name) => !(name in mod))
  console.log(`${missing.length ? 'FAIL' : 'ok  '} ${specifier}${missing.length ? ` missing ${missing}` : ''}`)
  if (missing.length) failed = true
}
process.exit(failed ? 1 : 0)
JS
node import.mjs

echo "== typechecking an import of every entry point"
node -e "
const expected = require('./expected.json')
let i = 0
const lines = Object.entries(expected).map(([spec, names]) =>
  'import { ' + names.map((n) => n + ' as n' + i++).join(', ') + \" } from '\" + spec + \"'\")
lines.push('export {}')
require('fs').writeFileSync('check.ts', lines.join('\n') + '\n')
"
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "target": "ES2022",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "noUnusedLocals": false
  },
  "files": ["check.ts"]
}
JSON
pnpm exec tsc -p tsconfig.json
echo "ok   types of every entry point"

echo "== bundling ./core for the browser without Node polyfills"
# Bundlers like Next polyfill Node modules quietly; esbuild for the browser fails on them.
echo "import * as core from '@wolffc/payload-image-framing/core'; console.log(core)" > browser.mjs
pnpm exec esbuild browser.mjs --bundle --platform=browser --format=esm --log-level=error --outfile=browser.out.js
echo "ok   ./core bundles for the browser"

echo "== rendering without Next.js or Payload (react-dom/server)"
mkdir "$work/plain"
(
  cd "$work/plain"
  echo '{ "name": "plain", "private": true, "type": "module" }' > package.json
  # npm with --legacy-peer-deps installs no peers: no next, no payload.
  npm install --silent --no-audit --no-fund --legacy-peer-deps "$tarball" react@19 react-dom@19 >/dev/null
  cat > render.mjs <<'JS'
import { defineFraming, frameAspectVariables, framePositionCss } from '@wolffc/payload-image-framing/core'
import { frameImage } from '@wolffc/payload-image-framing/server'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

for (const name of ['next', 'payload']) {
  let installed = true
  try {
    import.meta.resolve(name)
  } catch {
    installed = false
  }
  if (installed) throw new Error(`${name} is installed; this check needs a project without it`)
}

const framing = defineFraming({ breakpoints: { base: {}, lg: { minWidth: 1280 } } })
const frames = { base: { aspect: 4 / 5 }, lg: { aspect: 21 / 9 } }
const media = {
  id: 7, alt: 'Beach', filename: 'beach.jpg', mimeType: 'image/jpeg', url: '/api/media/file/beach.jpg',
  width: 3000, height: 1000, crop: { x: 10, y: 0, width: 80, height: 100 },
}
const { resource, style } = frameImage({ framing, frames, media, secret: 'secret' })
const html = renderToStaticMarkup(
  h('div', { className: 'frame', style: { ...style, ...frameAspectVariables(framing, frames) } },
    h('style', null, framePositionCss(framing, '.frame img')),
    h('img', { alt: resource.alt, src: resource.url, style: { objectFit: 'cover' } })),
)
for (const part of ['src="/api/media/crop/7/', '--frame-pos-lg:', '--frame-aspect:0.8', 'object-position:var(--frame-pos-lg)']) {
  if (!html.includes(part)) throw new Error(`Missing ${part} in ${html}`)
}
console.log('ok   rendered with react-dom/server, without next or payload installed')
JS
  node render.mjs
)

if [ "${SKIP_APP_BUILD:-}" = "1" ]; then
  echo "skipped app build (SKIP_APP_BUILD=1)"
  exit 0
fi

echo "== building a Payload + Next app that uses the package (test/consumer)"
mkdir "$work/consumer"
cp -r "$root/test/consumer/." "$work/consumer/"
mkdir -p "$work/consumer/app/(payload)"
cp -r "$root/dev/app/(payload)/." "$work/consumer/app/(payload)/"
# Reuse the scratch project's installed packages.
mv node_modules package.json .npmrc "$work/consumer/"
[ -f pnpm-lock.yaml ] && mv pnpm-lock.yaml "$work/consumer/"
cd "$work/consumer"

echo 'export const importMap = {}' > 'app/(payload)/admin/importMap.js'
PAYLOAD_CONFIG_PATH=payload.config.ts pnpm exec payload generate:importmap >/dev/null
for component in FramingEditor UsageFramingField; do
  if ! grep -q "'@wolffc/payload-image-framing/client#$component'\|\"@wolffc/payload-image-framing/client#$component\"" 'app/(payload)/admin/importMap.js'; then
    echo "The import map has no @wolffc/payload-image-framing/client#$component:" >&2
    cat 'app/(payload)/admin/importMap.js' >&2
    exit 1
  fi
done
echo "ok   import map has both editors from @wolffc/payload-image-framing/client"

NEXT_TELEMETRY_DISABLED=1 pnpm exec next build > build.log 2>&1 || { tail -60 build.log >&2; exit 1; }
echo "ok   next build (admin with the package's editors, ./core in a client component, <FramedImage>)"
