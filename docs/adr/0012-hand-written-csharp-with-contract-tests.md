# 0012. C# types are hand-written, and held to the schema by contract tests on every build

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The V1 plan generates code for TypeScript and Python only; C# and Kotlin types
are written by hand, saving roughly four days of generator work for two
consumers.

That saving has a price, and it lands in the worst place. Generated code cannot
disagree with the schema; hand-written code can. C# is the desktop — the
component that runs shell commands on a real machine. If its idea of a message
drifts from the schema, the wrong behaviour happens in the most dangerous
component, and nothing at compile time will notice.

## Decision

Hand-write the C# types, in `deskaway-desktop/src/DeskAway.Protocol`, and treat
the contract tests as the thing that makes that acceptable:

- The project holds the wire records and a **C# port of the checker** (same
  order, same close reasons), validating against the real schemas.
- The build downloads the schemas and examples at the protocol commit pinned in
  `build/protocol.props`; there is no hand-copied fixture set.
- `DeskAway.Desktop.Contract.Tests` runs on **every** build, over **every**
  example, not a sample: every valid example passes the checker, deserializes and
  round-trips to identical JSON; every invalid one fails with exactly its close
  reason. The C# enums must equal `enums/*.json`, and each record's properties
  and `required` set must equal its schema's — which catches an optional field no
  example happens to exercise. A count check fails the run if fewer tests ran
  than there are examples.
- When writing a type, work from the schema file open beside it, field by field,
  with the test written first.

## Rejected options

- **Generate C# now.** The safest option, and the one the full structure
  document describes; deferred for the time it costs. NuGet publishing arrives
  with Day 20, and C# generation can follow it.
- **Hand-write with a sample of fixtures.** A sample passes while an unexercised
  field drifts. Every example, every build, or the tests are decoration.

## Consequences

- This is a **known, accepted risk**, recorded here with its mitigation. The
  contract tests are the only thing between the schema and the desktop's
  behaviour; weakening them — skipping on CI, running a subset — removes the
  mitigation and reopens the risk.
- A new message type or envelope field fails the desktop build until the C# is
  written, because the enum-parity and property checks are exhaustive. That is
  the intended friction.
- The check order exists in three languages (ADR 0008). The same examples keep
  all three honest.
- Revisit when a second C# consumer appears, or when a C# drift bug reaches
  runtime despite the tests: either is the signal to generate.
