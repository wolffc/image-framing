#!/usr/bin/env bash
# Packs the package like a release would and installs the tarball into a
# scratch project: checks the file list, imports every entry point in Node
# and typechecks an import of every entry point.
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

pnpm build >/dev/null
# pnpm, not npm: only pnpm applies publishConfig.exports (dist instead of src).
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
pnpm add --silent "$tarball" "payload@$PAYLOAD_VERSION" "@payloadcms/ui@$PAYLOAD_VERSION" \
  "next@$NEXT_VERSION" react@19 react-dom@19 sharp graphql@16 typescript@5 @types/react@19 @types/node@24 \
  >/dev/null

# Every entry point exports these names, at runtime and in its types.
cat > expected.json <<'JSON'
{
  "@wolffc/payload-image-framing": ["imageFramingPlugin", "localDiskStorage", "DEFAULT_EDITOR_PATH"],
  "@wolffc/payload-image-framing/core": ["resolveFraming", "visibleRect", "objectPosition", "matchFrames"],
  "@wolffc/payload-image-framing/server": ["cropToken", "readCropToken", "frameImage", "cropUrl"],
  "@wolffc/payload-image-framing/client": ["FramingEditor", "UsageFramingField", "FramingCanvas", "PreviewStrip"],
  "@wolffc/payload-image-framing/next": ["frameImage"]
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
