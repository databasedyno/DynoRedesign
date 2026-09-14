#!/usr/bin/env python3
"""Idempotent i18n additions for the donations-extras batch:
   - landing.json: v5.products.donationsLink (Fundraising & tips nav link)
   - common.json:  donation.countdown.{endsIn,d,h,m} (live campaign countdown)
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOCALES = ROOT / "langs" / "locales"

PRODUCTS_LINK = {
    "en": "Fundraising & tips",
    "de": "Fundraising & Trinkgeld",
    "es": "Recaudación y propinas",
    "fr": "Collecte & pourboires",
    "pt": "Arrecadação e gorjetas",
    "nl": "Fondsenwerving & fooien",
}

COUNTDOWN = {
    "en": {"endsIn": "Ends in {{value}}", "d": "d", "h": "h", "m": "m"},
    "de": {"endsIn": "Endet in {{value}}", "d": "T", "h": "Std", "m": "Min"},
    "es": {"endsIn": "Termina en {{value}}", "d": "d", "h": "h", "m": "min"},
    "fr": {"endsIn": "Se termine dans {{value}}", "d": "j", "h": "h", "m": "min"},
    "pt": {"endsIn": "Termina em {{value}}", "d": "d", "h": "h", "m": "min"},
    "nl": {"endsIn": "Eindigt over {{value}}", "d": "d", "h": "u", "m": "min"},
}

URGENCY = {
    "en": {"urgency": "Only {{time}} left — help it reach the goal", "urgencyNoGoal": "Only {{time}} left — chip in before it closes"},
    "de": {"urgency": "Nur noch {{time}} — hilf mit, das Ziel zu erreichen", "urgencyNoGoal": "Nur noch {{time}} — trag etwas bei, bevor es endet"},
    "es": {"urgency": "Solo quedan {{time}} — ayuda a alcanzar la meta", "urgencyNoGoal": "Solo quedan {{time}} — aporta antes de que cierre"},
    "fr": {"urgency": "Plus que {{time}} — aidez à atteindre l'objectif", "urgencyNoGoal": "Plus que {{time}} — participez avant la fin"},
    "pt": {"urgency": "Faltam apenas {{time}} — ajude a atingir a meta", "urgencyNoGoal": "Faltam apenas {{time}} — contribua antes de encerrar"},
    "nl": {"urgency": "Nog maar {{time}} — help het doel te bereiken", "urgencyNoGoal": "Nog maar {{time}} — draag bij voordat het sluit"},
}


def load(p: Path) -> dict:
    return json.loads(p.read_text(encoding="utf-8"))


def save(p: Path, data: dict) -> None:
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


for lang in PRODUCTS_LINK:
    # landing.json
    lp = LOCALES / lang / "landing.json"
    d = load(lp)
    d.setdefault("v5", {}).setdefault("products", {})["donationsLink"] = PRODUCTS_LINK[lang]
    save(lp, d)

    # common.json
    cp = LOCALES / lang / "common.json"
    c = load(cp)
    c.setdefault("donation", {})["countdown"] = COUNTDOWN[lang]
    c["donation"]["urgency"] = URGENCY[lang]["urgency"]
    c["donation"]["urgencyNoGoal"] = URGENCY[lang]["urgencyNoGoal"]
    save(cp, c)
    print(f"{lang}: OK")

print("done")
