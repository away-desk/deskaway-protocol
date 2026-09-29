// End-to-end: a desktop and phones talking through a relay, all three built
// from nothing but the real schemas and the check order in check-message.mjs.
// The relay here is a stand-in with the behaviour the envelope ADRs commit the
// real one to: route on the envelope alone, stamp the relay block from the
// connection, number each receiver's stream, close on any bad message.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { loadContract, jsonFiles, readJson, ROOT, MAX_MESSAGE_BYTES } from '../runtime/contract.mjs';
import { checkMessage } from '../runtime/check-message.mjs';

const contract = loadContract();
const NIL = '00000000-0000-0000-0000-000000000000';
const DESKTOP_ID = '2b7e4f1a-9c3d-4e8b-a6f2-1d0c5e9b7a34';
const PHONE_ID = '8d3a6c2e-5f1b-4a97-b0e4-c2f8a1d6e953';
const OTHER_PHONE_ID = '3f6b9d2c-7a1e-4c58-b3d7-e9a2c4f6b081';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Wraps a payload so any look inside it is recorded while `armed()` is true.
function watch(payload, reads, armed) {
  const note = (what) => armed() && reads.push(what);
  return new Proxy(payload, {
    get: (t, k, r) => (note(`get ${String(k)}`), Reflect.get(t, k, r)),
    has: (t, k) => (note(`has ${String(k)}`), Reflect.has(t, k)),
    ownKeys: (t) => (note('keys'), Reflect.ownKeys(t)),
    getOwnPropertyDescriptor: (t, k) => (note(`desc ${String(k)}`), Reflect.getOwnPropertyDescriptor(t, k)),
  });
}

class FakeRelay {
  constructor() {
    this.tick = 0;
    this.streams = new Map(); // `${session}:${endpoint}` -> delivered frames, index = sequence - 1
    this.online = new Map(); // `${session}:${endpoint}` -> connection
    this.desktopSessions = new Map(); // desktop deviceId -> session
    this.payloadReadsWhileForwarding = [];
    this.parseCalls = 0;
  }

  now() {
    return new Date(Date.UTC(2026, 8, 29, 13, 0, 0, this.tick++)).toISOString();
  }

  // `auth` is what the token proved; nothing in a message can change it.
  connect(auth) {
    return { auth, open: true, closeReason: null, session: null, inbox: [] };
  }

  close(conn, reason) {
    conn.open = false;
    conn.closeReason = reason;
    if (conn.session && this.online.get(`${conn.session}:${conn.auth.role}`) === conn) {
      this.online.delete(`${conn.session}:${conn.auth.role}`);
    }
  }

  receive(conn, frame) {
    assert.ok(conn.open, 'sent on a closed connection');
    const reads = [];
    let armed = true;
    const parse = (text) => {
      this.parseCalls++;
      const m = JSON.parse(text);
      if (m && typeof m.payload === 'object' && m.payload !== null) m.payload = watch(m.payload, reads, () => armed);
      return m;
    };
    const result = checkMessage(contract, frame, { direction: 'inbound', self: 'relay', parse });
    if (!result.ok) return this.close(conn, result.closeReason);
    const msg = result.message;

    if (msg.to === 'relay') return this.handleControl(conn, msg);

    // Forwarding: everything needed is on the envelope.
    armed = false;
    this.payloadReadsWhileForwarding.push(...reads);
    const stamped = { ...msg, relay: { from: conn.auth.role, receivedAt: this.now(), sequence: 0 } };
    this.deliver(conn.session, msg.to, stamped);
  }

