#!/usr/bin/env node
/**
 * Publishes the versions Changesets prepared (run by the release workflow,
 * through changesets/action, after a "Version packages" pull request is
 * merged):
 *
 * 1. `changeset pack` builds the package and packs it with pnpm, which points
 *    the entry points at dist/ (`publishConfig.exports`), for every version
 *    not on npm yet, and writes the plan with its dist-tag (`next` while in
 *    pre mode, else `latest`).
 * 2. `npm publish` uploads each tarball. In GitHub Actions npm authenticates
 *    through trusted publishing (OIDC) and adds provenance by itself; there is
 *    no token.
 * 3. A "New tag:" line per version, from which changesets/action creates the
 *    git tag and the GitHub release.
 *
 * DRY_RUN=1 packs and runs `npm publish --dry-run`.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const dryRun = process.env.DRY_RUN === '1'
const outDir = path.resolve('.release')
const run = (command, args) => execFileSync(command, args, { stdio: 'inherit' })

fs.rmSync(outDir, { force: true, recursive: true })
run('pnpm', ['exec', 'changeset', 'pack', '--out-dir', outDir])

const plan = JSON.parse(fs.readFileSync(path.join(outDir, 'publish-plan.json'), 'utf8'))
const releases = plan.plan.flat().filter((release) => release.kind === 'publish')
if (!releases.length) {
  console.log('Nothing to publish: every version is on npm already.')
  process.exit(0)
}

for (const release of releases) {
  const tarball = path.join(outDir, release.tarball.path)
  run('npm', [
    'publish',
    tarball,
    '--access',
    release.access ?? 'public',
    '--tag',
    release.tag,
    ...(dryRun ? ['--dry-run'] : []),
  ])
  const tag = `${release.name}@${release.version}`
  console.log(dryRun ? `Would tag ${tag} (dist-tag ${release.tag})` : `New tag: ${tag}`)
}
