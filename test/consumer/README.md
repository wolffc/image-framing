# Consumer app fixture

A fresh Payload + Next project that uses the packed package the way an app
would: the plugin with its default options (no editor paths) and a client
component importing `@wolffc80/payload-image-framing/core`.
`scripts/pack-smoke.sh` copies it into a scratch directory together with the
admin routes from `dev/app/(payload)`, installs the tarball, generates the
import map and runs `next build`.
