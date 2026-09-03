#!/usr/bin/env python3
"""Inject sidebar group captions (Sell) + row labels (Refer & earn) for the
Sell / Money / Grow / Settings nav into all 6 locales. Idempotent."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
LANGS = ["en", "es", "pt", "fr", "de", "nl"]
SELL = {"en": "Sell", "es": "Vender", "pt": "Vender", "fr": "Vendre", "de": "Verkaufen", "nl": "Verkopen"}
REFER = {
    "en": "Refer & earn", "es": "Recomienda y gana", "pt": "Indique e ganhe",
    "fr": "Parrainez et gagnez", "de": "Empfehlen & verdienen", "nl": "Verwijs & verdien",
}


def write(path, data):
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


for lang in LANGS:
    p = os.path.join(ROOT, "langs", "locales", lang, "dashboardLayout.json")
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    d["sidebarSectionSell"] = SELL[lang]
    write(p, d)

    c = os.path.join(ROOT, "langs", "locales", lang, "common.json")
    with open(c, encoding="utf-8") as f:
        d = json.load(f)
    d.setdefault("referAndEarn", REFER[lang])
    write(c, d)
    print(f"[{lang}] dashboardLayout.sidebarSectionSell='{SELL[lang]}' common.referAndEarn='{d['referAndEarn']}'")
