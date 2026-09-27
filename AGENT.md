# AGENT.md — deskaway-protocol

The wire contract between every DeskAway component. Nothing here is code
that runs; it is JSON Schema, enums, and the rules for changing them. When a
schema in this repo and an implementation elsewhere disagree, this repo is
right and the implementation is broken.

Changes here ripple into `deskaway-relay`, `deskaway-desktop`,
`deskaway-android` and `deskaway-agent` at once. Treat every edit as a
breaking-change question first.

## Folder structure

```
.github/
  CODEOWNERS
  pull_request_template.md
  workflows/
    validate.yml          # schema linting + example validation
    codegen-verify.yml    # generated output matches committed schemas
    publish.yml           # release the versioned contract
schemas/
  envelope.v1.json        # outer frame every message shares
  control/                # hello, goodbye, heartbeat, session-claim,
                          #   session-evicted
  pairing/                # pair-announce, pair-approve, pair-code
  task/                   # task-start, task-complete, checklist-item,
                          #   checklist-update
  command/                # command-request, command-result
  approval/               # approval-request, approval-response
  replay/                 # run-manifest, model-call-record
enums/                    # shared closed vocabularies
  message-type.json       #   every envelope type
  task-state.json
  autonomy-level.json
  reversibility-tier.json
  close-reason.json
codegen/                  # per-language emitters; output is NOT committed
  typescript/  python/  csharp/  kotlin/
  templates/              # shared emitter templates
compatibility/
  checker/                # diffs a proposed schema against a snapshot
  snapshots/v1/           # frozen v1 shapes, for regression checks
examples/
  valid/                  # must pass validation
  invalid/                # must fail, with the expected error
docs/
  wire-format.md          # framing, ordering, encoding
  message-catalog.md      # every message and when it is sent
  versioning-policy.md    # what may change within a major version
VERSION                   # current contract version
CHANGELOG.md              # every contract change, newest first
```

Directories holding only a `.gitkeep` are agreed structure with no content
yet. `codegen/*/` will hold emitters, not generated artifacts — generated
code is built in the consuming repos, never committed here.

## Conventions

- Schema files are named `<message>.v<major>.json` and live in the folder
  matching their envelope category.
- A new field that is optional is a minor change. Anything else — renaming,
  removing, retyping, tightening a constraint, adding a required field — is
  a new major version.
- Every schema change adds a `CHANGELOG.md` entry and, if it is breaking,
  bumps `VERSION`.
- Every new message ships with at least one example under `examples/valid/`
  and one under `examples/invalid/`.

## Rule: keep README.md current

The README is the one file a newcomer is guaranteed to read. Revisit it
whenever this repo's answer to any of the four questions below changes — not
on a schedule.

Every DeskAway README answers four things, in this order:

1. **What this one repo is**, in two lines, and where it sits in the whole
   system.
2. **Its current status**, stated honestly. Right now that is *early
   development, nothing works yet.*
3. **How to run it locally**, aiming for under ten minutes.
4. **A link back** to the org or to `deskaway-docs`, so someone landing here
   can find the rest.

How to apply it:

- Keep those four as the first four sections, in that order. Anything else
  goes after them.
- Status rots fastest. The moment the first thing in this repo actually
  runs, that line changes in the same PR. "Nothing works yet" is honest
  only until it isn't.
- If a setup step breaks, or creeps past ten minutes, fix the README in the
  PR that caused it. A stale run section is worse than no run section.
- Never write intent as if it were fact. Anything not yet true is either
  labelled as planned or left out entirely.
- Two lines means two lines. If section 1 needs a third paragraph, that
  content belongs in `deskaway-docs`.
