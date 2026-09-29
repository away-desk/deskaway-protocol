# 0011. Inbound and outbound are two types, and inbound has no relay field

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

ADR 0002 split the envelope schema into inbound (no relay block allowed) and
outbound (relay block required), so a forged `from` fails at the door. The types
could either carry that split or collapse it into one envelope with an optional
relay section.

Neither generator carries it faithfully on its own. `json-schema-to-typescript`
writes the inbound envelope as `relay?: never`, which still lets code *read*
`msg.relay` (typed `undefined`). `datamodel-code-generator` writes it as
`relay: NotRequired[Any]`, which *allows* a relay block — the opposite of the
schema.

## Decision

Two types in both languages, composed by our codegen from the shared envelope
fields rather than taken from the generators:

- **TypeScript:** `InboundMessage` and `OutboundMessage` are discriminated
  unions over every message type, built from `Common` with `type` and `payload`
  replaced. An inbound message has **no** `relay` property, so `msg.relay` is a
  compile error. `switch (msg.type)` narrows `msg.payload` to that type's payload.
- **Python:** one closed `TypedDict` per type and direction (`HelloInbound`,
  `HelloOutbound`, ...), with `InboundMessage` and `OutboundMessage` as their
  unions. mypy rejects `inbound["relay"]`.

`test/types/` holds type tests in both languages proving each of these is an
error; they fail if one ever compiles.

## Rejected options

- **One envelope type with an optional relay section.** Less code, but it
  reintroduces the ambiguity ADR 0002 removed: every reader writes
  `msg.relay?.sequence` and nobody knows whether it should be there.
- **Use the generators' envelope types as they are.** TypeScript's lets a read
  through; Python's permits the relay block outright.

## Consequences

- Code holding an inbound message cannot read `sequence`: the compiler stops it.
- The relay's core job has a type signature — `stamp(msg: InboundMessage) =>
  OutboundMessage` — and that function is the only place a relay block is made.
- The composition lives in `codegen/*/generate.*`, and is derived from the
  envelope schema's own field list; a new envelope field of a shape the Python
  composer does not know fails codegen loudly rather than being skipped.
- The Python types cannot express `hello`'s role-dependent fields, nor can the
  TypeScript ones: `folder` is optional in the type. The checker enforces the
  rule at runtime.
