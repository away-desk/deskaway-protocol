// npm run validate
//
// 1. Every schema and enum is valid JSON Schema 2020-12 and compiles.
// 2. Every example in examples/valid/ passes.
// 3. Every example in examples/invalid/ fails with exactly its expected close
//    reason, and at the expected field when it names one. An invalid example
//    that fails for the wrong reason is a schema that accepts too much.
// 4. Every message type has at least one valid example.

import { join, relative } from 'node:path';
import { loadContract, jsonFiles, readJson, ROOT } from './lib/contract.mjs';
import { checkMessage } from './check-message.mjs';

const problems = [];
const problem = (file, text) => problems.push(`${relative(ROOT, file)}: ${text}`);

let contract;
try {
  contract = loadContract();
} catch (err) {
  console.error(`schema load failed: ${err.message}`);
  process.exit(1);
}
for (const schema of contract.schemas) {
  try {
    contract.ajv.getSchema(schema.$id);
  } catch (err) {
    problems.push(`${schema.$id}: does not compile: ${err.message}`);
  }
}

// An example is a wrapper: { description, direction, message | raw, expect? }.
function readExample(file, invalid) {
  const ex = readJson(file);
  const allowed = new Set(['description', 'direction', 'message', 'raw', ...(invalid ? ['expect'] : [])]);
  for (const key of Object.keys(ex)) if (!allowed.has(key)) problem(file, `unknown wrapper key "${key}"`);
  if (typeof ex.description !== 'string' || !ex.description) problem(file, 'needs a description');
  if (!['inbound', 'outbound'].includes(ex.direction)) problem(file, 'direction must be inbound or outbound');
  if (('message' in ex) === ('raw' in ex)) problem(file, 'needs exactly one of message or raw');
  if (invalid && !contract.closeReasons.includes(ex.expect?.closeReason)) {
    problem(file, `expect.closeReason "${ex.expect?.closeReason}" is not in enums/close-reason.json`);
  }
  const frame = 'raw' in ex ? ex.raw : JSON.stringify(ex.message);
  // The relay checks inbound; the addressee checks outbound.
  const self = ex.direction === 'inbound' ? 'relay' : ex.message?.to;
  return { ex, frame, self };
}

const covered = new Set();
const validFiles = jsonFiles(join(ROOT, 'examples', 'valid'));
for (const file of validFiles) {
  const { ex, frame, self } = readExample(file, false);
  const result = checkMessage(contract, frame, { direction: ex.direction, self, payload: 'always' });
  if (!result.ok) {
    const where = result.errors.map((e) => `${e.at || '/'} ${e.message}`).join('; ');
    problem(file, `should pass but closed with ${result.closeReason}${where ? ` (${where})` : ''}`);
  } else {
    covered.add(result.message.type);
  }
}

const invalidFiles = jsonFiles(join(ROOT, 'examples', 'invalid'));
for (const file of invalidFiles) {
  const { ex, frame, self } = readExample(file, true);
  const result = checkMessage(contract, frame, { direction: ex.direction, self, payload: 'always' });
  const want = ex.expect?.closeReason;
  if (result.ok) {
    problem(file, `should fail with ${want} but passed`);
  } else if (result.closeReason !== want) {
    problem(file, `should fail with ${want} but failed with ${result.closeReason}`);
  } else if (ex.expect.errorAt !== undefined && !result.errors.some((e) => e.at === ex.expect.errorAt)) {
    const got = result.errors.map((e) => e.at || '/').join(', ');
    problem(file, `should fail at ${ex.expect.errorAt} but failed at ${got}`);
  }
}

for (const type of contract.messageTypes) {
  if (!covered.has(type)) problems.push(`message type "${type}" has no example in examples/valid/`);
}

console.log(
  `${contract.schemas.length} schemas and enums, ` +
    `${validFiles.length} valid and ${invalidFiles.length} invalid examples checked`,
);
if (problems.length) {
  for (const p of problems) console.error(`  FAIL ${p}`);
  process.exit(1);
}
console.log('ok');
