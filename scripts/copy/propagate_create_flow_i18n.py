#!/usr/bin/env python3
"""Propagate the Create-hub / Fundraiser-flow / settlement copy to all locales.

Writes the NEW + CHANGED English strings from the "Create Flows Redesign &
Discovery" work into every supported language (en is the source of truth and is
also written so new keys exist there). Idempotent; only touches the listed keys.

NOTE: the full landing v7 marketing rewrite is propagated separately (Phase 3
"full propagation"); here we cover the create-flow UI + the settlement-accuracy
strings that must be truthful in every language.
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales"))
LANGS = ["en", "es", "fr", "de", "pt", "nl"]

# Flat (top-level) keys per namespace.
FLAT = {
    "dashboardLayout": {
        "navClose": {"en": "Close", "es": "Cerrar", "fr": "Fermer", "de": "Schließen", "pt": "Fechar", "nl": "Sluiten"},
        "navNewFundraiser": {"en": "Fundraiser", "es": "Recaudación", "fr": "Collecte de fonds", "de": "Spendenaktion", "pt": "Arrecadação", "nl": "Inzamelingsactie"},
        "navNewCreatorPage": {"en": "Creator page", "es": "Página de creador", "fr": "Page créateur", "de": "Creator-Seite", "pt": "Página de criador", "nl": "Creatorpagina"},
        "hubTitle": {"en": "Create", "es": "Crear", "fr": "Créer", "de": "Erstellen", "pt": "Criar", "nl": "Aanmaken"},
        "hubSubtitle": {"en": "What would you like to set up?", "es": "¿Qué quieres crear?", "fr": "Que souhaitez-vous configurer ?", "de": "Was möchtest du einrichten?", "pt": "O que você quer criar?", "nl": "Wat wil je instellen?"},
        "hubPaylinkDesc": {"en": "Request a fixed amount for a product, invoice or service.", "es": "Solicita un importe fijo por un producto, factura o servicio.", "fr": "Demandez un montant fixe pour un produit, une facture ou un service.", "de": "Fordere einen festen Betrag für ein Produkt, eine Rechnung oder eine Dienstleistung an.", "pt": "Solicite um valor fixo por um produto, fatura ou serviço.", "nl": "Vraag een vast bedrag voor een product, factuur of dienst."},
        "hubPaylinkFull": {"en": "Full options: taxes, expiry, accepted coins", "es": "Opciones completas: impuestos, caducidad, monedas aceptadas", "fr": "Options complètes : taxes, expiration, cryptos acceptées", "de": "Alle Optionen: Steuern, Ablauf, akzeptierte Coins", "pt": "Opções completas: impostos, expiração, moedas aceitas", "nl": "Alle opties: belasting, vervaldatum, geaccepteerde coins"},
        "hubFundraiserDesc": {"en": "Collect donations toward a goal, with a progress bar and donor wall.", "es": "Recauda donaciones hacia una meta, con barra de progreso y muro de donantes.", "fr": "Collectez des dons pour atteindre un objectif, avec barre de progression et mur des donateurs.", "de": "Sammle Spenden für ein Ziel – mit Fortschrittsbalken und Spenderwand.", "pt": "Receba doações para uma meta, com barra de progresso e mural de doadores.", "nl": "Verzamel donaties voor een doel, met voortgangsbalk en donateurswand."},
        "hubProductDesc": {"en": "Sell a product with variants, images and inventory.", "es": "Vende un producto con variantes, imágenes e inventario.", "fr": "Vendez un produit avec variantes, images et stock.", "de": "Verkaufe ein Produkt mit Varianten, Bildern und Lagerbestand.", "pt": "Venda um produto com variações, imagens e estoque.", "nl": "Verkoop een product met varianten, afbeeldingen en voorraad."},
        "hubCreatorDesc": {"en": "A shareable page for tips and support at your dynopay.com/handle.", "es": "Una página para compartir, con propinas y apoyo, en tu dynopay.com/usuario.", "fr": "Une page partageable pour les pourboires et le soutien, sur votre dynopay.com/pseudo.", "de": "Eine teilbare Seite für Trinkgeld und Unterstützung unter deiner dynopay.com/handle.", "pt": "Uma página para compartilhar, com gorjetas e apoio, no seu dynopay.com/usuario.", "nl": "Een deelbare pagina voor fooien en steun op jouw dynopay.com/handle."},
        "hubSettlementNote": {"en": "You'll receive the coin each customer pays. Turn on auto-convert to settle in a stablecoin instead.", "es": "Recibirás la misma moneda que paga cada cliente. Activa la conversión automática para liquidar en una stablecoin.", "fr": "Vous recevez la crypto payée par chaque client. Activez la conversion automatique pour être réglé en stablecoin.", "de": "Du erhältst die Coin, die jeder Kunde zahlt. Aktiviere die Auto-Konvertierung, um stattdessen in einem Stablecoin ausgezahlt zu werden.", "pt": "Você recebe a mesma moeda que cada cliente paga. Ative a conversão automática para liquidar em uma stablecoin.", "nl": "Je ontvangt de coin die elke klant betaalt. Zet automatische omzetting aan om in een stablecoin uit te betalen."},
        "hubSettlementCta": {"en": "Auto-convert settings", "es": "Ajustes de conversión automática", "fr": "Paramètres de conversion automatique", "de": "Auto-Konvertierung-Einstellungen", "pt": "Configurações de conversão automática", "nl": "Instellingen automatische omzetting"},
    },
    "createPaymentLinkScreen": {
        "linkTypeDonation": {"en": "Fundraiser", "es": "Recaudación", "fr": "Collecte de fonds", "de": "Spendenaktion", "pt": "Arrecadação", "nl": "Inzamelingsactie"},
        "linkTypeDonationHint": {"en": "Collect donations toward a goal, with a progress bar and donor wall.", "es": "Recauda donaciones hacia una meta, con barra de progreso y muro de donantes.", "fr": "Collectez des dons pour atteindre un objectif, avec barre de progression et mur des donateurs.", "de": "Sammle Spenden für ein Ziel – mit Fortschrittsbalken und Spenderwand.", "pt": "Receba doações para uma meta, com barra de progresso e mural de doadores.", "nl": "Verzamel donaties voor een doel, met voortgangsbalk en donateurswand."},
        "createDonationTitle": {"en": "Create a fundraiser", "es": "Crear una recaudación", "fr": "Créer une collecte de fonds", "de": "Spendenaktion erstellen", "pt": "Criar uma arrecadação", "nl": "Een inzamelingsactie maken"},
        "donationPresetsSuggest": {"en": "Suggest amounts", "es": "Sugerir importes", "fr": "Suggérer des montants", "de": "Beträge vorschlagen", "pt": "Sugerir valores", "nl": "Bedragen voorstellen"},
        "previewDonorWall": {"en": "Recent supporters", "es": "Colaboradores recientes", "fr": "Soutiens récents", "de": "Neueste Unterstützer", "pt": "Apoiadores recentes", "nl": "Recente supporters"},
        "previewDonorWallSample": {"en": "Sample — real supporters appear here once you're live.", "es": "Ejemplo: los colaboradores reales aparecerán aquí cuando publiques.", "fr": "Exemple — les vrais soutiens apparaîtront ici une fois en ligne.", "de": "Beispiel – echte Unterstützer erscheinen hier, sobald du live bist.", "pt": "Exemplo — os apoiadores reais aparecerão aqui quando você estiver no ar.", "nl": "Voorbeeld — echte supporters verschijnen hier zodra je live bent."},
        "previewDonorJustNow": {"en": "just now", "es": "ahora mismo", "fr": "à l'instant", "de": "gerade eben", "pt": "agora mesmo", "nl": "zojuist"},
        "previewDonorMinsAgo": {"en": "2m ago", "es": "hace 2 min", "fr": "il y a 2 min", "de": "vor 2 Min.", "pt": "há 2 min", "nl": "2 min geleden"},
        "previewDonorA": {"en": "Amara", "es": "Amara", "fr": "Amara", "de": "Amara", "pt": "Amara", "nl": "Amara"},
        "previewDonorB": {"en": "Leo", "es": "Leo", "fr": "Leo", "de": "Leo", "pt": "Leo", "nl": "Leo"},
    },
    "paymentLinks": {
        "donationBadge": {"en": "Fundraiser", "es": "Recaudación", "fr": "Collecte de fonds", "de": "Spendenaktion", "pt": "Arrecadação", "nl": "Inzamelingsactie"},
    },
}

# Nested keys in landing.json (settlement-accuracy copy).
LANDING = {
    "v7.hero.body": {
        "en": "Take Bitcoin, Ethereum, USDT and 40+ assets, and keep the coin you're paid — or switch on auto-convert to settle in a stablecoin. Non-custodial, zero chargebacks, live in minutes.",
        "es": "Acepta Bitcoin, Ethereum, USDT y más de 40 activos, y conserva la moneda que te paguen, o activa la conversión automática para liquidar en una stablecoin. Sin custodia, sin contracargos, en marcha en minutos.",
        "fr": "Acceptez Bitcoin, Ethereum, USDT et plus de 40 actifs, et conservez la crypto reçue — ou activez la conversion automatique pour être réglé en stablecoin. Non-dépositaire, zéro rétrofacturation, opérationnel en quelques minutes.",
        "de": "Akzeptiere Bitcoin, Ethereum, USDT und über 40 Assets und behalte die gezahlte Coin – oder aktiviere die Auto-Konvertierung, um in einem Stablecoin ausgezahlt zu werden. Nicht-verwahrend, keine Rückbuchungen, in Minuten startklar.",
        "pt": "Aceite Bitcoin, Ethereum, USDT e mais de 40 ativos e fique com a moeda que recebeu — ou ative a conversão automática para liquidar em uma stablecoin. Sem custódia, sem estornos, no ar em minutos.",
        "nl": "Accepteer Bitcoin, Ethereum, USDT en 40+ assets en behoud de ontvangen coin — of zet automatische omzetting aan om in een stablecoin uit te betalen. Non-custodial, geen terugboekingen, binnen enkele minuten live.",
    },
    "v7.how.steps.settle.body": {
        "en": "Receive the coin your customer paid, or turn on auto-convert to settle in a stablecoin — straight to the wallet you control.",
        "es": "Recibe la moneda que pagó tu cliente, o activa la conversión automática para liquidar en una stablecoin, directo a la billetera que tú controlas.",
        "fr": "Recevez la crypto payée par votre client, ou activez la conversion automatique pour un règlement en stablecoin — directement vers le portefeuille que vous contrôlez.",
        "de": "Erhalte die Coin, die dein Kunde gezahlt hat, oder aktiviere die Auto-Konvertierung für die Auszahlung in einem Stablecoin – direkt in die Wallet, die du kontrollierst.",
        "pt": "Receba a moeda que seu cliente pagou, ou ative a conversão automática para liquidar em uma stablecoin — direto para a carteira que você controla.",
        "nl": "Ontvang de coin die je klant betaalde, of zet automatische omzetting aan om in een stablecoin uit te betalen — rechtstreeks naar de wallet die jij beheert.",
    },
    "v7.faq.coins.a": {
        "en": "Bitcoin, Ethereum, USDT, USDC and 40+ assets across major chains. By default you receive the same coin your customer paid; switch on auto-convert to settle in a stablecoin like USDC instead.",
        "es": "Bitcoin, Ethereum, USDT, USDC y más de 40 activos en las principales redes. De forma predeterminada recibes la misma moneda que pagó tu cliente; activa la conversión automática para liquidar en una stablecoin como USDC.",
        "fr": "Bitcoin, Ethereum, USDT, USDC et plus de 40 actifs sur les principales blockchains. Par défaut, vous recevez la crypto payée par votre client ; activez la conversion automatique pour être réglé en stablecoin comme l'USDC.",
        "de": "Bitcoin, Ethereum, USDT, USDC und über 40 Assets auf den wichtigsten Chains. Standardmäßig erhältst du dieselbe Coin, die dein Kunde gezahlt hat; aktiviere die Auto-Konvertierung, um stattdessen in einem Stablecoin wie USDC ausgezahlt zu werden.",
        "pt": "Bitcoin, Ethereum, USDT, USDC e mais de 40 ativos nas principais redes. Por padrão, você recebe a mesma moeda que seu cliente pagou; ative a conversão automática para liquidar em uma stablecoin como a USDC.",
        "nl": "Bitcoin, Ethereum, USDT, USDC en 40+ assets op de grote chains. Standaard ontvang je dezelfde coin die je klant betaalde; zet automatische omzetting aan om in een stablecoin zoals USDC uit te betalen.",
    },
}


def set_path(obj, dotted, value):
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    changed = 0
    for lang in LANGS:
        # flat namespaces
        for ns, keys in FLAT.items():
            path = os.path.join(ROOT, lang, f"{ns}.json")
            data = json.load(open(path, encoding="utf-8"))
            for key, vals in keys.items():
                data[key] = vals[lang]
                changed += 1
            write_json(path, data)
        # landing nested
        lpath = os.path.join(ROOT, lang, "landing.json")
        ldata = json.load(open(lpath, encoding="utf-8"))
        for dotted, vals in LANDING.items():
            set_path(ldata, dotted, vals[lang])
            changed += 1
        write_json(lpath, ldata)
    print(f"propagated {changed} key-writes across {len(LANGS)} languages")


if __name__ == "__main__":
    main()
