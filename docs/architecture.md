# Architecture — deskaway-protocol

## Responsibility

Defines every message DeskAway components exchange, as JSON Schema, plus the shared
enums those messages draw their vocabulary from. It is the contract four
independent codebases agree on, written once so a disagreement about what a task
looks like is a schema diff rather than a debugging session.

It is not a running component: no process and no port. It does ship two small
packages — `@deskaway/protocol` for JavaScript and `deskaway-protocol` for
Python — each holding the generated types and the **one message checker**, so no
consumer writes its own check order. See ADR 0008.

## What it deliberately does not do

- **It ships no client and no helper library beyond the checker.** No socket
  code, no retry logic, no serialization helpers. The checker is the only runtime
  code, and it exists because a check order each repo rebuilt for itself would
  drift. Its one dependency is a JSON Schema validator (Ajv, `jsonschema`).
- **It never lets generated code become the definition.** Generated output *is*
  committed, in `generated/`, so consumers can take a git dependency and anyone
  can read it (ADR 0009). What stops it drifting is `codegen-verify`: CI
  regenerates from the schemas and fails on any difference, so a hand edit to
  `generated/` cannot merge.
- **It does not generate C# or Kotlin in V1.** Those are hand-written in the
  desktop and android repos and held to the schema by contract tests run against
  `examples/` (ADR 0012).
- **It does not describe transport.** Framing, ordering and encoding are documented
  in `wire-format.md`, but how a socket is opened, retried or authenticated is each
  client's business.
- **It does not describe internal shapes.** A type that never crosses a process
  boundary does not belong here, however widely it is used inside one component.
- **It does not silently relax a constraint.** Loosening a schema is a
  compatibility event, because a consumer may rely on the guarantee it provided.
- **It carries no credentials, endpoints or environment detail.** The contract is
  the same in dev and prod.

## Internal pieces, and how a message flows

**`schemas/envelope-inbound.v1.json`, `envelope-outbound.v1.json`** — the outer
frame every message shares, in its two states: as a device sends it (no relay
block allowed) and as the relay delivers it (relay block of `from`,
`receivedAt`, `sequence` required). Shared definitions live in
`envelope.v1.json`. The frame carries identity,
type, correlation, ordering.

**`schemas/*/`** — payloads by concern. `control/` for connection lifecycle (hello,
goodbye, heartbeat, session claim and eviction); `pairing/`; `task/` for starting
work and checklist progress; `command/`; `approval/`; `replay/` for the run manifest
and model-call records.

**`enums/`** — closed vocabularies referenced by schemas: message types, task
states, autonomy levels, reversibility tiers, close reasons. Separate because all
four languages need the same constants, and because an enum gaining a value is a
compatibility question worth reviewing on its own.

**`codegen/`** — the generators. `typescript/generate.mjs` and
`python/generate.py` run a pinned third-party generator for the building
blocks, then compose the message types themselves, so an inbound message has
no `relay` field at all (ADR 0011). `generate.mjs` runs both, and with
`--check` it is codegen-verify. `python/runtime/` holds the hand-written Python
checker that codegen copies into the package.

**`generated/`** — committed output, never edited by hand.
`typescript/protocol.d.ts` is the types; `python/` is an installable package
(types, message types, the checker, copies of the schemas).

**`runtime/`** — the JavaScript checker every JS consumer imports:
`contract.mjs` loads the schemas, `check-message.mjs` is the check order,
`index.mjs` is the public API (`createChecker`).

**`compatibility/`** — `snapshots/v1/` will freeze released shapes; `checker/`
will diff a proposal against them. Deferred to V2. **`examples/`** — `valid/`
must pass, `invalid/` must fail with the expected close reason. Every checker —
JavaScript, Python and the desktop's C# — runs all of them.

### How a message flows through this repo

Nothing flows at runtime. What flows is a *change*:

1. A schema under `schemas/` is edited, or a value is added to an `enums/` file.
2. `examples/valid/` and `examples/invalid/` are updated. A new message without
   both is unfinished — `invalid/` is what catches a schema that accepts too much.
3. The validator checks that each schema is valid JSON Schema, every valid example
   passes, and every invalid example fails with the stated close reason.
4. `npm run codegen` regenerates `generated/`, and the result is committed in the
   same pull request. `codegen-verify` fails the pull request if it was not.
5. Decide additive or breaking by `docs/versioning-policy.md` (the mechanical
   compatibility checker is deferred to V2). If breaking, `VERSION` gets a major
   bump. Either way `CHANGELOG.md` gets an entry.
6. After merging, each consumer moves its pinned commit forward in a pull request
   of its own — `package.json` in the relay, `build/protocol.props` in the
   desktop — and either compiles and passes its contract tests, or does not.
   `deskaway-desktop`'s `Contract.Tests` is the conformance check on the
   hand-written side.

### At runtime, in the system these schemas describe

Every message is an `envelope` wrapping one payload. A sender serializes the
payload, wraps it, and writes it; a receiver checks the frame's size, parses it,
validates the envelope, switches on its `message-type`, then validates the
payload against that type's schema before anything reads a field. Validation
precedes interpretation, in every component. The exact order and the close
reason for each failure are in `docs/wire-format.md`.

A concrete trace: the desktop sends a `heartbeat` addressed `to: phone`. The
relay checks it against `envelope-inbound`, never opens the payload, stamps a
`relay` block — `from: desktop` taken from the authenticated connection,
`receivedAt` from its own clock, the next `sequence` in the phone's stream — and
delivers it. The phone checks it against `envelope-outbound`, then checks the
payload against `control/heartbeat.v1.json`, because it is the addressee.

## Layering rules

**The schema is the source; everything else is derived.** Generated code, snapshots
and documentation all follow from `schemas/` and `enums/`, never the other way
round.

The reason: four codebases in four languages cannot each hold an opinion about
message shape. The moment a hand-edited Kotlin data class is the real definition of
`approval-request`, the contract exists in five places and the JSON Schema is
decoration. `codegen-verify` is what enforces that for generated code: a
generated file that differs from what the schema produces cannot merge. For the
hand-written C# and Kotlin, the contract tests against every example do the
same job, less strictly — which is why ADR 0012 records it as a known risk.

Two more:

- **`enums/` are referenced, never inlined.** A tier list copied into a schema is a
  tier list that will diverge.
- **A payload schema never redefines an envelope field.** The envelope owns
  identity, type, correlation and ordering; payloads own everything else.

## What it talks to, and in which direction

Nothing, at runtime. At build time the direction is one way, outward:

| Direction | Peer | How |
| --- | --- | --- |
| **outbound** | `deskaway-relay` | `@deskaway/protocol`: generated types and the checker, as a git dependency pinned to a commit |
| **outbound** | `deskaway-agent` | `deskaway-protocol` Python package, pinned the same way (from Day 32) |
| **outbound** | `deskaway-desktop` | schemas and examples downloaded at a pinned commit; hand-written types checked by `Contract.Tests` |
| **outbound** | `deskaway-android` | hand-written types in its `protocol/` module, checked against `examples/` |

Until Day 20 nothing is published to a registry: consumers pin a commit of this
repo and move it forward deliberately (ADR 0010).

This repo depends on none of them. That is what lets it be the thing they all
agree on: it has no reason to change to suit one consumer.
