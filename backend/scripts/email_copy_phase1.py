#!/usr/bin/env python3
"""
Email copy audit — Phase 1 (logic bugs + user-flagged rewrites).
Applies, across all 6 email locales:
  - merchant.* OTP templates (login / signup / emailVerify / forgotPassword / changeEmail / setPassword)
    with the one canonical OTP shape (code-in-subject + expiry line). Fixes the bug where
    password-reset / email-change / set-password reused the generic "login code" body.
  - paymentPending (B2): drops the estimated-confirmation-times table the user flagged as noise.
  - paymentPartial (B5): rewrites the MERCHANT email that was written to the buyer
    ("you have N minutes to send…") into merchant-facing copy.
Idempotent: overwrites the specific keys only, leaves everything else untouched.
"""
import json, os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")
LANGS = ["en", "pt", "es", "fr", "de", "nl"]

# ── merchant.* OTP templates ────────────────────────────────────────────────
OTP = {
    "en": {
        "loginOtp": {
            "subject": "{{code}} is your Dynopay login code",
            "heading": "Your login code",
            "intro": "Enter this code to sign in:",
            "expiry": "Expires in 5 minutes. Never share it — Dynopay will never ask for this code.",
            "preheader": "Your Dynopay login code.",
        },
        "signupOtp": {
            "subject": "{{code}} is your Dynopay sign-up code",
            "heading": "Confirm your email",
            "intro": "Enter this code to finish creating your Dynopay account:",
            "expiry": "Expires in 10 minutes. Didn't sign up? Ignore this email.",
            "preheader": "Confirm your email to finish signing up.",
        },
        "emailVerifyOtp": {
            "subject": "{{code}} is your Dynopay verification code",
            "heading": "Verify your email",
            "intro": "Enter this code to confirm your email address:",
            "expiry": "Expires in 10 minutes. Didn't request this? Ignore this email.",
            "preheader": "Enter this code to verify your email.",
        },
        "forgotPasswordOtp": {
            "subject": "{{code}} is your password reset code",
            "heading": "Reset your password",
            "intro": "Use this code to choose a new password:",
            "expiry": "Expires in 10 minutes. Didn't ask for this? Ignore it — your password stays the same.",
            "preheader": "Use this code to reset your password.",
        },
        "changeEmailOtp": {
            "subject": "{{code}} to confirm your new email",
            "heading": "Confirm your new email",
            "intro": "Enter this code to confirm your new email address:",
            "expiry": "Expires in 10 minutes. Didn't request this change? Ignore this email.",
            "preheader": "Confirm your new email address.",
        },
        "setPasswordOtp": {
            "subject": "{{code}} to set your password",
            "heading": "Set your password",
            "intro": "Enter this code to set a password on your account:",
            "expiry": "Expires in 10 minutes. Didn't request this? Ignore this email.",
            "preheader": "Set a password for your account.",
        },
    },
    "de": {
        "loginOtp": {
            "subject": "{{code}} ist dein Dynopay-Anmeldecode",
            "heading": "Dein Anmeldecode",
            "intro": "Gib diesen Code ein, um dich anzumelden:",
            "expiry": "Läuft in 5 Minuten ab. Gib ihn niemals weiter — Dynopay fragt nie nach diesem Code.",
            "preheader": "Dein Dynopay-Anmeldecode.",
        },
        "signupOtp": {
            "subject": "{{code}} ist dein Dynopay-Registrierungscode",
            "heading": "Bestätige deine E-Mail",
            "intro": "Gib diesen Code ein, um dein Dynopay-Konto zu erstellen:",
            "expiry": "Läuft in 10 Minuten ab. Nicht registriert? Ignoriere diese E-Mail.",
            "preheader": "Bestätige deine E-Mail, um die Registrierung abzuschließen.",
        },
        "emailVerifyOtp": {
            "subject": "{{code}} ist dein Dynopay-Bestätigungscode",
            "heading": "E-Mail bestätigen",
            "intro": "Gib diesen Code ein, um deine E-Mail-Adresse zu bestätigen:",
            "expiry": "Läuft in 10 Minuten ab. Nicht angefordert? Ignoriere diese E-Mail.",
            "preheader": "Gib diesen Code ein, um deine E-Mail zu bestätigen.",
        },
        "forgotPasswordOtp": {
            "subject": "{{code}} ist dein Code zum Zurücksetzen des Passworts",
            "heading": "Passwort zurücksetzen",
            "intro": "Verwende diesen Code, um ein neues Passwort zu wählen:",
            "expiry": "Läuft in 10 Minuten ab. Nicht angefordert? Ignoriere ihn — dein Passwort bleibt unverändert.",
            "preheader": "Verwende diesen Code, um dein Passwort zurückzusetzen.",
        },
        "changeEmailOtp": {
            "subject": "{{code}} zur Bestätigung deiner neuen E-Mail",
            "heading": "Neue E-Mail bestätigen",
            "intro": "Gib diesen Code ein, um deine neue E-Mail-Adresse zu bestätigen:",
            "expiry": "Läuft in 10 Minuten ab. Diese Änderung nicht angefordert? Ignoriere diese E-Mail.",
            "preheader": "Bestätige deine neue E-Mail-Adresse.",
        },
        "setPasswordOtp": {
            "subject": "{{code}} zum Festlegen deines Passworts",
            "heading": "Passwort festlegen",
            "intro": "Gib diesen Code ein, um ein Passwort für dein Konto festzulegen:",
            "expiry": "Läuft in 10 Minuten ab. Nicht angefordert? Ignoriere diese E-Mail.",
            "preheader": "Lege ein Passwort für dein Konto fest.",
        },
    },
    "es": {
        "loginOtp": {
            "subject": "{{code}} es tu código de acceso de Dynopay",
            "heading": "Tu código de acceso",
            "intro": "Introduce este código para iniciar sesión:",
            "expiry": "Caduca en 5 minutos. Nunca lo compartas: Dynopay jamás te pedirá este código.",
            "preheader": "Tu código de acceso de Dynopay.",
        },
        "signupOtp": {
            "subject": "{{code}} es tu código de registro de Dynopay",
            "heading": "Confirma tu correo",
            "intro": "Introduce este código para crear tu cuenta de Dynopay:",
            "expiry": "Caduca en 10 minutos. ¿No te registraste? Ignora este correo.",
            "preheader": "Confirma tu correo para completar el registro.",
        },
        "emailVerifyOtp": {
            "subject": "{{code}} es tu código de verificación de Dynopay",
            "heading": "Verifica tu correo",
            "intro": "Introduce este código para confirmar tu dirección de correo:",
            "expiry": "Caduca en 10 minutos. ¿No lo solicitaste? Ignora este correo.",
            "preheader": "Introduce este código para verificar tu correo.",
        },
        "forgotPasswordOtp": {
            "subject": "{{code}} es tu código para restablecer la contraseña",
            "heading": "Restablece tu contraseña",
            "intro": "Usa este código para elegir una nueva contraseña:",
            "expiry": "Caduca en 10 minutos. ¿No lo solicitaste? Ignóralo: tu contraseña no cambiará.",
            "preheader": "Usa este código para restablecer tu contraseña.",
        },
        "changeEmailOtp": {
            "subject": "{{code}} para confirmar tu nuevo correo",
            "heading": "Confirma tu nuevo correo",
            "intro": "Introduce este código para confirmar tu nueva dirección de correo:",
            "expiry": "Caduca en 10 minutos. ¿No solicitaste este cambio? Ignora este correo.",
            "preheader": "Confirma tu nueva dirección de correo.",
        },
        "setPasswordOtp": {
            "subject": "{{code}} para establecer tu contraseña",
            "heading": "Establece tu contraseña",
            "intro": "Introduce este código para establecer una contraseña en tu cuenta:",
            "expiry": "Caduca en 10 minutos. ¿No lo solicitaste? Ignora este correo.",
            "preheader": "Establece una contraseña para tu cuenta.",
        },
    },
    "fr": {
        "loginOtp": {
            "subject": "{{code}} est votre code de connexion Dynopay",
            "heading": "Votre code de connexion",
            "intro": "Saisissez ce code pour vous connecter :",
            "expiry": "Expire dans 5 minutes. Ne le partagez jamais — Dynopay ne vous demandera jamais ce code.",
            "preheader": "Votre code de connexion Dynopay.",
        },
        "signupOtp": {
            "subject": "{{code}} est votre code d'inscription Dynopay",
            "heading": "Confirmez votre e-mail",
            "intro": "Saisissez ce code pour créer votre compte Dynopay :",
            "expiry": "Expire dans 10 minutes. Vous ne vous êtes pas inscrit ? Ignorez cet e-mail.",
            "preheader": "Confirmez votre e-mail pour terminer l'inscription.",
        },
        "emailVerifyOtp": {
            "subject": "{{code}} est votre code de vérification Dynopay",
            "heading": "Vérifiez votre e-mail",
            "intro": "Saisissez ce code pour confirmer votre adresse e-mail :",
            "expiry": "Expire dans 10 minutes. Vous n'avez rien demandé ? Ignorez cet e-mail.",
            "preheader": "Saisissez ce code pour vérifier votre e-mail.",
        },
        "forgotPasswordOtp": {
            "subject": "{{code}} est votre code de réinitialisation du mot de passe",
            "heading": "Réinitialisez votre mot de passe",
            "intro": "Utilisez ce code pour choisir un nouveau mot de passe :",
            "expiry": "Expire dans 10 minutes. Vous n'avez rien demandé ? Ignorez-le — votre mot de passe reste inchangé.",
            "preheader": "Utilisez ce code pour réinitialiser votre mot de passe.",
        },
        "changeEmailOtp": {
            "subject": "{{code}} pour confirmer votre nouvel e-mail",
            "heading": "Confirmez votre nouvel e-mail",
            "intro": "Saisissez ce code pour confirmer votre nouvelle adresse e-mail :",
            "expiry": "Expire dans 10 minutes. Vous n'avez pas demandé ce changement ? Ignorez cet e-mail.",
            "preheader": "Confirmez votre nouvelle adresse e-mail.",
        },
        "setPasswordOtp": {
            "subject": "{{code}} pour définir votre mot de passe",
            "heading": "Définissez votre mot de passe",
            "intro": "Saisissez ce code pour définir un mot de passe sur votre compte :",
            "expiry": "Expire dans 10 minutes. Vous n'avez rien demandé ? Ignorez cet e-mail.",
            "preheader": "Définissez un mot de passe pour votre compte.",
        },
    },
    "pt": {
        "loginOtp": {
            "subject": "{{code}} é o seu código de acesso Dynopay",
            "heading": "Seu código de acesso",
            "intro": "Digite este código para entrar:",
            "expiry": "Expira em 5 minutos. Nunca o compartilhe — a Dynopay jamais pedirá este código.",
            "preheader": "Seu código de acesso Dynopay.",
        },
        "signupOtp": {
            "subject": "{{code}} é o seu código de cadastro Dynopay",
            "heading": "Confirme seu e-mail",
            "intro": "Digite este código para criar sua conta Dynopay:",
            "expiry": "Expira em 10 minutos. Não se cadastrou? Ignore este e-mail.",
            "preheader": "Confirme seu e-mail para concluir o cadastro.",
        },
        "emailVerifyOtp": {
            "subject": "{{code}} é o seu código de verificação Dynopay",
            "heading": "Verifique seu e-mail",
            "intro": "Digite este código para confirmar seu endereço de e-mail:",
            "expiry": "Expira em 10 minutos. Não solicitou? Ignore este e-mail.",
            "preheader": "Digite este código para verificar seu e-mail.",
        },
        "forgotPasswordOtp": {
            "subject": "{{code}} é o seu código de redefinição de senha",
            "heading": "Redefina sua senha",
            "intro": "Use este código para escolher uma nova senha:",
            "expiry": "Expira em 10 minutos. Não solicitou? Ignore — sua senha permanece a mesma.",
            "preheader": "Use este código para redefinir sua senha.",
        },
        "changeEmailOtp": {
            "subject": "{{code}} para confirmar seu novo e-mail",
            "heading": "Confirme seu novo e-mail",
            "intro": "Digite este código para confirmar seu novo endereço de e-mail:",
            "expiry": "Expira em 10 minutos. Não solicitou esta alteração? Ignore este e-mail.",
            "preheader": "Confirme seu novo endereço de e-mail.",
        },
        "setPasswordOtp": {
            "subject": "{{code}} para definir sua senha",
            "heading": "Defina sua senha",
            "intro": "Digite este código para definir uma senha na sua conta:",
            "expiry": "Expira em 10 minutos. Não solicitou? Ignore este e-mail.",
            "preheader": "Defina uma senha para sua conta.",
        },
    },
    "nl": {
        "loginOtp": {
            "subject": "{{code}} is je Dynopay-inlogcode",
            "heading": "Je inlogcode",
            "intro": "Voer deze code in om in te loggen:",
            "expiry": "Verloopt over 5 minuten. Deel hem nooit — Dynopay vraagt nooit om deze code.",
            "preheader": "Je Dynopay-inlogcode.",
        },
        "signupOtp": {
            "subject": "{{code}} is je Dynopay-registratiecode",
            "heading": "Bevestig je e-mail",
            "intro": "Voer deze code in om je Dynopay-account aan te maken:",
            "expiry": "Verloopt over 10 minuten. Niet aangemeld? Negeer deze e-mail.",
            "preheader": "Bevestig je e-mail om de registratie te voltooien.",
        },
        "emailVerifyOtp": {
            "subject": "{{code}} is je Dynopay-verificatiecode",
            "heading": "Verifieer je e-mail",
            "intro": "Voer deze code in om je e-mailadres te bevestigen:",
            "expiry": "Verloopt over 10 minuten. Niet aangevraagd? Negeer deze e-mail.",
            "preheader": "Voer deze code in om je e-mail te verifiëren.",
        },
        "forgotPasswordOtp": {
            "subject": "{{code}} is je code om je wachtwoord te resetten",
            "heading": "Reset je wachtwoord",
            "intro": "Gebruik deze code om een nieuw wachtwoord te kiezen:",
            "expiry": "Verloopt over 10 minuten. Niet aangevraagd? Negeer het — je wachtwoord blijft hetzelfde.",
            "preheader": "Gebruik deze code om je wachtwoord te resetten.",
        },
        "changeEmailOtp": {
            "subject": "{{code}} om je nieuwe e-mail te bevestigen",
            "heading": "Bevestig je nieuwe e-mail",
            "intro": "Voer deze code in om je nieuwe e-mailadres te bevestigen:",
            "expiry": "Verloopt over 10 minuten. Deze wijziging niet aangevraagd? Negeer deze e-mail.",
            "preheader": "Bevestig je nieuwe e-mailadres.",
        },
        "setPasswordOtp": {
            "subject": "{{code}} om je wachtwoord in te stellen",
            "heading": "Stel je wachtwoord in",
            "intro": "Voer deze code in om een wachtwoord voor je account in te stellen:",
            "expiry": "Verloopt over 10 minuten. Niet aangevraagd? Negeer deze e-mail.",
            "preheader": "Stel een wachtwoord voor je account in.",
        },
    },
}

