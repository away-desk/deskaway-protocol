# Changelog

All notable changes to this repository are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this repository follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Generated TypeScript types (generated/typescript/protocol.d.ts) and a
  Python package (generated/python), committed and checked by a new Codegen
  verify workflow that fails on any difference from the schemas.
- @deskaway/protocol: the repo is now a package shipping the types and the
  message checker (createChecker), consumed as a pinned git dependency.
- Discriminated InboundMessage and OutboundMessage types in both languages;
  an inbound message has no relay field, so reading one is a type error.
- Python package deskaway-protocol with the checker ported to Python, strict
  mypy clean.
- Type tests in TypeScript and Python proving a field typo fails to compile,
  and a CI step failing if Node and Python checked different example counts.
- ADRs 0008 to 0012: bundling types and validator, committing generated code,
  git dependency until Day 20, two envelope types, hand-written C# held by
  contract tests.

- Envelope v1, in two schemas: inbound (device to relay, relay block
  forbidden) and outbound (relay to device, relay block of from, receivedAt
  and sequence required), with shared definitions in envelope.v1.json.
- Control message schemas: hello (with resume and trust-labelled fields),
  heartbeat, goodbye, session-claim, session-evicted.
- Enums: message-type (the five control types), close-reason, and a new
  endpoint enum (desktop, phone, relay).
- Wire rules: UUID v4 ids, nil UUID for no run, camelCase names, UTC
  timestamps, unknown fields rejected, 256 KiB frame limit checked before
  parsing.
- Examples: 9 valid and 17 invalid, each invalid one naming the close reason
  it must produce.
- Tooling: npm run validate, a Python cross-check (npm run validate:py), and
  an end-to-end envelope test (npm test), all run in CI.
- ADRs 0001 to 0007 for the envelope decisions; wire-format, message-catalog
  and versioning-policy docs written.
- Source-of-truth rule in AGENT.md: the two V1 plan files in the parent
  folder are authoritative, changes land there first, and neither is edited
  without explicit approval.
- SECURITY.md: reporting route corrected. Private vulnerability reporting is a
  public-repository feature and was never enabled, so the file now routes
  reports through a repo issue and carries a checklist to work through before
  any repo goes public.
- Pre-commit secret check in AGENT.md, plus CI steps enforcing that no
  credential-shaped file is tracked and that .gitignore blocks key material.
- Pull request template prompt: which doc changed, or why none was needed.
- Component documentation: docs/architecture.md, docs/local-setup.md and
  docs/adr/ with the ADR format and template. Upkeep rules for each in
  AGENT.md.
- CI workflow: repo hygiene checks that run today, plus stack-specific lint,
  build and test steps that activate once there is code to run them on.
- Contribution workflow rule: every change goes on a branch and through a
  pull request, and any GitHub write needs approval first (AGENT.md,
  CLAUDE.md).
- Repository scaffolding: agreed directory layout and project documentation
  (README, AGENT.md, CONTRIBUTING, SECURITY, LICENSE).

### Changed

- The check order moved from scripts/check-message.mjs to
  runtime/check-message.mjs, so the code consumers import is the code tested.
- scripts/validate.py now runs the installed Python package's checker instead
  of its own copy of the logic.
- ajv is now a runtime dependency; the package supports Node 22 and newer.
- SECURITY.md rewritten for a public repository: vulnerabilities are reported
  through GitHub private vulnerability reporting, and the protections section
  now lists secret scanning, push protection and branch protection. The
  go-public checklist is removed, having been completed. AGENT.md's SECURITY.md
  rule updated to match.

### Removed

- Empty placeholder workflow files, replaced by the CI workflow above. The
  deploy, release, publish and security pipelines will return when there is
  code and credentials to make them real.

Nothing has been released yet and no version has been tagged. Entries
accumulate here until the first release, at which point this heading becomes
that version and a fresh `[Unreleased]` opens above it.

Note for this repo specifically: the version here is the *wire contract*
version, mirrored in `VERSION`. A breaking schema change bumps the major and
every consuming repo has to react, so an entry here is never routine — see
`docs/versioning-policy.md`.
