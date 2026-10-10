#!/usr/bin/env python3
"""FIAT/crypto audit (2026-06): adds `common.fxLabel.*` — the "rate as of hh:mm" /
"Shown in USD" caption next to fiat totals. Idempotent. Usage: python3 scripts/i18n/fx_label_i18n.py"""
import json
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "langs", "locales")

FX = {
    "en": {
        "asOf": "Rate as of {{time}}",
        "asOfHint": "The live exchange rate is briefly unavailable, so we're using the last known rate. Payments are not affected.",
        "fallback": "Shown in USD · {{currency}} rate unavailable",
        "fallbackHint": "We couldn't get a {{currency}} exchange rate, so these amounts are in US dollars. They switch back automatically.",
    },
    "de": {
        "asOf": "Kurs von {{time}}",
        "asOfHint": "Der Live-Wechselkurs ist kurz nicht verfügbar, daher verwenden wir den zuletzt bekannten Kurs. Zahlungen sind nicht betroffen.",
        "fallback": "In USD angezeigt · {{currency}}-Kurs nicht verfügbar",
        "fallbackHint": "Wir konnten keinen {{currency}}-Wechselkurs abrufen, daher sind diese Beträge in US-Dollar. Sie wechseln automatisch zurück.",
    },
    "es": {
        "asOf": "Tipo de cambio de las {{time}}",
        "asOfHint": "El tipo de cambio en vivo no está disponible por un momento, así que usamos el último conocido. Los pagos no se ven afectados.",
        "fallback": "Mostrado en USD · tipo de {{currency}} no disponible",
        "fallbackHint": "No pudimos obtener un tipo de cambio de {{currency}}, así que estos importes están en dólares estadounidenses. Volverán a cambiar automáticamente.",
    },
    "fr": {
        "asOf": "Taux de {{time}}",
        "asOfHint": "Le taux de change en direct est brièvement indisponible, nous utilisons donc le dernier taux connu. Les paiements ne sont pas affectés.",
        "fallback": "Affiché en USD · taux {{currency}} indisponible",
        "fallbackHint": "Nous n'avons pas pu obtenir de taux de change {{currency}}, ces montants sont donc en dollars américains. Ils reviendront automatiquement.",
    },
    "nl": {
        "asOf": "Koers van {{time}}",
        "asOfHint": "De live wisselkoers is even niet beschikbaar, dus gebruiken we de laatst bekende koers. Betalingen worden niet beïnvloed.",
        "fallback": "Getoond in USD · {{currency}}-koers niet beschikbaar",
        "fallbackHint": "We konden geen {{currency}}-wisselkoers ophalen, dus deze bedragen staan in Amerikaanse dollars. Ze schakelen automatisch terug.",
    },
    "pt": {
        "asOf": "Câmbio das {{time}}",
        "asOfHint": "A taxa de câmbio ao vivo está indisponível por um momento, então usamos a última conhecida. Os pagamentos não são afetados.",
        "fallback": "Exibido em USD · câmbio de {{currency}} indisponível",
        "fallbackHint": "Não conseguimos obter uma taxa de câmbio de {{currency}}, então estes valores estão em dólares americanos. Eles voltam automaticamente.",
    },
}

for lang, keys in FX.items():
    path = os.path.join(ROOT, lang, "common.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data["fxLabel"] = keys
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{lang}: fxLabel ({len(keys)} keys)")
