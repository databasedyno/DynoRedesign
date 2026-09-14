#!/usr/bin/env python3
"""Inject unified step-up UI copy (common.stepUp.* + touched wallet/company/referral/profile keys) into all 6 locales. Idempotent."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")
LANGS = ["en", "de", "es", "fr", "pt", "nl"]

COMMON = {
    "en": {
        "title": "Verify it's you",
        "body": "To {{action}}, confirm it's really you. This unlocks the action for 10 minutes — no more codes until then.",
        "cancel": "Cancel",
        "verify": "Verify",
        "sending": "Sending your code…",
        "sentEmail": "We emailed a 6-digit code to {{contact}}.",
        "sentSms": "We texted a 6-digit code to {{contact}}.",
        "yourEmail": "your email",
        "yourPhone": "your phone",
        "methodTotp": "Authenticator",
        "methodEmail": "Email code",
        "methodSms": "Text message",
        "methodBackup": "Backup code",
        "totpLabel": "Code from your authenticator app",
        "backupLabel": "Backup code",
        "sendFailed": "We couldn't send the code. Please try again.",
        "statusFailed": "Couldn't start verification. Please try again.",
        "invalidCode": "Invalid code. Please try again.",
        "noMethods": "Add an email address to your account first — we need somewhere to send your verification code.",
        "scope": {
            "apikey": "manage API keys",
            "wallet": "change payout wallets",
            "brand_delete": "delete a brand",
            "security": "change your security settings",
            "payout": "change your payout settings",
            "team": "change team access",
            "settlement": "change your settlement currency",
        },
    },
    "de": {
        "title": "Bestätige, dass es du bist",
        "body": "Um {{action}}, bestätige bitte deine Identität. Damit ist die Aktion 10 Minuten lang freigeschaltet – bis dahin keine weiteren Codes.",
        "cancel": "Abbrechen",
        "verify": "Bestätigen",
        "sending": "Code wird gesendet…",
        "sentEmail": "Wir haben einen 6-stelligen Code an {{contact}} gemailt.",
        "sentSms": "Wir haben einen 6-stelligen Code per SMS an {{contact}} gesendet.",
        "yourEmail": "deine E-Mail",
        "yourPhone": "dein Telefon",
        "methodTotp": "Authenticator",
        "methodEmail": "E-Mail-Code",
        "methodSms": "SMS",
        "methodBackup": "Backup-Code",
        "totpLabel": "Code aus deiner Authenticator-App",
        "backupLabel": "Backup-Code",
        "sendFailed": "Der Code konnte nicht gesendet werden. Bitte versuche es erneut.",
        "statusFailed": "Die Verifizierung konnte nicht gestartet werden. Bitte versuche es erneut.",
        "invalidCode": "Ungültiger Code. Bitte versuche es erneut.",
        "noMethods": "Füge zuerst eine E-Mail-Adresse zu deinem Konto hinzu – wir brauchen einen Ort, an den wir deinen Bestätigungscode senden können.",
        "scope": {
            "apikey": "API-Schlüssel zu verwalten",
            "wallet": "Auszahlungs-Wallets zu ändern",
            "brand_delete": "eine Marke zu löschen",
            "security": "deine Sicherheitseinstellungen zu ändern",
            "payout": "deine Auszahlungseinstellungen zu ändern",
            "team": "den Teamzugriff zu ändern",
            "settlement": "deine Abrechnungswährung zu ändern",
        },
    },
    "es": {
        "title": "Verifica que eres tú",
        "body": "Para {{action}}, confirma que realmente eres tú. Esto desbloquea la acción durante 10 minutos: sin más códigos hasta entonces.",
        "cancel": "Cancelar",
        "verify": "Verificar",
        "sending": "Enviando tu código…",
        "sentEmail": "Enviamos un código de 6 dígitos por correo a {{contact}}.",
        "sentSms": "Enviamos un código de 6 dígitos por SMS a {{contact}}.",
        "yourEmail": "tu correo",
        "yourPhone": "tu teléfono",
        "methodTotp": "Autenticador",
        "methodEmail": "Código por correo",
        "methodSms": "Mensaje de texto",
        "methodBackup": "Código de respaldo",
        "totpLabel": "Código de tu app de autenticación",
        "backupLabel": "Código de respaldo",
        "sendFailed": "No pudimos enviar el código. Inténtalo de nuevo.",
        "statusFailed": "No se pudo iniciar la verificación. Inténtalo de nuevo.",
        "invalidCode": "Código no válido. Inténtalo de nuevo.",
        "noMethods": "Añade primero una dirección de correo a tu cuenta: necesitamos dónde enviarte el código de verificación.",
        "scope": {
            "apikey": "gestionar las claves API",
            "wallet": "cambiar las carteras de pago",
            "brand_delete": "eliminar una marca",
            "security": "cambiar tu configuración de seguridad",
            "payout": "cambiar tu configuración de pagos",
            "team": "cambiar el acceso del equipo",
            "settlement": "cambiar tu moneda de liquidación",
        },
    },
    "fr": {
        "title": "Vérifiez que c'est bien vous",
        "body": "Pour {{action}}, confirmez que c'est bien vous. Cela déverrouille l'action pendant 10 minutes — plus de codes d'ici là.",
        "cancel": "Annuler",
        "verify": "Vérifier",
        "sending": "Envoi de votre code…",
        "sentEmail": "Nous avons envoyé un code à 6 chiffres par e-mail à {{contact}}.",
        "sentSms": "Nous avons envoyé un code à 6 chiffres par SMS à {{contact}}.",
        "yourEmail": "votre e-mail",
        "yourPhone": "votre téléphone",
        "methodTotp": "Authentificateur",
        "methodEmail": "Code par e-mail",
        "methodSms": "SMS",
        "methodBackup": "Code de secours",
        "totpLabel": "Code de votre application d'authentification",
        "backupLabel": "Code de secours",
        "sendFailed": "Impossible d'envoyer le code. Veuillez réessayer.",
        "statusFailed": "Impossible de démarrer la vérification. Veuillez réessayer.",
        "invalidCode": "Code invalide. Veuillez réessayer.",
        "noMethods": "Ajoutez d'abord une adresse e-mail à votre compte — nous devons pouvoir vous envoyer votre code de vérification.",
        "scope": {
            "apikey": "gérer les clés API",
            "wallet": "modifier les portefeuilles de paiement",
            "brand_delete": "supprimer une marque",
            "security": "modifier vos paramètres de sécurité",
            "payout": "modifier vos paramètres de versement",
            "team": "modifier l'accès de l'équipe",
            "settlement": "modifier votre devise de règlement",
        },
    },
    "pt": {
        "title": "Confirma que és tu",
        "body": "Para {{action}}, confirma que és mesmo tu. Isto desbloqueia a ação durante 10 minutos — sem mais códigos até então.",
        "cancel": "Cancelar",
        "verify": "Verificar",
        "sending": "A enviar o teu código…",
        "sentEmail": "Enviámos um código de 6 dígitos por e-mail para {{contact}}.",
        "sentSms": "Enviámos um código de 6 dígitos por SMS para {{contact}}.",
        "yourEmail": "o teu e-mail",
        "yourPhone": "o teu telemóvel",
        "methodTotp": "Autenticador",
        "methodEmail": "Código por e-mail",
        "methodSms": "Mensagem de texto",
        "methodBackup": "Código de recuperação",
        "totpLabel": "Código da tua app de autenticação",
        "backupLabel": "Código de recuperação",
        "sendFailed": "Não conseguimos enviar o código. Tenta novamente.",
        "statusFailed": "Não foi possível iniciar a verificação. Tenta novamente.",
        "invalidCode": "Código inválido. Tenta novamente.",
        "noMethods": "Adiciona primeiro um endereço de e-mail à tua conta — precisamos de um sítio para enviar o teu código de verificação.",
        "scope": {
            "apikey": "gerir chaves de API",
            "wallet": "alterar carteiras de pagamento",
            "brand_delete": "eliminar uma marca",
            "security": "alterar as tuas definições de segurança",
            "payout": "alterar as tuas definições de pagamento",
            "team": "alterar o acesso da equipa",
            "settlement": "alterar a tua moeda de liquidação",
        },
    },
    "nl": {
        "title": "Bevestig dat jij het bent",
        "body": "Om {{action}}, bevestig dat het echt jij bent. Dit ontgrendelt de actie voor 10 minuten — tot dan geen codes meer.",
        "cancel": "Annuleren",
        "verify": "Verifiëren",
        "sending": "Je code wordt verzonden…",
        "sentEmail": "We hebben een 6-cijferige code gemaild naar {{contact}}.",
        "sentSms": "We hebben een 6-cijferige code ge-sms't naar {{contact}}.",
        "yourEmail": "je e-mail",
        "yourPhone": "je telefoon",
        "methodTotp": "Authenticator",
        "methodEmail": "E-mailcode",
        "methodSms": "Sms",
        "methodBackup": "Back-upcode",
        "totpLabel": "Code uit je authenticator-app",
        "backupLabel": "Back-upcode",
        "sendFailed": "We konden de code niet verzenden. Probeer het opnieuw.",
        "statusFailed": "Verificatie kon niet worden gestart. Probeer het opnieuw.",
        "invalidCode": "Ongeldige code. Probeer het opnieuw.",
        "noMethods": "Voeg eerst een e-mailadres toe aan je account — we hebben een plek nodig om je verificatiecode naartoe te sturen.",
        "scope": {
            "apikey": "API-sleutels te beheren",
            "wallet": "uitbetalingswallets te wijzigen",
            "brand_delete": "een merk te verwijderen",
            "security": "je beveiligingsinstellingen te wijzigen",
            "payout": "je uitbetalingsinstellingen te wijzigen",
            "team": "teamtoegang te wijzigen",
            "settlement": "je afwikkelingsvaluta te wijzigen",
        },
    },
}

COMMON_FLAT = {
    "en": {"deleteWalletBody": "You're about to remove the {{type}} wallet{{address}}. This action is permanent and cannot be undone. We'll ask you to verify it's you first."},
    "de": {"deleteWalletBody": "Du bist dabei, die {{type}}-Wallet{{address}} zu entfernen. Diese Aktion ist endgültig und kann nicht rückgängig gemacht werden. Wir bitten dich zuerst, deine Identität zu bestätigen."},
    "es": {"deleteWalletBody": "Estás a punto de eliminar la cartera {{type}}{{address}}. Esta acción es permanente y no se puede deshacer. Primero te pediremos que verifiques que eres tú."},
    "fr": {"deleteWalletBody": "Vous êtes sur le point de supprimer le portefeuille {{type}}{{address}}. Cette action est définitive et irréversible. Nous vous demanderons d'abord de vérifier votre identité."},
    "pt": {"deleteWalletBody": "Estás prestes a remover a carteira {{type}}{{address}}. Esta ação é permanente e não pode ser anulada. Primeiro vamos pedir-te para confirmares que és tu."},
    "nl": {"deleteWalletBody": "Je staat op het punt de {{type}}-wallet{{address}} te verwijderen. Deze actie is permanent en kan niet ongedaan worden gemaakt. We vragen je eerst om te bevestigen dat jij het bent."},
}

WALLET = {
    "en": {
        "editVerifyNotice": "Changing the address requires a quick identity check.",
        "addVerifyNotice": "We'll ask you to verify it's you before this wallet is saved.",
        "stepUpAwaiting": "Verify it's you to manage payout wallets.",
        "stepUpVerifyNow": "Verify now",
        "stepUpCancelled": "Verification cancelled — your changes weren't saved.",
        "sudoEndedBanner": "Verification ended",
        "sudoEndedHint": "We'll ask you to verify again when you save.",
    },
    "de": {
        "editVerifyNotice": "Das Ändern der Adresse erfordert eine kurze Identitätsprüfung.",
        "addVerifyNotice": "Wir bitten dich, deine Identität zu bestätigen, bevor diese Wallet gespeichert wird.",
        "stepUpAwaiting": "Bestätige deine Identität, um Auszahlungs-Wallets zu verwalten.",
        "stepUpVerifyNow": "Jetzt bestätigen",
        "stepUpCancelled": "Bestätigung abgebrochen – deine Änderungen wurden nicht gespeichert.",
        "sudoEndedBanner": "Bestätigung abgelaufen",
        "sudoEndedHint": "Beim Speichern bitten wir dich erneut um eine Bestätigung.",
    },
    "es": {
        "editVerifyNotice": "Cambiar la dirección requiere una comprobación rápida de identidad.",
        "addVerifyNotice": "Te pediremos que verifiques que eres tú antes de guardar esta cartera.",
        "stepUpAwaiting": "Verifica que eres tú para gestionar las carteras de pago.",
        "stepUpVerifyNow": "Verificar ahora",
        "stepUpCancelled": "Verificación cancelada: tus cambios no se guardaron.",
        "sudoEndedBanner": "Verificación finalizada",
        "sudoEndedHint": "Te pediremos verificar de nuevo al guardar.",
    },
    "fr": {
        "editVerifyNotice": "Modifier l'adresse nécessite une vérification rapide de votre identité.",
        "addVerifyNotice": "Nous vous demanderons de vérifier votre identité avant d'enregistrer ce portefeuille.",
        "stepUpAwaiting": "Vérifiez votre identité pour gérer les portefeuilles de paiement.",
        "stepUpVerifyNow": "Vérifier maintenant",
        "stepUpCancelled": "Vérification annulée — vos modifications n'ont pas été enregistrées.",
        "sudoEndedBanner": "Vérification expirée",
        "sudoEndedHint": "Nous vous demanderons de vérifier à nouveau lors de l'enregistrement.",
    },
    "pt": {
        "editVerifyNotice": "Alterar o endereço requer uma verificação rápida de identidade.",
        "addVerifyNotice": "Vamos pedir-te para confirmares que és tu antes de guardar esta carteira.",
        "stepUpAwaiting": "Confirma que és tu para gerir as carteiras de pagamento.",
        "stepUpVerifyNow": "Verificar agora",
        "stepUpCancelled": "Verificação cancelada — as tuas alterações não foram guardadas.",
        "sudoEndedBanner": "Verificação terminada",
        "sudoEndedHint": "Vamos pedir-te para verificares novamente ao guardar.",
    },
    "nl": {
        "editVerifyNotice": "Het wijzigen van het adres vereist een snelle identiteitscontrole.",
        "addVerifyNotice": "We vragen je te bevestigen dat jij het bent voordat deze wallet wordt opgeslagen.",
        "stepUpAwaiting": "Bevestig dat jij het bent om uitbetalingswallets te beheren.",
        "stepUpVerifyNow": "Nu verifiëren",
        "stepUpCancelled": "Verificatie geannuleerd — je wijzigingen zijn niet opgeslagen.",
        "sudoEndedBanner": "Verificatie verlopen",
        "sudoEndedHint": "Bij het opslaan vragen we je opnieuw om te verifiëren.",
    },
}

COMPANY = {
    "en": "This permanently removes {{name}} together with its payment links, API keys and settings. This cannot be undone. We'll ask you to verify it's you first.",
    "de": "Dadurch wird {{name}} zusammen mit allen Zahlungslinks, API-Schlüsseln und Einstellungen dauerhaft entfernt. Dies kann nicht rückgängig gemacht werden. Wir bitten dich zuerst, deine Identität zu bestätigen.",
    "es": "Esto elimina permanentemente {{name}} junto con sus enlaces de pago, claves API y configuración. No se puede deshacer. Primero te pediremos que verifiques que eres tú.",
    "fr": "Cela supprime définitivement {{name}} ainsi que ses liens de paiement, clés API et paramètres. Cette action est irréversible. Nous vous demanderons d'abord de vérifier votre identité.",
    "pt": "Isto remove permanentemente {{name}} juntamente com os seus links de pagamento, chaves de API e definições. Não pode ser anulado. Primeiro vamos pedir-te para confirmares que és tu.",
    "nl": "Hiermee wordt {{name}} permanent verwijderd, inclusief betaallinks, API-sleutels en instellingen. Dit kan niet ongedaan worden gemaakt. We vragen je eerst om te bevestigen dat jij het bent.",
}

REFERRALS = {
    "en": "We'll send {{amount}} in USDT (TRC-20) to {{address}}. You'll be asked to verify it's you.",
    "de": "Wir senden {{amount}} in USDT (TRC-20) an {{address}}. Du wirst gebeten, deine Identität zu bestätigen.",
    "es": "Enviaremos {{amount}} en USDT (TRC-20) a {{address}}. Te pediremos que verifiques que eres tú.",
    "fr": "Nous enverrons {{amount}} en USDT (TRC-20) à {{address}}. Il vous sera demandé de vérifier votre identité.",
    "pt": "Vamos enviar {{amount}} em USDT (TRC-20) para {{address}}. Vais ser convidado a confirmar que és tu.",
    "nl": "We sturen {{amount}} in USDT (TRC-20) naar {{address}}. Je wordt gevraagd te bevestigen dat jij het bent.",
}

PROFILE = {
    "en": {
        "disableBodyStepUp": "Your account will only be protected by your password. We'll ask you to verify it's you first.",
        "regenerateBodyStepUp": "Your current backup codes stop working the moment new ones are created. We'll ask you to verify it's you first.",
    },
    "de": {
        "disableBodyStepUp": "Dein Konto ist dann nur noch durch dein Passwort geschützt. Wir bitten dich zuerst, deine Identität zu bestätigen.",
        "regenerateBodyStepUp": "Deine aktuellen Backup-Codes funktionieren nicht mehr, sobald neue erstellt werden. Wir bitten dich zuerst, deine Identität zu bestätigen.",
    },
    "es": {
        "disableBodyStepUp": "Tu cuenta solo estará protegida por tu contraseña. Primero te pediremos que verifiques que eres tú.",
        "regenerateBodyStepUp": "Tus códigos de respaldo actuales dejarán de funcionar en cuanto se creen los nuevos. Primero te pediremos que verifiques que eres tú.",
    },
    "fr": {
        "disableBodyStepUp": "Votre compte ne sera plus protégé que par votre mot de passe. Nous vous demanderons d'abord de vérifier votre identité.",
        "regenerateBodyStepUp": "Vos codes de secours actuels cesseront de fonctionner dès la création des nouveaux. Nous vous demanderons d'abord de vérifier votre identité.",
    },
    "pt": {
        "disableBodyStepUp": "A tua conta ficará protegida apenas pela tua palavra-passe. Primeiro vamos pedir-te para confirmares que és tu.",
        "regenerateBodyStepUp": "Os teus códigos de recuperação atuais deixam de funcionar assim que forem criados novos. Primeiro vamos pedir-te para confirmares que és tu.",
    },
    "nl": {
        "disableBodyStepUp": "Je account wordt dan alleen nog beschermd door je wachtwoord. We vragen je eerst om te bevestigen dat jij het bent.",
        "regenerateBodyStepUp": "Je huidige back-upcodes werken niet meer zodra er nieuwe worden aangemaakt. We vragen je eerst om te bevestigen dat jij het bent.",
    },
}


def load(lang, ns):
    p = os.path.join(BASE, lang, ns + ".json")
    with open(p, encoding="utf-8") as f:
        return p, json.load(f)


def save(p, data):
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


for lang in LANGS:
    p, common = load(lang, "common")
    common["stepUp"] = {**common.get("stepUp", {}), **COMMON[lang]}
    common.update(COMMON_FLAT[lang])
    save(p, common)

    p, wallet = load(lang, "walletScreen")
    wallet.update(WALLET[lang])
    save(p, wallet)

    p, comp = load(lang, "companySettings")
    comp.setdefault("delete", {})["bodyStepUp"] = COMPANY[lang]
    save(p, comp)

    p, ref = load(lang, "referrals")
    ref["payoutWithdrawIntro"] = REFERRALS[lang]
    save(p, ref)

    p, prof = load(lang, "profile")
    prof.setdefault("twoFactor", {}).update(PROFILE[lang])
    save(p, prof)
    print(f"[{lang}] ok")