  handleControl(conn, msg) {
    const p = msg.payload;
    switch (msg.type) {
      case 'hello': {
        if (p.role !== conn.auth.role || p.deviceId !== conn.auth.deviceId) return this.close(conn, 'device-mismatch');
        if (p.role === 'desktop') {
          conn.session = msg.session ?? this.desktopSessions.get(p.deviceId) ?? randomUUID();
          this.desktopSessions.set(p.deviceId, conn.session);
        } else {
          conn.session = msg.session ?? null; // a phone joins a session by claiming it
        }
        if (conn.session) this.online.set(`${conn.session}:${p.role}`, conn);
        if (conn.session && p.lastSeenSequence !== undefined) {
          const stream = this.streams.get(`${conn.session}:${p.role}`) ?? [];
          conn.inbox.push(...stream.slice(p.lastSeenSequence)); // same frames, same ids, same sequences
        }
        // The relay's own first message tells a new device which session it is in.
        if (conn.session) this.originate(conn.session, p.role, 'heartbeat', {});
        return;
      }
      case 'session-claim': {
        const session = this.desktopSessions.get(p.desktopDeviceId);
        const previous = this.online.get(`${session}:phone`);
        if (previous && previous !== conn) {
          this.originate(session, 'phone', 'session-evicted', {});
          this.close(previous, 'evicted');
        }
        conn.session = session;
        this.online.set(`${session}:phone`, conn);
        this.streams.delete(`${session}:phone`); // a new holder starts a fresh stream
        return;
      }
      case 'goodbye':
        return this.close(conn, 'normal');
      default:
        return; // heartbeat to the relay: liveness only
    }
  }

  originate(session, to, type, payload) {
    const receivedAt = this.now();
    this.deliver(session, to, {
      id: randomUUID(),
      type,
      envelopeVersion: 1,
      session,
      to,
      runId: NIL,
      traceId: randomUUID(),
      sentAt: receivedAt,
      payload,
      relay: { from: 'relay', receivedAt, sequence: 0 },
    });
  }

  deliver(session, to, message) {
    const key = `${session}:${to}`;
    const stream = this.streams.get(key) ?? [];
    this.streams.set(key, stream);
    message.relay.sequence = stream.length + 1;
    const frame = JSON.stringify(message);
    stream.push(frame);
    this.online.get(key)?.inbox.push(frame);
  }
}

class Device {
  constructor(role, deviceId, clock = () => new Date().toISOString()) {
    Object.assign(this, { role, deviceId, clock, session: undefined, lastSeen: 0, seen: new Set(), handled: [] });
  }

  envelope(type, payload, fields = {}) {
    return {
      id: randomUUID(),
      type,
      envelopeVersion: 1,
      ...(this.session ? { session: this.session } : {}),
      to: 'relay',
      runId: NIL,
      traceId: randomUUID(),
      sentAt: this.clock(),
      payload,
      ...fields,
    };
  }

  hello(extra = {}) {
    const payload = { role: this.role, deviceId: this.deviceId, deviceName: `test ${this.role}`, os: 'test', appVersion: '0.1.0', ...extra };
    if (this.role === 'desktop') Object.assign(payload, { folder: 'C:\\projects\\myapp', scopeVersion: 1 });
    return JSON.stringify(this.envelope('hello', payload));
  }

  receive(frame) {
    const result = checkMessage(contract, frame, { direction: 'outbound', self: this.role });
    if (!result.ok) return result.closeReason;
    const msg = result.message;
    if (this.seen.has(msg.id)) return 'duplicate';
    this.seen.add(msg.id);
    this.session ??= msg.session;
    this.lastSeen = Math.max(this.lastSeen, msg.relay.sequence);
    this.handled.push(msg);
    return 'handled';
  }

  drain(conn, count = Infinity) {
    return conn.inbox.splice(0, count).map((f) => this.receive(f));
  }
}

// Desktop online with a session, phone online and holding it.
function pairUp() {
  const relay = new FakeRelay();
  const desktop = new Device('desktop', DESKTOP_ID);
  const phone = new Device('phone', PHONE_ID);
  const dConn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  relay.receive(dConn, desktop.hello());
  desktop.drain(dConn);
  const pConn = relay.connect({ role: 'phone', deviceId: PHONE_ID });
  relay.receive(pConn, phone.hello());
  relay.receive(pConn, JSON.stringify(phone.envelope('session-claim', { desktopDeviceId: DESKTOP_ID })));
  phone.session = dConn.session;
  return { relay, desktop, phone, dConn, pConn };
}

