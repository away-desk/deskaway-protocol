// The order every component checks a message in. JavaScript consumers import
// this exact code through @deskaway/protocol. The Python package
// (codegen/python/runtime/check.py) and the desktop's C# MessageChecker are
// ports that must agree with it on every example in examples/.
//
//   1. size      — raw frame over 256 KiB          -> message-too-large
//   2. parse     — not JSON                        -> invalid-json
//   3. version   — envelopeVersion is not 1        -> unsupported-envelope-version
//   4. relay     — inbound frame has a relay block -> relay-fields-from-sender
//   5. type      — type not in message-type        -> unknown-type
//   6. envelope  — fails the envelope schema       -> invalid-envelope
//   7. payload   — fails the payload schema        -> invalid-payload
//
// Steps 3–5 run before full validation so the close reason names the specific
// problem instead of a generic invalid-envelope. Step 7 only runs when the
// message is addressed to whoever is checking: the relay never opens a payload
// it is forwarding.

import { Buffer } from 'node:buffer';
import { MAX_MESSAGE_BYTES, ENVELOPE_VERSION } from './contract.mjs';

const fail = (closeReason, errors = []) => ({ ok: false, closeReason, errors });

// Flatten an Ajv error to the JSON Pointer of the field at fault.
function locate(error) {
  const p = error.params ?? {};
  const name = p.missingProperty ?? p.additionalProperty ?? p.unevaluatedProperty;
  return {
    at: name === undefined ? error.instancePath : `${error.instancePath}/${name}`,
    keyword: error.keyword,
    message: error.message,
  };
}

/**
 * @param contract   from loadContract()
 * @param frame      the raw text as it came off the socket
 * @param direction  'inbound' (sender -> relay) or 'outbound' (relay -> receiver)
 * @param self       the endpoint doing the checking: 'relay', 'desktop' or 'phone'
 * @param payload    'addressed' (default) checks the payload only when to === self;
 *                   'always' checks it regardless — for fixtures, not for a relay
 * @param parse      injectable for tests; defaults to JSON.parse
 */
export function checkMessage(contract, frame, { direction, self, payload = 'addressed', parse = JSON.parse }) {
  if (direction !== 'inbound' && direction !== 'outbound') throw new Error(`bad direction: ${direction}`);

  if (Buffer.byteLength(frame, 'utf8') > MAX_MESSAGE_BYTES) return fail('message-too-large');

  let message;
  try {
    message = parse(frame);
  } catch {
    return fail('invalid-json');
  }

  if (message === null || typeof message !== 'object' || Array.isArray(message)) {
    return fail('invalid-envelope', [{ at: '', keyword: 'type', message: 'must be object' }]);
  }
  if (typeof message.envelopeVersion === 'number' && message.envelopeVersion !== ENVELOPE_VERSION) {
    return fail('unsupported-envelope-version');
  }
  if (direction === 'inbound' && Object.hasOwn(message, 'relay')) {
    return fail('relay-fields-from-sender');
  }
  if (typeof message.type === 'string' && !contract.messageTypes.includes(message.type)) {
    return fail('unknown-type');
  }

  const envelope = contract.envelope[direction];
  if (!envelope(message)) return fail('invalid-envelope', envelope.errors.map(locate));

  if (payload === 'always' || message.to === self) {
    const validatePayload = contract.payload(message.type);
    if (!validatePayload(message.payload)) {
      return fail(
        'invalid-payload',
        validatePayload.errors.map((e) => ({ ...locate(e), at: `/payload${locate(e).at}` })),
      );
    }
  }

  return { ok: true, message };
}
