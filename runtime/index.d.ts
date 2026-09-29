// Types for the @deskaway/protocol runtime. The message types themselves are
// generated; this file only describes the checker API in runtime/index.mjs.

import type {
  CloseReason,
  Endpoint,
  InboundMessage,
  MessageType,
  OutboundMessage,
} from '../generated/typescript/protocol.js';

export type * from '../generated/typescript/protocol.js';

/** 256 KiB: the largest frame any component accepts, checked before parsing. */
export declare const MAX_MESSAGE_BYTES: number;
/** The only envelope version that exists. */
export declare const ENVELOPE_VERSION: 1;
/** Absolute path to the examples shipped with this package: valid/ and invalid/. */
export declare const EXAMPLES_DIR: string;

/** One schema failure, located by JSON Pointer to the field at fault. */
export interface CheckError {
  at: string;
  keyword: string;
  message: string;
}

export type CheckResult<M> =
  | { ok: true; message: M }
  | { ok: false; closeReason: CloseReason; errors: CheckError[] };

export interface CheckOptions {
  /** The endpoint doing the checking. The payload is checked only when the message is addressed to it. */
  self: Endpoint;
  /** 'always' also checks payloads addressed elsewhere. For fixtures and tests, never for a relay. */
  payload?: 'addressed' | 'always';
  /** Injectable for tests. Defaults to JSON.parse. */
  parse?: (text: string) => unknown;
}

export interface Checker {
  readonly messageTypes: readonly MessageType[];
  readonly endpoints: readonly Endpoint[];
  readonly closeReasons: readonly CloseReason[];
  /** A frame from a device, as the relay receives it. A relay block is refused. */
  checkInbound(frame: string, options: CheckOptions): CheckResult<InboundMessage>;
  /** A frame from the relay, as a device receives it. A relay block is required. */
  checkOutbound(frame: string, options: CheckOptions): CheckResult<OutboundMessage>;
}

/** Compiles every schema once. Build one per process and reuse it. */
export declare function createChecker(): Checker;
