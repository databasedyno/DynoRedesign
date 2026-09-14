#!/usr/bin/env python3
"""Heuristic scanner for hardcoded English UI strings in TSX that bypass t():
 - JSX text nodes (single- or multi-line) between tags
 - text-bearing JSX attributes (label=, placeholder=, title=, aria-label=, helperText=, alt=)
 - object-literal props that are rendered verbatim (label:, hint:, title:, description:, …)
Prints file:line -> snippet grouped by file. Usage: python3 scripts/scan_hardcoded_i18n.py [path ...]"""
import os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..")
TARGETS = sys.argv[1:] or ["pages", "Components", "Containers"]
SKIP_DIRS = {"node_modules", ".next", "_archive", "ui", "admin"}
SKIP_FILES = re.compile(r"(styled|\.styled|\.test|\.stories|types?|QA)\.tsx?$")

WORD = r"[A-Za-z0-9'’,.!?&%:;()/\-—–@#+ ]"
JSX_TEXT = re.compile(r">\s*((?:[A-Z]|[a-z]{2,})" + WORD + r"*?)\s*<", re.S)
ATTR = re.compile(r"\b(label|placeholder|title|aria-label|helperText|alt|subtitle|description|tooltip|hint|caption|emptyText|primaryText|secondaryText|message)=\"([A-Za-z][^\"{}]*)\"")
OBJ = re.compile(r"\b(label|hint|title|subtitle|description|body|text|name|tagline|headline|placeholder|cta|caption|value|tip|detail|desc|summary|question|answer|q|a)\s*:\s*\"([A-Z][^\"]*\s[^\"]*)\"")
CODE_NOISE = re.compile(r"[{}=;]|=>|\bconst\b|\breturn\b|^\s*//|^\s*\*|https?:|\.(tsx?|json|png|svg)\b")
NOISE = re.compile(r"^(USD|USDT|USDC|BTC|ETH|API|OK|Dynopay|DynoPay|Emergent|N/A|ID|URL|QR|PDF|CSV|JSON|TRC20|ERC20|Polygon|Ethereum|Bitcoin|Tron|Solana|Litecoin|Dogecoin|Ripple|Stellar|Binance|English|Português|Français|Español|Deutsch|Nederlands|EN|PT|FR|ES|DE|NL|Ok|X|Twitter|LinkedIn|GitHub|Stripe|Tatum)$")

def good(s):
    s = s.strip()
    if len(s) < 3 or NOISE.match(s) or CODE_NOISE.search(s):
        return False
    if not re.search(r"[a-z]", s):
        return False
    if re.fullmatch(r"[\d\W_]+", s):
        return False
    return " " in s or len(s) > 11

hits = {}
for target in TARGETS:
    for dp, dns, fns in os.walk(os.path.join(ROOT, target)):
        dns[:] = [d for d in dns if d not in SKIP_DIRS]
        for fn in fns:
            if not fn.endswith(".tsx") or SKIP_FILES.search(fn):
                continue
            p = os.path.join(dp, fn)
            rel = os.path.relpath(p, ROOT)
            src = open(p, encoding="utf-8").read()
            # strip comments so JSDoc prose doesn't count
            code = re.sub(r"/\*.*?\*/", lambda m: "\n" * m.group(0).count("\n"), src, flags=re.S)
            code = re.sub(r"(^|\s)//[^\n]*", lambda m: m.group(1), code)
            found = []
            for m in JSX_TEXT.finditer(code):
                s = m.group(1)
                if good(s):
                    found.append((code.count("\n", 0, m.start(1)) + 1, s))
            lines = code.split("\n")
            for i, line in enumerate(lines, 1):
                if re.search(r"\bt\(|\bt[A-Z]\w*\(|<Trans|i18nKey|import ", line):
                    continue
                for m in ATTR.finditer(line):
                    if good(m.group(2)):
                        found.append((i, m.group(2)))
                for m in OBJ.finditer(line):
                    if good(m.group(2)):
                        found.append((i, m.group(2)))
            if found:
                seen = set()
                for ln, s in found:
                    key = (ln, s[:60])
                    if key in seen:
                        continue
                    seen.add(key)
                    hits.setdefault(rel, []).append((ln, re.sub(r"\s+", " ", s)[:100]))

verbose = os.environ.get("ALL") == "1"
for rel, items in sorted(hits.items(), key=lambda kv: -len(kv[1])):
    print(f"\n{rel} ({len(items)})")
    for ln, s in (items if verbose else items[:10]):
        print(f"  {ln}: {s}")
    if not verbose and len(items) > 10:
        print(f"  … +{len(items) - 10} more (ALL=1 to expand)")
print(f"\nTOTAL files: {len(hits)}  strings: {sum(len(v) for v in hits.values())}")
