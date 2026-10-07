#!/usr/bin/env python3
"""Reframe the misleading 'Payouts' (outbound) product messaging to 'Settlement'
(money settles to a wallet you control) across all locales. Keeps accurate
'payout address' terminology untouched. Also renames the in-app Balances screen
label/heading away from 'Payouts'. Idempotent."""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales")
LOCALES = ["en", "de", "es", "fr", "nl", "pt"]

SETTLE_TITLE = {
    "en": "Settlement", "de": "Abwicklung", "es": "Liquidación",
    "fr": "Règlement", "nl": "Afwikkeling", "pt": "Liquidação",
}
SETTLE_DESC = {
    "en": "Your money settles straight to a wallet you control — keep the crypto or auto-convert to USDT/USDC. Non-custodial, on-chain, instant.",
    "de": "Ihr Geld wird direkt in eine Wallet abgewickelt, die Sie kontrollieren – behalten Sie die Kryptowährung oder konvertieren Sie automatisch in USDT/USDC. Nicht-verwahrend, on-chain, sofort.",
    "es": "Tu dinero se liquida directamente en una wallet que tú controlas: conserva la cripto o conviértela automáticamente a USDT/USDC. No custodial, on-chain, al instante.",
    "fr": "Votre argent est réglé directement vers un portefeuille que vous contrôlez — gardez la crypto ou convertissez automatiquement en USDT/USDC. Non dépositaire, on-chain, instantané.",
    "nl": "Je geld wordt direct afgewikkeld naar een wallet die jij beheert — houd de crypto of converteer automatisch naar USDT/USDC. Niet-custodiaal, on-chain, direct.",
    "pt": "O seu dinheiro é liquidado diretamente numa carteira que você controla — mantenha a cripto ou converta automaticamente para USDT/USDC. Não custodial, on-chain, instantâneo.",
}
PRODUCT_LEAD = {
    "en": "Accept, convert, settle and check out — from a single non-custodial platform built for businesses and creators.",
    "de": "Akzeptieren, konvertieren, abwickeln und auschecken – auf einer einzigen nicht-verwahrenden Plattform für Unternehmen und Creator.",
    "es": "Acepta, convierte, liquida y cobra, todo desde una única plataforma no custodial creada para empresas y creadores.",
    "fr": "Acceptez, convertissez, réglez et encaissez — depuis une seule plateforme non dépositaire conçue pour les entreprises et les créateurs.",
    "nl": "Accepteren, converteren, afwikkelen en afrekenen — vanaf één niet-custodiaal platform voor bedrijven en creators.",
    "pt": "Aceite, converta, liquide e finalize — tudo numa única plataforma não custodial feita para empresas e criadores.",
}
STATS_NONCUSTODIAL = {
    "en": "Non-custodial settlement", "de": "Nicht-verwahrende Abwicklung",
    "es": "Liquidación no custodial", "fr": "Règlement non dépositaire",
    "nl": "Niet-custodiale afwikkeling", "pt": "Liquidação não custodial",
}
GLOBAL_BODY = {
    "en": "Accept Bitcoin, Ethereum and stablecoins from customers anywhere, with fast settlement and no chargebacks.",
    "de": "Akzeptieren Sie Bitcoin, Ethereum und Stablecoins von Kunden überall – mit schneller Abwicklung und ohne Rückbuchungen.",
    "es": "Acepta Bitcoin, Ethereum y stablecoins de clientes en cualquier lugar, con liquidación rápida y sin contracargos.",
    "fr": "Acceptez Bitcoin, Ethereum et stablecoins de clients partout, avec un règlement rapide et sans rétrofacturation.",
    "nl": "Accepteer Bitcoin, Ethereum en stablecoins van klanten overal, met snelle afwikkeling en zonder terugboekingen.",
    "pt": "Aceite Bitcoin, Ethereum e stablecoins de clientes em qualquer lugar, com liquidação rápida e sem estornos.",
}
# In-app Balances screen (route /payouts) visible label + page heading
INAPP_LABEL = {
    "en": "Balances & Settlement", "de": "Guthaben & Abwicklung",
    "es": "Saldos y liquidación", "fr": "Soldes et règlement",
    "nl": "Saldi & afwikkeling", "pt": "Saldos e liquidação",
}


def load(l, ns):
    p = os.path.join(ROOT, l, ns + ".json")
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


def save(p, d):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")


for l in LOCALES:
    # ---- landing.json ----
    p, d = load(l, "landing")
    d.setdefault("v8", {})["product"] = {
        "lead": PRODUCT_LEAD[l],
        "settle": {"title": SETTLE_TITLE[l], "desc": SETTLE_DESC[l]},
    }
    try:
        d["nav"]["mega"]["payouts"]["title"] = SETTLE_TITLE[l]
    except KeyError:
        print(f"[{l}] WARN nav.mega.payouts.title missing")
    try:
        d["about"]["stats"]["nonCustodial"] = STATS_NONCUSTODIAL[l]
    except KeyError:
        print(f"[{l}] WARN about.stats.nonCustodial missing")
    try:
        d["about"]["values"]["global"]["body"] = GLOBAL_BODY[l]
    except KeyError:
        print(f"[{l}] WARN about.values.global.body missing")
    save(p, d)

    # ---- dashboardLayout.json : sidebar label ----
    p, d = load(l, "dashboardLayout")
    if "balancesPayouts" in d:
        d["balancesPayouts"] = INAPP_LABEL[l]
    else:
        print(f"[{l}] WARN balancesPayouts missing")
    save(p, d)

    # ---- common.json : /payouts page heading ----
    p, d = load(l, "common")
    if isinstance(d.get("payouts"), dict) and "pageName" in d["payouts"]:
        d["payouts"]["pageName"] = INAPP_LABEL[l]
    else:
        print(f"[{l}] WARN common.payouts.pageName missing")
    save(p, d)

    print(f"[{l}] updated landing + dashboardLayout + common")

print("DONE")
