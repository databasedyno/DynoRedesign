#!/usr/bin/env python3
"""Set / update i18n keys across all 6 locales in one go (idempotent).

Usage:  python3 scripts/copy/i18n_set.py <spec.json>
Spec:   { "<namespace>": { "<dotted.key>": { "en": "...", "es": "...", "fr": "...", "de": "...", "pt": "...", "nl": "..." } } }
        A value of null deletes the key in that locale.
Files:  langs/locales/<locale>/<namespace>.json (2-space indent, UTF-8, key order preserved; new keys appended).
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / "langs" / "locales"
LOCALES = ["en", "es", "fr", "de", "pt", "nl"]


def set_path(obj, dotted, value):
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        if not isinstance(cur.get(p), dict):
            cur[p] = {}
        cur = cur[p]
    if value is None:
        cur.pop(parts[-1], None)
    else:
        cur[parts[-1]] = value


def main(spec_path):
    spec = json.loads(Path(spec_path).read_text())
    changed = 0
    for ns, keys in spec.items():
        for loc in LOCALES:
            f = ROOT / loc / f"{ns}.json"
            data = json.loads(f.read_text()) if f.exists() else {}
            for dotted, per_loc in keys.items():
                val = per_loc.get(loc, per_loc.get("en"))
                set_path(data, dotted, val)
                changed += 1
            f.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    print(f"ok — {changed} key writes across {len(LOCALES)} locales")


if __name__ == "__main__":
    main(sys.argv[1])
