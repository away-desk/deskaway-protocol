# 0006. A 256 KiB message limit, checked before parsing

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The relay holds messages in memory and parses every inbound one. Without a
limit, a single oversized frame costs memory and parse time on an always-on
service. JSON Schema cannot measure bytes, so the limit cannot live in the
schemas. Full command output goes to S3, with only its tail sent over the
socket, so no planned message needs to be large.

## Decision

A frame may be at most 256 KiB (262,144 bytes of UTF-8). Every receiver checks
the size of the raw frame first, before parsing, and closes with
`message-too-large` if it is over.

## Rejected options

- **64 KiB.** Enough for everything planned today, but it leaves little margin
  as checklists and approval context grow.
- **1 MiB.** More memory per message on the relay and a larger abuse surface,
  with no planned use for the extra room.
- **No limit, relying on the WebSocket library's default.** The defaults differ
  per library, so four components would enforce four different limits.

## Consequences

- The limit is a rule in `docs/wire-format.md` and `scripts/check-message.mjs`,
  not in any schema, so each component must implement it itself. The
  `oversized` example in `examples/invalid/` checks that it does.
- Anything larger than this must travel out of band, as command output does.
