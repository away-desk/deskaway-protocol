// Compile-time tests. `npm run typecheck` fails if any line marked with an
// expect-error directive stops being an error — that is how "a typo is a
// build error" stays true after every regeneration. Nothing here runs.

import { createChecker, type InboundMessage, type OutboundMessage } from '@deskaway/protocol';

declare const inbound: InboundMessage;
declare const outbound: OutboundMessage;

// A misspelt field does not exist.
// @ts-expect-error — 'sesion' is not a field
inbound.sesion;
inbound.session;

// An inbound message has no relay block at all: not optional, absent.
// @ts-expect-error — inbound messages cannot carry a relay block
inbound.relay;
outbound.relay.sequence;
outbound.relay.from;

// `to` only accepts the three endpoints.
const hello: InboundMessage<'hello'> = {
  id: '6f1c2b9e-3d4a-4c8e-9b21-7a5d0e4f8c13',
  type: 'hello',
  envelopeVersion: 1,
  // @ts-expect-error — 'laptop' is not an endpoint
  to: 'laptop',
  runId: '00000000-0000-0000-0000-000000000000',
  traceId: '0a9f3e7c-6b2d-4c1a-9e8f-5d3b1a7c4e20',
  sentAt: '2026-09-29T13:00:00.000Z',
  payload: { role: 'phone', deviceId: '8d3a6c2e-5f1b-4a97-b0e4-c2f8a1d6e953', deviceName: 'p', os: 'a', appVersion: '0.1.0' },
};

// Only version 1 exists.
const v2: InboundMessage<'goodbye'> = {
  ...hello,
  type: 'goodbye',
  payload: {},
  // @ts-expect-error — envelopeVersion is the literal 1
  envelopeVersion: 2,
};

// An unknown field on a payload is refused.
const claim: InboundMessage<'session-claim'> = {
  ...hello,
  type: 'session-claim',
  // @ts-expect-error — 'desktopId' is not a field of session-claim
  payload: { desktopId: '2b7e4f1a-9c3d-4e8b-a6f2-1d0c5e9b7a34' },
};

// Narrowing on `type` gives the payload its type.
function describe(msg: InboundMessage): string {
  switch (msg.type) {
    case 'hello':
      return msg.payload.deviceName;
    case 'session-claim':
      return msg.payload.desktopDeviceId;
    case 'heartbeat':
      // @ts-expect-error — a heartbeat payload has no deviceName
      return msg.payload.deviceName;
    default:
      return msg.type;
  }
}

// The checker's results are typed by direction.
const checker = createChecker();
const inResult = checker.checkInbound('{}', { self: 'relay' });
if (inResult.ok) {
  // @ts-expect-error — an inbound result is an inbound message
  inResult.message.relay;
} else {
  const reason: 'message-too-large' | 'invalid-json' | (string & {}) = inResult.closeReason;
  void reason;
}
const outResult = checker.checkOutbound('{}', { self: 'desktop' });
if (outResult.ok) outResult.message.relay.receivedAt;

void [v2, claim, describe];
