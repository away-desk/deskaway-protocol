// Runs every generator.
//
//   node codegen/generate.mjs           regenerate generated/ in place
//   node codegen/generate.mjs --check   regenerate into a temp folder and fail
//                                       if generated/ differs in any way
//
// --check is codegen-verify. It catches a hand-edited generated file, a
// deleted or stray one, and a schema changed without regenerating. It needs
// the exact Python toolchain in codegen/python/requirements.txt; it finds
// Python in $PYTHON, then ./.venv, then on the PATH.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TARGETS = ['typescript', 'python'];
const check = process.argv.includes('--check');

function python() {
  if (process.env.PYTHON) return process.env.PYTHON;
  for (const p of ['.venv/Scripts/python.exe', '.venv/bin/python']) if (existsSync(join(ROOT, p))) return join(ROOT, p);
  return 'python';
}

function run(target, out) {
  const [cmd, script] =
    target === 'typescript'
      ? [process.execPath, 'codegen/typescript/generate.mjs']
      : [python(), 'codegen/python/generate.py'];
  const r = spawnSync(cmd, [script, '--out', out], { cwd: ROOT, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`codegen: ${target} generator failed${r.error ? `: ${r.error.message}` : ''}`);
    process.exit(1);
  }
}

// Left behind by `pip install ./generated/python`. Git ignores them, so they can
// never be committed; they are not generator output and are not compared.
const BUILD_ARTIFACT = /^(build|dist|__pycache__|.*\.egg-info)$/;

function files(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    if (BUILD_ARTIFACT.test(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...files(full).map((f) => join(name, f)));
    else out.push(name);
  }
  return out;
}

if (!check) {
  for (const target of TARGETS) run(target, join(ROOT, 'generated', target));
  process.exit(0);
}

const temp = mkdtempSync(join(tmpdir(), 'deskaway-codegen-'));
const drift = [];
try {
  for (const target of TARGETS) {
    const fresh = join(temp, target);
    const committed = join(ROOT, 'generated', target);
    run(target, fresh);
    const want = new Set(files(fresh));
    const have = new Set(files(committed));
    for (const f of want) {
      const rel = relative(ROOT, join(committed, f)).replaceAll('\\', '/');
      if (!have.has(f)) {
        drift.push(`missing   ${rel}`);
        continue;
      }
      // Line endings are normalised: a Windows checkout must not count as drift.
      const a = readFileSync(join(fresh, f), 'utf8').replace(/\r\n/g, '\n');
      const b = readFileSync(join(committed, f), 'utf8').replace(/\r\n/g, '\n');
      if (a !== b) {
        const al = a.split('\n');
        const bl = b.split('\n');
        const line = al.findIndex((l, i) => l !== bl[i]);
        drift.push(`changed   ${rel}:${line + 1}\n            expected: ${al[line] ?? '<end of file>'}\n            found:    ${bl[line] ?? '<end of file>'}`);
      }
    }
    for (const f of have) {
      if (!want.has(f)) drift.push(`unexpected ${relative(ROOT, join(committed, f)).replaceAll('\\', '/')}`);
    }
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (drift.length) {
  console.error('codegen-verify: generated/ does not match the schemas.\n');
  for (const d of drift) console.error(`  ${d}`);
  console.error('\nNever edit generated/ by hand. Change the schema, then run `npm run codegen` and commit the result.');
  process.exit(1);
}
console.log(`codegen-verify: generated/ matches the schemas (${TARGETS.join(', ')})`);
