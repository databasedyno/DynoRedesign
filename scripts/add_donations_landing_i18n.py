#!/usr/bin/env python3
"""Add the Donations product to the v5 landing showcase copy (6 locales) and bump
the products headline count Six → Seven. Idempotent, format-preserving text edit."""
import io, json, sys

COPY = {
    "en": {
        "tab": "Donations",
        "title": "Raise funds and take tips in crypto.",
        "desc": "Launch a campaign with a goal bar, reward tiers and a live donor wall — or a simple tip jar. Supporters give in any coin, from anywhere, and every contribution settles straight to your wallet.",
        "note": "Live demo at /pay/donation-demo — goal bar, tiers and donor wall.",
        "cta": "See the donation demo",
        "headline_old": "Six ways to get paid. One account.",
        "headline_new": "Seven ways to get paid. One account.",
    },
    "de": {
        "tab": "Spenden",
        "title": "Sammle Spenden und Trinkgeld in Krypto.",
        "desc": "Starte eine Kampagne mit Zielbalken, Belohnungsstufen und einer Live-Spenderwand – oder eine einfache Trinkgeldkasse. Unterstützer zahlen in jeder Coin, von überall, und jeder Beitrag landet direkt in deiner Wallet.",
        "note": "Live-Demo unter /pay/donation-demo – Zielbalken, Stufen und Spenderwand.",
        "cta": "Spenden-Demo ansehen",
        "headline_old": "Sechs Wege, bezahlt zu werden. Ein Konto.",
        "headline_new": "Sieben Wege, bezahlt zu werden. Ein Konto.",
    },
    "es": {
        "tab": "Donaciones",
        "title": "Recauda fondos y recibe propinas en cripto.",
        "desc": "Lanza una campaña con barra de meta, niveles de recompensa y un muro de donantes en vivo, o un simple bote de propinas. Los seguidores aportan en cualquier moneda, desde cualquier lugar, y cada aporte llega directo a tu wallet.",
        "note": "Demo en vivo en /pay/donation-demo: barra de meta, niveles y muro de donantes.",
        "cta": "Ver la demo de donaciones",
        "headline_old": "Seis formas de cobrar. Una cuenta.",
        "headline_new": "Siete formas de cobrar. Una cuenta.",
    },
    "fr": {
        "tab": "Dons",
        "title": "Collectez des fonds et des pourboires en crypto.",
        "desc": "Lancez une campagne avec barre d'objectif, paliers de récompense et un mur de donateurs en direct — ou une simple cagnotte à pourboires. Les soutiens donnent dans n'importe quelle crypto, depuis partout, et chaque contribution arrive directement dans votre wallet.",
        "note": "Démo en direct sur /pay/donation-demo — barre d'objectif, paliers et mur de donateurs.",
        "cta": "Voir la démo de dons",
        "headline_old": "Six façons d'être payé. Un seul compte.",
        "headline_new": "Sept façons d'être payé. Un seul compte.",
    },
    "pt": {
        "tab": "Doações",
        "title": "Arrecade fundos e receba gorjetas em cripto.",
        "desc": "Lance uma campanha com barra de meta, níveis de recompensa e um mural de doadores ao vivo — ou uma simples caixinha de gorjetas. Os apoiadores contribuem em qualquer moeda, de qualquer lugar, e cada contribuição vai direto para a sua wallet.",
        "note": "Demo ao vivo em /pay/donation-demo — barra de meta, níveis e mural de doadores.",
        "cta": "Ver a demo de doações",
        "headline_old": "Seis formas de receber. Uma conta.",
        "headline_new": "Sete formas de receber. Uma conta.",
    },
    "nl": {
        "tab": "Donaties",
        "title": "Zamel geld en fooien in met crypto.",
        "desc": "Start een campagne met een doelbalk, beloningsniveaus en een live donateurswand — of een simpele fooienpot. Supporters geven in elke coin, van overal, en elke bijdrage komt direct in je wallet.",
        "note": "Live demo op /pay/donation-demo — doelbalk, niveaus en donateurswand.",
        "cta": "Bekijk de donatie-demo",
        "headline_old": "Zes manieren om betaald te worden. Eén account.",
        "headline_new": "Zeven manieren om betaald te worden. Eén account.",
    },
}


def js(v: str) -> str:
    return json.dumps(v, ensure_ascii=False)


miss = 0
for loc, c in COPY.items():
    path = f"langs/locales/{loc}/landing.json"
    txt = io.open(path, "r", encoding="utf-8").read()

    # 1) headline Six -> Seven
    if c["headline_old"] in txt:
        txt = txt.replace(c["headline_old"], c["headline_new"])
    elif c["headline_new"] not in txt:
        miss += 1
        print(f"  !! headline not found in {path}")

    # 2) insert donations block right after the products object opens
    anchor = '"products": {'
    block = (
        anchor
        + "\n      \"donations\": {\n"
        + f"        \"tab\": {js(c['tab'])},\n"
        + f"        \"title\": {js(c['title'])},\n"
        + f"        \"desc\": {js(c['desc'])},\n"
        + f"        \"note\": {js(c['note'])},\n"
        + f"        \"cta\": {js(c['cta'])}\n"
        + "      },"
    )
    if js(c["title"]) in txt:
        pass  # already present (my v5.products donations block)
    elif anchor in txt:
        txt = txt.replace(anchor, block, 1)
    else:
        miss += 1
        print(f"  !! products anchor not found in {path}")

    # validate + write
    json.loads(txt)
    io.open(path, "w", encoding="utf-8").write(txt)
    d = json.loads(txt)
    print(f"ok {loc}: donations={'donations' in d['v5']['products']} headline={d['v5']['products']['headline']!r}")

sys.exit(1 if miss else 0)
