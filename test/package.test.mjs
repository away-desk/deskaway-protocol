// The public API, imported by package name exactly as a consumer imports it,
// so the exports map, createChecker and EXAMPLES_DIR are what is tested.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChecker, EXAMPLES_DIR, MAX_MESSAGE_BYTES, ENVELOPE_VERSION } from '@deskaway/protocol';

const checker = createChecker();
const examples = (kind) =>
  readdirSync(join(EXAMPLES_DIR, kind))
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ file: f, ...JSON.parse(readFileSync(join(EXAMPLES_DIR, kind, f), 'utf8')) }));

function check(ex) {
  const frame = 'raw' in ex ? ex.raw : JSON.stringify(ex.message);
  return ex.direction === 'inbound'
    ? checker.checkInbound(frame, { self: 'relay', payload: 'always' })
    : checker.checkOutbound(frame, { self: ex.message.to, payload: 'always' });
}

test('constants', () => {
  assert.equal(MAX_MESSAGE_BYTES, 262144);
  assert.equal(ENVELOPE_VERSION, 1);
  assert.deepEqual(checker.messageTypes, ['hello', 'heartbeat', 'goodbye', 'session-claim', 'session-evicted']);
});

test('every valid example passes through the public API', () => {
  const all = examples('valid');
  assert.ok(all.length > 0);
  for (const ex of all) assert.equal(check(ex).ok, true, ex.file);
});

test('every invalid example fails with its expected close reason through the public API', () => {
  const all = examples('invalid');
  assert.ok(all.length > 0);
  for (const ex of all) {
    const result = check(ex);
    assert.equal(result.ok, false, ex.file);
    assert.equal(result.closeReason, ex.expect.closeReason, ex.file);
  }
});

test('a relay does not open a payload it is only forwarding', () => {
  const frame = JSON.stringify({
    id: '6f1c2b9e-3d4a-4c8e-9b21-7a5d0e4f8c13',
    type: 'hello',
    envelopeVersion: 1,
    to: 'phone',
    runId: '00000000-0000-0000-0000-000000000000',
    traceId: '0a9f3e7c-6b2d-4c1a-9e8f-5d3b1a7c4e20',
    sentAt: '2026-09-29T13:00:00.000Z',
    payload: { not: 'a hello payload' },
  });
  assert.equal(checker.checkInbound(frame, { self: 'relay' }).ok, true);
  assert.equal(checker.checkInbound(frame, { self: 'relay', payload: 'always' }).closeReason, 'invalid-payload');
});
