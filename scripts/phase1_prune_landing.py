#!/usr/bin/env python3
"""
Phase 1 — prune orphaned landing.json keys (all 6 languages).

A top-level landing key is considered USED if its name appears anywhere in the
frontend source as a QUOTED translation-key token, i.e. matches:
    ["'`] KEY ["'`.]           e.g. t("v3.hero.body"), t('nav.mega...'), `seo.title`
This precise pattern avoids false positives from common English words used as
ordinary identifiers, while still keeping dynamically-built keys (the literal
prefix like "v3.audience." still appears in source).

Conservative by design: if in doubt it KEEPS the key (over-keeping is safe,
over-deleting would show raw keys in the UI).

Usage:
  python3 scripts/phase1_prune_landing.py            # report only
  python3 scripts/phase1_prune_landing.py --apply     # prune all 6 languages
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LOCALES = os.path.join(ROOT, "langs", "locales")
LANGS = ["en", "pt", "fr", "es", "de", "nl"]
SCAN_DIRS = [os.path.join(ROOT, "Components"), os.path.join(ROOT, "pages")]
SCAN_EXT = (".tsx", ".ts", ".jsx", ".js")

# Keys we always keep regardless (page <head>/SEO/meta may be referenced oddly)
ALWAYS_KEEP = {"seo"}


def load_sources():
    blobs = []
    for base in SCAN_DIRS:
        for root, _dirs, files in os.walk(base):
            for fn in files:
                if fn.endswith(SCAN_EXT):
                    try:
                        with open(os.path.join(root, fn), encoding="utf-8") as f:
                            blobs.append(f.read())
                    except Exception:
                        pass
    return "\n".join(blobs)


def is_used(key, src):
    # match "key" 'key' `key` or "key. 'key. `key.  (quoted translation token)
    pat = r"""["'`]""" + re.escape(key) + r"""["'`.]"""
    return re.search(pat, src) is not None


def count_strings(x):
    if isinstance(x, dict):
        return sum(count_strings(v) for v in x.values())
    if isinstance(x, list):
        return sum(count_strings(v) for v in x)
    return 1 if isinstance(x, str) else 0


def main():
    apply = "--apply" in sys.argv
    src = load_sources()
    en = json.load(open(os.path.join(LOCALES, "en", "landing.json"), encoding="utf-8"))

    used, orphan = [], []
    for key in en.keys():
        if key in ALWAYS_KEEP or is_used(key, src):
            used.append(key)
        else:
            orphan.append(key)

    orphan_strings = sum(count_strings(en[k]) for k in orphan)
    print(f"TOP-LEVEL KEYS: {len(en)}  |  USED: {len(used)}  |  ORPHAN: {len(orphan)}")
    print(f"Orphaned string count (EN): {orphan_strings}")
    print("\nORPHANED (to remove):")
    for k in orphan:
        print(f"  - {k}  ({count_strings(en[k])} strings)")
    print("\nKEPT:")
    print("  " + ", ".join(used))

    if not apply:
        print("\n(report only — re-run with --apply to prune all 6 languages)")
        return

    orphan_set = set(orphan)
    for lang in LANGS:
        fp = os.path.join(LOCALES, lang, "landing.json")
        d = json.load(open(fp, encoding="utf-8"))
        before = count_strings(d)
        removed = 0
        for k in list(d.keys()):
            if k in orphan_set:
                del d[k]
                removed += 1
        after = count_strings(d)
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}: removed {removed} top-level keys | strings {before} -> {after}")


if __name__ == "__main__":
    main()
