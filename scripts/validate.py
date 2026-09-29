"""npm run validate:py

The same examples through a second, independent validator (Python
jsonschema) and a second implementation of the check order in
check-message.mjs. If the two disagree about any example, one language will
accept what another rejects, and that is a contract bug.

Checks close reasons only; validate.mjs also checks the field at fault.
"""

import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator
from referencing import Registry, Resource
from referencing.jsonschema import DRAFT202012

ROOT = Path(__file__).resolve().parent.parent
MAX_MESSAGE_BYTES = 256 * 1024
ENVELOPE_VERSION = 1
BASE = "https://deskaway.dev/protocol/"


def json_files(directory):
    return sorted(p for p in directory.rglob("*.json") if p.stat().st_size > 0)


def reject_constant(name):
    # JSON.parse rejects NaN and Infinity; Python's json module accepts them.
    raise ValueError(f"not JSON: {name}")


schema_files = json_files(ROOT / "schemas") + json_files(ROOT / "enums")
schemas = {}
for path in schema_files:
    schema = json.loads(path.read_text("utf-8"))
    Draft202012Validator.check_schema(schema)
    schemas[schema["$id"]] = schema

registry = Registry().with_resources(
    (sid, Resource.from_contents(s, default_specification=DRAFT202012)) for sid, s in schemas.items()
)


def validator(schema_id):
    return Draft202012Validator(schemas[schema_id], registry=registry)


message_types = schemas[BASE + "enums/message-type.json"]["enum"]
close_reasons = schemas[BASE + "enums/close-reason.json"]["enum"]
envelope = {
    "inbound": validator(BASE + "schemas/envelope-inbound.v1.json"),
    "outbound": validator(BASE + "schemas/envelope-outbound.v1.json"),
}
payload_validators = {}
for message_type in message_types:
    matches = [p for p in (ROOT / "schemas").glob(f"*/{message_type}.v1.json")]
    if len(matches) != 1:
        sys.exit(f'message type "{message_type}" matches {len(matches)} payload schemas, expected 1')
    payload_validators[message_type] = validator(json.loads(matches[0].read_text("utf-8"))["$id"])


def check_message(frame, direction, self_endpoint, always_check_payload):
    """Returns None when the message is accepted, otherwise the close reason."""
    if len(frame.encode("utf-8")) > MAX_MESSAGE_BYTES:
        return "message-too-large"
    try:
        message = json.loads(frame, parse_constant=reject_constant)
    except ValueError:
        return "invalid-json"
    if not isinstance(message, dict):
        return "invalid-envelope"
    version = message.get("envelopeVersion")
    if isinstance(version, (int, float)) and not isinstance(version, bool) and version != ENVELOPE_VERSION:
        return "unsupported-envelope-version"
    if direction == "inbound" and "relay" in message:
        return "relay-fields-from-sender"
    if isinstance(message.get("type"), str) and message["type"] not in message_types:
        return "unknown-type"
    if not envelope[direction].is_valid(message):
        return "invalid-envelope"
    if always_check_payload or message.get("to") == self_endpoint:
        if not payload_validators[message["type"]].is_valid(message["payload"]):
            return "invalid-payload"
    return None


problems = []
counts = {}
for kind in ("valid", "invalid"):
    files = json_files(ROOT / "examples" / kind)
    counts[kind] = len(files)
    for path in files:
        example = json.loads(path.read_text("utf-8"))
        frame = example["raw"] if "raw" in example else json.dumps(example["message"], separators=(",", ":"), ensure_ascii=False)
        direction = example["direction"]
        self_endpoint = "relay" if direction == "inbound" else example["message"].get("to")
        got = check_message(frame, direction, self_endpoint, True)
        want = None if kind == "valid" else example["expect"]["closeReason"]
        name = path.relative_to(ROOT).as_posix()
        if want is not None and want not in close_reasons:
            problems.append(f'{name}: expected close reason "{want}" is not in enums/close-reason.json')
        elif got != want:
            problems.append(f"{name}: expected {want or 'pass'}, got {got or 'pass'}")

print(f"{len(schemas)} schemas and enums, {counts['valid']} valid and {counts['invalid']} invalid examples checked (python)")
if problems:
    for problem in problems:
        print(f"  FAIL {problem}", file=sys.stderr)
    sys.exit(1)
print("ok")
