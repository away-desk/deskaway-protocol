# Local setup — deskaway-protocol

There is no service here and nothing to start. Working on this repo means
editing JSON Schema and running the validator over it.

**The validator does not exist yet.** There is no `package.json`, so the
commands below describe the intended toolchain rather than something you can run
today. Correct this page in the same pull request that makes them work.

## What you need

- Node, for the schema validator and the code generators.
- Nothing else. No database, no credentials, no network access beyond the clone.

## Steps

```sh
git clone https://github.com/away-desk/deskaway-protocol.git
cd deskaway-protocol

npm ci
npm run validate
```

`validate` should check three things: every schema is itself valid JSON Schema,
every file in `examples/valid/` passes the schema it claims to match, and every
file in `examples/invalid/` fails with the error it is supposed to produce. That
last one is the check that catches a schema which accepts too much.

Well under ten minutes, since there is nothing to build.

## Changing a schema

1. Edit the schema under `schemas/`.
2. Add or update examples in `examples/valid/` and `examples/invalid/`. A new
   message without both is not finished.
3. Run the compatibility checker against the frozen snapshot:

   ```sh
   npm run compat -- --against compatibility/snapshots/v1
   ```

   It should tell you whether your change is additive or breaking. Do not
   decide that by eye — `docs/versioning-policy.md` has the rules, and the
   checker exists because the rules are easy to get wrong.

4. If it is breaking, bump the major in `VERSION`.
5. Add a `CHANGELOG.md` entry either way.

## Regenerating clients

```sh
npm run codegen -- --target typescript      # or python, csharp, kotlin
```

Generated output is **not** committed here. Emitters live in `codegen/<target>/`
and their output belongs in the consuming repo. If you find yourself editing
generated code, the emitter or the schema is what needs the change.

## Checking a change against the real consumers

A schema change is not really validated until something encodes and decodes it.
The fastest loop is to regenerate for one target, copy the types into that repo
on a branch, and see whether it still compiles. `deskaway-relay` is usually the
best first check, since it touches nearly every message type.

## When something looks wrong

- **A valid-looking example fails** — check `envelope.v1.json` first. Most
  payload examples are wrapped, and an envelope field mismatch reports as a
  payload error.
- **The compatibility checker objects to something that feels harmless** —
  read `docs/versioning-policy.md` before overriding it. Tightening a constraint
  and adding a required field are both breaking, even though neither looks like
  it.
- **An enum needs a new value** — that is a compatibility question, not a typo
  fix. Consumers may switch exhaustively over it.
