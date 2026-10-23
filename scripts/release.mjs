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
 * 3. One `git-tag` event per version in the file changesets/action names in
 *    `CHANGESETS_OUTPUT`, from which it pushes the git tag (`v1.2.3`, as
 *    Changesets tags a single package) and creates the GitHub release.
 *
 * DRY_RUN=1 packs and runs `npm publish --dry-run`.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const dryRun = process.env.DRY_RUN === '1'
const outDir = path.resolve('.release')
const output = process.env.CHANGESETS_OUTPUT
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
  const tag = `v${release.version}`
  if (dryRun) {
    console.log(`Would tag ${tag} (dist-tag ${release.tag})`)
  } else {
    console.log(`New tag: ${tag}`)
    const event = { type: 'git-tag', tag, packageName: release.name }
    if (output) fs.appendFileSync(output, `${JSON.stringify(event)}\n`)
  }
}
