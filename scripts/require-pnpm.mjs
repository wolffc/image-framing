// Run before publishing. Only pnpm applies `publishConfig.exports`, which
// points the entry points at dist/; npm would publish entry points into src/,
// which isn't in the package.
const agent = process.env.npm_config_user_agent ?? ''
if (!agent.startsWith('pnpm/')) {
  console.error('Publish with pnpm (`pnpm publish`): npm ignores publishConfig.exports.')
  process.exit(1)
}
