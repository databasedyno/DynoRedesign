#!/usr/bin/env python3
"""
Phase 3 frontend i18n additions:
  1. blogIndex.* — localized <Head> title/meta/og + eyebrow + split headline for /blog.
  2. press.* — full key set for the new /press page (press kit).
  3. nav.mega.press.* — header mega-menu entry (Company section).
  4. Brand-casing sweep: "DynoPay" -> "Dynopay" in ALL string values of every
     frontend locale JSON (nav.mega.about.title, share menu, dashboardLayout
     heroEmptyEyebrow — no header names live in frontend catalogs, so this is safe).
Idempotent.
"""
import glob
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

K = {
    "en": {
        "blogIndex": {
            "metaTitle": "Blog — Crypto commerce insights · Dynopay",
            "metaDescription": "Guides and strategies for selling, tipping, and fundraising in crypto — reduce fees, settle to stablecoins, and grow with cryptocurrency payments.",
            "ogDescription": "Guides, strategies, and insights for merchants accepting cryptocurrency payments.",
            "eyebrow": "Blog",
            "heroTitleLead": "Crypto payment",
            "heroTitleAccent": "insights",
        },
        "press": {
            "metaTitle": "Dynopay press kit — logos, facts & boilerplate",
            "metaDescription": "Official Dynopay press resources: downloadable logos, company facts, boilerplate description and media contact.",
            "eyebrow": "Press kit",
            "heroTitle": "Everything you need to write about Dynopay.",
            "heroBody": "Logos, company facts and a ready-to-use boilerplate — free to republish in articles, reviews and directories. If you need anything else, our team is one email away.",
            "boilerplateTitle": "Boilerplate",
            "boilerplateBody": "Dynopay is a non-custodial cryptocurrency payment gateway founded in 2024. Merchants use it to sell products, collect tips and run fundraising campaigns — or to integrate payments via API — accepting Bitcoin, Ethereum, stablecoins and 15+ other networks. Payments settle directly to a wallet the merchant controls, with optional auto-conversion to USDT/USDC, fees from 0.5% and no chargebacks.",
            "factsTitle": "Fast facts",
            "facts": {
                "founded": {"label": "Founded", "value": "2024"},
                "product": {"label": "Product", "value": "Non-custodial crypto payment gateway"},
                "pricing": {"label": "Pricing", "value": "From 0.5% per transaction — no monthly fees"},
                "networks": {"label": "Networks", "value": "15+ blockchains, including Bitcoin, Ethereum, Solana, XRP and major stablecoins"},
                "settlement": {"label": "Settlement", "value": "Straight to the merchant's own wallet — keep crypto or auto-convert to USDT/USDC"},
                "chargebacks": {"label": "Chargebacks", "value": "None — crypto payments are final once confirmed"},
            },
            "logosTitle": "Logos & brand assets",
            "logosBody": "Use the wordmark as provided. Please don't recolor, distort, rotate or add effects.",
            "logoBlackLabel": "Wordmark — dark on light",
            "logoWhiteLabel": "Wordmark — light on dark",
            "iconLabel": "App icon",
            "downloadSvg": "Download SVG",
            "downloadPng": "Download PNG",
            "contactTitle": "Media contact",
            "contactBody": "For interviews, comments or anything missing from this page, write to us — we read every message.",
            "storyCta": "Read our story",
        },
        "nav": {"mega": {"press": {"title": "Press kit", "desc": "Logos, facts and media resources"}}},
    },
    "de": {
        "blogIndex": {
            "metaTitle": "Blog — Einblicke in den Krypto-Handel · Dynopay",
            "metaDescription": "Leitfäden und Strategien für Verkauf, Trinkgelder und Spenden in Krypto — Gebühren senken, in Stablecoins abrechnen und mit Kryptozahlungen wachsen.",
            "ogDescription": "Leitfäden, Strategien und Einblicke für Händler, die Kryptowährungszahlungen akzeptieren.",
            "eyebrow": "Blog",
            "heroTitleLead": "Krypto-Zahlungen",
            "heroTitleAccent": "verstehen",
        },
        "press": {
            "metaTitle": "Dynopay Pressekit — Logos, Fakten & Boilerplate",
            "metaDescription": "Offizielle Presseressourcen von Dynopay: Logos zum Download, Unternehmensfakten, Boilerplate-Beschreibung und Pressekontakt.",
            "eyebrow": "Pressekit",
            "heroTitle": "Alles, was Sie brauchen, um über Dynopay zu schreiben.",
            "heroBody": "Logos, Unternehmensfakten und eine fertige Boilerplate — frei verwendbar in Artikeln, Tests und Verzeichnissen. Wenn Sie mehr brauchen, ist unser Team nur eine E-Mail entfernt.",
            "boilerplateTitle": "Boilerplate",
            "boilerplateBody": "Dynopay ist ein 2024 gegründetes non-custodial Krypto-Zahlungsgateway. Händler verkaufen damit Produkte, sammeln Trinkgelder und führen Spendenkampagnen durch — oder integrieren Zahlungen per API — und akzeptieren Bitcoin, Ethereum, Stablecoins und 15+ weitere Netzwerke. Zahlungen landen direkt in einer vom Händler kontrollierten Wallet, mit optionaler Auto-Konvertierung in USDT/USDC, Gebühren ab 0,5 % und ohne Chargebacks.",
            "factsTitle": "Fakten im Überblick",
            "facts": {
                "founded": {"label": "Gegründet", "value": "2024"},
                "product": {"label": "Produkt", "value": "Non-custodial Krypto-Zahlungsgateway"},
                "pricing": {"label": "Preise", "value": "Ab 0,5 % pro Transaktion — keine monatlichen Gebühren"},
                "networks": {"label": "Netzwerke", "value": "15+ Blockchains, darunter Bitcoin, Ethereum, Solana, XRP und führende Stablecoins"},
                "settlement": {"label": "Abwicklung", "value": "Direkt in die eigene Wallet des Händlers — Krypto behalten oder automatisch in USDT/USDC konvertieren"},
                "chargebacks": {"label": "Chargebacks", "value": "Keine — Krypto-Zahlungen sind nach Bestätigung endgültig"},
            },
            "logosTitle": "Logos & Markenmaterial",
            "logosBody": "Verwenden Sie die Wortmarke wie bereitgestellt. Bitte nicht umfärben, verzerren, drehen oder mit Effekten versehen.",
            "logoBlackLabel": "Wortmarke — dunkel auf hell",
            "logoWhiteLabel": "Wortmarke — hell auf dunkel",
            "iconLabel": "App-Icon",
            "downloadSvg": "SVG herunterladen",
            "downloadPng": "PNG herunterladen",
            "contactTitle": "Pressekontakt",
            "contactBody": "Für Interviews, Statements oder alles, was auf dieser Seite fehlt, schreiben Sie uns — wir lesen jede Nachricht.",
            "storyCta": "Unsere Geschichte lesen",
        },
        "nav": {"mega": {"press": {"title": "Pressekit", "desc": "Logos, Fakten und Presse-Material"}}},
    },
    "es": {
        "blogIndex": {
            "metaTitle": "Blog — Ideas sobre comercio cripto · Dynopay",
            "metaDescription": "Guías y estrategias para vender, recibir propinas y recaudar fondos en cripto — reduce comisiones, liquida en stablecoins y crece con los pagos en criptomonedas.",
            "ogDescription": "Guías, estrategias e ideas para comercios que aceptan pagos en criptomonedas.",
            "eyebrow": "Blog",
            "heroTitleLead": "Ideas sobre",
            "heroTitleAccent": "pagos cripto",
        },
        "press": {
            "metaTitle": "Kit de prensa de Dynopay — logos, datos y descripción",
            "metaDescription": "Recursos de prensa oficiales de Dynopay: logos descargables, datos de la empresa, descripción estándar y contacto para medios.",
            "eyebrow": "Kit de prensa",
            "heroTitle": "Todo lo que necesitas para escribir sobre Dynopay.",
            "heroBody": "Logos, datos de la empresa y una descripción lista para usar — libres para republicar en artículos, reseñas y directorios. Si necesitas algo más, nuestro equipo está a un correo de distancia.",
            "boilerplateTitle": "Descripción estándar",
            "boilerplateBody": "Dynopay es una pasarela de pagos en criptomonedas sin custodia fundada en 2024. Los comercios la usan para vender productos, recibir propinas y lanzar campañas de recaudación — o para integrar pagos vía API — aceptando Bitcoin, Ethereum, stablecoins y más de 15 redes. Los pagos se liquidan directamente en una wallet controlada por el comercio, con conversión automática opcional a USDT/USDC, comisiones desde el 0,5% y sin contracargos.",
            "factsTitle": "Datos clave",
            "facts": {
                "founded": {"label": "Fundación", "value": "2024"},
                "product": {"label": "Producto", "value": "Pasarela de pagos cripto sin custodia"},
                "pricing": {"label": "Precios", "value": "Desde el 0,5% por transacción — sin cuotas mensuales"},
                "networks": {"label": "Redes", "value": "Más de 15 blockchains, incluidas Bitcoin, Ethereum, Solana, XRP y las principales stablecoins"},
                "settlement": {"label": "Liquidación", "value": "Directamente a la wallet del comercio — conserva la cripto o conviértela automáticamente a USDT/USDC"},
                "chargebacks": {"label": "Contracargos", "value": "Ninguno — los pagos en cripto son definitivos una vez confirmados"},
            },
            "logosTitle": "Logos y recursos de marca",
            "logosBody": "Usa el logotipo tal como se proporciona. No lo recolorees, deformes, gires ni le añadas efectos.",
            "logoBlackLabel": "Logotipo — oscuro sobre claro",
            "logoWhiteLabel": "Logotipo — claro sobre oscuro",
            "iconLabel": "Icono de la app",
            "downloadSvg": "Descargar SVG",
            "downloadPng": "Descargar PNG",
            "contactTitle": "Contacto para medios",
            "contactBody": "Para entrevistas, declaraciones o cualquier cosa que falte en esta página, escríbenos — leemos todos los mensajes.",
            "storyCta": "Lee nuestra historia",
        },
        "nav": {"mega": {"press": {"title": "Kit de prensa", "desc": "Logos, datos y recursos para medios"}}},
    },
    "fr": {
        "blogIndex": {
            "metaTitle": "Blog — Le commerce crypto décrypté · Dynopay",
            "metaDescription": "Guides et stratégies pour vendre, recevoir des pourboires et collecter des fonds en crypto — réduisez les frais, réglez en stablecoins et développez-vous avec les paiements en cryptomonnaies.",
            "ogDescription": "Guides, stratégies et analyses pour les marchands qui acceptent les paiements en cryptomonnaies.",
            "eyebrow": "Blog",
            "heroTitleLead": "Les paiements crypto",
            "heroTitleAccent": "décryptés",
        },
        "press": {
            "metaTitle": "Kit presse Dynopay — logos, chiffres et description type",
            "metaDescription": "Ressources presse officielles de Dynopay : logos téléchargeables, chiffres clés, description type et contact média.",
            "eyebrow": "Kit presse",
            "heroTitle": "Tout ce qu'il vous faut pour écrire sur Dynopay.",
            "heroBody": "Logos, chiffres clés et une description prête à l'emploi — libres de republication dans vos articles, tests et annuaires. Besoin d'autre chose ? Notre équipe est à un e-mail.",
            "boilerplateTitle": "Description type",
            "boilerplateBody": "Dynopay est une passerelle de paiement en cryptomonnaies non-custodial fondée en 2024. Les marchands l'utilisent pour vendre des produits, recevoir des pourboires et mener des campagnes de collecte — ou pour intégrer les paiements via API — en acceptant Bitcoin, Ethereum, les stablecoins et plus de 15 réseaux. Les paiements arrivent directement dans un wallet contrôlé par le marchand, avec conversion automatique optionnelle en USDT/USDC, des frais à partir de 0,5 % et aucune rétrofacturation.",
            "factsTitle": "Chiffres clés",
            "facts": {
                "founded": {"label": "Création", "value": "2024"},
                "product": {"label": "Produit", "value": "Passerelle de paiement crypto non-custodial"},
                "pricing": {"label": "Tarifs", "value": "À partir de 0,5 % par transaction — sans frais mensuels"},
                "networks": {"label": "Réseaux", "value": "Plus de 15 blockchains, dont Bitcoin, Ethereum, Solana, XRP et les principaux stablecoins"},
                "settlement": {"label": "Règlement", "value": "Directement dans le wallet du marchand — conservez la crypto ou convertissez-la automatiquement en USDT/USDC"},
                "chargebacks": {"label": "Rétrofacturation", "value": "Aucune — les paiements crypto sont définitifs une fois confirmés"},
            },
            "logosTitle": "Logos et éléments de marque",
            "logosBody": "Utilisez le logotype tel quel. Merci de ne pas le recolorer, le déformer, le faire pivoter ni lui ajouter d'effets.",
            "logoBlackLabel": "Logotype — foncé sur clair",
            "logoWhiteLabel": "Logotype — clair sur foncé",
            "iconLabel": "Icône de l'app",
            "downloadSvg": "Télécharger le SVG",
            "downloadPng": "Télécharger le PNG",
            "contactTitle": "Contact média",
            "contactBody": "Pour une interview, un commentaire ou tout élément manquant sur cette page, écrivez-nous — nous lisons chaque message.",
            "storyCta": "Découvrir notre histoire",
        },
        "nav": {"mega": {"press": {"title": "Kit presse", "desc": "Logos, chiffres et ressources presse"}}},
    },
    "nl": {
        "blogIndex": {
            "metaTitle": "Blog — Inzichten in cryptohandel · Dynopay",
            "metaDescription": "Gidsen en strategieën voor verkopen, fooien en inzamelen in crypto — verlaag kosten, reken af in stablecoins en groei met cryptobetalingen.",
            "ogDescription": "Gidsen, strategieën en inzichten voor handelaren die cryptobetalingen accepteren.",
            "eyebrow": "Blog",
            "heroTitleLead": "Inzicht in",
            "heroTitleAccent": "cryptobetalingen",
        },
        "press": {
            "metaTitle": "Dynopay perskit — logo's, feiten & standaardtekst",
            "metaDescription": "Officiële persbronnen van Dynopay: downloadbare logo's, bedrijfsfeiten, standaardbeschrijving en mediacontact.",
            "eyebrow": "Perskit",
            "heroTitle": "Alles wat u nodig heeft om over Dynopay te schrijven.",
            "heroBody": "Logo's, bedrijfsfeiten en een kant-en-klare standaardtekst — vrij te herpubliceren in artikelen, reviews en gidsen. Meer nodig? Ons team is één e-mail verwijderd.",
            "boilerplateTitle": "Standaardtekst",
            "boilerplateBody": "Dynopay is een non-custodial cryptobetaalgateway, opgericht in 2024. Handelaren gebruiken het om producten te verkopen, fooien te ontvangen en inzamelingsacties te voeren — of om betalingen via de API te integreren — met ondersteuning voor Bitcoin, Ethereum, stablecoins en 15+ andere netwerken. Betalingen komen rechtstreeks terecht in een wallet die de handelaar beheert, met optionele automatische conversie naar USDT/USDC, kosten vanaf 0,5% en zonder chargebacks.",
            "factsTitle": "Feiten in het kort",
            "facts": {
                "founded": {"label": "Opgericht", "value": "2024"},
                "product": {"label": "Product", "value": "Non-custodial crypto-betaalgateway"},
                "pricing": {"label": "Prijzen", "value": "Vanaf 0,5% per transactie — geen maandelijkse kosten"},
                "networks": {"label": "Netwerken", "value": "15+ blockchains, waaronder Bitcoin, Ethereum, Solana, XRP en grote stablecoins"},
                "settlement": {"label": "Uitbetaling", "value": "Rechtstreeks naar de eigen wallet van de handelaar — houd crypto of converteer automatisch naar USDT/USDC"},
                "chargebacks": {"label": "Chargebacks", "value": "Geen — cryptobetalingen zijn definitief zodra ze bevestigd zijn"},
            },
            "logosTitle": "Logo's & merkmateriaal",
            "logosBody": "Gebruik het woordmerk zoals aangeleverd. Niet herkleuren, vervormen, roteren of van effecten voorzien.",
            "logoBlackLabel": "Woordmerk — donker op licht",
            "logoWhiteLabel": "Woordmerk — licht op donker",
            "iconLabel": "App-icoon",
            "downloadSvg": "SVG downloaden",
            "downloadPng": "PNG downloaden",
            "contactTitle": "Mediacontact",
            "contactBody": "Voor interviews, reacties of iets dat op deze pagina ontbreekt: schrijf ons — we lezen elk bericht.",
            "storyCta": "Lees ons verhaal",
        },
        "nav": {"mega": {"press": {"title": "Perskit", "desc": "Logo's, feiten en persmateriaal"}}},
    },
    "pt": {
        "blogIndex": {
            "metaTitle": "Blog — Insights de comércio cripto · Dynopay",
            "metaDescription": "Guias e estratégias para vender, receber gorjetas e arrecadar em cripto — reduza taxas, liquide em stablecoins e cresça com pagamentos em criptomoedas.",
            "ogDescription": "Guias, estratégias e insights para comerciantes que aceitam pagamentos em criptomoedas.",
            "eyebrow": "Blog",
            "heroTitleLead": "Insights sobre",
            "heroTitleAccent": "pagamentos cripto",
        },
        "press": {
            "metaTitle": "Kit de imprensa da Dynopay — logos, fatos e descrição",
            "metaDescription": "Recursos oficiais de imprensa da Dynopay: logos para download, fatos da empresa, descrição padrão e contato para a mídia.",
            "eyebrow": "Kit de imprensa",
            "heroTitle": "Tudo o que você precisa para escrever sobre a Dynopay.",
            "heroBody": "Logos, fatos da empresa e uma descrição pronta para uso — livres para republicação em artigos, análises e diretórios. Precisa de algo mais? Nossa equipe está a um e-mail de distância.",
            "boilerplateTitle": "Descrição padrão",
            "boilerplateBody": "A Dynopay é um gateway de pagamentos em criptomoedas sem custódia fundado em 2024. Comerciantes o usam para vender produtos, receber gorjetas e criar campanhas de arrecadação — ou para integrar pagamentos via API — aceitando Bitcoin, Ethereum, stablecoins e mais de 15 redes. Os pagamentos são liquidados direto em uma carteira controlada pelo comerciante, com conversão automática opcional para USDT/USDC, taxas a partir de 0,5% e sem estornos.",
            "factsTitle": "Fatos rápidos",
            "facts": {
                "founded": {"label": "Fundação", "value": "2024"},
                "product": {"label": "Produto", "value": "Gateway de pagamentos em cripto sem custódia"},
                "pricing": {"label": "Preços", "value": "A partir de 0,5% por transação — sem mensalidades"},
                "networks": {"label": "Redes", "value": "Mais de 15 blockchains, incluindo Bitcoin, Ethereum, Solana, XRP e as principais stablecoins"},
                "settlement": {"label": "Liquidação", "value": "Direto na carteira do próprio comerciante — mantenha a cripto ou converta automaticamente para USDT/USDC"},
                "chargebacks": {"label": "Estornos", "value": "Nenhum — pagamentos em cripto são definitivos após a confirmação"},
            },
            "logosTitle": "Logos e materiais de marca",
            "logosBody": "Use o logotipo como fornecido. Não recolora, distorça, gire nem adicione efeitos.",
            "logoBlackLabel": "Logotipo — escuro sobre claro",
            "logoWhiteLabel": "Logotipo — claro sobre escuro",
            "iconLabel": "Ícone do app",
            "downloadSvg": "Baixar SVG",
            "downloadPng": "Baixar PNG",
            "contactTitle": "Contato para imprensa",
            "contactBody": "Para entrevistas, comentários ou algo que falte nesta página, escreva para nós — lemos todas as mensagens.",
            "storyCta": "Leia nossa história",
        },
        "nav": {"mega": {"press": {"title": "Kit de imprensa", "desc": "Logos, fatos e recursos para a mídia"}}},
    },
}


