#!/usr/bin/env python3
"""
UI-copy re-author — BATCH 1: Landing (v3.*) + header/nav CTAs.

Only the CHANGED keys are listed here. Unchanged v3 strings keep their
existing (already good) translations. English is re-authored to the approved
voice; the other 5 languages are re-translated to match.

Run:  python3 scripts/batch1_landing_copy.py
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")
LANGS = ["en", "pt", "fr", "es", "de", "nl"]

# key path -> { lang: value }
CHANGES = {
    "getStarted": {
        "en": "Start free",
        "pt": "Comece grátis",
        "fr": "Commencer gratuitement",
        "es": "Empieza gratis",
        "de": "Kostenlos starten",
        "nl": "Gratis starten",
    },
    "v3.hero.eyebrow": {
        "en": "Dynopay · Now in public beta",
        "pt": "Dynopay · Agora em beta público",
        "fr": "Dynopay · Désormais en bêta publique",
        "es": "Dynopay · Ahora en beta pública",
        "de": "Dynopay · Jetzt in der öffentlichen Beta",
        "nl": "Dynopay · Nu in publieke bèta",
    },
    "v3.hero.body": {
        "en": "One wallet for merchants, creators, fundraisers and developers. Storefronts, tips, campaigns and a clean API — all settled to the coin you choose, from <b>0.5%</b>.",
        "pt": "Uma carteira para lojistas, criadores, arrecadadores e desenvolvedores. Lojas, gorjetas, campanhas e uma API simples — tudo liquidado na moeda que você escolher, a partir de <b>0,5%</b>.",
        "fr": "Un seul portefeuille pour marchands, créateurs, collecteurs de fonds et développeurs. Boutiques, pourboires, campagnes et une API claire — le tout réglé dans la devise de votre choix, à partir de <b>0,5 %</b>.",
        "es": "Una sola billetera para comercios, creadores, recaudadores y desarrolladores. Tiendas, propinas, campañas y una API sencilla: todo liquidado en la moneda que elijas, desde el <b>0,5 %</b>.",
        "de": "Eine Wallet für Händler, Creator, Fundraiser und Entwickler. Shops, Trinkgelder, Kampagnen und eine saubere API – alles in der Coin deiner Wahl abgerechnet, ab <b>0,5 %</b>.",
        "nl": "Eén wallet voor verkopers, creators, fondsenwervers en developers. Winkels, fooien, campagnes en een strakke API — alles afgerekend in de munt die jij kiest, vanaf <b>0,5%</b>.",
    },
    "v3.hero.bullets": {
        "en": "Free to start · No card · 15+ chains",
        "pt": "Grátis para começar · Sem cartão · Mais de 15 redes",
        "fr": "Gratuit au départ · Sans carte · Plus de 15 chaînes",
        "es": "Gratis para empezar · Sin tarjeta · Más de 15 redes",
        "de": "Kostenlos starten · Keine Karte · Über 15 Chains",
        "nl": "Gratis te starten · Geen kaart · 15+ chains",
    },
    "v3.hero.rewardBadge": {
        "en": "New here? Your first <b>$500</b> in volume is on us.",
        "pt": "É novo por aqui? Seus primeiros <b>US$ 500</b> em volume são por nossa conta.",
        "fr": "Nouveau ici ? Vos premiers <b>500 $</b> de volume sont offerts.",
        "es": "¿Eres nuevo? Tus primeros <b>500 $</b> de volumen corren por nuestra cuenta.",
        "de": "Neu hier? Deine ersten <b>500 $</b> Volumen gehen auf uns.",
        "nl": "Nieuw hier? Je eerste <b>$500</b> aan volume is van ons.",
    },
    "v3.hero.metaSettle": {
        "en": "Lands in <b>your wallet</b> in ~4s · from <b>1.5%</b>",
        "pt": "Cai na <b>sua carteira</b> em ~4s · a partir de <b>1,5%</b>",
        "fr": "Arrive dans <b>votre portefeuille</b> en ~4s · à partir de <b>1,5 %</b>",
        "es": "Llega a <b>tu billetera</b> en ~4s · desde el <b>1,5 %</b>",
        "de": "Landet in ~4s in <b>deiner Wallet</b> · ab <b>1,5 %</b>",
        "nl": "Staat in ~4s in <b>je wallet</b> · vanaf <b>1,5%</b>",
    },
    "v3.audience.body": {
        "en": "Pick your door — merchants, creators, fundraisers, developers. Same crypto rails, same wallet, same fees.",
        "pt": "Escolha sua porta — lojistas, criadores, arrecadadores, desenvolvedores. Os mesmos trilhos cripto, a mesma carteira, as mesmas taxas.",
        "fr": "Choisissez votre porte — marchands, créateurs, collecteurs de fonds, développeurs. Les mêmes rails crypto, le même portefeuille, les mêmes frais.",
        "es": "Elige tu puerta: comercios, creadores, recaudadores, desarrolladores. Los mismos rieles cripto, la misma billetera, las mismas tarifas.",
        "de": "Wähle deine Tür – Händler, Creator, Fundraiser, Entwickler. Dieselben Krypto-Rails, dieselbe Wallet, dieselben Gebühren.",
        "nl": "Kies je deur — verkopers, creators, fondsenwervers, developers. Dezelfde crypto-rails, dezelfde wallet, dezelfde kosten.",
    },
    "v3.audience.merchants.desc": {
        "en": "Hosted checkout, product catalog and invoices. Auto-convert or keep the original coin.",
        "pt": "Checkout hospedado, catálogo de produtos e faturas. Converta automaticamente ou mantenha a moeda original.",
        "fr": "Checkout hébergé, catalogue de produits et factures. Conversion automatique ou conservation de la devise d'origine.",
        "es": "Checkout alojado, catálogo de productos y facturas. Convierte automáticamente o conserva la moneda original.",
        "de": "Gehosteter Checkout, Produktkatalog und Rechnungen. Automatisch umwandeln oder die ursprüngliche Coin behalten.",
        "nl": "Gehoste checkout, productcatalogus en facturen. Automatisch omzetten of de originele munt behouden.",
    },
    "v3.audience.fundraisers.desc": {
        "en": "Goal bar, tiers, donor wall and updates. Every donation lands on-chain, in your wallet.",
        "pt": "Barra de meta, níveis, mural de doadores e atualizações. Cada doação cai on-chain, na sua carteira.",
        "fr": "Barre d'objectif, paliers, mur des donateurs et actualités. Chaque don arrive on-chain, dans votre portefeuille.",
        "es": "Barra de meta, niveles, muro de donantes y novedades. Cada donación llega on-chain, a tu billetera.",
        "de": "Zielbalken, Stufen, Spender-Wall und Updates. Jede Spende landet on-chain, in deiner Wallet.",
        "nl": "Doelbalk, niveaus, donateurswand en updates. Elke donatie komt on-chain in je wallet.",
    },
    "v3.audience.creators.desc": {
        "en": "Your own dynopay.me/@handle page with inline tips — no chargebacks, instant payouts.",
        "pt": "Sua própria página dynopay.me/@usuario com gorjetas integradas — sem estornos, saques instantâneos.",
        "fr": "Votre propre page dynopay.me/@handle avec pourboires intégrés — sans rétrofacturation, versements instantanés.",
        "es": "Tu propia página dynopay.me/@usuario con propinas integradas: sin contracargos, pagos instantáneos.",
        "de": "Deine eigene dynopay.me/@handle-Seite mit integrierten Trinkgeldern – keine Rückbuchungen, sofortige Auszahlungen.",
        "nl": "Je eigen dynopay.me/@handle-pagina met ingebouwde fooien — geen terugboekingen, directe uitbetalingen.",
    },
    "v3.features.body": {
        "en": "One platform, three ways to plug in: a hosted checkout, automatic settlement, and a clean API. Take what you need, ignore the rest.",
        "pt": "Uma plataforma, três formas de integrar: um checkout hospedado, liquidação automática e uma API simples. Use o que precisar, ignore o resto.",
        "fr": "Une plateforme, trois façons de vous connecter : un checkout hébergé, un règlement automatique et une API claire. Prenez ce dont vous avez besoin, ignorez le reste.",
        "es": "Una plataforma, tres formas de integrarte: un checkout alojado, liquidación automática y una API sencilla. Toma lo que necesites e ignora el resto.",
        "de": "Eine Plattform, drei Wege zur Anbindung: ein gehosteter Checkout, automatische Abrechnung und eine saubere API. Nimm, was du brauchst, ignoriere den Rest.",
        "nl": "Eén platform, drie manieren om aan te sluiten: een gehoste checkout, automatische afwikkeling en een strakke API. Neem wat je nodig hebt, negeer de rest.",
    },
    "v3.finalcta.body": {
        "en": "Free to start. No card. Live in under 10 minutes — bring your wallet, keep your money.",
        "pt": "Grátis para começar. Sem cartão. No ar em menos de 10 minutos — traga sua carteira, fique com seu dinheiro.",
        "fr": "Gratuit au départ. Sans carte. En ligne en moins de 10 minutes — apportez votre portefeuille, gardez votre argent.",
        "es": "Gratis para empezar. Sin tarjeta. En marcha en menos de 10 minutos: trae tu billetera, quédate con tu dinero.",
        "de": "Kostenlos starten. Keine Karte. In unter 10 Minuten live – bring deine Wallet mit, behalte dein Geld.",
        "nl": "Gratis te starten. Geen kaart. Binnen 10 minuten live — neem je wallet mee, hou je geld.",
    },
    "v3.finalcta.rewardBadge": {
        "en": "New here? Your first <b>$500</b> in volume is on us.",
        "pt": "É novo por aqui? Seus primeiros <b>US$ 500</b> em volume são por nossa conta.",
        "fr": "Nouveau ici ? Vos premiers <b>500 $</b> de volume sont offerts.",
        "es": "¿Eres nuevo? Tus primeros <b>500 $</b> de volumen corren por nuestra cuenta.",
        "de": "Neu hier? Deine ersten <b>500 $</b> Volumen gehen auf uns.",
        "nl": "Nieuw hier? Je eerste <b>$500</b> aan volume is van ons.",
    },
    "v3.finalcta.getStarted": {
        "en": "Start free",
        "pt": "Comece grátis",
        "fr": "Commencer gratuitement",
        "es": "Empieza gratis",
        "de": "Kostenlos starten",
        "nl": "Gratis starten",
    },
    "nav.mega.paymentLinks.desc": {
        "en": "Shareable links that get you paid in crypto in seconds",
        "pt": "Links compartilháveis que recebem em cripto em segundos",
        "fr": "Des liens partageables pour être payé en crypto en quelques secondes",
        "es": "Enlaces para compartir que te pagan en cripto en segundos",
        "de": "Teilbare Links, mit denen du in Sekunden in Krypto bezahlt wirst",
        "nl": "Deelbare links waarmee je in seconden in crypto betaald wordt",
    },
    "nav.mega.checkout.desc": {
        "en": "Drop-in hosted checkout for any store",
        "pt": "Checkout hospedado plug-and-play para qualquer loja",
        "fr": "Checkout hébergé prêt à l'emploi pour toute boutique",
        "es": "Checkout alojado listo para usar en cualquier tienda",
        "de": "Sofort einsetzbarer gehosteter Checkout für jeden Shop",
        "nl": "Kant-en-klare gehoste checkout voor elke winkel",
    },
    "nav.mega.creatorPages.desc": {
        "en": "Your own branded tip and payment page",
        "pt": "Sua própria página de gorjetas e pagamentos personalizada",
        "fr": "Votre propre page de pourboires et de paiement personnalisée",
        "es": "Tu propia página de propinas y pagos personalizada",
        "de": "Deine eigene gebrandete Trinkgeld- und Zahlungsseite",
        "nl": "Je eigen gebrande fooien- en betaalpagina",
    },
    "nav.mega.payouts.desc": {
        "en": "Send stablecoins and crypto to anyone, anywhere",
        "pt": "Envie stablecoins e cripto para qualquer pessoa, em qualquer lugar",
        "fr": "Envoyez des stablecoins et des cryptos à n'importe qui, partout",
        "es": "Envía stablecoins y cripto a cualquier persona, en cualquier lugar",
        "de": "Sende Stablecoins und Krypto an jeden, überall",
        "nl": "Stuur stablecoins en crypto naar iedereen, overal",
    },
    "nav.mega.webhooks.desc": {
        "en": "Real-time notifications for every payment event",
        "pt": "Notificações em tempo real para cada evento de pagamento",
        "fr": "Notifications en temps réel pour chaque événement de paiement",
        "es": "Notificaciones en tiempo real para cada evento de pago",
        "de": "Echtzeit-Benachrichtigungen für jedes Zahlungsereignis",
        "nl": "Realtime meldingen voor elke betaalgebeurtenis",
    },
    "nav.mega.terms.desc": {
        "en": "Terms and conditions",
        "pt": "Termos e condições",
        "fr": "Conditions générales",
        "es": "Términos y condiciones",
        "de": "Geschäftsbedingungen",
        "nl": "Algemene voorwaarden",
    },
    "nav.mega.featured.cta": {
        "en": "Start free",
        "pt": "Comece grátis",
        "fr": "Commencer gratuitement",
        "es": "Empieza gratis",
        "de": "Kostenlos starten",
        "nl": "Gratis starten",
    },
}


def count_strings(x):
    if isinstance(x, dict):
        return sum(count_strings(v) for v in x.values())
    if isinstance(x, list):
        return sum(count_strings(v) for v in x)
    return 1 if isinstance(x, str) else 0


def set_path(d, path, val):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = val


def main():
    for lang in LANGS:
        fp = os.path.abspath(os.path.join(BASE, lang, "landing.json"))
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        before = count_strings(data)
        applied = 0
        for path, vals in CHANGES.items():
            if lang in vals:
                set_path(data, path, vals[lang])
                applied += 1
        after = count_strings(data)
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}: applied {applied} keys | strings {before} -> {after}")


if __name__ == "__main__":
    main()
