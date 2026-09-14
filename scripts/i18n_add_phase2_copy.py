#!/usr/bin/env python3
"""
COPY_AUDIT Phase 2 — i18n migration keys (about.tsx + ExitIntentModal + blog CTA body).

Adds to langs/locales/<lang>/landing.json (all 6 locales, idempotent):
  - root: exitIntentEyebrow, exitIntentBody, exitIntentClaimCta, exitIntentClose, blogReadyCtaBody
  - about.* block (metaTitle, metaDescription, eyebrow, heroTitle, heroBody, talkToUs,
    stats.*, values.*, buildTitle, buildBody, ctaTitle, ctaBody)

Terminology matched to existing locale voice (de=Sie, fr=vous, nl=u, es=tu, pt=voce;
chargebacks: de=Chargebacks, es=contracargos, fr=retrofacturation, nl=chargebacks, pt=estornos).
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

KEYS = {
    "en": {
        "exitIntentEyebrow": "Wait — one second",
        "exitIntentBody": "Grab the sandbox key below and hit our API from your terminal. No signup. No card. Real response — same JSON shape as production.",
        "exitIntentClaimCta": "Claim 0% platform fee on your first payment",
        "exitIntentClose": "Close",
        "blogReadyCtaBody": "Get started in minutes with Dynopay's simple API integration.",
        "about": {
            "metaTitle": "About Dynopay — our mission & company",
            "metaDescription": "Learn about Dynopay: our mission to make crypto payments simple, how the platform works, the values we build on, and how to get in touch.",
            "eyebrow": "About Dynopay",
            "heroTitle": "Crypto payments, made simple for every business.",
            "heroBody": "Dynopay is a crypto payment gateway for selling products, collecting tips and running fundraising campaigns — or integrating payments via API. Our mission is to make accepting digital currency as effortless as a card payment, while you stay fully in control of your money.",
            "talkToUs": "Talk to us",
            "stats": {
                "baseFee": "Base fee — no monthly cost",
                "chains": "Blockchains supported",
                "nonCustodial": "Non-custodial payouts",
                "since": "Building since",
            },
            "values": {
                "nonCustodial": {
                    "title": "Non-custodial by design",
                    "body": "Payments settle straight to your own wallet — keep the original crypto or auto-convert to USDT/USDC. We never hold your funds.",
                },
                "pricing": {
                    "title": "Transparent pricing",
                    "body": "One clear fee, volume discounts as you grow, and no hidden charges or monthly minimums. What you see is what you pay.",
                },
                "builder": {
                    "title": "Builder-friendly",
                    "body": "A clean API, hosted checkout, payment links and webhooks — so you can start accepting crypto in minutes, not weeks.",
                },
                "global": {
                    "title": "Global by default",
                    "body": "Accept Bitcoin, Ethereum and stablecoins from customers anywhere, with fast payouts and no chargebacks.",
                },
            },
            "buildTitle": "What we build on",
            "buildBody": "A small, fast-moving team focused on one thing: getting merchants paid in crypto without the complexity. These are the principles behind every feature we ship.",
            "ctaTitle": "Want to build the future of payments with us?",
            "ctaBody": "We're always happy to hear from merchants, partners and people who want to join the team. Reach out any time — we read every message.",
        },
    },
    "de": {
        "exitIntentEyebrow": "Moment — eine Sekunde",
        "exitIntentBody": "Nehmen Sie den Sandbox-Key unten und rufen Sie unsere API direkt aus Ihrem Terminal auf. Keine Registrierung. Keine Karte. Echte Antwort — dasselbe JSON-Format wie in der Produktion.",
        "exitIntentClaimCta": "0 % Plattformgebühr auf Ihre erste Zahlung sichern",
        "exitIntentClose": "Schließen",
        "blogReadyCtaBody": "Starten Sie in wenigen Minuten mit der einfachen API-Integration von Dynopay.",
        "about": {
            "metaTitle": "Über Dynopay — unsere Mission & das Unternehmen",
            "metaDescription": "Erfahren Sie mehr über Dynopay: unsere Mission, Krypto-Zahlungen einfach zu machen, wie die Plattform funktioniert, unsere Werte und wie Sie uns erreichen.",
            "eyebrow": "Über Dynopay",
            "heroTitle": "Krypto-Zahlungen, einfach gemacht für jedes Unternehmen.",
            "heroBody": "Dynopay ist ein Krypto-Zahlungsgateway für den Verkauf von Produkten, das Sammeln von Trinkgeldern und Spendenkampagnen — oder die Integration von Zahlungen per API. Unsere Mission: digitale Währungen so mühelos zu akzeptieren wie eine Kartenzahlung, während Sie die volle Kontrolle über Ihr Geld behalten.",
            "talkToUs": "Sprechen Sie mit uns",
            "stats": {
                "baseFee": "Basisgebühr — keine monatlichen Kosten",
                "chains": "Unterstützte Blockchains",
                "nonCustodial": "Non-custodial Auszahlungen",
                "since": "Aktiv seit",
            },
            "values": {
                "nonCustodial": {
                    "title": "Non-custodial by Design",
                    "body": "Zahlungen landen direkt in Ihrer eigenen Wallet — behalten Sie die ursprüngliche Kryptowährung oder konvertieren Sie automatisch in USDT/USDC. Wir verwahren Ihre Gelder nie.",
                },
                "pricing": {
                    "title": "Transparente Preise",
                    "body": "Eine klare Gebühr, Mengenrabatte mit Ihrem Wachstum und keine versteckten Kosten oder monatlichen Mindestbeträge. Was Sie sehen, ist was Sie zahlen.",
                },
                "builder": {
                    "title": "Entwicklerfreundlich",
                    "body": "Eine saubere API, gehosteter Checkout, Zahlungslinks und Webhooks — damit Sie Krypto in Minuten statt Wochen akzeptieren können.",
                },
                "global": {
                    "title": "Global von Anfang an",
                    "body": "Akzeptieren Sie Bitcoin, Ethereum und Stablecoins von Kunden weltweit — mit schnellen Auszahlungen und ohne Chargebacks.",
                },
            },
            "buildTitle": "Worauf wir bauen",
            "buildBody": "Ein kleines, schnelles Team mit einem Fokus: Händler in Krypto bezahlen lassen — ohne Komplexität. Das sind die Prinzipien hinter jedem Feature, das wir ausliefern.",
            "ctaTitle": "Möchten Sie mit uns die Zukunft des Bezahlens bauen?",
            "ctaBody": "Wir freuen uns immer über Nachrichten von Händlern, Partnern und Menschen, die Teil des Teams werden möchten. Melden Sie sich jederzeit — wir lesen jede Nachricht.",
        },
    },
    "es": {
        "exitIntentEyebrow": "Espera — un segundo",
        "exitIntentBody": "Copia la clave sandbox de abajo y llama a nuestra API desde tu terminal. Sin registro. Sin tarjeta. Respuesta real — el mismo formato JSON que en producción.",
        "exitIntentClaimCta": "Consigue 0% de comisión de plataforma en tu primer pago",
        "exitIntentClose": "Cerrar",
        "blogReadyCtaBody": "Empieza en minutos con la sencilla integración de la API de Dynopay.",
        "about": {
            "metaTitle": "Sobre Dynopay — nuestra misión y empresa",
            "metaDescription": "Conoce Dynopay: nuestra misión de simplificar los pagos en cripto, cómo funciona la plataforma, los valores sobre los que construimos y cómo contactarnos.",
            "eyebrow": "Sobre Dynopay",
            "heroTitle": "Pagos en cripto, simples para cualquier negocio.",
            "heroBody": "Dynopay es una pasarela de pagos cripto para vender productos, recibir propinas y lanzar campañas de recaudación — o integrar pagos vía API. Nuestra misión es que aceptar moneda digital sea tan fácil como un pago con tarjeta, mientras mantienes el control total de tu dinero.",
            "talkToUs": "Habla con nosotros",
            "stats": {
                "baseFee": "Comisión base — sin coste mensual",
                "chains": "Blockchains compatibles",
                "nonCustodial": "Pagos sin custodia",
                "since": "Construyendo desde",
            },
            "values": {
                "nonCustodial": {
                    "title": "Sin custodia por diseño",
                    "body": "Los pagos se liquidan directamente en tu propia wallet — conserva la cripto original o conviértela automáticamente a USDT/USDC. Nunca retenemos tus fondos.",
                },
                "pricing": {
                    "title": "Precios transparentes",
                    "body": "Una comisión clara, descuentos por volumen a medida que creces y sin cargos ocultos ni mínimos mensuales. Lo que ves es lo que pagas.",
                },
                "builder": {
                    "title": "Hecho para desarrolladores",
                    "body": "Una API limpia, checkout alojado, enlaces de pago y webhooks — para que empieces a aceptar cripto en minutos, no en semanas.",
                },
                "global": {
                    "title": "Global por defecto",
                    "body": "Acepta Bitcoin, Ethereum y stablecoins de clientes en cualquier lugar, con pagos rápidos y sin contracargos.",
                },
            },
            "buildTitle": "Sobre qué construimos",
            "buildBody": "Un equipo pequeño y ágil centrado en una sola cosa: que los comercios cobren en cripto sin complicaciones. Estos son los principios detrás de cada función que lanzamos.",
            "ctaTitle": "¿Quieres construir el futuro de los pagos con nosotros?",
            "ctaBody": "Siempre nos alegra saber de comercios, socios y personas que quieren unirse al equipo. Escríbenos cuando quieras — leemos todos los mensajes.",
        },
    },
    "fr": {
        "exitIntentEyebrow": "Attendez — une seconde",
        "exitIntentBody": "Récupérez la clé sandbox ci-dessous et appelez notre API depuis votre terminal. Sans inscription. Sans carte. Réponse réelle — le même format JSON qu'en production.",
        "exitIntentClaimCta": "Profitez de 0 % de frais de plateforme sur votre premier paiement",
        "exitIntentClose": "Fermer",
        "blogReadyCtaBody": "Démarrez en quelques minutes avec l'intégration API simple de Dynopay.",
        "about": {
            "metaTitle": "À propos de Dynopay — notre mission et notre entreprise",
            "metaDescription": "Découvrez Dynopay : notre mission de simplifier les paiements crypto, le fonctionnement de la plateforme, nos valeurs et comment nous contacter.",
            "eyebrow": "À propos de Dynopay",
            "heroTitle": "Les paiements crypto, simples pour chaque entreprise.",
            "heroBody": "Dynopay est une passerelle de paiement crypto pour vendre des produits, recevoir des pourboires et mener des campagnes de collecte — ou intégrer les paiements via API. Notre mission : rendre l'acceptation de monnaie numérique aussi simple qu'un paiement par carte, tout en vous laissant le contrôle total de votre argent.",
            "talkToUs": "Parlez-nous",
            "stats": {
                "baseFee": "Frais de base — aucun coût mensuel",
                "chains": "Blockchains prises en charge",
                "nonCustodial": "Paiements non-custodial",
                "since": "En développement depuis",
            },
            "values": {
                "nonCustodial": {
                    "title": "Non-custodial par conception",
                    "body": "Les paiements arrivent directement dans votre propre wallet — conservez la crypto d'origine ou convertissez-la automatiquement en USDT/USDC. Nous ne détenons jamais vos fonds.",
                },
                "pricing": {
                    "title": "Tarification transparente",
                    "body": "Des frais clairs, des remises de volume à mesure que vous grandissez, sans frais cachés ni minimums mensuels. Ce que vous voyez est ce que vous payez.",
                },
                "builder": {
                    "title": "Pensé pour les développeurs",
                    "body": "Une API claire, un checkout hébergé, des liens de paiement et des webhooks — pour accepter la crypto en quelques minutes, pas en semaines.",
                },
                "global": {
                    "title": "Mondial par défaut",
                    "body": "Acceptez Bitcoin, Ethereum et les stablecoins de clients partout dans le monde, avec des paiements rapides et sans rétrofacturation.",
                },
            },
            "buildTitle": "Nos fondations",
            "buildBody": "Une petite équipe rapide, concentrée sur une seule chose : permettre aux marchands d'être payés en crypto sans la complexité. Voici les principes derrière chaque fonctionnalité que nous livrons.",
            "ctaTitle": "Envie de construire l'avenir des paiements avec nous ?",
            "ctaBody": "Nous sommes toujours ravis d'échanger avec des marchands, des partenaires et des personnes qui veulent rejoindre l'équipe. Contactez-nous à tout moment — nous lisons chaque message.",
        },
    },
    "nl": {
        "exitIntentEyebrow": "Wacht — één seconde",
        "exitIntentBody": "Pak de sandbox-sleutel hieronder en roep onze API aan vanuit uw terminal. Geen registratie. Geen kaart. Echte respons — hetzelfde JSON-formaat als in productie.",
        "exitIntentClaimCta": "Claim 0% platformkosten op uw eerste betaling",
        "exitIntentClose": "Sluiten",
        "blogReadyCtaBody": "Ga binnen enkele minuten aan de slag met de eenvoudige API-integratie van Dynopay.",
        "about": {
            "metaTitle": "Over Dynopay — onze missie & het bedrijf",
            "metaDescription": "Leer Dynopay kennen: onze missie om cryptobetalingen eenvoudig te maken, hoe het platform werkt, de waarden waarop we bouwen en hoe u contact opneemt.",
            "eyebrow": "Over Dynopay",
            "heroTitle": "Cryptobetalingen, eenvoudig voor elk bedrijf.",
            "heroBody": "Dynopay is een crypto-betaalgateway voor het verkopen van producten, het ontvangen van fooien en het voeren van inzamelingsacties — of het integreren van betalingen via de API. Onze missie: digitale valuta accepteren net zo moeiteloos maken als een kaartbetaling, terwijl u de volledige controle over uw geld houdt.",
            "talkToUs": "Praat met ons",
            "stats": {
                "baseFee": "Basistarief — geen maandelijkse kosten",
                "chains": "Ondersteunde blockchains",
                "nonCustodial": "Non-custodial uitbetalingen",
                "since": "Actief sinds",
            },
            "values": {
                "nonCustodial": {
                    "title": "Non-custodial door ontwerp",
                    "body": "Betalingen komen rechtstreeks in uw eigen wallet terecht — houd de originele crypto of converteer automatisch naar USDT/USDC. Wij houden uw geld nooit vast.",
                },
                "pricing": {
                    "title": "Transparante prijzen",
                    "body": "Eén helder tarief, volumekortingen naarmate u groeit, en geen verborgen kosten of maandelijkse minima. Wat u ziet, is wat u betaalt.",
                },
                "builder": {
                    "title": "Gemaakt voor ontwikkelaars",
                    "body": "Een overzichtelijke API, gehoste checkout, betaallinks en webhooks — zodat u in minuten crypto accepteert, niet in weken.",
                },
                "global": {
                    "title": "Wereldwijd als standaard",
                    "body": "Accepteer Bitcoin, Ethereum en stablecoins van klanten overal ter wereld, met snelle uitbetalingen en zonder chargebacks.",
                },
            },
            "buildTitle": "Waarop we bouwen",
            "buildBody": "Een klein, snel team met één focus: handelaren in crypto laten betalen zonder de complexiteit. Dit zijn de principes achter elke functie die we uitbrengen.",
            "ctaTitle": "Wilt u samen met ons de toekomst van betalingen bouwen?",
            "ctaBody": "We horen altijd graag van handelaren, partners en mensen die het team willen versterken. Neem gerust contact op — we lezen elk bericht.",
        },
    },
    "pt": {
        "exitIntentEyebrow": "Espere — um segundo",
        "exitIntentBody": "Copie a chave sandbox abaixo e chame a nossa API no seu terminal. Sem cadastro. Sem cartão. Resposta real — o mesmo formato JSON da produção.",
        "exitIntentClaimCta": "Garanta 0% de taxa de plataforma no seu primeiro pagamento",
        "exitIntentClose": "Fechar",
        "blogReadyCtaBody": "Comece em minutos com a integração simples da API da Dynopay.",
        "about": {
            "metaTitle": "Sobre a Dynopay — nossa missão e empresa",
            "metaDescription": "Conheça a Dynopay: nossa missão de simplificar pagamentos em cripto, como a plataforma funciona, os valores que nos guiam e como falar conosco.",
            "eyebrow": "Sobre a Dynopay",
            "heroTitle": "Pagamentos em cripto, simples para qualquer negócio.",
            "heroBody": "A Dynopay é um gateway de pagamentos em cripto para vender produtos, receber gorjetas e criar campanhas de arrecadação — ou integrar pagamentos via API. Nossa missão é tornar a aceitação de moeda digital tão simples quanto um pagamento com cartão, com você no controle total do seu dinheiro.",
            "talkToUs": "Fale conosco",
            "stats": {
                "baseFee": "Taxa base — sem custo mensal",
                "chains": "Blockchains suportadas",
                "nonCustodial": "Repasses sem custódia",
                "since": "Construindo desde",
            },
            "values": {
                "nonCustodial": {
                    "title": "Sem custódia por padrão",
                    "body": "Os pagamentos são liquidados direto na sua própria carteira — mantenha a cripto original ou converta automaticamente para USDT/USDC. Nunca retemos seus fundos.",
                },
                "pricing": {
                    "title": "Preços transparentes",
                    "body": "Uma taxa clara, descontos por volume conforme você cresce e sem cobranças ocultas nem mínimos mensais. O que você vê é o que você paga.",
                },
                "builder": {
                    "title": "Feito para desenvolvedores",
                    "body": "Uma API limpa, checkout hospedado, links de pagamento e webhooks — para você aceitar cripto em minutos, não em semanas.",
                },
                "global": {
                    "title": "Global por padrão",
                    "body": "Aceite Bitcoin, Ethereum e stablecoins de clientes em qualquer lugar, com repasses rápidos e sem estornos.",
                },
            },
            "buildTitle": "No que nos baseamos",
            "buildBody": "Uma equipe pequena e ágil focada em uma coisa: fazer comerciantes receberem em cripto sem complexidade. Estes são os princípios por trás de cada recurso que lançamos.",
            "ctaTitle": "Quer construir o futuro dos pagamentos com a gente?",
            "ctaBody": "Adoramos ouvir comerciantes, parceiros e pessoas que querem entrar para o time. Fale com a gente a qualquer momento — lemos todas as mensagens.",
        },
    },
}


def deep_merge(dst, src):
    """Set keys from src into dst (src wins), recursing into dicts."""
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


def main():
    total = 0
    for lang, keys in KEYS.items():
        path = os.path.join(BASE, lang, "landing.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        n = deep_merge(data, keys)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}/landing.json: {n} keys set")
        total += n
    print(f"TOTAL: {total} keys set across {len(KEYS)} locales")


if __name__ == "__main__":
    main()
