#!/usr/bin/env python3
"""One-off: remove the public "+ $1" fixed-fee itemisation from landing + fees copy
(6 locales). The $1 is still charged and still shown in-app under Settings › Plan & fees;
it is just no longer advertised publicly. Idempotent text replacement (preserves formatting)."""
import io, sys

REPL = {
    "langs/locales/en/landing.json": [
        ("Dynopay ({{pct}}% + $1)", "Dynopay ({{pct}}%)"),
        ("1.5% + $1, down to 0.5%", "1.5%, down to 0.5%"),
        ("1.5% + $1 per payment to start,", "1.5% per payment to start,"),
    ],
    "langs/locales/de/landing.json": [
        ("Dynopay ({{pct}} % + 1 $)", "Dynopay ({{pct}} %)"),
        ("1,5 % + 1 $, bis hinunter zu 0,5 %", "1,5 %, bis hinunter zu 0,5 %"),
        ("Zum Start 1,5 % + 1 $ pro Zahlung,", "Zum Start 1,5 % pro Zahlung,"),
    ],
    "langs/locales/es/landing.json": [
        ("Dynopay ({{pct}} % + 1 $)", "Dynopay ({{pct}} %)"),
        ("1,5 % + 1 $, hasta bajar al 0,5 %", "1,5 %, hasta bajar al 0,5 %"),
        ("1,5 % + 1 $ por pago para empezar,", "1,5 % por pago para empezar,"),
    ],
    "langs/locales/fr/landing.json": [
        ("Dynopay ({{pct}} % + 1 $)", "Dynopay ({{pct}} %)"),
        ("1,5 % + 1 $, jusqu'à 0,5 %", "1,5 %, jusqu'à 0,5 %"),
        ("1,5 % + 1 $ par paiement au départ,", "1,5 % par paiement au départ,"),
    ],
    "langs/locales/pt/landing.json": [
        ("Dynopay ({{pct}}% + US$ 1)", "Dynopay ({{pct}}%)"),
        ("1,5% + US$ 1, caindo até 0,5%", "1,5%, caindo até 0,5%"),
        ("1,5% + US$ 1 por pagamento para começar,", "1,5% por pagamento para começar,"),
    ],
    "langs/locales/nl/landing.json": [
        ("Dynopay ({{pct}}% + $1)", "Dynopay ({{pct}}%)"),
        ("1,5% + $1, dalend tot 0,5%", "1,5%, dalend tot 0,5%"),
        ("1,5% + $1 per betaling om te beginnen,", "1,5% per betaling om te beginnen,"),
    ],
    "langs/locales/en/fees.json": [
        ("Fees · Dynopay — 1.5% + $1 per payment,", "Fees · Dynopay — 1.5% per payment,"),
        ("On a $100 payment at 1.5% + $1, you receive $97.50.", "On a $100 payment you receive $97.50."),
    ],
    "langs/locales/de/fees.json": [
        ("Gebühren · Dynopay — 1,5 % + 1 $ pro Zahlung,", "Gebühren · Dynopay — 1,5 % pro Zahlung,"),
        ("Bei einer Zahlung von $100 zu 1,5 % + $1 erhalten Sie $97,50.", "Bei einer Zahlung von $100 erhalten Sie $97,50."),
    ],
    "langs/locales/es/fees.json": [
        ("Comisiones · Dynopay — 1,5 % + 1 $ por pago,", "Comisiones · Dynopay — 1,5 % por pago,"),
        ("En un pago de $100 al 1,5% + $1, recibes $97,50.", "En un pago de $100 recibes $97,50."),
    ],
    "langs/locales/fr/fees.json": [
        ("Tarifs · Dynopay — 1,5 % + 1 $ par paiement,", "Tarifs · Dynopay — 1,5 % par paiement,"),
        ("Sur un paiement de $100 à 1,5 % + $1, vous recevez $97,50.", "Sur un paiement de $100, vous recevez $97,50."),
    ],
    "langs/locales/pt/fees.json": [
        ("Taxas · Dynopay — 1,5% + $1 por pagamento,", "Taxas · Dynopay — 1,5% por pagamento,"),
        ("Em um pagamento de $100 a 1,5% + $1, você recebe $97,50.", "Em um pagamento de $100, você recebe $97,50."),
    ],
    "langs/locales/nl/fees.json": [
        ("Tarieven · Dynopay — 1,5% + $1 per betaling,", "Tarieven · Dynopay — 1,5% per betaling,"),
        ("Bij een betaling van $100 tegen 1,5% + $1 ontvang je $97,50.", "Bij een betaling van $100 ontvang je $97,50."),
    ],
}

miss = 0
for path, pairs in REPL.items():
    with io.open(path, "r", encoding="utf-8") as f:
        txt = f.read()
    for old, new in pairs:
        if old in txt:
            txt = txt.replace(old, new)
        elif new in txt:
            pass  # already applied
        else:
            miss += 1
            print(f"  !! MISSING in {path}: {old!r}")
    with io.open(path, "w", encoding="utf-8") as f:
        f.write(txt)
    print(f"ok {path}")

sys.exit(1 if miss else 0)