test('a first-ever desktop hello opens a session and the relay says which', () => {
  const relay = new FakeRelay();
  const desktop = new Device('desktop', DESKTOP_ID);
  const conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  const hello = desktop.hello();
  assert.equal(JSON.parse(hello).session, undefined, 'no session key at all on a first hello');
  assert.equal(JSON.parse(hello).runId, NIL);

  relay.receive(conn, hello);
  assert.ok(conn.open, `closed with ${conn.closeReason}`);
  assert.match(conn.session, UUID_V4);
  assert.deepEqual(desktop.drain(conn), ['handled']);
  assert.equal(desktop.session, conn.session, 'desktop learns its session from the first delivered message');
});

test('the relay forwards on the envelope alone and stamps the relay block from the connection', () => {
  const { relay, desktop, phone, dConn, pConn } = pairUp();
  const payload = { currentItemId: '5a7c3e1f-8b2d-4e6a-9c4b-0f1e2d3c4b5a', currentStepId: null };
  relay.receive(dConn, JSON.stringify(desktop.envelope('heartbeat', payload, { to: 'phone' })));

  assert.ok(dConn.open);
  assert.deepEqual(relay.payloadReadsWhileForwarding, [], 'relay looked inside a payload it was only forwarding');
  assert.deepEqual(phone.drain(pConn), ['handled']);
  const got = phone.handled.at(-1);
  assert.equal(got.relay.from, 'desktop');
  assert.equal(got.relay.sequence, 1);
  assert.match(got.relay.receivedAt, /^2026-09-29T13:00:00\.\d{3}Z$/);
  assert.deepEqual(got.payload, payload);
});

test('a sender that writes its own relay block is disconnected and nothing is delivered', () => {
  const { relay, desktop, pConn, dConn } = pairUp();
  const forged = desktop.envelope('heartbeat', {}, { to: 'phone', relay: { from: 'phone', receivedAt: '2026-09-29T13:00:00Z', sequence: 1 } });
  relay.receive(dConn, JSON.stringify(forged));
  assert.equal(dConn.closeReason, 'relay-fields-from-sender');
  assert.deepEqual(pConn.inbox, []);
});

test('a wrong desktop clock is harmless: sentAt passes through, receivedAt is the relay\'s', () => {
  const { relay, phone, pConn, dConn } = pairUp();
  const skewed = new Device('desktop', DESKTOP_ID, () => '2025-01-01T00:00:00.000Z');
  skewed.session = dConn.session;
  relay.receive(dConn, JSON.stringify(skewed.envelope('heartbeat', {}, { to: 'phone' })));
  assert.ok(dConn.open);
  phone.drain(pConn);
  const got = phone.handled.at(-1);
  assert.equal(got.sentAt, '2025-01-01T00:00:00.000Z');
  assert.match(got.relay.receivedAt, /^2026-09-29T/);
});

test('resume: a reconnecting desktop gets exactly what it missed, with the same ids and sequences', () => {
  const relay = new FakeRelay();
  const desktop = new Device('desktop', DESKTOP_ID);
  let conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  relay.receive(conn, desktop.hello());
  for (let i = 0; i < 4; i++) relay.originate(conn.session, 'desktop', 'heartbeat', {});
  const sent = relay.streams.get(`${conn.session}:desktop`).map((f) => JSON.parse(f));
  assert.deepEqual(sent.map((m) => m.relay.sequence), [1, 2, 3, 4, 5]);

  desktop.drain(conn, 3); // 4 and 5 are in flight when the network drops
  relay.close(conn, 'normal');
  assert.equal(desktop.lastSeen, 3);

  conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  relay.receive(conn, desktop.hello({ lastSeenSequence: desktop.lastSeen }));
  assert.equal(conn.session, desktop.session, 'same session, not a fresh start');
  const replayed = conn.inbox.slice(0, 2).map((f) => JSON.parse(f));
  assert.deepEqual(replayed.map((m) => m.id), [sent[3].id, sent[4].id]);
  assert.deepEqual(replayed.map((m) => m.relay.sequence), [4, 5]);
  assert.deepEqual(desktop.drain(conn), ['handled', 'handled', 'handled']); // 4, 5, then the relay's new heartbeat
  assert.equal(desktop.lastSeen, 6);
});

