#!/usr/bin/env python3
"""Add hero audience-tab i18n keys + update the fixed H1 tagline across all 6 locales.

Idempotent: deep-merges the `heroTabs` + `heroAudience` blocks and force-updates
`heroSwissTitle1` (the fixed tagline line of the tabbed hero). Existing polished
translations for other keys are never touched.
"""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

# heroSwissTitle1 = fixed tagline (H1 line 1). Standardized positioning.
TAGLINE = {
    "en": "Sell, tip, fundraise — in crypto.",
    "es": "Vende, recibe propinas, recauda — en cripto.",
    "fr": "Vendez, encaissez des pourboires, collectez — en crypto.",
    "de": "Verkaufen, Trinkgeld, Fundraising — in Krypto.",
    "nl": "Verkopen, fooien, doneren — in crypto.",
    "pt": "Venda, receba gorjetas, arrecade — em cripto.",
}

HERO_TABS = {
    "en": {"merchant": "Merchants", "creator": "Creators", "campaign": "Fundraisers", "developer": "Developers"},
    "es": {"merchant": "Comerciantes", "creator": "Creadores", "campaign": "Recaudadores", "developer": "Desarrolladores"},
    "fr": {"merchant": "Commerçants", "creator": "Créateurs", "campaign": "Collecteurs", "developer": "Développeurs"},
    "de": {"merchant": "Händler", "creator": "Creator", "campaign": "Fundraiser", "developer": "Entwickler"},
    "nl": {"merchant": "Verkopers", "creator": "Creators", "campaign": "Fondsenwervers", "developer": "Ontwikkelaars"},
    "pt": {"merchant": "Comerciantes", "creator": "Criadores", "campaign": "Arrecadadores", "developer": "Desenvolvedores"},
}