# ── paymentPending (B2): drop the estimated-times table ─────────────────────
PAYMENT_PENDING = {
    "en": {
        "subject": "{{amount}} {{currency}} incoming for {{companyName}} — confirming",
        "heading": "Payment confirming",
        "intro": "A <strong>{{amount}} {{currency}}</strong> payment is confirming on-chain for <strong>{{companyName}}</strong>.",
        "outro": "We'll email you the moment it's final — nothing to do yet.",
        "preheader": "We'll email you the moment it settles on-chain.",
    },
    "de": {
        "subject": "{{amount}} {{currency}} für {{companyName}} — wird bestätigt",
        "heading": "Zahlung wird bestätigt",
        "intro": "Eine Zahlung über <strong>{{amount}} {{currency}}</strong> wird für <strong>{{companyName}}</strong> on-chain bestätigt.",
        "outro": "Wir benachrichtigen dich, sobald sie endgültig ist — du musst nichts tun.",
        "preheader": "Wir benachrichtigen dich, sobald sie on-chain bestätigt ist.",
    },
    "es": {
        "subject": "{{amount}} {{currency}} para {{companyName}} — confirmando",
        "heading": "Confirmando el pago",
        "intro": "Un pago de <strong>{{amount}} {{currency}}</strong> se está confirmando en la cadena para <strong>{{companyName}}</strong>.",
        "outro": "Te avisaremos en cuanto sea definitivo: no tienes que hacer nada.",
        "preheader": "Te avisaremos en cuanto se confirme en la cadena.",
    },
    "fr": {
        "subject": "{{amount}} {{currency}} pour {{companyName}} — en cours de confirmation",
        "heading": "Paiement en cours de confirmation",
        "intro": "Un paiement de <strong>{{amount}} {{currency}}</strong> est en cours de confirmation on-chain pour <strong>{{companyName}}</strong>.",
        "outro": "Nous vous préviendrons dès qu'il sera définitif — rien à faire pour l'instant.",
        "preheader": "Nous vous préviendrons dès qu'il sera confirmé on-chain.",
    },
    "pt": {
        "subject": "{{amount}} {{currency}} para {{companyName}} — confirmando",
        "heading": "Confirmando o pagamento",
        "intro": "Um pagamento de <strong>{{amount}} {{currency}}</strong> está sendo confirmado on-chain para <strong>{{companyName}}</strong>.",
        "outro": "Avisaremos assim que for definitivo — nada a fazer por enquanto.",
        "preheader": "Avisaremos assim que for confirmado on-chain.",
    },
    "nl": {
        "subject": "{{amount}} {{currency}} voor {{companyName}} — wordt bevestigd",
        "heading": "Betaling wordt bevestigd",
        "intro": "Een betaling van <strong>{{amount}} {{currency}}</strong> wordt on-chain bevestigd voor <strong>{{companyName}}</strong>.",
        "outro": "We mailen je zodra deze definitief is — je hoeft niets te doen.",
        "preheader": "We mailen je zodra deze on-chain is bevestigd.",
    },
}

