# Local setup — deskaway-protocol

There is no service here and nothing to start. Working on this repo means
editing JSON Schema and running the validator and the envelope tests over it.

## What you need

- Node 22 or newer, for the validator and the tests.
- Python 3.12 with `jsonschema` 4.18 or newer, for the cross-check
  (`pip install "jsonschema>=4.18,<5"`).
- Nothing else. No database, no credentials, no network access beyond the clone
  and `npm ci`.

## Steps

```sh
git clone https://github.com/away-desk/deskaway-protocol.git
cd deskaway-protocol

npm ci
npm run validate
npm test
npm run validate:py
```

How to tell it is working:

```
$ npm run validate
11 schemas and enums, 9 valid and 17 invalid examples checked
ok

$ npm test
ℹ tests 12
ℹ pass 12
ℹ fail 0

$ npm run validate:py
11 schemas and enums, 9 valid and 17 invalid examples checked (python)
ok
```

The numbers grow as schemas and examples are added. What matters is `ok` and
`fail 0`.

What each one checks:

- **`validate`** — every schema is valid JSON Schema 2020-12 and compiles in
  strict mode; every file in `examples/valid/` passes; every file in
  `examples/invalid/` fails with exactly the close reason it names in
  `expect.closeReason`, and at `expect.errorAt` when given; every message type
  has at least one valid example. The invalid check is what catches a schema
  that accepts too much.
- **`test`** — the end-to-end envelope test in `test/`: a desktop and phones
  talking through a stand-in relay, covering routing, stamping, clock skew,
  resume, dedupe, the size limit, eviction, and every invalid example.
- **`validate:py`** — the same examples through Python's `jsonschema` and a
  second implementation of the check order. If it disagrees with `validate`,
  two languages would treat the same message differently.

Well under ten minutes, since there is nothing to build.

## Changing a schema

1. Edit the schema under `schemas/`.
2. Add or update examples in `examples/valid/` and `examples/invalid/`. A new
   message without both is not finished. Each example is a wrapper:
   `{ description, direction: "inbound" | "outbound", message | raw, expect? }`.
   Use `raw` only for a frame that is not JSON.
3. Run all three checks above.
4. Decide whether the change is additive or breaking using
   `docs/versioning-policy.md`. The compatibility checker that will make this
   mechanical (`npm run compat`) does not exist yet.
5. If it is breaking, bump the major in `VERSION`.
6. Add a `CHANGELOG.md` entry either way.

## Regenerating clients

Not built yet — codegen is Day 3. Generated output will **not** be committed
here: emitters live in `codegen/<target>/` and their output belongs in the
consuming repo.

## When something looks wrong

- **A valid-looking example fails** — read the close reason first. The checks
  run in a fixed order (size, parse, version, relay block, type, envelope,
  payload), so the reason tells you how far the message got. An envelope field
  mismatch reports as `invalid-envelope`, not as a payload error.
- **Ajv says `strict mode: ...`** — the schema uses a keyword Ajv does not
  know, or is missing a `type` next to type-specific keywords. Add the `type`.
  A new annotation keyword must be registered in `scripts/lib/contract.mjs`.
- **`validate` and `validate:py` disagree** — usually a `format` keyword, which
  validators enforce differently. Use a `pattern` instead; that is why ids and
  timestamps are patterns.
- **`python` is not found on Windows** — `npm run validate:py` calls `python`,
  not `python3`. Make sure `python` resolves to 3.12.
- **An enum needs a new value** — that is a compatibility question, not a typo
  fix. Consumers may switch exhaustively over it.
