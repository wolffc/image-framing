# Changelog

All notable changes to `@wolffc/payload-image-framing` are listed here. The
format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the
package uses [Semantic Versioning](https://semver.org/).

## Unreleased

- Extracted from weflyhome.com (`src/plugins/imageFraming`) with its history.
- Package layout after Payload's plugin template, with a Docker-based dev app.
- Entry points `.`, `./core`, `./server`, `./client` and `./next`.
- Supports Payload `^3.39.0`.
- `./core` has no Node imports and works in the browser; the crop token
  signing moved to `./server`, together with `frameImage`.
- Every entry point lists its exports explicitly; `./next` re-exports
  `frameImage` until it gets Next-only helpers.