def deep_merge(dst, src):
    changed = 0
    for k, v in src.items():
        if isinstance(v, dict):
            node = dst.setdefault(k, {})
            if not isinstance(node, dict):
                dst[k] = node = {}
            changed += deep_merge(node, v)
        else:
            if dst.get(k) != v:
                dst[k] = v
                changed += 1
    return changed


def fix_casing(obj):
    """Recursively replace DynoPay -> Dynopay in every string value."""
    n = 0
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and "DynoPay" in v:
                obj[k] = v.replace("DynoPay", "Dynopay")
                n += 1
            elif isinstance(v, (dict, list)):
                n += fix_casing(v)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, str) and "DynoPay" in v:
                obj[i] = v.replace("DynoPay", "Dynopay")
                n += 1
            elif isinstance(v, (dict, list)):
                n += fix_casing(v)
    return n


def main():
    total = 0
    for lang, keys in K.items():
        path = os.path.join(BASE, lang, "landing.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        n = deep_merge(data, keys)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}/landing.json: {n} keys set")
        total += n
    # brand casing sweep across ALL frontend catalogs
    fixed = 0
    for path in sorted(glob.glob(os.path.join(BASE, "*", "*.json"))):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        n = fix_casing(data)
        if n:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")
            rel = os.path.relpath(path, BASE)
            print(f"casing fix: {rel}: {n} strings")
            fixed += n
    print(f"TOTAL: {total} keys set, {fixed} casing fixes")


if __name__ == "__main__":
    main()
