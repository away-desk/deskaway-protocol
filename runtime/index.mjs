// Public entry point of @deskaway/protocol. Types come from
// generated/typescript; this is the one runtime a consumer needs.

import { join } from 'node:path';
import { loadContract, ROOT, MAX_MESSAGE_BYTES, ENVELOPE_VERSION } from './contract.mjs';
import { checkMessage } from './check-message.mjs';

export { MAX_MESSAGE_BYTES, ENVELOPE_VERSION };

/** Absolute path to the examples shipped with this package: valid/ and invalid/. */
export const EXAMPLES_DIR = join(ROOT, 'examples');

/**
 * Compiles every schema once and returns the checks. Build one per process
 * and reuse it: compiling is the expensive part, checking is cheap.
 */
export function createChecker() {
  const contract = loadContract();
  return {
    messageTypes: Object.freeze([...contract.messageTypes]),
    endpoints: Object.freeze([...contract.endpoints]),
    closeReasons: Object.freeze([...contract.closeReasons]),
    checkInbound: (frame, options) => checkMessage(contract, frame, { ...options, direction: 'inbound' }),
    checkOutbound: (frame, options) => checkMessage(contract, frame, { ...options, direction: 'outbound' }),
  };
}