# ── paymentPartial (B5): merchant-facing rewrite ────────────────────────────
PAYMENT_PARTIAL = {
    "en": {
        "subject": "Short payment: {{received}} of {{expected}} {{currency}}",
        "heading": "Short payment received",
        "intro": "A buyer sent <strong>{{received}} {{currency}}</strong> of the <strong>{{expected}} {{currency}}</strong> owed to <strong>{{companyName}}</strong>.",
        "windowNote": "They have <strong>{{minutes}} min</strong> to send the remaining <strong>{{remaining}} {{currency}}</strong>. If it doesn't arrive, we settle what was received and adjust the fee.",
        "preheader": "A buyer underpaid — the shortfall may still arrive.",
    },
    "de": {
        "subject": "Zu wenig gezahlt: {{received}} von {{expected}} {{currency}}",
        "heading": "Zu geringe Zahlung eingegangen",
        "intro": "Ein Käufer hat <strong>{{received}} {{currency}}</strong> von den <strong>{{expected}} {{currency}}</strong> gesendet, die {{companyName}} zustehen.",
        "windowNote": "Er hat <strong>{{minutes}} Min.</strong> Zeit, den Restbetrag von <strong>{{remaining}} {{currency}}</strong> zu senden. Bleibt er aus, rechnen wir den erhaltenen Betrag mit angepasster Gebühr ab.",
        "preheader": "Ein Käufer hat zu wenig gezahlt — der Rest kann noch eintreffen.",
    },
    "es": {
        "subject": "Pago incompleto: {{received}} de {{expected}} {{currency}}",
        "heading": "Pago incompleto recibido",
        "intro": "Un comprador envió <strong>{{received}} {{currency}}</strong> de los <strong>{{expected}} {{currency}}</strong> que corresponden a {{companyName}}.",
        "windowNote": "Tiene <strong>{{minutes}} min</strong> para enviar los <strong>{{remaining}} {{currency}}</strong> restantes. Si no llegan, liquidamos lo recibido con la comisión ajustada.",
        "preheader": "Un comprador pagó de menos: el resto aún puede llegar.",
    },
    "fr": {
        "subject": "Paiement partiel : {{received}} sur {{expected}} {{currency}}",
        "heading": "Paiement partiel reçu",
        "intro": "Un acheteur a envoyé <strong>{{received}} {{currency}}</strong> sur les <strong>{{expected}} {{currency}}</strong> dus à {{companyName}}.",
        "windowNote": "Il a <strong>{{minutes}} min</strong> pour envoyer les <strong>{{remaining}} {{currency}}</strong> restants. À défaut, nous réglons le montant reçu avec des frais ajustés.",
        "preheader": "Un acheteur a sous-payé — le reste peut encore arriver.",
    },
    "pt": {
        "subject": "Pagamento incompleto: {{received}} de {{expected}} {{currency}}",
        "heading": "Pagamento incompleto recebido",
        "intro": "Um comprador enviou <strong>{{received}} {{currency}}</strong> dos <strong>{{expected}} {{currency}}</strong> devidos a {{companyName}}.",
        "windowNote": "Ele tem <strong>{{minutes}} min</strong> para enviar os <strong>{{remaining}} {{currency}}</strong> restantes. Se não chegar, liquidamos o valor recebido com a taxa ajustada.",
        "preheader": "Um comprador pagou a menos — o restante ainda pode chegar.",
    },
    "nl": {
        "subject": "Te weinig betaald: {{received}} van {{expected}} {{currency}}",
        "heading": "Te lage betaling ontvangen",
        "intro": "Een koper heeft <strong>{{received}} {{currency}}</strong> van de <strong>{{expected}} {{currency}}</strong> gestuurd die {{companyName}} toekomen.",
        "windowNote": "Hij heeft <strong>{{minutes}} min</strong> om de resterende <strong>{{remaining}} {{currency}}</strong> te sturen. Komt dat niet, dan verrekenen we het ontvangen bedrag met aangepaste kosten.",
        "preheader": "Een koper heeft te weinig betaald — de rest kan nog binnenkomen.",
    },
}

for lang in LANGS:
    path = os.path.join(LOCALES_DIR, lang, "emails.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    # merchant.* OTP templates
    data.setdefault("merchant", {})
    for key, val in OTP[lang].items():
        data["merchant"][key] = val

    # paymentPending — replace whole object (drops estimatedTimes/btcTime/etc.)
    data["paymentPending"] = PAYMENT_PENDING[lang]

    # paymentPartial — replace whole object (drops actionRequired/actionText/sendTo/graceNote)
    data["paymentPartial"] = PAYMENT_PARTIAL[lang]

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"updated {lang}/emails.json")

print("done")
