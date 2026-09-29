# Local setup — deskaway-protocol

There is no service here and nothing to start. Working on this repo means
editing JSON Schema, regenerating the types, and running the checks.

## What you need

- **Node 22 or newer**, for the validator, the tests and the TypeScript generator.
- **Python 3.12** in a virtual environment at `./.venv`, holding the exact codegen
  toolchain. Generated output depends on every version in
  `codegen/python/requirements.txt` — the formatters above all — so install
  exactly that set, not whatever is newest.
- Network access for the first `npm ci` and `pip install` only.

## Steps

```sh
git clone https://github.com/away-desk/deskaway-protocol.git
cd deskaway-protocol

npm ci

python -m venv .venv
.venv/Scripts/pip install -r codegen/python/requirements.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/pip install ./generated/python
```

`npm run codegen` and `npm run codegen:check` find the venv's Python by
themselves (then `$PYTHON`, then `python` on the PATH). For `validate:py` and
mypy, activate the venv first, or call `.venv/Scripts/python` directly.

Then run everything CI runs:

```sh
npm run codegen:check      # generated/ matches the schemas
npm run validate           # every schema and every example
npm test                   # end-to-end envelope test + the public API
npm run typecheck          # TypeScript type tests
npm run validate:py        # every example through the installed Python package
mypy --strict -p deskaway_protocol
mypy --strict --warn-unused-ignores test/types/python_smoke.py
```

How to tell it is working:

```
$ npm run codegen:check
codegen-verify: generated/ matches the schemas (typescript, python)

$ npm run validate
11 schemas and enums, 9 valid and 17 invalid examples checked
ok

$ npm test
ℹ tests 16
ℹ pass 16
ℹ fail 0

$ npm run validate:py
5 message types, 9 valid and 17 invalid examples checked (python)
ok
```

`typecheck` and both mypy runs print nothing but success. The numbers grow as
schemas and examples are added; what matters is `ok`, `fail 0`, and that Node
and Python report the **same** valid and invalid counts — CI fails if they
differ.

What each one checks:

- **`codegen:check`** — regenerates everything into a temp folder and compares it
  file by file with `generated/`: a hand edit, a missing file, a stray file, or
  a schema changed without regenerating all fail, naming the file and line.
- **`validate`** — every schema compiles in strict mode; every valid example
  passes; every invalid example fails with exactly its `expect.closeReason`, at
  `expect.errorAt` when given; every message type has a valid example.
- **`test`** — the end-to-end envelope test (a stand-in relay routing, stamping,
  resuming and deduping) and the public API imported by package name.
- **`typecheck`** — `test/types/envelope.types.ts`. Each line marked with an
  expect-error directive must be a type error; if a typo ever compiles, this fails.
- **`validate:py`** — the same examples through the *installed* Python package,
  so a packaging mistake fails here rather than in a consumer.
- **mypy** — the package itself under `--strict`, and the Python type tests.

## Changing a schema

1. Edit the schema under `schemas/`.
2. Add or update examples in `examples/valid/` and `examples/invalid/`. A new
   message without both is not finished. Each example is a wrapper:
   `{ description, direction: "inbound" | "outbound", message | raw, expect? }`.
   Use `raw` only for a frame that is not JSON.
3. Run `npm run codegen` and commit what it changes in `generated/`. **Never edit
   `generated/` by hand** — `codegen:check` and CI will fail it.
4. Reinstall the Python package (`pip install ./generated/python`) and run
   everything above.
5. Decide whether the change is additive or breaking using
   `docs/versioning-policy.md`. The compatibility checker that would make this
   mechanical is deferred to V2.
6. If it is breaking, bump the major in `VERSION`. Add a `CHANGELOG.md` entry
   either way.
7. After it merges, each consumer moves its pinned commit forward in its own
   pull request: `package.json` in `deskaway-relay`, `build/protocol.props` in
   `deskaway-desktop`.

## Changing a generator

The generators are `codegen/typescript/generate.mjs` and
`codegen/python/generate.py`; the Python checker source is
`codegen/python/runtime/`. Change them, run `npm run codegen`, and commit the
generator and its output together. Upgrading a pinned generator or formatter is
the same: expect `generated/` to change, and review that diff like code.

## When something looks wrong

- **`codegen:check` fails and you did not touch `generated/`** — the schema
  changed without regenerating, or your toolchain differs from
  `codegen/python/requirements.txt`. Reinstall exactly that set and rerun.
- **A `FutureWarning` about Black/isort becoming optional** — harmless. The
  Python generator is announcing that its formatters will become optional
  extras; they are installed explicitly at pinned versions, so the output does
  not change.
- **`validate:py` says the package is imported from the source tree** — install
  it (`pip install ./generated/python`) instead of pointing `PYTHONPATH` at
  `src/`; the check exists to catch schema files missing from the wheel.
- **A valid-looking example fails** — read the close reason first. The checks
  run in a fixed order (size, parse, version, relay block, type, envelope,
  payload), so the reason tells you how far the message got.
- **Ajv says `strict mode: ...`** — the schema uses a keyword Ajv does not
  know, or is missing a `type` next to type-specific keywords. A new annotation
  keyword must be registered in `runtime/contract.mjs`.
- **`validate` and `validate:py` disagree** — usually a `format` keyword, which
  validators enforce differently. Use a `pattern` instead; that is why ids and
  timestamps are patterns.
- **`python` is not found on Windows** — `npm run validate:py` calls `python`,
  not `python3`. Activate the venv, or make sure `python` resolves to 3.12.
- **An enum needs a new value** — that is a compatibility question, not a typo
  fix. Consumers may switch exhaustively over it.
