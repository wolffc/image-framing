# Changesets

Every pull request that changes what users of the package get adds a
changeset: `pnpm changeset` asks for the kind of change (patch, minor, major)
and a sentence for the changelog, and writes a file here. On `main`, the
release workflow collects them into a "Version packages" pull request; merging
that pull request publishes the new version to npm. See CONTRIBUTING.md.
