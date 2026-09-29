# Wire format — deskaway-protocol

How a DeskAway message looks on the socket. The schemas are the definition;
this page explains them and the rules a schema cannot express.

## Framing and encoding

- One message per WebSocket text frame. The frame is a single JSON object,
  UTF-8 encoded.
- **Maximum 256 KiB (262,144 bytes) per frame**, measured on the raw UTF-8
  bytes *before* parsing. JSON Schema cannot count bytes, so every receiver
  checks size first and closes with `message-too-large` without parsing. See
  [ADR 0006](./adr/0006-256-kib-message-limit.md).
- Field names are **camelCase** on the wire: `sentAt`, `traceId`,
  `receivedAt`. Each language maps to its own convention at its edge. See
  [ADR 0004](./adr/0004-camelcase-on-the-wire.md).
- **Unknown fields are rejected**, at every level. A typo such as `sesion`
  fails loudly instead of leaving `session` silently empty.

## The envelope

Every message is an envelope: routing information on the outside, content in
`payload`. The relay reads the outside and — unless the message is addressed
to the relay itself — never opens the payload. See
[ADR 0001](./adr/0001-routing-fields-on-the-envelope.md).

There are two envelope schemas, one per direction
([ADR 0002](./adr/0002-inbound-outbound-envelopes.md)):

| Schema | Travels | Relay block |
| --- | --- | --- |
| `envelope-inbound.v1.json` | desktop or phone → relay | **forbidden** |
| `envelope-outbound.v1.json` | relay → desktop or phone | **required** |

Shared definitions live in `envelope.v1.json`, which nothing validates against
directly.

### Fields

| Field | Required | Shape | Meaning |
| --- | --- | --- | --- |
| `id` | yes | UUID v4 | Identifies the message. A resend after reconnect keeps its id, so receivers drop ids they have handled. |
| `type` | yes | `enums/message-type.json` | Which payload schema applies. |
| `envelopeVersion` | yes | `1` | Version of the envelope shape only. See [ADR 0005](./adr/0005-envelope-version-field.md). |
| `session` | no | UUID v4 | The session. **Absent** — key missing, never `""` — until one exists. |
| `to` | yes | `enums/endpoint.json` | `desktop`, `phone` or `relay`. The relay routes on this alone. |
| `runId` | yes | UUID v4 or nil UUID | The run; `00000000-0000-0000-0000-000000000000` when the message belongs to none. See [ADR 0003](./adr/0003-uuid-v4-ids-and-nil-run-id.md). |
| `traceId` | yes | UUID v4 | Correlates one user action across every hop and log line. |
| `sentAt` | yes | UTC timestamp | The sender's clock. Informational only. |
| `payload` | yes | object | The content, validated against the schema `type` names. |
| `relay` | outbound only | object | Stamped by the relay; see below. |

The relay block:

| Field | Shape | Meaning |
| --- | --- | --- |
| `relay.from` | `enums/endpoint.json` | The sender, taken from the authenticated connection — never from the message. |
| `relay.receivedAt` | UTC timestamp | The relay's clock. **The authoritative time** for ordering, timeouts and recordings. |
| `relay.sequence` | integer ≥ 1 | Position in the session's stream to this receiver. Drives resume. |

### Timestamps

RFC 3339, UTC, ending in `Z`, optional fractional seconds:
`2026-09-29T13:00:00.412Z`. Enforced by pattern rather than `format` so every
language's validator agrees. A sender's wrong clock never gets a message
rejected: `sentAt` is carried as the sender's claim, and `relay.receivedAt` is
the time anything is decided on.

### Ids

Every id is a lowercase UUID version 4, enforced by pattern. The one exception
is `runId`, which may also be the nil UUID.

## Check order

Every receiver checks a message in this order and stops at the first failure,
which names the close reason (`enums/close-reason.json`). The reference
implementation is `scripts/check-message.mjs`.

1. **Size** over 256 KiB → `message-too-large`
2. **Parse** fails → `invalid-json`
3. **`envelopeVersion`** is a number other than 1 → `unsupported-envelope-version`
4. **Relay block** present on an inbound message → `relay-fields-from-sender`
5. **`type`** not in the enum → `unknown-type`
6. **Envelope** schema fails → `invalid-envelope`
7. **Payload** schema fails → `invalid-payload`, checked only by the addressee

The relay closes the connection on any failure. See
`deskaway-relay/docs/adr/0002-invalid-message-closes-connection.md`.

## Resume and duplicates

`relay.sequence` numbers each session's stream to each receiver from 1. A
reconnecting device puts the last sequence it saw in `hello.lastSeenSequence`,
and the relay resends everything after it — the same frames, with the same ids
and sequences. Anything resent that the device had already handled is dropped
by `id`.
