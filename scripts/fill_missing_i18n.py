#!/usr/bin/env python3
"""One-off: fill the 106 missing translation keys flagged by check-i18n.mjs.
Source of truth = langs/locales/en. Adds keys only if absent (idempotent)."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

# productQuickSell block per language (nl already has it)
PQS = {
    "de": {
        "title": "Produkt aus deinem Shop verkaufen",
        "hint": "Füllt Betrag, Währung, Beschreibung & Bild automatisch aus – oder trage sie unten manuell ein.",
        "pick": "Produkt auswählen",
        "selectedHint": "Betrag & Beschreibung automatisch ausgefüllt – du kannst sie unten weiterhin bearbeiten.",
        "change": "Ändern",
        "remove": "Produkt entfernen",
        "close": "Schließen",
        "dialogTitle": "Wähle ein Produkt aus deinem Shop",
        "searchPlaceholder": "Nach Namen suchen…",
        "noResults": "Keine Produkte passen zu deiner Suche",
        "noneLive": "Noch keine aktiven Produkte",
        "noneHint": "Veröffentliche Produkte unter Shop → Produkte und komm dann zurück, um eines auszuwählen.",
        "currentBadge": "· aktuell",
        "variantLabel": "Variante",
    },
    "es": {
        "title": "Vende un producto de tu tienda",
        "hint": "Rellena automáticamente importe, moneda, descripción e imagen, o complétalos manualmente abajo.",
        "pick": "Elegir producto",
        "selectedHint": "Importe y descripción rellenados automáticamente; aún puedes editarlos abajo.",
        "change": "Cambiar",
        "remove": "Quitar producto",
        "close": "Cerrar",
        "dialogTitle": "Elige un producto de tu tienda",
        "searchPlaceholder": "Buscar por nombre…",
        "noResults": "Ningún producto coincide con tu búsqueda",
        "noneLive": "Aún no hay productos activos",
        "noneHint": "Publica productos en Tienda → Productos y vuelve para elegir uno.",
        "currentBadge": "· actual",
        "variantLabel": "Variante",
    },
    "fr": {
        "title": "Vendez un produit de votre boutique",
        "hint": "Remplit automatiquement le montant, la devise, la description et l'image — ou saisissez-les manuellement ci-dessous.",
        "pick": "Choisir un produit",
        "selectedHint": "Montant et description remplis automatiquement — vous pouvez toujours les modifier ci-dessous.",
        "change": "Modifier",
        "remove": "Retirer le produit",
        "close": "Fermer",
        "dialogTitle": "Choisissez un produit de votre boutique",
        "searchPlaceholder": "Rechercher par nom…",
        "noResults": "Aucun produit ne correspond à votre recherche",
        "noneLive": "Aucun produit actif pour le moment",
        "noneHint": "Publiez des produits dans Boutique → Produits, puis revenez en choisir un.",
        "currentBadge": "· actuel",
        "variantLabel": "Variante",
    },
    "pt": {
        "title": "Venda um produto da sua loja",
        "hint": "Preenche automaticamente valor, moeda, descrição e imagem — ou preencha manualmente abaixo.",
        "pick": "Escolher produto",
        "selectedHint": "Valor e descrição preenchidos automaticamente — ainda pode editá-los abaixo.",
        "change": "Alterar",
        "remove": "Remover produto",
        "close": "Fechar",
        "dialogTitle": "Escolha um produto da sua loja",
        "searchPlaceholder": "Pesquisar por nome…",
        "noResults": "Nenhum produto corresponde à sua pesquisa",
        "noneLive": "Ainda não há produtos ativos",
        "noneHint": "Publique produtos em Loja → Produtos e volte para escolher um.",
        "currentBadge": "· atual",
        "variantLabel": "Variante",
    },
}

DASH = {
    "de": {
        "storefront": "Storefront",
        "firstLinkStep1Title": "Wallet hinzufügen",
        "firstLinkStep1Desc": "Wähle die Währungen, in denen du bezahlt werden möchtest.",
        "firstLinkStep2Title": "Zahlungslink erstellen",
        "firstLinkStep2Desc": "Lege einen Betrag fest und erstelle einen teilbaren Checkout.",
        "firstLinkStep3Title": "Teilen und bezahlt werden",
        "firstLinkStep3Desc": "Sende den Link an einen Kunden – Zahlungen erscheinen hier.",
    },
    "es": {
        "storefront": "Tienda",
        "firstLinkStep1Title": "Añade una wallet",
        "firstLinkStep1Desc": "Elige las monedas en las que quieres cobrar.",
        "firstLinkStep2Title": "Crea un enlace de pago",
        "firstLinkStep2Desc": "Fija un importe y genera un checkout para compartir.",
        "firstLinkStep3Title": "Compártelo y cobra",
        "firstLinkStep3Desc": "Envía el enlace a un cliente: los pagos aparecen aquí.",
    },
    "fr": {
        "storefront": "Vitrine",
        "firstLinkStep1Title": "Ajouter un portefeuille",
        "firstLinkStep1Desc": "Choisissez les devises dans lesquelles vous souhaitez être payé.",
        "firstLinkStep2Title": "Créer un lien de paiement",
        "firstLinkStep2Desc": "Définissez un montant et générez un paiement partageable.",
        "firstLinkStep3Title": "Partagez-le et soyez payé",
        "firstLinkStep3Desc": "Envoyez le lien à un client — les paiements arrivent ici.",
    },
    "nl": {
        "storefront": "Etalage",
        "firstLinkStep1Title": "Voeg een wallet toe",
        "firstLinkStep1Desc": "Kies de valuta's waarin je betaald wilt worden.",
        "firstLinkStep2Title": "Maak een betaallink",
        "firstLinkStep2Desc": "Stel een bedrag in en genereer een deelbare checkout.",
        "firstLinkStep3Title": "Deel de link en word betaald",
        "firstLinkStep3Desc": "Stuur de link naar een klant — betalingen verschijnen hier.",
    },
    "pt": {
        "storefront": "Loja",
        "firstLinkStep1Title": "Adicione uma carteira",
        "firstLinkStep1Desc": "Escolha as moedas em que quer receber.",
        "firstLinkStep2Title": "Crie um link de pagamento",
        "firstLinkStep2Desc": "Defina um valor e gere um checkout partilhável.",
        "firstLinkStep3Title": "Partilhe e receba",
        "firstLinkStep3Desc": "Envie o link a um cliente — os pagamentos aparecem aqui.",
    },
}

PAGETITLES = {
    "de": {
        "about_title": "Über Dynopay – unsere Mission & unser Unternehmen",
        "about_desc": "Erfahre mehr über Dynopay: unsere Mission, Krypto-Zahlungen einfach zu machen, wie die Plattform funktioniert, unsere Werte und wie du uns kontaktierst oder dem Team beitrittst.",
    },
    "es": {
        "about_title": "Sobre Dynopay: nuestra misión y empresa",
        "about_desc": "Conoce Dynopay: nuestra misión de simplificar los pagos con cripto, cómo funciona la plataforma, los valores que nos guían y cómo contactarnos o unirte al equipo.",
    },
    "fr": {
        "about_title": "À propos de Dynopay — notre mission et notre entreprise",
        "about_desc": "Découvrez Dynopay : notre mission de simplifier les paiements en crypto, le fonctionnement de la plateforme, nos valeurs et comment nous contacter ou rejoindre l'équipe.",
    },
    "nl": {
        "about_title": "Over Dynopay — onze missie & ons bedrijf",
        "about_desc": "Ontdek Dynopay: onze missie om cryptobetalingen eenvoudig te maken, hoe het platform werkt, de waarden waarop we bouwen en hoe je contact opneemt of ons team komt versterken.",
    },
    "pt": {
        "about_title": "Sobre a Dynopay — a nossa missão e empresa",
        "about_desc": "Conheça a Dynopay: a nossa missão de tornar os pagamentos em cripto simples, como a plataforma funciona, os valores em que assentamos e como entrar em contacto ou juntar-se à equipa.",
    },
}

TX_VALUE = {"de": "Wert", "es": "Valor", "fr": "Valeur", "nl": "Waarde", "pt": "Valor"}


def load(lang, fname):
    with open(os.path.join(BASE, lang, fname), "r", encoding="utf-8") as f:
        return json.load(f)


def save(lang, fname, data):
    with open(os.path.join(BASE, lang, fname), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


added = 0

# productQuickSell (de/es/fr/pt)
for lang, block in PQS.items():
    d = load(lang, "createPaymentLinkScreen.json")
    if "productQuickSell" not in d:
        d["productQuickSell"] = block
        save(lang, "createPaymentLinkScreen.json", d)
        added += len(block)
        print(f"[{lang}] createPaymentLinkScreen.productQuickSell +{len(block)}")

# dashboardLayout (de/es/fr/nl/pt)
for lang, block in DASH.items():
    d = load(lang, "dashboardLayout.json")
    n = 0
    for k, v in block.items():
        if k not in d:
            d[k] = v
            n += 1
    if n:
        save(lang, "dashboardLayout.json", d)
        added += n
        print(f"[{lang}] dashboardLayout +{n}")

# pageTitles
for lang, block in PAGETITLES.items():
    d = load(lang, "pageTitles.json")
    n = 0
    for k, v in block.items():
        if k not in d:
            d[k] = v
            n += 1
    if n:
        save(lang, "pageTitles.json", d)
        added += n
        print(f"[{lang}] pageTitles +{n}")

# transactions.value
for lang, v in TX_VALUE.items():
    d = load(lang, "transactions.json")
    if "value" not in d:
        d["value"] = v
        save(lang, "transactions.json", d)
        added += 1
        print(f"[{lang}] transactions.value +1")

print(f"TOTAL added: {added}")
