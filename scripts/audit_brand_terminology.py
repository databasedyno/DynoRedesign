#!/usr/bin/env python3
"""Report locale strings where EN says brand/Brand but the translation still uses a company-word."""
import json, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")
COMPANY_WORDS = {
    "de": r"\b(Unternehmen|Unternehmens|Firma|Firmen|Gesellschaft)\b",
    "es": r"\b(empresa|empresas|compañía|compañías|sociedad)\b",
    "fr": r"\b(entreprise|entreprises|société|sociétés|compagnie)\b",
    "nl": r"\b(bedrijf|bedrijven|onderneming|ondernemingen)\b",
    "pt": r"\b(empresa|empresas|companhia|companhias)\b",
}

def flatten(d, prefix=""):
    out = {}
    for k, v in d.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        elif isinstance(v, str):
            out[key] = v
    return out

def main():
    en_dir = os.path.join(ROOT, "en")
    hits = 0
    for fname in sorted(os.listdir(en_dir)):
        if not fname.endswith(".json"):
            continue
        en = flatten(json.load(open(os.path.join(en_dir, fname), encoding="utf-8")))
        for lang, pat in COMPANY_WORDS.items():
            p = os.path.join(ROOT, lang, fname)
            if not os.path.exists(p):
                continue
            tr = flatten(json.load(open(p, encoding="utf-8")))
            for key, en_val in en.items():
                if not re.search(r"\bbrands?\b", en_val, re.I):
                    continue
                val = tr.get(key)
                if val and re.search(pat, val, re.I):
                    hits += 1
                    print(f"{lang}/{fname} :: {key}\n   EN: {en_val}\n   {lang.upper()}: {val}")
    print(f"\n{hits} mismatches")
    return 1 if hits else 0

if __name__ == "__main__":
    sys.exit(main())
