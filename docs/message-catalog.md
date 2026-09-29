# Message catalog — deskaway-protocol

Every message type, who sends it, and when. The schema for each is
`schemas/<category>/<type>.v1.json`; examples are in `examples/valid/`.

Only the control messages exist so far. Pairing, task, command, approval and
replay messages arrive on their own days in the implementation plan.

## Control

| Type | From → to | When |
| --- | --- | --- |
| `hello` | desktop or phone → relay | First message on every connection, including reconnects. |
| `heartbeat` | any → any | Every 7 seconds on an open connection, faster while a job is active. |
| `goodbye` | desktop or phone → relay | Deliberate disconnect. |
| `session-claim` | phone → relay | A phone takes control of a desktop. |
| `session-evicted` | relay → desktop or phone | The device lost its session to another claim; the relay closes it with `evicted` straight after. |

### `hello`

Two jobs: introduce the device, and say where it left off.

| Field | Who | Trust | Notes |
| --- | --- | --- | --- |
| `role` | both | **verified** | `desktop` or `phone`. Must match what the device authenticated as. |
| `deviceId` | both | **verified** | Must match the authenticated device. |
| `deviceName` | both | self-reported | |
| `os` | both | self-reported | |
| `appVersion` | both | self-reported | SemVer. Lets the relay turn away a client too old for this contract. |
| `folder` | desktop only | self-reported | The folder the desktop says it will work in. Required for a desktop, forbidden for a phone. |
| `scopeVersion` | desktop only | self-reported | Required for a desktop, forbidden for a phone. |
| `lastSeenSequence` | both | self-reported | Absent on a first connection. The relay resends everything after it. |

**Verified** means the relay checks the field against the authenticated
connection and closes with `device-mismatch` if they differ. **Self-reported**
means the relay has no way to check it. Each field carries the annotation
`x-deskaway-trust` saying which.

The one self-reported field that matters is `folder`. Scope is a carried value,
not an OS-enforced wall, so the folder shown on the phone's approval screen is
the desktop's promise, not a guarantee. Any screen that shows it must present it
as the desktop's claim. This is recorded in the threat model in
`deskaway-docs/security/threat-model.md`.

### `heartbeat`

Optional `currentItemId` and `currentStepId`, each a UUID or `null`. Both are
empty until there are jobs to report. Seven seconds without one marks the peer
DEGRADED; thirty-five seconds, LOST.

### `goodbye`

Empty payload. Lets the relay mark the device gone immediately instead of
waiting out the 35-second grace window.

### `session-claim`

`desktopDeviceId`: the desktop being claimed. One phone and one desktop per
session; a claim evicts the phone that held it before. Deliberately minimal
until Day 14, where the claim rules are designed.

### `session-evicted`

Empty payload. Deliberately minimal until Day 14.
