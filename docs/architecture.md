# Architecture — deskaway-protocol

## Responsibility

Defines every message DeskAway components exchange, as JSON Schema, plus the shared
enums those messages draw their vocabulary from. It is the contract four
independent codebases agree on, written once so a disagreement about what a task
looks like is a schema diff rather than a debugging session.

It is not a running component: no process, no port, no runtime dependencies.

## What it deliberately does not do

- **It contains no runtime code and no logic.** Not a validator, not a client, not a
  helper library. Those are generated or written in the consuming repos, so this
  repo has no dependencies to age and nothing to ship on a security advisory.
- **It does not commit generated code.** A checked-in artifact drifts from its
  source, and then somebody edits the artifact instead of the schema.
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

**`schemas/envelope.v1.json`** — the outer frame every message shares: identity,
type, correlation, ordering.

**`schemas/*/`** — payloads by concern. `control/` for connection lifecycle (hello,
goodbye, heartbeat, session claim and eviction); `pairing/`; `task/` for starting
work and checklist progress; `command/`; `approval/`; `replay/` for the run manifest
and model-call records.

**`enums/`** — closed vocabularies referenced by schemas: message types, task
states, autonomy levels, reversibility tiers, close reasons. Separate because all
four languages need the same constants, and because an enum gaining a value is a
compatibility question worth reviewing on its own.

**`codegen/`** — emitters for TypeScript, Python, C# and Kotlin, plus shared
`templates/`. **`compatibility/`** — `snapshots/v1/` freezes released shapes;
`checker/` diffs a proposal against them. **`examples/`** — `valid/` must pass,
`invalid/` must fail with the expected error.

### How a message flows through this repo

Nothing flows at runtime. What flows is a *change*:

1. A schema under `schemas/` is edited, or a value is added to an `enums/` file.
2. `examples/valid/` and `examples/invalid/` are updated. A new message without
   both is unfinished — `invalid/` is what catches a schema that accepts too much.
3. The validator checks that each schema is valid JSON Schema, every valid example
   passes, and every invalid example fails with the stated error.
4. `compatibility/checker/` diffs the change against `snapshots/v1/` and reports it
   as additive or breaking. That judgement is mechanical on purpose; by eye it is
   easy to get wrong.
5. If breaking, `VERSION` gets a major bump. Either way `CHANGELOG.md` gets an
   entry.
6. `codegen/<target>/` emits types **into the consuming repo**, where they are
   committed. Nothing generated lands here.
7. The consumers — relay, agent, desktop, android — pick up the new types and
   either compile or do not. `deskaway-desktop`'s `Contract.Tests` is the
   conformance check on that side.

### At runtime, in the system these schemas describe

Every message is an `envelope` wrapping one payload. A sender serializes the
payload, wraps it, and writes it; a receiver validates the envelope, switches on
its `message-type`, then validates the payload against that type's schema before
anything reads a field. Validation precedes interpretation, in every component.

## Layering rules

**The schema is the source; everything else is derived.** Generated code, snapshots
and documentation all follow from `schemas/` and `enums/`, never the other way
round.

The reason: four codebases in four languages cannot each hold an opinion about
message shape. The moment a hand-edited Kotlin data class is the real definition of
`approval-request`, the contract exists in five places and the JSON Schema is
decoration. Keeping generated output out of this repo is what enforces that — you
cannot edit what is not here.

Two more:

- **`enums/` are referenced, never inlined.** A tier list copied into a schema is a
  tier list that will diverge.
- **A payload schema never redefines an envelope field.** The envelope owns
  identity, type, correlation and ordering; payloads own everything else.

## What it talks to, and in which direction

Nothing, at runtime. At build time the direction is one way, outward:

| Direction | Peer | How |
| --- | --- | --- |
| **outbound** | `deskaway-relay` | validated against, and generated types |
| **outbound** | `deskaway-agent` | step and plan shapes |
| **outbound** | `deskaway-desktop` | generated types, checked by `Contract.Tests` |
| **outbound** | `deskaway-android` | generated types in its `protocol/` module |

This repo depends on none of them. That is what lets it be the thing they all
agree on: it has no reason to change to suit one consumer.