test('dedupe: a message resent after reconnect is dropped by id, not handled twice', () => {
  const relay = new FakeRelay();
  const desktop = new Device('desktop', DESKTOP_ID);
  let conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  relay.receive(conn, desktop.hello());
  for (let i = 0; i < 4; i++) relay.originate(conn.session, 'desktop', 'heartbeat', {});
  desktop.drain(conn, 3);
  relay.close(conn, 'normal');

  // The desktop handled 1-3 but only persisted 1 before it crashed.
  conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  relay.receive(conn, desktop.hello({ lastSeenSequence: 1 }));
  assert.deepEqual(desktop.drain(conn), ['duplicate', 'duplicate', 'handled', 'handled', 'handled']);
  assert.equal(desktop.handled.length, 6);
});

test('an oversized message is refused before it is parsed', () => {
  const relay = new FakeRelay();
  const desktop = new Device('desktop', DESKTOP_ID);
  const conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  const frame = JSON.stringify(desktop.envelope('heartbeat', { pad: '' }));
  const oversized = frame.replace('"pad":""', `"pad":"${'x'.repeat(MAX_MESSAGE_BYTES - frame.length + 1)}"`);
  assert.equal(Buffer.byteLength(oversized), MAX_MESSAGE_BYTES + 1);

  relay.receive(conn, oversized);
  assert.equal(conn.closeReason, 'message-too-large');
  assert.equal(relay.parseCalls, 0);
});

test('exactly 256 KiB is still allowed through the size check', () => {
  const desktop = new Device('desktop', DESKTOP_ID);
  const frame = JSON.stringify(desktop.envelope('heartbeat', {}));
  const padded = frame + ' '.repeat(MAX_MESSAGE_BYTES - frame.length); // whitespace is valid JSON
  assert.equal(Buffer.byteLength(padded), MAX_MESSAGE_BYTES);
  assert.ok(checkMessage(contract, padded, { direction: 'inbound', self: 'relay' }).ok);
});

test('hello from a device other than the one that authenticated is refused', () => {
  const relay = new FakeRelay();
  const imposter = new Device('desktop', OTHER_PHONE_ID);
  const conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
  relay.receive(conn, imposter.hello());
  assert.equal(conn.closeReason, 'device-mismatch');

  const wrongRole = relay.connect({ role: 'phone', deviceId: DESKTOP_ID });
  relay.receive(wrongRole, new Device('desktop', DESKTOP_ID).hello());
  assert.equal(wrongRole.closeReason, 'device-mismatch');
});

test('a second phone claiming the desktop evicts the first, which is told why', () => {
  const { relay, phone, pConn } = pairUp();
  const other = new Device('phone', OTHER_PHONE_ID);
  const oConn = relay.connect({ role: 'phone', deviceId: OTHER_PHONE_ID });
  relay.receive(oConn, other.hello());
  relay.receive(oConn, JSON.stringify(other.envelope('session-claim', { desktopDeviceId: DESKTOP_ID })));

  assert.equal(pConn.closeReason, 'evicted');
  assert.ok(oConn.open);
  assert.deepEqual(phone.drain(pConn), ['handled']);
  assert.equal(phone.handled.at(-1).type, 'session-evicted');
});

test('goodbye closes cleanly', () => {
  const { relay, desktop, dConn } = pairUp();
  relay.receive(dConn, JSON.stringify(desktop.envelope('goodbye', {})));
  assert.equal(dConn.closeReason, 'normal');
});

test('every invalid example is refused with its expected close reason', () => {
  const files = jsonFiles(join(ROOT, 'examples', 'invalid'));
  assert.ok(files.length > 0);
  for (const file of files) {
    const ex = readJson(file);
    const frame = 'raw' in ex ? ex.raw : JSON.stringify(ex.message);
    let reason;
    if (ex.direction === 'inbound') {
      const relay = new FakeRelay();
      const conn = relay.connect({ role: 'desktop', deviceId: DESKTOP_ID });
      relay.receive(conn, frame);
      reason = conn.closeReason;
    } else {
      reason = new Device(ex.message.to, DESKTOP_ID).receive(frame);
    }
    assert.equal(reason, ex.expect.closeReason, file);
  }
});
