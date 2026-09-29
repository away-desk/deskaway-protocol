# 0005. envelopeVersion versions the envelope only

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

When the envelope changes, a receiver must be able to tell which shape it is
looking at before it trusts any field. There are also payload schemas and a
released contract version, and it was unclear which of these a version number
on the message should describe.

## Decision

Every envelope carries `envelopeVersion`, pinned to `1` by `const`. It versions
the envelope's shape only. Payload shapes are versioned by their schema
filename (`.v1.json`) and by the contract `VERSION`. A message with any other
`envelopeVersion` is closed with `unsupported-envelope-version`.

## Rejected options

- **No version field.** A future envelope change could only be detected by
  guessing from which fields are present.
- **One version for the envelope and payload together.** Every payload change
  would bump it, so it would stop meaning "the outside changed", which is the
  one thing a relay needs to know.
- **Accept unknown versions and do the best we can.** A half-understood envelope
  is worse than a refused one.

## Consequences

- A version-2 envelope is a coordinated change across every component and every
  recorded session, so it should be very rare.
- Client age is handled separately, by `hello.appVersion`.
