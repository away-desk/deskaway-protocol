# 0001. Routing fields live on the envelope

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The relay is a plain relay: it passes messages between a phone and a desktop
and does not reason about them. That only holds if everything the relay needs
to route a message can be read without opening the content. Four codebases in
four languages build on whatever the outside of a message looks like, and a
field added in month three has to change in all four plus every recorded
session.

## Decision

Every message is an envelope carrying `id`, `type`, `envelopeVersion`,
`session`, `to`, `runId`, `traceId`, `sentAt` and `payload`. The destination is
written explicitly in `to` (`desktop`, `phone` or `relay`). The relay routes on
the envelope alone and opens `payload` only when `to` is `relay`.

## Rejected options

- **The relay infers the destination from `type`** ("commands go to the
  desktop"). The relay would need a table of every message type and where it
  goes, updated with every new type. That is the relay slowly becoming smart
  and fragile, which is exactly what the plain-relay decision ruled out.
- **The minimal envelope first sketched (id, type, session, trace id,
  timestamp).** It has no destination, no version and no run correlation, so
  each of those would have to be added later, in four codebases.

## Consequences

- A new message type needs no change to relay routing.
- Every sender must fill in `to` correctly. A wrong `to` is delivered to the
  wrong place rather than caught by the relay.
- The envelope is now the most expensive thing in the system to change. ADR
  0005 covers how such a change would be signalled.
