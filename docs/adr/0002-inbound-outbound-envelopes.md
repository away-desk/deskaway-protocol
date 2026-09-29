# 0002. Separate inbound and outbound envelopes

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The relay stamps three fields on every message it delivers: `from`,
`receivedAt` and `sequence`. They are absent on a message arriving from a
device and present on one leaving the relay, so it is the same envelope in two
states. `from` in particular must never come from the sender, or a desktop
could claim to be the phone.

## Decision

Use two schemas. `envelope-inbound.v1.json` (device → relay) forbids a `relay`
block. `envelope-outbound.v1.json` (relay → device) requires it. Shared fields
are defined once, in `envelope.v1.json`. The relay-stamped fields are grouped
under a single `relay` object.

## Rejected options

- **One schema with an optional relay block.** The schema would accept a
  sender-supplied `from`, and the protection would depend on the relay
  remembering to strip or overwrite it on every code path. A rule enforced by
  remembering eventually gets forgotten.
- **Relay fields at the top level, alongside the others.** Forbidding three
  scattered fields is easier to get subtly wrong than forbidding one object.
  Grouping them also makes it obvious at a glance which fields the relay
  vouches for.

## Consequences

- A forged relay block is refused before any code reads it, with its own close
  reason, `relay-fields-from-sender`.
- Every receiver must know which direction it is checking. Generated code will
  have two envelope types, not one.
