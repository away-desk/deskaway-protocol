// Loads every schema and enum in this repo into one Ajv instance, so any file
// can $ref any other by its $id. Tooling only — consumers generate their own.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// 256 KiB of UTF-8, checked on the raw frame before it is parsed.
export const MAX_MESSAGE_BYTES = 256 * 1024;
export const ENVELOPE_VERSION = 1;

const ENVELOPE_IDS = {
  inbound: 'https://deskaway.dev/protocol/schemas/envelope-inbound.v1.json',
  outbound: 'https://deskaway.dev/protocol/schemas/envelope-outbound.v1.json',
};

export function jsonFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...jsonFiles(full));
    else if (name.endsWith('.json') && statSync(full).size > 0) out.push(full);
  }
  return out;
}

export const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

export function loadContract() {
  // strictRequired is off because if/then legitimately requires properties
  // declared at the top level (hello: a desktop must send folder).
  const ajv = new Ajv2020({ strict: true, strictRequired: false, allErrors: true });
  // Annotation only: marks a field as checked by the relay or merely claimed.
  ajv.addKeyword({
    keyword: 'x-deskaway-trust',
    schemaType: 'string',
    metaSchema: { enum: ['verified', 'self-reported'] },
  });

  const files = [...jsonFiles(join(ROOT, 'schemas')), ...jsonFiles(join(ROOT, 'enums'))];
  const byFile = new Map();
  for (const file of files) {
    const schema = readJson(file);
    if (!schema.$id) throw new Error(`${relative(ROOT, file)}: missing $id`);
    ajv.addSchema(schema); // throws if the schema is not valid 2020-12
    byFile.set(file, schema);
  }

  const enumOf = (name) => readJson(join(ROOT, 'enums', `${name}.json`)).enum;
  const messageTypes = enumOf('message-type');

  // Each message type names exactly one payload schema: schemas/<category>/<type>.v1.json.
  const payloadIds = new Map();
  for (const type of messageTypes) {
    const matches = [...byFile].filter(
      ([file]) => basename(file) === `${type}.v1.json` && relative(join(ROOT, 'schemas'), dirname(file)) !== '',
    );
    if (matches.length !== 1) {
      throw new Error(`message type "${type}" matches ${matches.length} payload schemas, expected 1`);
    }
    payloadIds.set(type, matches[0][1].$id);
  }

  return {
    ajv,
    files: [...byFile.keys()],
    schemas: [...byFile.values()],
    messageTypes,
    endpoints: enumOf('endpoint'),
    closeReasons: enumOf('close-reason'),
    envelope: {
      inbound: ajv.getSchema(ENVELOPE_IDS.inbound),
      outbound: ajv.getSchema(ENVELOPE_IDS.outbound),
    },
    payload: (type) => ajv.getSchema(payloadIds.get(type)),
  };
}
