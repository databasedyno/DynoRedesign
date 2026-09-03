#!/usr/bin/env python3
"""Inject the checkout price-breakdown i18n keys (you pay / merchant receives /
Dynopay fee) into all 6 locales: frontend langs/locales/*/landing.json (checkout.*)
and backend backend/locales/*/emails.json (labels.* + receipt.*). Idempotent."""
import json
import os

ROOT = os.path.join(os.path.dirname(__file__), "..")
LANGS = ["en", "es", "pt", "fr", "de", "nl"]

STRINGS = {
    "en": {
        "breakdown": "Payment breakdown",
        "youPay": "You pay",
        "youPaid": "You paid",
        "merchantReceives": "Merchant receives",
        "platformFee": "Dynopay fee",
        "feePaidByMerchant": "paid by the merchant",
        "feePaidByCustomer": "added to your total",
        "plusNetworkCover": "+ network fee cover",
        "inclNetworkCover": "incl. network fee cover",
    },
    "es": {
        "breakdown": "Desglose del pago",
        "youPay": "Pagas",
        "youPaid": "Pagaste",
        "merchantReceives": "El comercio recibe",
        "platformFee": "Comisión de Dynopay",
        "feePaidByMerchant": "pagada por el comercio",
        "feePaidByCustomer": "añadida a tu total",
        "plusNetworkCover": "+ cobertura de la tarifa de red",
        "inclNetworkCover": "incl. cobertura de la tarifa de red",
    },
    "pt": {
        "breakdown": "Detalhe do pagamento",
        "youPay": "Você paga",
        "youPaid": "Você pagou",
        "merchantReceives": "O comerciante recebe",
        "platformFee": "Taxa Dynopay",
        "feePaidByMerchant": "paga pelo comerciante",
        "feePaidByCustomer": "adicionada ao seu total",
        "plusNetworkCover": "+ cobertura da taxa de rede",
        "inclNetworkCover": "incl. cobertura da taxa de rede",
    },
    "fr": {
        "breakdown": "Détail du paiement",
        "youPay": "Vous payez",
        "youPaid": "Vous avez payé",
        "merchantReceives": "Le marchand reçoit",
        "platformFee": "Frais Dynopay",
        "feePaidByMerchant": "payés par le marchand",
        "feePaidByCustomer": "ajoutés à votre total",
        "plusNetworkCover": "+ couverture des frais de réseau",
        "inclNetworkCover": "incl. couverture des frais de réseau",
    },
    "de": {
        "breakdown": "Zahlungsaufschlüsselung",
        "youPay": "Du zahlst",
        "youPaid": "Du hast bezahlt",
        "merchantReceives": "Händler erhält",
        "platformFee": "Dynopay-Gebühr",
        "feePaidByMerchant": "vom Händler bezahlt",
        "feePaidByCustomer": "zu deinem Gesamtbetrag addiert",
        "plusNetworkCover": "+ Netzwerkgebühr-Deckung",
        "inclNetworkCover": "inkl. Netzwerkgebühr-Deckung",
    },
    "nl": {
        "breakdown": "Betalingsoverzicht",
        "youPay": "Je betaalt",
        "youPaid": "Je hebt betaald",
        "merchantReceives": "Verkoper ontvangt",
        "platformFee": "Dynopay-kosten",
        "feePaidByMerchant": "betaald door de verkoper",
        "feePaidByCustomer": "opgeteld bij je totaal",
        "plusNetworkCover": "+ dekking netwerkkosten",
        "inclNetworkCover": "incl. dekking netwerkkosten",
    },
}

FRONTEND_KEYS = {
    "breakdownTitle": "breakdown",
    "youPay": "youPay",
    "youPaid": "youPaid",
    "merchantReceives": "merchantReceives",
    "dynopayFee": "platformFee",
    "feePaidByMerchant": "feePaidByMerchant",
    "feePaidByCustomer": "feePaidByCustomer",
    "plusNetworkCover": "plusNetworkCover",
    "inclNetworkCover": "inclNetworkCover",
}
EMAIL_LABEL_KEYS = ["merchantReceives", "platformFee", "feePaidByMerchant", "feePaidByCustomer"]
RECEIPT_KEYS = ["breakdown", "youPaid", "merchantReceives", "platformFee", "feePaidByMerchant", "feePaidByCustomer"]


def write(path, data):
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=2) + "\n")


for lang in LANGS:
    s = STRINGS[lang]
    fe = os.path.join(ROOT, "langs", "locales", lang, "landing.json")
    with open(fe, encoding="utf-8") as f:
        d = json.load(f)
    d.setdefault("checkout", {})
    for k, src in FRONTEND_KEYS.items():
        d["checkout"][k] = s[src]
    write(fe, d)

    be = os.path.join(ROOT, "backend", "locales", lang, "emails.json")
    with open(be, encoding="utf-8") as f:
        d = json.load(f)
    d.setdefault("labels", {})
    d.setdefault("receipt", {})
    for k in EMAIL_LABEL_KEYS:
        d["labels"][k] = s[k]
    for k in RECEIPT_KEYS:
        d["receipt"][k] = s[k]
    write(be, d)
    print(f"[{lang}] landing.checkout +{len(FRONTEND_KEYS)}  emails.labels +{len(EMAIL_LABEL_KEYS)} emails.receipt +{len(RECEIPT_KEYS)}")
