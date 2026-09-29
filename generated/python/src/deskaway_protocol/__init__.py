# Copied by codegen/python/generate.py from codegen/python/runtime/__init__.py. Edit the source, not this copy.
"""The DeskAway wire contract for Python: generated types and the one checker.

Types (``types``, ``messages``) are for editors and type checkers only; Python
does not enforce them at runtime. Everything that arrives from a network goes
through ``create_checker()`` first.
"""

from .check import ENVELOPE_VERSION, MAX_MESSAGE_BYTES, Checker, CheckResult, create_checker
from .messages import InboundMessage, OutboundMessage, Payload
from .types import CloseReason, Endpoint, MessageType

__all__ = [
    "ENVELOPE_VERSION",
    "MAX_MESSAGE_BYTES",
    "Checker",
    "CheckResult",
    "CloseReason",
    "Endpoint",
    "InboundMessage",
    "MessageType",
    "OutboundMessage",
    "Payload",
    "create_checker",
]
