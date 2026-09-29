# 0003. UUID v4 ids, and the nil UUID for "no run"

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The envelope carries four identifiers: `id`, `session`, `runId` and `traceId`.
Free text would accept anything, so a malformed id would only surface deep
inside some component. Separately, `runId` has to be required, so that every
message is attributed either to a run or explicitly to none. But connection
messages such as `hello` and `heartbeat` belong to no run.

## Decision

All ids are lowercase UUID version 4, enforced by a regular expression rather
than JSON Schema's `format`, so every language's validator agrees on exactly
what passes. `runId` is required, and a message outside any run uses the nil
UUID, `00000000-0000-0000-0000-000000000000`.

## Rejected options

- **Free-text ids.** There is no shape to check, so a truncated or mistyped id
  passes validation.
- **UUID v7.** Its time ordering is attractive for storage, but not every
  language here has a standard generator yet, and ordering comes from
  `relay.sequence` anyway.
- **`format: uuid`.** Validators differ on whether `format` is enforced by
  default and on which UUID versions pass. A pattern behaves the same
  everywhere.
- **Optional `runId`.** Declined, because a required field makes "belongs to no
  run" an explicit statement rather than an omission.
- **A per-connection UUID as the runId for connection messages.** It would blur
  "connection" and "run" into one concept.

## Consequences

- Code must treat the nil UUID as "no run" and never look it up as a real run.
- Uppercase UUIDs are rejected, so every generator must emit lowercase.
