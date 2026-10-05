#!/usr/bin/env python3
"""Apply exact-match replacements to a file; every target must match exactly once (or `count` times)."""
import json
import sys
from pathlib import Path


def apply(path, edits):
    p = Path(path)
    s = p.read_text()
    for i, e in enumerate(edits):
        old, new = e["old"], e["new"]
        want = e.get("count", 1)
        got = s.count(old)
        if got != want:
            raise SystemExit(f"[{path}] edit #{i} expected {want} match(es), found {got}:\n{old[:200]}")
        s = s.replace(old, new)
    p.write_text(s)
    print(f"ok {path}: {len(edits)} edits")


if __name__ == "__main__":
    spec = json.loads(Path(sys.argv[1]).read_text())
    for path, edits in spec.items():
        apply(path, edits)
