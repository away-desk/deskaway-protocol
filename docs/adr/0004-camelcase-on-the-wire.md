# 0004. camelCase field names on the wire

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The four consumers have different habits: C# writes `SentAt`, Kotlin and
TypeScript write `sentAt`, and Python writes `sent_at`. Without one convention
on the wire, a field serialized one way and read another is silently empty
instead of raising an error.

## Decision

The wire uses camelCase. Each language maps to its own convention at its
serialization boundary.

## Rejected options

- **snake_case.** Natural only for Python, so three of the four consumers would
  have to convert.
- **Each side uses its native case.** This guarantees silent mismatches.

## Consequences

- The C# and Python serializers must be configured for camelCase. Contract
  tests against `examples/` catch a misconfiguration, because unknown fields
  are rejected.
