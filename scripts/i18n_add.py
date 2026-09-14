#!/usr/bin/env python3
"""Merge translation additions into all six locale files.
Input JSON shape: { "<namespace>": { "<dot.key>": { "en": "...", "de": "...", "es": "...", "fr": "...", "nl": "...", "pt": "..." } } }
Usage: python3 scripts/i18n_add.py additions.json [more.json ...]
Existing keys are overwritten only when the new value is non-empty."""
import json, sys, os, collections

ROOT = os.path.join(os.path.dirname(__file__), "..")
LOCALES = ["en", "de", "es", "fr", "nl", "pt"]


def set_path(obj, dotted, value):
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = collections.OrderedDict()
        cur = cur[p]
    cur[parts[-1]] = value


added = 0
for src in sys.argv[1:]:
    data = json.load(open(src, encoding="utf-8"), object_pairs_hook=collections.OrderedDict)
    for ns, keys in data.items():
        for loc in LOCALES:
            path = os.path.join(ROOT, "langs", "locales", loc, f"{ns}.json")
            doc = json.load(open(path, encoding="utf-8"), object_pairs_hook=collections.OrderedDict) if os.path.exists(path) else collections.OrderedDict()
            for key, tr in keys.items():
                val = tr.get(loc) or tr["en"]
                set_path(doc, key, val)
                added += 1
            with open(path, "w", encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=2)
                f.write("\n")
print(f"merged {added} key/locale pairs")
