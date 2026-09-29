# Versioning policy — deskaway-protocol

Three version numbers exist. They version different things, so do not bump one
to signal a change in another.

| Version | Where | Versions |
| --- | --- | --- |
| `envelopeVersion` | inside every message | The envelope's shape only: its fields and their rules. |
| `.vN` in a schema filename | `schemas/**/<name>.vN.json` | That one schema's shape. |
| `VERSION` | repo root | The whole contract as released, in SemVer. |

## `envelopeVersion`

Only `1` exists, and the schema pins it with `const: 1`. A message claiming any
other number is closed with `unsupported-envelope-version` rather than
half-processed. It changes only when the envelope itself changes incompatibly —
which forces every component and every recorded session to deal with it, so
expect it to stay at 1 for a very long time. A payload change never touches it.
See [ADR 0005](./adr/0005-envelope-version-field.md).

## What is breaking

**Breaking** (new major in `VERSION`; new `.vN` file for that schema):

- removing or renaming a field
- changing a field's type
- tightening a constraint — a shorter `maxLength`, a stricter pattern, a
  smaller enum
- adding a required field
- making an optional field required

**Additive** (minor in `VERSION`):

- adding an optional field
- adding a new message type with its schema

Adding a value to an enum is **not automatically additive**. Consumers may
switch over an enum exhaustively, and an unknown message type closes the
connection. Treat it as breaking unless every consumer is known to tolerate it.

Loosening a constraint is also a compatibility event, because a consumer may
rely on the guarantee it provided.

## Before the first release

Nothing is released yet and `VERSION` is empty. Until the first release, shapes
change freely on `main`, and every change is still recorded in `CHANGELOG.md`.

## How consumers pin a version until Day 20

Nothing is published to npm or PyPI yet. Each consumer pins a **commit** of this
repo — `github:away-desk/deskaway-protocol#<sha>` in the relay's
`package.json`, `DeskAwayProtocolCommit` in the desktop's `build/protocol.props`
— and moves it forward in a pull request of its own, which its CI checks. A
protocol change therefore never breaks a consumer's build on its own; the
consumer finds out when it chooses to move. See ADR 0010. Day 20 replaces the
commit pins with published, versioned packages.
