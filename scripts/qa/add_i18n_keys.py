#!/usr/bin/env python3
"""Add/overwrite i18n keys across all locales. Usage: add_i18n_keys.py spec.json
spec = {"namespace": {"dot.path.key": {"en": "...", "de": "...", ...}}}  (missing langs fall back to en)."""
import json, sys, os, collections

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales")
LANGS = ["en", "de", "es", "fr", "nl", "pt"]

spec = json.load(open(sys.argv[1]))
for ns, keys in spec.items():
    for lang in LANGS:
        path = os.path.join(ROOT, lang, f"{ns}.json")
        data = json.load(open(path), object_pairs_hook=collections.OrderedDict) if os.path.exists(path) else collections.OrderedDict()
        for dotted, vals in keys.items():
            node = data
            parts = dotted.split(".")
            for p in parts[:-1]:
                node = node.setdefault(p, collections.OrderedDict())
            node[parts[-1]] = vals.get(lang, vals["en"])
        with open(path, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print("updated", path)
