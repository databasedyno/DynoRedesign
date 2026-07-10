#!/usr/bin/env python3
"""One-off: add donation-aware copy keys to createPaymentLinkScreen.json + landing.json
across all supported locales. Idempotent (safe to re-run)."""
import json
import os

BASE = "/app/langs/locales"
LOCALES = ["en", "es", "fr", "de", "nl", "pt"]

# ── createPaymentLinkScreen.json additions ─────────────────────────────
CPL = {
    "en": {
        "createDonation": "Create donation",
        "createDonationTitle": "Create Donation",
        "donationSuccessfullyCreated": "Donation created",
        "shareDonationToStartCollecting": "Share it to start collecting donations",
    },
    "es": {
        "createDonation": "Crear donación",
        "createDonationTitle": "Crear donación",
        "donationSuccessfullyCreated": "Donación creada",
        "shareDonationToStartCollecting": "Compártelo para empezar a recaudar donaciones",
    },
    "fr": {
        "createDonation": "Créer un don",
        "createDonationTitle": "Créer un don",
        "donationSuccessfullyCreated": "Don créé",
        "shareDonationToStartCollecting": "Partagez-le pour commencer à collecter des dons",
    },
    "de": {
        "createDonation": "Spende erstellen",
        "createDonationTitle": "Spende erstellen",
        "donationSuccessfullyCreated": "Spende erstellt",
        "shareDonationToStartCollecting": "Teilen Sie ihn, um Spenden zu sammeln",
    },
    "nl": {
        "createDonation": "Donatie aanmaken",
        "createDonationTitle": "Donatie aanmaken",
        "donationSuccessfullyCreated": "Donatie aangemaakt",
        "shareDonationToStartCollecting": "Deel het om donaties te ontvangen",
    },
    "pt": {
        "createDonation": "Criar doação",
        "createDonationTitle": "Criar doação",
        "donationSuccessfullyCreated": "Doação criada",
        "shareDonationToStartCollecting": "Compartilhe para começar a receber doações",
    },
}

