# Copied by codegen/python/generate.py from codegen/python/runtime/check.py. Edit the source, not this copy.
"""The message check order, ported from runtime/check-message.mjs.

    1. size      -- raw frame over 256 KiB          -> message-too-large
    2. parse     -- not JSON                        -> invalid-json
    3. version   -- envelopeVersion is not 1        -> unsupported-envelope-version
    4. relay     -- inbound frame has a relay block -> relay-fields-from-sender
    5. type      -- type not in message-type        -> unknown-type
    6. envelope  -- fails the envelope schema       -> invalid-envelope
    7. payload   -- fails the payload schema        -> invalid-payload

The payload is checked only when the message is addressed to whoever is
checking: the relay never opens a payload it is forwarding.

This file is the source; codegen copies it into the generated package. It must
give the same result as the JavaScript and C# checkers on every example in
examples/, and the fixture runs in all three languages enforce that.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from importlib.resources import files
from importlib.resources.abc import Traversable
from typing import Any, Literal, cast

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

from .messages import InboundMessage, OutboundMessage
from .types import CloseReason, Endpoint, MessageType

MAX_MESSAGE_BYTES = 256 * 1024
ENVELOPE_VERSION = 1
_BASE = "https://deskaway.dev/protocol/"

Direction = Literal["inbound", "outbound"]
PayloadMode = Literal["addressed", "always"]


@dataclass(frozen=True)
class CheckResult:
    """The outcome of checking one frame. Exactly one of message and close_reason is set."""

    ok: bool
    message: InboundMessage | OutboundMessage | None = None
    close_reason: CloseReason | None = None


def _reject_constant(name: str) -> Any:
    # JSON.parse rejects NaN and Infinity; Python's json module would accept them.
    raise ValueError(f"not JSON: {name}")


def _json_files(root: Traversable) -> list[Traversable]:
    found: list[Traversable] = []
    for entry in sorted(root.iterdir(), key=lambda e: e.name):
        if entry.is_dir():
            found.extend(_json_files(entry))
        elif entry.name.endswith(".json"):
            found.append(entry)
    return found


class Checker:
    """Compiles every schema once. Build one per process and reuse it."""

    def __init__(self) -> None:
        contract = files("deskaway_protocol") / "_contract"
        schemas: dict[str, dict[str, Any]] = {}
        payload_ids: dict[str, str] = {}
        for entry in _json_files(contract):
            text = entry.read_text("utf-8")
            if not text.strip():
                continue
            schema = json.loads(text)
            Draft202012Validator.check_schema(schema)
            schemas[schema["$id"]] = schema

        registry: Registry[Any] = Registry().with_resources(
            (sid, Resource.from_contents(s, default_specification=DRAFT202012)) for sid, s in schemas.items()
        )

        def validator(schema_id: str) -> Draft202012Validator:
            return Draft202012Validator(schemas[schema_id], registry=registry)

        self.message_types: tuple[MessageType, ...] = tuple(schemas[_BASE + "enums/message-type.json"]["enum"])
        self.endpoints: tuple[Endpoint, ...] = tuple(schemas[_BASE + "enums/endpoint.json"]["enum"])
        self.close_reasons: tuple[CloseReason, ...] = tuple(schemas[_BASE + "enums/close-reason.json"]["enum"])
        self._envelope = {
            "inbound": validator(_BASE + "schemas/envelope-inbound.v1.json"),
            "outbound": validator(_BASE + "schemas/envelope-outbound.v1.json"),
        }
        for message_type in self.message_types:
            matches = [sid for sid in schemas if sid.startswith(_BASE + "schemas/") and sid.endswith(f"/{message_type}.v1.json")]
            if len(matches) != 1:
                raise RuntimeError(f'message type "{message_type}" matches {len(matches)} payload schemas, expected 1')
            payload_ids[message_type] = matches[0]
        self._payload = {t: validator(sid) for t, sid in payload_ids.items()}

    def check_inbound(
        self, frame: str | bytes, *, self_endpoint: Endpoint = "relay", payload: PayloadMode = "addressed"
    ) -> CheckResult:
        """A frame from a device, as the relay receives it. A relay block is refused."""
        return self._check(frame, "inbound", self_endpoint, payload)

    def check_outbound(
        self, frame: str | bytes, *, self_endpoint: Endpoint, payload: PayloadMode = "addressed"
    ) -> CheckResult:
        """A frame from the relay, as a device receives it. A relay block is required."""
        return self._check(frame, "outbound", self_endpoint, payload)

    def _check(self, frame: str | bytes, direction: Direction, self_endpoint: Endpoint, payload: PayloadMode) -> CheckResult:
        raw = frame if isinstance(frame, bytes) else frame.encode("utf-8")
        if len(raw) > MAX_MESSAGE_BYTES:
            return CheckResult(ok=False, close_reason="message-too-large")
        try:
            message = json.loads(raw.decode("utf-8"), parse_constant=_reject_constant)
        except ValueError:
            return CheckResult(ok=False, close_reason="invalid-json")
        if not isinstance(message, dict):
            return CheckResult(ok=False, close_reason="invalid-envelope")
        version = message.get("envelopeVersion")
        if isinstance(version, (int, float)) and not isinstance(version, bool) and version != ENVELOPE_VERSION:
            return CheckResult(ok=False, close_reason="unsupported-envelope-version")
        if direction == "inbound" and "relay" in message:
            return CheckResult(ok=False, close_reason="relay-fields-from-sender")
        if isinstance(message.get("type"), str) and message["type"] not in self.message_types:
            return CheckResult(ok=False, close_reason="unknown-type")
        if not self._envelope[direction].is_valid(message):
            return CheckResult(ok=False, close_reason="invalid-envelope")
        if payload == "always" or message.get("to") == self_endpoint:
            if not self._payload[message["type"]].is_valid(message["payload"]):
                return CheckResult(ok=False, close_reason="invalid-payload")
        return CheckResult(ok=True, message=cast("InboundMessage | OutboundMessage", message))


def create_checker() -> Checker:
    """Compiles every schema once. Build one per process and reuse it."""
    return Checker()
