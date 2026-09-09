#!/usr/bin/env python3
"""Reword the last business/company phrasings to 'brand' in all 6 locales (PRD 2 follow-up)."""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

DESC = {
    "en": "Brand profile, logo, and details",
    "de": "Markenprofil, Logo und Details",
    "es": "Perfil de la marca, logotipo y detalles",
    "fr": "Profil de la marque, logo et détails",
    "nl": "Merkprofiel, logo en gegevens",
    "pt": "Perfil da marca, logotipo e detalhes",
}
FIRST_BRAND = {
    "en": "Create your first brand to start accepting payments and manage everything in one place.",
    "de": "Erstelle deine erste Marke, um Zahlungen zu akzeptieren und alles an einem Ort zu verwalten.",
    "es": "Crea tu primera marca para empezar a aceptar pagos y gestionar todo en un solo lugar.",
    "fr": "Créez votre première marque pour commencer à accepter des paiements et tout gérer au même endroit.",
    "nl": "Maak je eerste merk om betalingen te ontvangen en alles op één plek te beheren.",
    "pt": "Crie sua primeira marca para começar a aceitar pagamentos e gerenciar tudo num só lugar.",
}
C7D = {
    "en": "Run multiple brands from a single login — each with its own checkout, wallets and settlement. Switch between them in one click.",
    "de": "Verwalte mehrere Marken mit einem einzigen Login — jede mit eigenem Checkout, Wallets und Auszahlung. Wechsle mit einem Klick.",
    "es": "Gestiona varias marcas desde un solo inicio de sesión: cada una con su propio checkout, monederos y liquidación. Cambia entre ellas con un clic.",
    "fr": "Gérez plusieurs marques depuis une seule connexion — chacune avec son propre checkout, ses portefeuilles et ses règlements. Passez de l'une à l'autre en un clic.",
    "nl": "Beheer meerdere merken vanuit één login — elk met een eigen checkout, wallets en uitbetaling. Wissel met één klik.",
    "pt": "Gerencie várias marcas com um único login — cada uma com seu próprio checkout, carteiras e liquidação. Alterne entre elas num clique.",
}


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


for lang in DESC:
    p = os.path.join(ROOT, lang, "common.json")
    d = json.load(open(p, encoding="utf-8"))
    d["settingsPage"]["companyDesc"] = DESC[lang]
    d["settingsPage"]["accountDetailsDesc"] = DESC[lang]
    save(p, d)

    p = os.path.join(ROOT, lang, "companyDialog.json")
    d = json.load(open(p, encoding="utf-8"))
    d["createFirstCompanyBody"] = FIRST_BRAND[lang]
    save(p, d)

    p = os.path.join(ROOT, lang, "landing.json")
    d = json.load(open(p, encoding="utf-8"))
    d["v3"]["why"]["c7d"] = C7D[lang]
    save(p, d)
    print(lang, "ok")
