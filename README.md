# deskaway-protocol

The wire contract every DeskAway component speaks: JSON Schemas, shared
enums, and the versioning policy that governs them. No runtime code.

This is the root dependency of the system — `deskaway-relay`,
`deskaway-desktop`, `deskaway-android` and `deskaway-agent` all encode and
validate against these schemas.

## Status

**Early development. The envelope and the control messages are defined, and
consumers can build against them; nothing else is.**

The envelope (inbound and outbound) and the five control messages — `hello`,
`heartbeat`, `goodbye`, `session-claim`, `session-evicted` — have schemas,
examples, generated TypeScript and Python types, and a checker in each
language. Pairing, task, command, approval and replay schemas are still empty
placeholders. Nothing is published to a registry yet (that is Day 20):
consumers pin a commit of this repo. Shapes can still change.

## Running locally

There is no build and no service. You regenerate the types and run the checks:

```sh
git clone https://github.com/away-desk/deskaway-protocol.git
cd deskaway-protocol

npm ci
python -m venv .venv && .venv/Scripts/pip install -r codegen/python/requirements.txt

npm run codegen:check   # generated/ matches the schemas
npm run validate        # every schema and every example
npm test                # end-to-end envelope test and the public API
npm run typecheck       # a field typo must fail to compile
```

`docs/local-setup.md` has the full list, including the Python checks, and what
healthy output looks like. To understand the messages, start with
`docs/wire-format.md` and `docs/message-catalog.md`.

### Using it from another repo

```jsonc
// package.json — pin a commit; move it forward on purpose
"@deskaway/protocol": "github:away-desk/deskaway-protocol#<commit>"
```

```ts
import { createChecker, type InboundMessage } from '@deskaway/protocol';
```

Python: `pip install "deskaway-protocol @ git+https://github.com/away-desk/deskaway-protocol@<commit>#subdirectory=generated/python"`.

## The rest of DeskAway

Cross-repo docs and architecture decisions live in
**[deskaway-docs](https://github.com/away-desk/deskaway-docs)**. All
components are under the **[away-desk](https://github.com/away-desk)** org.

Contributor guidance for this repo, including the rule for maintaining this
README, is in [AGENT.md](./AGENT.md).
