"""npm run validate:py

Every example through the Python package's checker (generated/python), which
must be installed first: `pip install ./generated/python`. Installed, not
imported from the source tree, so a packaging mistake (schemas missing from
the wheel) fails here rather than in a consumer.

If this disagrees with `npm run validate` about any example, Python and
JavaScript would treat the same message differently: a contract bug.
Checks close reasons only; validate.mjs also checks the field at fault.
"""

import json
import sys
from pathlib import Path

try:
    import deskaway_protocol
    from deskaway_protocol import create_checker
except ImportError:
    sys.exit("deskaway_protocol is not installed. Run: pip install ./generated/python")

ROOT = Path(__file__).resolve().parent.parent
if Path(deskaway_protocol.__file__).resolve().is_relative_to(ROOT / "generated" / "python" / "src"):
    sys.exit("deskaway_protocol is imported from the source tree. Install it: pip install ./generated/python")

checker = create_checker()
problems = []
counts = {}
for kind in ("valid", "invalid"):
    files = sorted(p for p in (ROOT / "examples" / kind).rglob("*.json") if p.stat().st_size > 0)
    counts[kind] = len(files)
    for path in files:
        example = json.loads(path.read_text("utf-8"))
        frame = example["raw"] if "raw" in example else json.dumps(example["message"], separators=(",", ":"), ensure_ascii=False)
        if example["direction"] == "inbound":
            result = checker.check_inbound(frame, payload="always")
        else:
            result = checker.check_outbound(frame, self_endpoint=example["message"]["to"], payload="always")
        want = None if kind == "valid" else example["expect"]["closeReason"]
        name = path.relative_to(ROOT).as_posix()
        if want is not None and want not in checker.close_reasons:
            problems.append(f'{name}: expected close reason "{want}" is not in enums/close-reason.json')
        elif result.close_reason != want:
            problems.append(f"{name}: expected {want or 'pass'}, got {result.close_reason or 'pass'}")

print(f"{len(checker.message_types)} message types, {counts['valid']} valid and {counts['invalid']} invalid examples checked (python)")
if problems:
    for problem in problems:
        print(f"  FAIL {problem}", file=sys.stderr)
    sys.exit(1)
print("ok")
