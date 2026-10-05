#!/usr/bin/env python3
"""Propagate the Phase 2/3 Create-flows copy (Product sections + post-creation
clarity + hub "Most used" badge) to every supported locale.

- common.json -> nested under `productEditor`
- dashboardLayout.json -> flat `hub*`

English is the source of truth and is also written. Idempotent: only the listed
keys are touched; JSON is re-serialised with the same 2-space indent, UTF-8.
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales"))
LANGS = ["en", "es", "fr", "de", "pt", "nl"]

# Nested keys: namespace -> parent object -> key -> {lang: value}
NESTED = {
    "common": {
        "productEditor": {
            "secBasicsTitle": {"en": "Product basics", "es": "Datos del producto", "fr": "Informations du produit", "de": "Produkt-Basics", "pt": "Dados do produto", "nl": "Productbasis"},
            "secBasicsSub": {"en": "Name and describe what you're selling. Buyers see this first on your product page.", "es": "Nombra y describe lo que vendes. Es lo primero que ven los compradores en tu página de producto.", "fr": "Nommez et décrivez ce que vous vendez. C'est ce que les acheteurs voient en premier sur votre page produit.", "de": "Benenne und beschreibe, was du verkaufst. Käufer sehen dies zuerst auf deiner Produktseite.", "pt": "Nomeie e descreva o que você vende. É o que os compradores veem primeiro na sua página de produto.", "nl": "Geef een naam en beschrijving van wat je verkoopt. Dit zien kopers als eerste op je productpagina."},
            "secImagesTitle": {"en": "Images", "es": "Imágenes", "fr": "Images", "de": "Bilder", "pt": "Imagens", "nl": "Afbeeldingen"},
            "secImagesSub": {"en": "Add a cover and up to a few gallery photos — this is what buyers see on your product page.", "es": "Añade una portada y algunas fotos de galería: es lo que ven los compradores en tu página de producto.", "fr": "Ajoutez une couverture et quelques photos de galerie — c'est ce que voient les acheteurs sur votre page produit.", "de": "Füge ein Titelbild und einige Galeriefotos hinzu – das sehen Käufer auf deiner Produktseite.", "pt": "Adicione uma capa e algumas fotos de galeria — é o que os compradores veem na sua página de produto.", "nl": "Voeg een omslag en enkele galerijfoto's toe — dit zien kopers op je productpagina."},
            "secPriceTitle": {"en": "Price & stock", "es": "Precio y stock", "fr": "Prix et stock", "de": "Preis & Bestand", "pt": "Preço e estoque", "nl": "Prijs & voorraad"},
            "secPriceSub": {"en": "Set your price and currency. Buyers pay the crypto equivalent at checkout; you receive the coin they pay unless auto-convert is on.", "es": "Define tu precio y moneda. Los compradores pagan el equivalente en cripto; recibes la moneda que pagan salvo que actives la conversión automática.", "fr": "Définissez votre prix et votre devise. Les acheteurs paient l'équivalent en crypto ; vous recevez la crypto payée, sauf si la conversion automatique est activée.", "de": "Lege Preis und Währung fest. Käufer zahlen den Krypto-Gegenwert; du erhältst die gezahlte Coin, sofern die Auto-Konvertierung nicht aktiviert ist.", "pt": "Defina seu preço e moeda. Os compradores pagam o equivalente em cripto; você recebe a moeda paga, a menos que a conversão automática esteja ativa.", "nl": "Stel je prijs en valuta in. Kopers betalen het crypto-equivalent; je ontvangt de betaalde coin, tenzij automatische omzetting aanstaat."},
            "secDeliverySub": {"en": "Choose how buyers get what they paid for — a file, a link or license keys. Delivery happens automatically after payment.", "es": "Elige cómo reciben los compradores lo que pagaron: un archivo, un enlace o claves de licencia. La entrega es automática tras el pago.", "fr": "Choisissez comment les acheteurs reçoivent leur achat — un fichier, un lien ou des clés de licence. La livraison est automatique après le paiement.", "de": "Wähle, wie Käufer ihren Kauf erhalten – eine Datei, einen Link oder Lizenzschlüssel. Die Lieferung erfolgt automatisch nach der Zahlung.", "pt": "Escolha como os compradores recebem o que pagaram — um arquivo, um link ou chaves de licença. A entrega é automática após o pagamento.", "nl": "Kies hoe kopers ontvangen waarvoor ze betaalden — een bestand, een link of licentiesleutels. Levering gebeurt automatisch na betaling."},
            "secTaxSub": {"en": "Optional. Control whether tax is added at checkout and how this product is categorised.", "es": "Opcional. Controla si se añade impuesto al pagar y cómo se categoriza este producto.", "fr": "Facultatif. Contrôlez si une taxe est ajoutée au paiement et comment ce produit est catégorisé.", "de": "Optional. Steuere, ob beim Checkout Steuer hinzugefügt wird und wie dieses Produkt kategorisiert ist.", "pt": "Opcional. Controle se o imposto é adicionado no checkout e como este produto é categorizado.", "nl": "Optioneel. Bepaal of er belasting wordt toegevoegd bij het afrekenen en hoe dit product wordt gecategoriseerd."},
            "secVariantsSub": {"en": "Offer the same product in different options (e.g. sizes or tiers), each with its own price and stock.", "es": "Ofrece el mismo producto en distintas opciones (p. ej., tamaños o niveles), cada una con su precio y stock.", "fr": "Proposez le même produit en différentes options (par ex. tailles ou niveaux), chacune avec son prix et son stock.", "de": "Biete dasselbe Produkt in verschiedenen Optionen an (z. B. Größen oder Stufen), jeweils mit eigenem Preis und Bestand.", "pt": "Ofereça o mesmo produto em diferentes opções (ex.: tamanhos ou níveis), cada uma com seu preço e estoque.", "nl": "Bied hetzelfde product aan in verschillende opties (bijv. maten of niveaus), elk met een eigen prijs en voorraad."},
            "nextTitle": {"en": "Your product is live", "es": "Tu producto está publicado", "fr": "Votre produit est en ligne", "de": "Dein Produkt ist live", "pt": "Seu produto está no ar", "nl": "Je product staat live"},
            "nextSub": {"en": "Here's where it lives, and how to share and track it.", "es": "Aquí puedes verlo, compartirlo y hacer seguimiento.", "fr": "Voici où le retrouver, et comment le partager et le suivre.", "de": "Hier findest du es und kannst es teilen und verfolgen.", "pt": "Aqui está onde ele fica e como compartilhar e acompanhar.", "nl": "Hier staat het, en zo deel en volg je het."},
            "nextSeeAll": {"en": "See all products", "es": "Ver todos los productos", "fr": "Voir tous les produits", "de": "Alle Produkte ansehen", "pt": "Ver todos os produtos", "nl": "Alle producten bekijken"},
            "nextShare": {"en": "Share & QR", "es": "Compartir y QR", "fr": "Partager et QR", "de": "Teilen & QR", "pt": "Compartilhar e QR", "nl": "Delen & QR"},
            "nextTrack": {"en": "Track sales", "es": "Ver ventas", "fr": "Suivre les ventes", "de": "Verkäufe verfolgen", "pt": "Acompanhar vendas", "nl": "Verkoop volgen"},
        }
    }
}

# Flat keys: namespace -> key -> {lang: value}
FLAT = {
    "dashboardLayout": {
        "hubMostUsed": {"en": "Most used", "es": "Más usado", "fr": "Le plus utilisé", "de": "Am häufigsten genutzt", "pt": "Mais usado", "nl": "Meest gebruikt"},
    }
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main():
    writes = 0
    for lang in LANGS:
        for ns, parents in NESTED.items():
            path = os.path.join(ROOT, lang, ns + ".json")
            data = load(path)
            for parent, keys in parents.items():
                node = data.setdefault(parent, {})
                if not isinstance(node, dict):
                    raise SystemExit(f"{path}: {parent} is not an object")
                for key, vals in keys.items():
                    node[key] = vals[lang]
                    writes += 1
            save(path, data)
        for ns, keys in FLAT.items():
            path = os.path.join(ROOT, lang, ns + ".json")
            data = load(path)
            for key, vals in keys.items():
                data[key] = vals[lang]
                writes += 1
            save(path, data)
    print(f"OK: {writes} key-writes across {len(LANGS)} locales. JSON valid.")


if __name__ == "__main__":
    main()
