#!/usr/bin/env python3
"""Idempotent: adds chrome.noReply / chrome.noReplyHelp to all 6 backend email locales."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "locales")
STRINGS = {
    "en": ("This email was sent from an unmonitored mailbox — replies are not read.", "Need help? Visit the Help centre"),
    "de": ("Diese E-Mail wurde von einem nicht überwachten Postfach gesendet – Antworten werden nicht gelesen.", "Brauchen Sie Hilfe? Zum Hilfecenter"),
    "es": ("Este correo se envió desde un buzón no supervisado: las respuestas no se leen.", "¿Necesitas ayuda? Visita el Centro de ayuda"),
    "fr": ("Cet e-mail a été envoyé depuis une boîte non surveillée : les réponses ne sont pas lues.", "Besoin d'aide ? Consultez le Centre d'aide"),
    "pt": ("Este e-mail foi enviado de uma caixa não monitorizada — as respostas não são lidas.", "Precisa de ajuda? Visite o Centro de ajuda"),
    "nl": ("Deze e-mail is verzonden vanaf een niet-gemonitorde mailbox – antwoorden worden niet gelezen.", "Hulp nodig? Ga naar het Helpcentrum"),
}

for lang, (no_reply, help_) in STRINGS.items():
    path = os.path.join(BASE, lang, "emails.json")
    with open(path, encoding="utf-8") as fh:
        data = json.load(fh)
    chrome = data.setdefault("chrome", {})
    chrome["noReply"] = no_reply
    chrome["noReplyHelp"] = help_
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    print(f"{lang}: ok")
