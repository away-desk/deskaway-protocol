# 0009. Commit generated code, and enforce it with codegen-verify

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

Until now this repo's docs said generated code is never committed here: a
checked-in artifact drifts from its source, and then someone edits the artifact
instead of the schema. That rule assumed each consumer would run the generators
in its own build.

Two things changed. Consumers take a git dependency on this repo (ADR 0010), and
npm installs a git dependency as-is — anything not in the repo does not exist
for the relay. And four codebases each needing the generator toolchain installed
is a real cost for no benefit.

The drift risk is real, though. A generated file edited by hand still compiles
and still works, and the claim "the schemas are the source of truth" becomes
false while still looking true.

## Decision

Commit generated output in `generated/`, and make CI prove it matches the
schemas. `npm run codegen:check` (the `Codegen verify` workflow) regenerates
everything into a temp folder with the pinned toolchain and fails on any
difference: a hand-edited file, a deleted or stray one, or a schema changed
without regenerating. `generated/` is never edited by hand.

Generators:

- **TypeScript:** `json-schema-to-typescript` 16.0.0 for the building blocks.
  Annotations beside a `$ref` are stripped in memory before generating, because
  they make the generator emit duplicated, renamed types (`Endpoint1`). The cost
  is that fields typed by a `$ref` lose their hover docs; the docs stay in the
  schemas and `wire-format.md`.
- **Python:** `datamodel-code-generator` 0.83.0 producing `TypedDict`s, with
  black and isort pinned. Every version is in `codegen/python/requirements.txt`.
- **Message types are composed, not generated,** in both languages — see ADR 0011.

Both generators were checked before adoption: closed types, no network access,
required fields matching, and byte-identical output across runs.

## Rejected options

- **Generate at build time in each consumer.** No drift possible, but nothing is
  readable in the repo, every consumer needs both toolchains, and a git
  dependency would have nothing to install.
- **Commit without a check.** The drift the old rule warned about, with nothing
  to stop it.
- **Write our own emitters.** Considered as the fallback if the generators
  failed their checks. They passed, with the two workarounds above, so a
  maintained generator is less code for us to own.

## Consequences

- Anyone can read the generated types in the repo, and a git dependency works.
- A generator or formatter upgrade shows up as a diff in `generated/`, reviewed
  like code.
- codegen-verify depends on exact tool versions; an unpinned formatter would
  fail it for no real reason. That is why the Python toolchain is a full freeze.
- The generators work around two known behaviours (sibling annotations, and the
  inbound `relay`). If either generator is replaced, those checks must move with
  it: `codegen/*/generate.*` fails loudly if the output changes shape.
