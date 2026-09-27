# deskaway-protocol

The wire contract every DeskAway component speaks: JSON Schemas, shared
enums, and the versioning policy that governs them. No runtime code.

This is the root dependency of the system — `deskaway-relay`,
`deskaway-desktop`, `deskaway-android` and `deskaway-agent` all encode and
validate against these schemas.

## Status

**Early development, nothing works yet.**

The directory layout and the message catalog's filenames are settled. The
schema files themselves are still empty placeholders — no schema validates
anything today, and no generated client exists. Do not build against this
yet; the shapes are not stable.

## Running locally

There is nothing to run. This repo has no build and no service; the payoff
is validation and codegen, and neither has an implementation yet.

Once `codegen/` and `compatibility/checker/` are filled in, the intended
loop is:

```sh
git clone https://github.com/away-desk/deskaway-protocol.git
cd deskaway-protocol

# validate every schema and every example
npm run validate

# regenerate clients for one target
npm run codegen -- --target typescript

# check a proposed change against the frozen v1 snapshot
npm run compat -- --against compatibility/snapshots/v1
```

Those commands do not exist yet. Reading is the only thing that works right
now, and `docs/wire-format.md` plus `docs/message-catalog.md` are the place
to start — they are also still empty.

## The rest of DeskAway

Cross-repo docs and architecture decisions live in
**[deskaway-docs](https://github.com/away-desk/deskaway-docs)**. All
components are under the **[away-desk](https://github.com/away-desk)** org.

Contributor guidance for this repo, including the rule for maintaining this
README, is in [AGENT.md](./AGENT.md).