# ── landing.json additions (use-case 5 + FAQ 7) ────────────────────────
LANDING = {
    "en": {
        "useCase5Title": "Donations & Crowdfunding",
        "useCase5Description": "Raise funds toward a goal — supporters choose their own amount and watch live progress.",
        "useCase5Tag": "Donations",
        "faq7Q": "Can I collect donations or run a crowdfunding campaign?",
        "faq7A": "Yes. Alongside fixed-amount payment links, DynoPay lets you create donation & crowdfunding links where supporters choose how much to give. Set a goal, add suggested amounts, and share a single link that shows live progress — perfect for fundraisers, creators, and nonprofits accepting crypto.",
    },
    "es": {
        "useCase5Title": "Donaciones y Crowdfunding",
        "useCase5Description": "Recauda fondos para un objetivo: los donantes eligen su importe y ven el progreso en vivo.",
        "useCase5Tag": "Donaciones",
        "faq7Q": "¿Puedo recibir donaciones o hacer una campaña de crowdfunding?",
        "faq7A": "Sí. Además de los enlaces de pago con importe fijo, DynoPay te permite crear enlaces de donación y crowdfunding donde los donantes eligen cuánto aportar. Define una meta, añade importes sugeridos y comparte un único enlace que muestra el progreso en vivo — ideal para recaudaciones, creadores y organizaciones sin fines de lucro que aceptan cripto.",
    },
    "fr": {
        "useCase5Title": "Dons et Financement participatif",
        "useCase5Description": "Collectez des fonds pour un objectif : les donateurs choisissent leur montant et suivent la progression en direct.",
        "useCase5Tag": "Dons",
        "faq7Q": "Puis-je collecter des dons ou lancer une campagne de financement participatif ?",
        "faq7A": "Oui. En plus des liens de paiement à montant fixe, DynoPay vous permet de créer des liens de don et de financement participatif où les donateurs choisissent le montant. Fixez un objectif, ajoutez des montants suggérés et partagez un seul lien qui affiche la progression en direct — idéal pour les collectes, les créateurs et les associations qui acceptent la crypto.",
    },
    "de": {
        "useCase5Title": "Spenden & Crowdfunding",
        "useCase5Description": "Sammeln Sie Geld für ein Ziel — Unterstützer wählen ihren Betrag und sehen den Fortschritt live.",
        "useCase5Tag": "Spenden",
        "faq7Q": "Kann ich Spenden sammeln oder eine Crowdfunding-Kampagne durchführen?",
        "faq7A": "Ja. Neben Zahlungslinks mit festem Betrag können Sie mit DynoPay Spenden- und Crowdfunding-Links erstellen, bei denen Unterstützer den Betrag selbst wählen. Legen Sie ein Ziel fest, fügen Sie Vorschlagsbeträge hinzu und teilen Sie einen einzigen Link, der den Fortschritt live anzeigt — perfekt für Fundraiser, Creator und gemeinnützige Organisationen, die Krypto akzeptieren.",
    },
    "nl": {
        "useCase5Title": "Donaties & Crowdfunding",
        "useCase5Description": "Zamel geld in voor een doel — donateurs kiezen zelf hun bedrag en zien de voortgang live.",
        "useCase5Tag": "Donaties",
        "faq7Q": "Kan ik donaties innen of een crowdfundingcampagne opzetten?",
        "faq7A": "Ja. Naast betaallinks met een vast bedrag kunt u met DynoPay donatie- en crowdfundinglinks maken waarbij supporters zelf kiezen hoeveel ze geven. Stel een doel in, voeg voorgestelde bedragen toe en deel één link die de voortgang live toont — ideaal voor fondsenwervers, creators en goede doelen die crypto accepteren.",
    },
    "pt": {
        "useCase5Title": "Doações e Crowdfunding",
        "useCase5Description": "Arrecade fundos para uma meta — os doadores escolhem o valor e acompanham o progresso ao vivo.",
        "useCase5Tag": "Doações",
        "faq7Q": "Posso receber doações ou fazer uma campanha de financiamento coletivo?",
        "faq7A": "Sim. Além dos links de pagamento com valor fixo, a DynoPay permite criar links de doação e financiamento coletivo em que os apoiadores escolhem quanto contribuir. Defina uma meta, adicione valores sugeridos e compartilhe um único link que mostra o progresso ao vivo — perfeito para arrecadações, criadores e ONGs que aceitam cripto.",
    },
}

# ── hero subtitle donation clause (appended) ───────────────────────────
HERO_CLAUSE = {
    "en": " Now with donations and crowdfunding.",
    "es": " Ahora con donaciones y crowdfunding.",
    "fr": " Désormais avec dons et financement participatif.",
    "de": " Jetzt auch mit Spenden und Crowdfunding.",
    "nl": " Nu ook met donaties en crowdfunding.",
    "pt": " Agora com doações e financiamento coletivo.",
}


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


for loc in LOCALES:
    # createPaymentLinkScreen.json
    cpl_path = os.path.join(BASE, loc, "createPaymentLinkScreen.json")
    d = load(cpl_path)
    for k, v in CPL[loc].items():
        d[k] = v
    save(cpl_path, d)

    # landing.json
    land_path = os.path.join(BASE, loc, "landing.json")
    ld = load(land_path)
    for k, v in LANDING[loc].items():
        ld[k] = v
    # append hero clause once (idempotent)
    clause = HERO_CLAUSE[loc]
    if "heroCleanSubtitle" in ld and clause.strip() not in ld["heroCleanSubtitle"]:
        ld["heroCleanSubtitle"] = ld["heroCleanSubtitle"].rstrip() + clause
    save(land_path, ld)
    print(f"[{loc}] updated createPaymentLinkScreen.json + landing.json")

print("DONE")