HERO_AUDIENCE = {
    "en": {
        "merchant": {"title2": "Sell products for crypto.", "subtitle": "Spin up a hosted checkout, payment links, or a full storefront. Every payment settles straight to your wallet.", "cta": "Start selling"},
        "creator": {"title2": "Get tipped in crypto.", "subtitle": "Your own tip page at dynopay.com/@you. Fans support you in one tap — funds go straight to your wallet, no signup for them.", "cta": "Claim your page"},
        "campaign": {"title2": "Fund your cause in crypto.", "subtitle": "Launch a full campaign page — goal, reward tiers, and updates that email your supporters. Raise from anyone, anywhere.", "cta": "Start a campaign"},
        "developer": {"title2": "Integrate crypto in ~10 minutes.", "subtitle": "REST API, webhooks, SDKs and drop-in checkout. 15+ chains, one API, no smart contracts.", "cta": "Read the docs"},
    },
    "es": {
        "merchant": {"title2": "Vende productos por cripto.", "subtitle": "Crea un checkout, enlaces de pago o una tienda completa. Cada pago se liquida directo a tu billetera.", "cta": "Empieza a vender"},
        "creator": {"title2": "Recibe propinas en cripto.", "subtitle": "Tu propia página de propinas en dynopay.com/@tú. Tus fans te apoyan con un toque — el dinero va directo a tu billetera, sin registro para ellos.", "cta": "Reclama tu página"},
        "campaign": {"title2": "Financia tu causa en cripto.", "subtitle": "Lanza una página de campaña completa — meta, niveles de recompensa y novedades que llegan por correo a tus donantes. Recauda de cualquiera, en cualquier lugar.", "cta": "Inicia una campaña"},
        "developer": {"title2": "Integra cripto en ~10 minutos.", "subtitle": "API REST, webhooks, SDKs y checkout listo para usar. Más de 15 cadenas, una sola API, sin smart contracts.", "cta": "Leer los docs"},
    },
    "fr": {
        "merchant": {"title2": "Vendez des produits en crypto.", "subtitle": "Lancez un checkout hébergé, des liens de paiement ou une boutique complète. Chaque paiement arrive directement dans votre portefeuille.", "cta": "Commencer à vendre"},
        "creator": {"title2": "Recevez des pourboires en crypto.", "subtitle": "Votre propre page de pourboires sur dynopay.com/@vous. Vos fans vous soutiennent en un clic — l'argent arrive direct dans votre portefeuille, sans inscription pour eux.", "cta": "Réclamez votre page"},
        "campaign": {"title2": "Financez votre cause en crypto.", "subtitle": "Lancez une page de campagne complète — objectif, paliers de récompense et actualités envoyées par e-mail à vos soutiens. Collectez auprès de tous, partout.", "cta": "Lancer une campagne"},
        "developer": {"title2": "Intégrez la crypto en ~10 minutes.", "subtitle": "API REST, webhooks, SDK et checkout prêt à l'emploi. 15+ chaînes, une seule API, sans smart contracts.", "cta": "Lire les docs"},
    },
    "de": {
        "merchant": {"title2": "Verkaufe Produkte für Krypto.", "subtitle": "Starte einen Checkout, Zahlungslinks oder einen kompletten Shop. Jede Zahlung landet direkt in deiner Wallet.", "cta": "Verkauf starten"},
        "creator": {"title2": "Erhalte Trinkgeld in Krypto.", "subtitle": "Deine eigene Trinkgeld-Seite auf dynopay.com/@du. Fans unterstützen dich mit einem Tippen — das Geld geht direkt in deine Wallet, ohne Anmeldung für sie.", "cta": "Seite sichern"},
        "campaign": {"title2": "Finanziere dein Anliegen in Krypto.", "subtitle": "Starte eine komplette Kampagnenseite — Ziel, Belohnungsstufen und Updates, die deine Unterstützer per E-Mail erreichen. Sammle von überall.", "cta": "Kampagne starten"},
        "developer": {"title2": "Integriere Krypto in ~10 Minuten.", "subtitle": "REST-API, Webhooks, SDKs und Drop-in-Checkout. 15+ Chains, eine API, keine Smart Contracts.", "cta": "Docs lesen"},
    },
    "nl": {
        "merchant": {"title2": "Verkoop producten voor crypto.", "subtitle": "Zet een checkout, betaallinks of een complete winkel op. Elke betaling komt direct in je wallet.", "cta": "Begin met verkopen"},
        "creator": {"title2": "Ontvang fooien in crypto.", "subtitle": "Je eigen fooienpagina op dynopay.com/@jij. Fans steunen je met één tik — het geld gaat direct naar je wallet, zonder aanmelding voor hen.", "cta": "Claim je pagina"},
        "campaign": {"title2": "Financier je doel in crypto.", "subtitle": "Start een volledige campagnepagina — doel, beloningsniveaus en updates die je supporters per e-mail bereiken. Werf van iedereen, overal.", "cta": "Start een campagne"},
        "developer": {"title2": "Integreer crypto in ~10 minuten.", "subtitle": "REST-API, webhooks, SDK's en kant-en-klare checkout. 15+ chains, één API, geen smart contracts.", "cta": "Lees de docs"},
    },
    "pt": {
        "merchant": {"title2": "Venda produtos por cripto.", "subtitle": "Crie um checkout, links de pagamento ou uma loja completa. Cada pagamento cai direto na sua carteira.", "cta": "Comece a vender"},
        "creator": {"title2": "Receba gorjetas em cripto.", "subtitle": "Sua própria página de gorjetas em dynopay.com/@você. Os fãs apoiam você com um toque — o dinheiro vai direto para sua carteira, sem cadastro para eles.", "cta": "Garanta sua página"},
        "campaign": {"title2": "Financie sua causa em cripto.", "subtitle": "Lance uma página de campanha completa — meta, níveis de recompensa e novidades que chegam por e-mail aos seus apoiadores. Arrecade de qualquer pessoa, em qualquer lugar.", "cta": "Inicie uma campanha"},
        "developer": {"title2": "Integre cripto em ~10 minutos.", "subtitle": "API REST, webhooks, SDKs e checkout pronto. Mais de 15 redes, uma API, sem smart contracts.", "cta": "Leia os docs"},
    },
}


def main():
    for loc in ["en", "es", "fr", "de", "nl", "pt"]:
        path = os.path.join(LOCALES_DIR, loc, "landing.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["heroSwissTitle1"] = TAGLINE[loc]
        data["heroTabs"] = HERO_TABS[loc]
        data["heroAudience"] = HERO_AUDIENCE[loc]

        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"[{loc}] updated heroSwissTitle1 + heroTabs + heroAudience")


if __name__ == "__main__":
    main()
