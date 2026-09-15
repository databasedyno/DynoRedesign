#!/usr/bin/env python3
"""Wave 4a: footer chrome strings (why-received, manage prefs, legal line) in all 6 emails.json (idempotent)."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "locales"
NEW = {
    "en": {
        "legal": "© {{year}} {{legalName}} · All rights reserved.",
        "whyMerchant": "You're receiving this because you have a Dynopay account ({{email}}).",
        "managePrefs": "Manage email preferences",
        "whyBuyer": "You're receiving this because you made a payment through Dynopay. Dynopay is non-custodial — funds go straight to the merchant's own wallet.",
        "whyAdmin": "Internal Dynopay operations notification.",
    },
    "de": {
        "legal": "© {{year}} {{legalName}} · Alle Rechte vorbehalten.",
        "whyMerchant": "Sie erhalten diese E-Mail, weil Sie ein Dynopay-Konto haben ({{email}}).",
        "managePrefs": "E-Mail-Einstellungen verwalten",
        "whyBuyer": "Sie erhalten diese E-Mail, weil Sie eine Zahlung über Dynopay getätigt haben. Dynopay ist nicht verwahrend — die Gelder gehen direkt in die eigene Wallet des Händlers.",
        "whyAdmin": "Interne Dynopay-Betriebsbenachrichtigung.",
    },
    "es": {
        "legal": "© {{year}} {{legalName}} · Todos los derechos reservados.",
        "whyMerchant": "Recibe este correo porque tiene una cuenta de Dynopay ({{email}}).",
        "managePrefs": "Gestionar preferencias de correo",
        "whyBuyer": "Recibe este correo porque realizó un pago a través de Dynopay. Dynopay no tiene custodia: los fondos van directamente a la wallet del comercio.",
        "whyAdmin": "Notificación interna de operaciones de Dynopay.",
    },
    "fr": {
        "legal": "© {{year}} {{legalName}} · Tous droits réservés.",
        "whyMerchant": "Vous recevez cet e-mail parce que vous avez un compte Dynopay ({{email}}).",
        "managePrefs": "Gérer les préférences e-mail",
        "whyBuyer": "Vous recevez cet e-mail parce que vous avez effectué un paiement via Dynopay. Dynopay est non-custodial : les fonds vont directement dans le wallet du commerçant.",
        "whyAdmin": "Notification interne des opérations Dynopay.",
    },
    "pt": {
        "legal": "© {{year}} {{legalName}} · Todos os direitos reservados.",
        "whyMerchant": "Está a receber este e-mail porque tem uma conta Dynopay ({{email}}).",
        "managePrefs": "Gerir preferências de e-mail",
        "whyBuyer": "Está a receber este e-mail porque efetuou um pagamento através da Dynopay. A Dynopay não tem custódia — os fundos vão diretamente para a wallet do comerciante.",
        "whyAdmin": "Notificação interna de operações da Dynopay.",
    },
    "nl": {
        "legal": "© {{year}} {{legalName}} · Alle rechten voorbehouden.",
        "whyMerchant": "U ontvangt deze e-mail omdat u een Dynopay-account heeft ({{email}}).",
        "managePrefs": "E-mailvoorkeuren beheren",
        "whyBuyer": "U ontvangt deze e-mail omdat u een betaling via Dynopay heeft gedaan. Dynopay is non-custodial — het geld gaat rechtstreeks naar de eigen wallet van de verkoper.",
        "whyAdmin": "Interne Dynopay-operationele melding.",
    },
}

for lang, block in NEW.items():
    path = ROOT / lang / "emails.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    chrome = data.setdefault("chrome", {})
    if all(chrome.get(k) == v for k, v in block.items()):
        print(f"{lang}: up to date"); continue
    chrome.update(block)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{lang}: chrome +{len(block)}")
