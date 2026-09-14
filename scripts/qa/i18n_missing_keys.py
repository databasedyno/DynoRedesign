#!/usr/bin/env python3
"""List every t()-style call with a defaultValue whose key exists in NO en/*.json namespace.
Prints: file:line alias key => english. Complements scripts/extract_missing_i18n.py (which needs a resolvable binding)."""
import glob, json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
EN = os.path.join(ROOT, "langs", "locales", "en")
present = set()
for f in glob.glob(os.path.join(EN, "*.json")):
    def walk(d, prefix=""):
        for k, v in d.items():
            present.add(prefix + k)
            if isinstance(v, dict):
                walk(v, prefix + k + ".")
    walk(json.load(open(f, encoding="utf-8")))

CALL = re.compile(r"\b(t[A-Z]?\w*)\(\s*[\"'`]([^\"'`$]+)[\"'`]\s*,\s*\{([^{}]*?defaultValue[^{}]*)\}", re.S)
DV = re.compile(r"defaultValue\s*:\s*(\"(?:[^\"\\]|\\.)*\"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)", re.S)
files = [p for pat in ("Components/**/*.tsx", "Components/**/*.ts", "pages/**/*.tsx", "Containers/**/*.tsx", "helpers/**/*.ts*", "hooks/**/*.ts*")
         for p in glob.glob(os.path.join(ROOT, pat), recursive=True)]
out = []
for fp in files:
    txt = open(fp, encoding="utf-8").read()
    for m in CALL.finditer(txt):
        alias, key, opts = m.groups()
        if alias not in ("t",) and not alias.startswith("t"):
            continue
        if key in present:
            continue
        dv = DV.search(opts)
        english = dv.group(1)[1:-1] if dv else ""
        line = txt.count("\n", 0, m.start()) + 1
        out.append((os.path.relpath(fp, ROOT), line, alias, key, english))
for rel, line, alias, key, english in sorted(out):
    print(f"{rel}:{line} {alias} {key} => {english[:100]}")
print(f"-- {len(out)} calls, {len(set(k for *_, k, _e in out))} distinct keys", file=sys.stderr)
