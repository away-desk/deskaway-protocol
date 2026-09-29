# 0010. Consume the protocol as a pinned git dependency; publish at Day 20

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

The structure document describes four published packages — npm, PyPI, NuGet and
Maven. Publishing properly means registry accounts, credentials in CI, a release
process, and version numbers that mean something. Right now there is one
developer changing the schemas daily, and one real consumer.

Publishing this early makes every schema tweak a three-step ritual: change,
publish, bump the consumer — then discover the change was wrong and do it
again. Version numbers start to matter at Day 20, when contract tests run across
all four repos and "which protocol is the desktop on" needs a real answer.

## Decision

Until Day 20, consumers depend on this repo directly, **pinned to a commit**:

- **relay** — `"@deskaway/protocol": "github:away-desk/deskaway-protocol#<sha>"`
- **agent** — `pip install "deskaway-protocol @ git+https://github.com/away-desk/deskaway-protocol@<sha>#subdirectory=generated/python"`
- **desktop** — `DeskAwayProtocolCommit` in `build/protocol.props`; the build
  downloads that commit's schemas and examples

Moving to a newer protocol is a one-line pull request in the consumer, checked by
its CI. Day 20 publishes `@deskaway/protocol` and `deskaway-protocol`, versioned
from `VERSION`, and moves the consumers onto them; the task is written into the
implementation plan so it is not skipped.

The package is the repo root because npm cannot install a git dependency from a
subdirectory. `package.json` keeps `private: true`, which blocks an accidental
publish without affecting git installs.

## Rejected options

- **Publish now.** The version story would be right from the first commit, at
  the cost of setup time and friction on every schema change while the schemas
  are least stable.
- **Track `main` instead of a commit.** Faster while iterating, but a protocol
  change would break a consumer's CI with no change in the consumer, and two
  builds of the same consumer commit could differ.
- **Copy the files into each consumer.** A third copy that drifts silently.

## Consequences

- Builds are reproducible: the pin, and each consumer's lockfile, name an exact
  commit.
- A protocol change reaches a consumer only when that consumer moves its pin, so
  consumers can lag behind — deliberately and visibly.
- The publishing work is deferred, not avoided. If Day 20 slips, this ADR is
  what says the pins are temporary.
