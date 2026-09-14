#!/usr/bin/env python3
"""Inject security.stepUp.* + security.stepUpActions.* email copy into all 6 locales (idempotent)."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "locales")

COPY = {
    "en": {
        "stepUp": {
            "subject": "Your Dynopay verification code",
            "heading": "Verify it's you",
            "intro": "Use this code to confirm a sensitive change on your Dynopay account: {{action}}.",
            "expiry": "This code expires in 5 minutes and unlocks the action for 10 minutes.",
            "ignore": "If you didn't request this, do NOT share the code — someone may be trying to change your account. Your settings stay unchanged until a code is entered.",
            "preheader": "One-time code for a sensitive account change · Dynopay will never ask for this code.",
        },
        "stepUpActions": {
            "apikey": "managing API keys",
            "wallet": "changing payout wallets",
            "brand_delete": "deleting a brand",
            "security": "account security settings",
            "payout": "payout settings",
            "team": "team access",
            "settlement": "settlement currency",
        },
    },
    "de": {
        "stepUp": {
            "subject": "Ihr Dynopay-Bestätigungscode",
            "heading": "Bestätigen Sie, dass es Sie sind",
            "intro": "Verwenden Sie diesen Code, um eine sicherheitsrelevante Änderung an Ihrem Dynopay-Konto zu bestätigen: {{action}}.",
            "expiry": "Dieser Code läuft in 5 Minuten ab und gibt die Aktion für 10 Minuten frei.",
            "ignore": "Falls Sie dies nicht angefordert haben, geben Sie den Code NICHT weiter – möglicherweise versucht jemand, Ihr Konto zu ändern. Ihre Einstellungen bleiben unverändert, bis ein Code eingegeben wird.",
            "preheader": "Einmalcode für eine sicherheitsrelevante Kontoänderung · Dynopay fragt Sie niemals nach diesem Code.",
        },
        "stepUpActions": {
            "apikey": "Verwaltung von API-Schlüsseln",
            "wallet": "Änderung von Auszahlungs-Wallets",
            "brand_delete": "Löschen einer Marke",
            "security": "Sicherheitseinstellungen des Kontos",
            "payout": "Auszahlungseinstellungen",
            "team": "Teamzugriff",
            "settlement": "Abrechnungswährung",
        },
    },
    "es": {
        "stepUp": {
            "subject": "Tu código de verificación de Dynopay",
            "heading": "Confirma que eres tú",
            "intro": "Usa este código para confirmar un cambio sensible en tu cuenta de Dynopay: {{action}}.",
            "expiry": "Este código caduca en 5 minutos y desbloquea la acción durante 10 minutos.",
            "ignore": "Si no lo solicitaste, NO compartas el código: alguien podría estar intentando modificar tu cuenta. Tu configuración no cambia hasta que se introduce un código.",
            "preheader": "Código de un solo uso para un cambio sensible de la cuenta · Dynopay nunca te pedirá este código.",
        },
        "stepUpActions": {
            "apikey": "gestión de claves API",
            "wallet": "cambio de wallets de pago",
            "brand_delete": "eliminación de una marca",
            "security": "ajustes de seguridad de la cuenta",
            "payout": "ajustes de retiro",
            "team": "acceso del equipo",
            "settlement": "moneda de liquidación",
        },
    },
    "fr": {
        "stepUp": {
            "subject": "Votre code de vérification Dynopay",
            "heading": "Confirmez que c'est bien vous",
            "intro": "Utilisez ce code pour confirmer une modification sensible de votre compte Dynopay : {{action}}.",
            "expiry": "Ce code expire dans 5 minutes et déverrouille l'action pendant 10 minutes.",
            "ignore": "Si vous n'êtes pas à l'origine de cette demande, NE partagez PAS ce code : quelqu'un essaie peut-être de modifier votre compte. Vos paramètres restent inchangés tant qu'aucun code n'est saisi.",
            "preheader": "Code à usage unique pour une modification sensible du compte · Dynopay ne vous demandera jamais ce code.",
        },
        "stepUpActions": {
            "apikey": "la gestion des clés API",
            "wallet": "la modification des portefeuilles de paiement",
            "brand_delete": "la suppression d'une marque",
            "security": "les paramètres de sécurité du compte",
            "payout": "les paramètres de retrait",
            "team": "l'accès de l'équipe",
            "settlement": "la devise de règlement",
        },
    },
    "pt": {
        "stepUp": {
            "subject": "O seu código de verificação Dynopay",
            "heading": "Confirme que é você",
            "intro": "Use este código para confirmar uma alteração sensível na sua conta Dynopay: {{action}}.",
            "expiry": "Este código expira em 5 minutos e desbloqueia a ação durante 10 minutos.",
            "ignore": "Se não fez este pedido, NÃO partilhe o código — alguém pode estar a tentar alterar a sua conta. As suas definições permanecem inalteradas até que um código seja introduzido.",
            "preheader": "Código de utilização única para uma alteração sensível da conta · A Dynopay nunca lhe pedirá este código.",
        },
        "stepUpActions": {
            "apikey": "gestão de chaves API",
            "wallet": "alteração de carteiras de pagamento",
            "brand_delete": "eliminação de uma marca",
            "security": "definições de segurança da conta",
            "payout": "definições de levantamento",
            "team": "acesso da equipa",
            "settlement": "moeda de liquidação",
        },
    },
    "nl": {
        "stepUp": {
            "subject": "Uw Dynopay-verificatiecode",
            "heading": "Bevestig dat u het bent",
            "intro": "Gebruik deze code om een gevoelige wijziging in uw Dynopay-account te bevestigen: {{action}}.",
            "expiry": "Deze code verloopt over 5 minuten en ontgrendelt de actie voor 10 minuten.",
            "ignore": "Als u dit niet hebt aangevraagd, deel de code dan NIET — iemand probeert mogelijk uw account te wijzigen. Uw instellingen blijven ongewijzigd totdat er een code wordt ingevoerd.",
            "preheader": "Eenmalige code voor een gevoelige accountwijziging · Dynopay vraagt u nooit om deze code.",
        },
        "stepUpActions": {
            "apikey": "beheer van API-sleutels",
            "wallet": "wijzigen van uitbetalingswallets",
            "brand_delete": "verwijderen van een merk",
            "security": "beveiligingsinstellingen van het account",
            "payout": "uitbetalingsinstellingen",
            "team": "teamtoegang",
            "settlement": "afrekenvaluta",
        },
    },
}

for lang, blocks in COPY.items():
    path = os.path.join(BASE, lang, "emails.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    sec = data.setdefault("security", {})
    sec["stepUp"] = blocks["stepUp"]
    sec["stepUpActions"] = blocks["stepUpActions"]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{lang}: security.stepUp + stepUpActions written")
