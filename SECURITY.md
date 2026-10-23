# Security

## Supported versions

Security fixes go into the latest release (the npm dist-tag `latest`), from
1.0.0 on.

## Reporting a vulnerability

Please don't open a public issue. Report it privately through
[GitHub's security advisories](https://github.com/wolffc/image-framing/security/advisories/new),
with what an attacker can do and how to reproduce it. You'll get an answer
within a week.

What counts: anything that lets someone get a cropped copy without a valid
signature or without read access to the media, read the secret, change a
crop without update access, or make the server do unbounded work.

## Releases

Every version is published from this repository's release workflow through
npm trusted publishing, with provenance: `npm view @wolffc80/payload-image-framing`
and the package page on npmjs.com show which commit and workflow built it.
