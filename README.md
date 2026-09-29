# deskaway-protocol

The wire contract every DeskAway component speaks: JSON Schemas, shared
enums, and the versioning policy that governs them. No runtime code.

This is the root dependency of the system — `deskaway-relay`,
`deskaway-desktop`, `deskaway-android` and `deskaway-agent` all encode and
validate against these schemas.

## Status

**Early development. The envelope and the control messages are defined;
nothing else is.**

The envelope (inbound and outbound) and the five control messages — `hello`,
`heartbeat`, `goodbye`, `session-claim`, `session-evicted` — are written,
validated, and covered by examples and an end-to-end test. Pairing, task,
command, approval and replay schemas are still empty placeholders. No
generated client exists yet, and nothing has been released, so shapes can
still change.

## Running locally

There is no build and no service. You run the validator and the tests:

```sh
git clone https://github.com/away-desk/deskaway-protocol.git
cd deskaway-protocol

npm ci
npm run validate      # every schema and every example
npm test              # end-to-end envelope test
npm run validate:py   # same examples through Python, to catch disagreement
```

Each prints `ok` or `fail 0` when all is well. `docs/local-setup.md` has the
details. To understand the messages, start with `docs/wire-format.md` and
`docs/message-catalog.md`. Codegen (`npm run codegen`) and the compatibility
checker (`npm run compat`) do not exist yet.

## The rest of DeskAway

Cross-repo docs and architecture decisions live in
**[deskaway-docs](https://github.com/away-desk/deskaway-docs)**. All
components are under the **[away-desk](https://github.com/away-desk)** org.

Contributor guidance for this repo, including the rule for maintaining this
README, is in [AGENT.md](./AGENT.md).
