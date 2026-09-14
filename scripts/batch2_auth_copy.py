#!/usr/bin/env python3
"""
UI-copy re-author — BATCH 2: Auth (login / signup / verify / reset).

Two kinds of change:
  * EN-only  -> pure casing/spelling normalization (e.g. "E-mail" -> "Email",
               Title Case -> sentence case). Other languages already carry a
               correct translation for the same concept, so we leave them.
  * All 6    -> genuine wording/tone rewrites (warmer errors, drop "OTP"
               jargon, consistent "phone"), re-translated to pt/fr/es/de/nl.

Run:  python3 scripts/batch2_auth_copy.py
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")
LANGS = ["en", "pt", "fr", "es", "de", "nl"]

# ---- EN-only: casing / spelling / light grammar normalization -------------
EN_ONLY = {
    "email": "Email",
    "lastName": "Last name",
    "forgotPassword": "Forgot password?",
    "alreadyHaveAccountLink": "Already have an account?",
    "verificationCode": "Verification code",
    "enterConfirmPassword": "Confirm your password",
    "enterOTPPlaceHolder": "Enter the code",
    "checkAndAdd": "Check and add",
    "firstNameRequired": "First name is required",
    "lastNameRequired": "Last name is required",
    "emailRequired": "Email is required",
    "passwordRequired": "Password is required",
    "fullName": "Full name",
    "phoneNumber": "Phone number",
    "phone": "Phone number",
    "sendVerificationCode": "Send verification code",
    "referralCode": "Referral code",
    "setNewPassword": "Set a new password",
    "newPasswordPlaceholder": "Enter a new password",
    "newPasswordConfirm": "Confirm new password",
    "newPasswordConfirmPlaceholder": "Re-enter your new password",
    "enterMobile": "Enter phone",
    "forgotPasswordDialog.title": "Reset your password",
    "forgotPasswordDialog.emailTab": "Email",
    "forgotPasswordDialog.phoneTab": "Phone",
    "forgotPasswordDialog.emailLabel": "Email address",
    "forgotPasswordDialog.phoneLabel": "Phone number",
    "forgotPasswordDialog.sendCode": "Send verification code",
    "forgotPasswordDialog.otpTitle": "Enter verification code",
    "forgotPasswordDialog.newPwTitle": "Create a new password",
    "forgotPasswordDialog.newPwLabel": "New password",
    "forgotPasswordDialog.confirmPwLabel": "Confirm password",
    "forgotPasswordDialog.resetBtn": "Reset password",
    "forgotPasswordDialog.successTitle": "Password reset",
    "forgotPasswordDialog.backToLoginBtn": "Back to login",
}

# ---- All 6: genuine wording / tone rewrites -------------------------------
ALL6 = {
    "registerLogin": {
        "en": "Sign up or log in with", "pt": "Cadastre-se ou entre com",
        "fr": "Inscrivez-vous ou connectez-vous avec", "es": "Regístrate o inicia sesión con",
        "de": "Registrieren oder anmelden mit", "nl": "Aanmelden of inloggen met",
    },
    "sendVerificationCodeViaSms": {
        "en": "Send my code by SMS", "pt": "Enviar meu código por SMS",
        "fr": "Envoyer mon code par SMS", "es": "Enviar mi código por SMS",
        "de": "Meinen Code per SMS senden", "nl": "Stuur mijn code per sms",
    },
    "sendVerificationCodeViaEmail": {
        "en": "Send my code by email", "pt": "Enviar meu código por e-mail",
        "fr": "Envoyer mon code par e-mail", "es": "Enviar mi código por correo electrónico",
        "de": "Meinen Code per E-Mail senden", "nl": "Stuur mijn code per e-mail",
    },
    "emailVerification": {
        "en": "Verify your email", "pt": "Verifique seu e-mail",
        "fr": "Vérifiez votre e-mail", "es": "Verifica tu correo electrónico",
        "de": "Bestätige deine E-Mail", "nl": "Verifieer je e-mail",
    },
    "emailVerificationSubtitle": {
        "en": "We sent a verification code to your email.",
        "pt": "Enviamos um código de verificação para o seu e-mail.",
        "fr": "Nous avons envoyé un code de vérification à votre e-mail.",
        "es": "Enviamos un código de verificación a tu correo electrónico.",
        "de": "Wir haben einen Bestätigungscode an deine E-Mail gesendet.",
        "nl": "We hebben een verificatiecode naar je e-mail gestuurd.",
    },
    "smsVerification": {
        "en": "Verify your phone", "pt": "Verifique seu telefone",
        "fr": "Vérifiez votre téléphone", "es": "Verifica tu teléfono",
        "de": "Bestätige dein Telefon", "nl": "Verifieer je telefoon",
    },
    "smsVerificationSubtitle": {
        "en": "We sent a verification code to your phone.",
        "pt": "Enviamos um código de verificação para o seu telefone.",
        "fr": "Nous avons envoyé un code de vérification à votre téléphone.",
        "es": "Enviamos un código de verificación a tu teléfono.",
        "de": "Wir haben einen Bestätigungscode an dein Telefon gesendet.",
        "nl": "We hebben een verificatiecode naar je telefoon gestuurd.",
    },
    "loginVerification": {
        "en": "Verify it's you", "pt": "Confirme que é você",
        "fr": "Confirmez que c'est bien vous", "es": "Confirma que eres tú",
        "de": "Bestätige, dass du es bist", "nl": "Bevestig dat jij het bent",
    },
    "loginOtpSubtitle": {
        "en": "Enter the code we sent to your email to finish signing in.",
        "pt": "Digite o código que enviamos para o seu e-mail para concluir o login.",
        "fr": "Saisissez le code que nous avons envoyé à votre e-mail pour terminer la connexion.",
        "es": "Introduce el código que enviamos a tu correo para completar el inicio de sesión.",
        "de": "Gib den Code ein, den wir an deine E-Mail gesendet haben, um die Anmeldung abzuschließen.",
        "nl": "Voer de code in die we naar je e-mail hebben gestuurd om het inloggen te voltooien.",
    },
    "passwordRecoveryInstructions": {
        "en": "Enter your email and we'll send you a recovery code.",
        "pt": "Digite seu e-mail e enviaremos um código de recuperação.",
        "fr": "Saisissez votre e-mail et nous vous enverrons un code de récupération.",
        "es": "Introduce tu correo y te enviaremos un código de recuperación.",
        "de": "Gib deine E-Mail ein und wir senden dir einen Wiederherstellungscode.",
        "nl": "Voer je e-mail in en we sturen je een herstelcode.",
    },
    "returnToAuthorization": {
        "en": "Back to sign in", "pt": "Voltar para o login",
        "fr": "Retour à la connexion", "es": "Volver al inicio de sesión",
        "de": "Zurück zur Anmeldung", "nl": "Terug naar inloggen",
    },
    "emailNotFound": {
        "en": "We couldn't find that email. Please try again.",
        "pt": "Não encontramos esse e-mail. Tente novamente.",
        "fr": "Nous n'avons pas trouvé cet e-mail. Veuillez réessayer.",
        "es": "No encontramos ese correo. Inténtalo de nuevo.",
        "de": "Wir konnten diese E-Mail nicht finden. Bitte versuche es erneut.",
        "nl": "We konden dat e-mailadres niet vinden. Probeer het opnieuw.",
    },
    "errorCheckingEmail": {
        "en": "Something went wrong verifying your email. Please try again shortly.",
        "pt": "Algo deu errado ao verificar seu e-mail. Tente novamente em instantes.",
        "fr": "Un problème est survenu lors de la vérification de votre e-mail. Réessayez dans un instant.",
        "es": "Algo salió mal al verificar tu correo. Inténtalo de nuevo en unos momentos.",
        "de": "Beim Überprüfen deiner E-Mail ist etwas schiefgelaufen. Bitte versuche es gleich erneut.",
        "nl": "Er ging iets mis bij het verifiëren van je e-mail. Probeer het zo opnieuw.",
    },
    "passwordAndConfirmPasswordShouldBeSame": {
        "en": "Passwords don't match", "pt": "As senhas não coincidem",
        "fr": "Les mots de passe ne correspondent pas", "es": "Las contraseñas no coinciden",
        "de": "Die Passwörter stimmen nicht überein", "nl": "De wachtwoorden komen niet overeen",
    },
    "phoneVerification": {
        "en": "Verify your phone", "pt": "Verifique seu telefone",
        "fr": "Vérifiez votre téléphone", "es": "Verifica tu teléfono",
        "de": "Bestätige dein Telefon", "nl": "Verifieer je telefoon",
    },
    "phoneVerificationSubtitle": {
        "en": "Enter the code we sent to your phone.",
        "pt": "Digite o código que enviamos para o seu telefone.",
        "fr": "Saisissez le code que nous avons envoyé à votre téléphone.",
        "es": "Introduce el código que enviamos a tu teléfono.",
        "de": "Gib den Code ein, den wir an dein Telefon gesendet haben.",
        "nl": "Voer de code in die we naar je telefoon hebben gestuurd.",
    },
    "otpSentToPhone": {
        "en": "Enter the code we sent to your phone.",
        "pt": "Digite o código que enviamos para o seu telefone.",
        "fr": "Saisissez le code que nous avons envoyé à votre téléphone.",
        "es": "Introduce el código que enviamos a tu teléfono.",
        "de": "Gib den Code ein, den wir an dein Telefon gesendet haben.",
        "nl": "Voer de code in die we naar je telefoon hebben gestuurd.",
    },
    "enterCodeSentToNumber": {
        "en": "Enter the code we sent to your number",
        "pt": "Digite o código que enviamos para o seu número",
        "fr": "Saisissez le code que nous avons envoyé à votre numéro",
        "es": "Introduce el código que enviamos a tu número",
        "de": "Gib den Code ein, den wir an deine Nummer gesendet haben",
        "nl": "Voer de code in die we naar je nummer hebben gestuurd",
    },
    "enterCodeSentToEmail": {
        "en": "Enter the code we sent to your email",
        "pt": "Digite o código que enviamos para o seu e-mail",
        "fr": "Saisissez le code que nous avons envoyé à votre e-mail",
        "es": "Introduce el código que enviamos a tu correo",
        "de": "Gib den Code ein, den wir an deine E-Mail gesendet haben",
        "nl": "Voer de code in die we naar je e-mail hebben gestuurd",
    },
    "errorCheckingPhone": {
        "en": "Something went wrong checking your phone number. Please try again.",
        "pt": "Algo deu errado ao verificar seu número de telefone. Tente novamente.",
        "fr": "Un problème est survenu lors de la vérification de votre numéro. Veuillez réessayer.",
        "es": "Algo salió mal al verificar tu número de teléfono. Inténtalo de nuevo.",
        "de": "Beim Überprüfen deiner Telefonnummer ist etwas schiefgelaufen. Bitte versuche es erneut.",
        "nl": "Er ging iets mis bij het controleren van je telefoonnummer. Probeer het opnieuw.",
    },
    "pleaseGetVerificationCodeFirst": {
        "en": "Please request a verification code first",
        "pt": "Solicite um código de verificação primeiro",
        "fr": "Veuillez d'abord demander un code de vérification",
        "es": "Primero solicita un código de verificación",
        "de": "Bitte fordere zuerst einen Bestätigungscode an",
        "nl": "Vraag eerst een verificatiecode aan",
    },
    "codeSentTo": {
        "en": "We sent a 6-digit code to", "pt": "Enviamos um código de 6 dígitos para",
        "fr": "Nous avons envoyé un code à 6 chiffres à", "es": "Enviamos un código de 6 dígitos a",
        "de": "Wir haben einen 6-stelligen Code gesendet an", "nl": "We hebben een 6-cijferige code gestuurd naar",
    },
    "enterSixDigitCodeSentTo": {
        "en": "Enter the 6-digit code we sent to",
        "pt": "Digite o código de 6 dígitos que enviamos para",
        "fr": "Saisissez le code à 6 chiffres que nous avons envoyé à",
        "es": "Introduce el código de 6 dígitos que enviamos a",
        "de": "Gib den 6-stelligen Code ein, den wir gesendet haben an",
        "nl": "Voer de 6-cijferige code in die we hebben gestuurd naar",
    },
    "otpRequired": {
        "en": "Enter the verification code", "pt": "Digite o código de verificação",
        "fr": "Saisissez le code de vérification", "es": "Introduce el código de verificación",
        "de": "Gib den Bestätigungscode ein", "nl": "Voer de verificatiecode in",
    },
    "otpInvalid6Digit": {
        "en": "Enter a valid 6-digit code", "pt": "Digite um código válido de 6 dígitos",
        "fr": "Saisissez un code valide à 6 chiffres", "es": "Introduce un código válido de 6 dígitos",
        "de": "Gib einen gültigen 6-stelligen Code ein", "nl": "Voer een geldige 6-cijferige code in",
    },
    "otpInvalid5Digit": {
        "en": "Enter a valid 5-digit code", "pt": "Digite um código válido de 5 dígitos",
        "fr": "Saisissez un code valide à 5 chiffres", "es": "Introduce un código válido de 5 dígitos",
        "de": "Gib einen gültigen 5-stelligen Code ein", "nl": "Voer een geldige 5-cijferige code in",
    },
    "mobileRequired": {
        "en": "Phone number is required", "pt": "O número de telefone é obrigatório",
        "fr": "Le numéro de téléphone est requis", "es": "El número de teléfono es obligatorio",
        "de": "Telefonnummer ist erforderlich", "nl": "Telefoonnummer is verplicht",
    },
    "forgotPasswordDialog.errSendFailed": {
        "en": "We couldn't send the code. Please try again.",
        "pt": "Não conseguimos enviar o código. Tente novamente.",
        "fr": "Nous n'avons pas pu envoyer le code. Veuillez réessayer.",
        "es": "No pudimos enviar el código. Inténtalo de nuevo.",
        "de": "Wir konnten den Code nicht senden. Bitte versuche es erneut.",
        "nl": "We konden de code niet versturen. Probeer het opnieuw.",
    },
    "forgotPasswordDialog.errOtpInvalid": {
        "en": "That code isn't valid. Please try again.",
        "pt": "Esse código não é válido. Tente novamente.",
        "fr": "Ce code n'est pas valide. Veuillez réessayer.",
        "es": "Ese código no es válido. Inténtalo de nuevo.",
        "de": "Dieser Code ist ungültig. Bitte versuche es erneut.",
        "nl": "Die code is niet geldig. Probeer het opnieuw.",
    },
    "forgotPasswordDialog.errPwMismatch": {
        "en": "Passwords don't match", "pt": "As senhas não coincidem",
        "fr": "Les mots de passe ne correspondent pas", "es": "Las contraseñas no coinciden",
        "de": "Die Passwörter stimmen nicht überein", "nl": "De wachtwoorden komen niet overeen",
    },
    "forgotPasswordDialog.errResetFailed": {
        "en": "We couldn't reset your password. Please try again.",
        "pt": "Não conseguimos redefinir sua senha. Tente novamente.",
        "fr": "Nous n'avons pas pu réinitialiser votre mot de passe. Veuillez réessayer.",
        "es": "No pudimos restablecer tu contraseña. Inténtalo de nuevo.",
        "de": "Wir konnten dein Passwort nicht zurücksetzen. Bitte versuche es erneut.",
        "nl": "We konden je wachtwoord niet opnieuw instellen. Probeer het opnieuw.",
    },
    "forgotPasswordDialog.errResendFailed": {
        "en": "We couldn't resend the code. Please try again.",
        "pt": "Não conseguimos reenviar o código. Tente novamente.",
        "fr": "Nous n'avons pas pu renvoyer le code. Veuillez réessayer.",
        "es": "No pudimos reenviar el código. Inténtalo de nuevo.",
        "de": "Wir konnten den Code nicht erneut senden. Bitte versuche es erneut.",
        "nl": "We konden de code niet opnieuw versturen. Probeer het opnieuw.",
    },
}


def set_path(d, path, val):
    parts = path.split(".")
    cur = d
    for p in parts[:-1]:
        if p not in cur or not isinstance(cur[p], dict):
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = val


def count_strings(x):
    if isinstance(x, dict):
        return sum(count_strings(v) for v in x.values())
    return 1 if isinstance(x, str) else 0


def main():
    for lang in LANGS:
        fp = os.path.abspath(os.path.join(BASE, lang, "auth.json"))
        with open(fp, encoding="utf-8") as f:
            data = json.load(f)
        applied = 0
        if lang == "en":
            for path, val in EN_ONLY.items():
                set_path(data, path, val)
                applied += 1
        for path, vals in ALL6.items():
            if lang in vals:
                set_path(data, path, vals[lang])
                applied += 1
        with open(fp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}: applied {applied} keys | total strings now {count_strings(data)}")


if __name__ == "__main__":
    main()
