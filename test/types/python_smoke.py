"""Type-checker tests for the Python package. Nothing here runs.

Run: mypy --strict --warn-unused-ignores test/types/python_smoke.py

Each line ending in an ignore-comment must be a type error; --warn-unused-ignores
fails the run if one stops being an error. Python does not enforce these at
runtime -- the checker does -- so this only keeps the editor and mypy honest.
"""

from deskaway_protocol import InboundMessage, OutboundMessage, create_checker
from deskaway_protocol.messages import HelloInbound
from deskaway_protocol.types import HelloV1

hello_payload: HelloV1 = {
    "role": "phone",
    "deviceId": "8d3a6c2e-5f1b-4a97-b0e4-c2f8a1d6e953",
    "deviceName": "Pixel",
    "os": "Android 16",
    "appVersion": "0.1.0",
}

message: HelloInbound = {
    "id": "6f1c2b9e-3d4a-4c8e-9b21-7a5d0e4f8c13",
    "type": "hello",
    "envelopeVersion": 1,
    "to": "relay",
    "runId": "00000000-0000-0000-0000-000000000000",
    "traceId": "0a9f3e7c-6b2d-4c1a-9e8f-5d3b1a7c4e20",
    "sentAt": "2026-09-29T13:00:00.000Z",
    "payload": hello_payload,
}


def reads(inbound: InboundMessage, outbound: OutboundMessage) -> None:
    inbound.get("session")
    inbound["sesion"]  # type: ignore[typeddict-item]  # misspelt field
    inbound["relay"]  # type: ignore[typeddict-item]  # inbound has no relay block
    outbound["relay"]["sequence"]


typo: HelloV1 = {**hello_payload, "deviceNme": "x"}  # type: ignore[typeddict-unknown-key]
wrong_endpoint: HelloInbound = {**message, "to": "laptop"}  # type: ignore[typeddict-item]
wrong_version: HelloInbound = {**message, "envelopeVersion": 2}  # type: ignore[typeddict-item]

result = create_checker().check_inbound("{}")
reason: str | None = result.close_reason
