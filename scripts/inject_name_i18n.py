#!/usr/bin/env python3
"""Inject first/last-name feature i18n keys into all 6 locales (byte-safe JSON round-trip)."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")
LANGS = ["en", "es", "pt", "fr", "de", "nl"]

AUTH = {
    "namePromptTitle": {
        "en": "What's your name?", "es": "¿Cómo te llamas?", "pt": "Qual é o seu nome?",
        "fr": "Comment vous appelez-vous ?", "de": "Wie heißt du?", "nl": "Wat is je naam?",
    },
    "namePromptDescription": {
        "en": "Tell us who you are so we can personalize your account and receipts.",
        "es": "Cuéntanos quién eres para personalizar tu cuenta y tus recibos.",
        "pt": "Diga-nos quem é para personalizarmos a sua conta e os recibos.",
        "fr": "Dites-nous qui vous êtes pour personnaliser votre compte et vos reçus.",
        "de": "Sag uns, wer du bist, damit wir dein Konto und deine Belege personalisieren können.",
        "nl": "Vertel ons wie je bent zodat we je account en bonnen kunnen personaliseren.",
    },
    "nameFirstLabel": {
        "en": "First name", "es": "Nombre", "pt": "Nome", "fr": "Prénom", "de": "Vorname", "nl": "Voornaam",
    },
    "nameLastLabel": {
        "en": "Last name", "es": "Apellido", "pt": "Sobrenome", "fr": "Nom", "de": "Nachname", "nl": "Achternaam",
    },
    "nameFirstRequired": {
        "en": "First name is required", "es": "El nombre es obligatorio", "pt": "O nome é obrigatório",
        "fr": "Le prénom est requis", "de": "Vorname ist erforderlich", "nl": "Voornaam is verplicht",
    },
    "nameLastRequired": {
        "en": "Last name is required", "es": "El apellido es obligatorio", "pt": "O sobrenome é obrigatório",
        "fr": "Le nom est requis", "de": "Nachname ist erforderlich", "nl": "Achternaam is verplicht",
    },
    "nameSaveContinue": {
        "en": "Save & continue", "es": "Guardar y continuar", "pt": "Guardar e continuar",
        "fr": "Enregistrer et continuer", "de": "Speichern und fortfahren", "nl": "Opslaan en doorgaan",
    },
    "nameSaveFailed": {
        "en": "Couldn't save your name. Please try again.",
        "es": "No se pudo guardar tu nombre. Inténtalo de nuevo.",
        "pt": "Não foi possível guardar o seu nome. Tente novamente.",
        "fr": "Impossible d'enregistrer votre nom. Veuillez réessayer.",
        "de": "Dein Name konnte nicht gespeichert werden. Bitte versuche es erneut.",
        "nl": "Je naam kon niet worden opgeslagen. Probeer het opnieuw.",
    },
}

PROFILE = {
    "saveName": {
        "en": "Save name", "es": "Guardar nombre", "pt": "Guardar nome",
        "fr": "Enregistrer le nom", "de": "Namen speichern", "nl": "Naam opslaan",
    },
    "nameUpdated": {
        "en": "Your name has been updated", "es": "Tu nombre se ha actualizado",
        "pt": "O seu nome foi atualizado", "fr": "Votre nom a été mis à jour",
        "de": "Dein Name wurde aktualisiert", "nl": "Je naam is bijgewerkt",
    },
}

COMPANY_NAME_LOCKED = {
    "en": "Your name is verified and can't be changed here. Contact support to update it.",
    "es": "Tu nombre está verificado y no se puede cambiar aquí. Contacta con soporte para actualizarlo.",
    "pt": "O seu nome está verificado e não pode ser alterado aqui. Contacte o suporte para atualizá-lo.",
    "fr": "Votre nom est vérifié et ne peut pas être modifié ici. Contactez le support pour le mettre à jour.",
    "de": "Dein Name ist verifiziert und kann hier nicht geändert werden. Kontaktiere den Support, um ihn zu aktualisieren.",
    "nl": "Je naam is geverifieerd en kan hier niet worden gewijzigd. Neem contact op met support om deze bij te werken.",
}


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


for lang in LANGS:
    # auth.json
    p = os.path.join(BASE, lang, "auth.json")
    d = load(p)
    for k, tr in AUTH.items():
        d[k] = tr[lang]
    save(p, d)

    # profile.json
    p = os.path.join(BASE, lang, "profile.json")
    d = load(p)
    for k, tr in PROFILE.items():
        d[k] = tr[lang]
    save(p, d)

    # companyDialog.json -> createModal.nameLockedNotice
    p = os.path.join(BASE, lang, "companyDialog.json")
    d = load(p)
    d.setdefault("createModal", {})
    d["createModal"]["nameLockedNotice"] = COMPANY_NAME_LOCKED[lang]
    save(p, d)

    print(f"injected: {lang}")

print("done")
