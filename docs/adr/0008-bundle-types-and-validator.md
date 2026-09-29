# 0008. The package ships the types and the validator together

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

Unit 3 turns the schemas into types. Types are a compile-time promise about the
code you write; they say nothing about what arrives from a socket, which is
just text until something checks it against the schema. Every consumer needs
both.

The check itself is not neutral. Unit 2 fixed an order — size, parse, version,
relay block, type, envelope, payload — and a close reason for each failure
(ADR 0006, `docs/wire-format.md`). If each consumer loads the schemas and wires
up a validator itself, the relay and the agent will each make small choices
differently: strict mode on in one, size checked after parsing in another.
They then disagree about whether a message is valid, on only some messages.

## Decision

Each package ships the generated types **and** the checker:

- `@deskaway/protocol` — `generated/typescript/protocol.d.ts` plus `runtime/`
  (`createChecker()`), with Ajv as its one runtime dependency.
- `deskaway-protocol` (Python) — generated `TypedDict`s plus
  `deskaway_protocol.check`, with `jsonschema` as its one runtime dependency.

The JavaScript check order moved from `scripts/check-message.mjs` (where ADR
0006 names it) to `runtime/check-message.mjs`, so the code consumers import is
the code the tests run.

## Rejected options

- **Types only.** Every consumer would rebuild validation for itself, and the
  check order would become a suggestion that drifts.
- **A separate validator package.** Two packages to pin and bump together, for
  no gain: nobody wants the types without being able to trust the data.

## Consequences

- One import gives a consumer both the type and the function that proves a
  message matches it.
- A consumer that only wants types still installs a validation library. Small.
- The check order now exists in three languages — the JavaScript runtime, the
  Python port, and the desktop's hand-written C# (ADR 0012). All three must run
  every example in `examples/` and agree; CI compares the Node and Python counts.
