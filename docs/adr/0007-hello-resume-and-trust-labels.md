# 0007. hello carries resume, and labels verified versus self-reported fields

- **Date:** 2026-09-29
- **Status:** Accepted
- **Supersedes:** none
- **Superseded by:** none

## Context

A device's first message must introduce it. A reconnecting device must also say
where it left off, so the relay can resend what it missed. The relay can check
some of what a device says about itself against the authenticated connection,
but most of it the relay cannot check. That information later appears on the
phone's pairing and approval screens, where it looks like fact.

## Decision

One `hello` message does both jobs. It carries:

- `role` and `deviceId`, which are verified against the connection
- `deviceName`, `os` and `appVersion`, plus `folder` and `scopeVersion` for a
  desktop, all of which are self-reported
- `lastSeenSequence`, which is absent on a first connection

`role` selects the shape: a desktop must send `folder` and `scopeVersion`, and
a phone must not. Each field carries an `x-deskaway-trust` annotation of
`verified` or `self-reported`.

## Rejected options

- **A separate resume message.** That means two round trips before work can
  continue, when a reconnecting device sends `hello` anyway.
- **Scope fields optional for every device.** A desktop `hello` without a
  folder would pass.
- **Separate `hello-desktop` and `hello-phone` types.** A new type and schema
  for what is one handshake.
- **Not labelling trust.** Six months on, the folder on the approval screen
  gets read as enforced.

## Consequences

- The folder shown on the phone is the desktop's claim. The relay cannot verify
  it, because scope is a carried value rather than an OS-enforced wall. This is
  recorded in `deskaway-docs/security/threat-model.md`.
- The relay can refuse an outdated client on connect, using `appVersion`.
