#!/usr/bin/env python3
"""Adds the `security.*` + `paymentRequest.*` email copy (2FA on/off/backup codes, phone changes,
account deleted/suspended/closed/reactivated, customer payment request) to all 6 locale catalogs.
Idempotent: re-running overwrites the same keys. Usage: python3 scripts/inject_security_emails_i18n.py"""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "locales")

DIDNT = {
    "en": "<strong>Didn't do this?</strong> Someone else may have access to your account. Change your password right away and contact our support team.",
    "de": "<strong>Waren Sie das nicht?</strong> Möglicherweise hat jemand anderes Zugriff auf Ihr Konto. Ändern Sie sofort Ihr Passwort und kontaktieren Sie unseren Support.",
    "es": "<strong>¿No fue usted?</strong> Es posible que otra persona tenga acceso a su cuenta. Cambie su contraseña de inmediato y contacte con nuestro equipo de soporte.",
    "fr": "<strong>Ce n'était pas vous ?</strong> Quelqu'un d'autre a peut-être accès à votre compte. Changez immédiatement votre mot de passe et contactez notre support.",
    "nl": "<strong>Was dit niet u?</strong> Mogelijk heeft iemand anders toegang tot uw account. Wijzig direct uw wachtwoord en neem contact op met onze support.",
    "pt": "<strong>Não foi você?</strong> Outra pessoa pode ter acesso à sua conta. Altere a sua palavra-passe imediatamente e contacte a nossa equipa de suporte.",
}

REVIEW_CTA = {"en": "Review security settings", "de": "Sicherheitseinstellungen prüfen", "es": "Revisar la seguridad", "fr": "Vérifier la sécurité", "nl": "Beveiliging controleren", "pt": "Rever a segurança"}
SUPPORT_CTA = {"en": "Contact support", "de": "Support kontaktieren", "es": "Contactar con soporte", "fr": "Contacter le support", "nl": "Contact met support", "pt": "Contactar o suporte"}
PROFILE_CTA = {"en": "View profile", "de": "Profil anzeigen", "es": "Ver perfil", "fr": "Voir le profil", "nl": "Profiel bekijken", "pt": "Ver perfil"}
DASH_CTA = {"en": "Go to dashboard", "de": "Zum Dashboard", "es": "Ir al panel", "fr": "Accéder au tableau de bord", "nl": "Naar het dashboard", "pt": "Ir para o painel"}

SECURITY = {
    "en": {
        "twoFaEnabled": {
            "subject": "Two-factor authentication is on",
            "heading": "Two-factor authentication enabled",
            "intro": "Two-factor authentication (2FA) is now protecting your Dynopay account. From now on you'll need a code from your authenticator app each time you sign in.",
            "tip": "Keep your backup codes somewhere safe — they're the only way in if you lose access to your authenticator app.",
            "preheader": "Your account now requires an authenticator code to sign in.",
        },
        "twoFaDisabled": {
            "subject": "Two-factor authentication turned off",
            "heading": "Two-factor authentication disabled",
            "intro": "Two-factor authentication (2FA) was just turned off on your Dynopay account. Your password alone now unlocks your account.",
            "cta": "Turn 2FA back on",
            "preheader": "2FA was turned off on your account — was that you?",
        },
        "backupCodes": {
            "subject": "New 2FA backup codes generated",
            "heading": "Backup codes regenerated",
            "intro": "A new set of two-factor backup codes was generated for your Dynopay account. Your previous backup codes no longer work.",
            "tip": "Store the new codes somewhere safe and never share them with anyone.",
            "preheader": "Your old backup codes no longer work.",
        },
        "phoneAdded": {
            "subject": "Phone number added to your account",
            "heading": "Phone number added",
            "intro": "A phone number was just added to your Dynopay account. You can now sign in and receive verification codes by SMS.",
            "preheader": "You can now receive verification codes by SMS.",
        },
        "phoneChanged": {
            "subject": "Phone number updated on your account",
            "heading": "Phone number updated",
            "intro": "The phone number on your Dynopay account was just changed. Verification codes and security alerts will now go to the new number.",
            "preheader": "Codes and alerts now go to your new number.",
        },
        "phoneRemoved": {
            "subject": "Phone number removed from your account",
            "heading": "Phone number removed",
            "intro": "The phone number was just removed from your Dynopay account. SMS sign-in is no longer available until you add a new number.",
            "preheader": "SMS sign-in is no longer available on your account.",
        },
        "phoneLabel": "Phone number",
        "accountDeleted": {
            "subject": "Your Dynopay account has been deleted",
            "heading": "Account deleted",
            "intro": "As requested, your Dynopay account and all of its data — brands, payment links, API keys, payout wallets and settings — have been permanently deleted.",
            "outro": "We're sorry to see you go. If you ever want to accept crypto payments again, you're welcome back any time.",
            "notice": "<strong>Didn't request this?</strong> Contact our support team immediately.",
            "preheader": "Your account and its data were permanently removed.",
        },
        "accountSuspended": {
            "subject": "Your Dynopay account has been suspended",
            "heading": "Account suspended",
            "intro": "Your Dynopay account has been temporarily suspended. You won't be able to sign in or process payments while it's suspended.",
            "outro": "If you believe this is a mistake, or you'd like to resolve it, reply to this email or contact our support team.",
            "preheader": "Sign-in and payments are paused on your account.",
        },
        "accountBanned": {
            "subject": "Your Dynopay account has been closed",
            "heading": "Account closed",
            "intro": "Your Dynopay account has been permanently closed for violating our terms of service. Sign-in and payment processing are no longer available.",
            "outro": "If you believe this decision is wrong, contact our support team and we'll review it.",
            "preheader": "Your account was closed for a terms-of-service violation.",
        },
        "accountReactivated": {
            "subject": "Your Dynopay account is active again",
            "heading": "Welcome back — your account is active",
            "intro": "Good news: your Dynopay account has been reactivated. You can sign in and accept payments as usual.",
            "preheader": "You can sign in and accept payments again.",
        },
        "reasonLabel": "Reason",
    },
    "de": {
        "twoFaEnabled": {
            "subject": "Zwei-Faktor-Authentifizierung ist aktiv",
            "heading": "Zwei-Faktor-Authentifizierung aktiviert",
            "intro": "Die Zwei-Faktor-Authentifizierung (2FA) schützt jetzt Ihr Dynopay-Konto. Ab sofort benötigen Sie bei jeder Anmeldung einen Code aus Ihrer Authenticator-App.",
            "tip": "Bewahren Sie Ihre Backup-Codes sicher auf – sie sind der einzige Zugang, falls Sie Ihre Authenticator-App verlieren.",
            "preheader": "Für die Anmeldung ist jetzt ein Authenticator-Code erforderlich.",
        },
        "twoFaDisabled": {
            "subject": "Zwei-Faktor-Authentifizierung deaktiviert",
            "heading": "Zwei-Faktor-Authentifizierung deaktiviert",
            "intro": "Die Zwei-Faktor-Authentifizierung (2FA) wurde gerade für Ihr Dynopay-Konto deaktiviert. Ihr Konto ist jetzt nur noch durch Ihr Passwort geschützt.",
            "cta": "2FA wieder aktivieren",
            "preheader": "2FA wurde für Ihr Konto deaktiviert – waren Sie das?",
        },
        "backupCodes": {
            "subject": "Neue 2FA-Backup-Codes erstellt",
            "heading": "Backup-Codes neu erstellt",
            "intro": "Für Ihr Dynopay-Konto wurde ein neuer Satz Backup-Codes für die Zwei-Faktor-Authentifizierung erstellt. Ihre bisherigen Backup-Codes funktionieren nicht mehr.",
            "tip": "Bewahren Sie die neuen Codes sicher auf und geben Sie sie niemals weiter.",
            "preheader": "Ihre alten Backup-Codes funktionieren nicht mehr.",
        },
        "phoneAdded": {
            "subject": "Telefonnummer zu Ihrem Konto hinzugefügt",
            "heading": "Telefonnummer hinzugefügt",
            "intro": "Zu Ihrem Dynopay-Konto wurde gerade eine Telefonnummer hinzugefügt. Sie können sich jetzt per SMS anmelden und Bestätigungscodes empfangen.",
            "preheader": "Sie können jetzt Bestätigungscodes per SMS erhalten.",
        },
        "phoneChanged": {
            "subject": "Telefonnummer Ihres Kontos aktualisiert",
            "heading": "Telefonnummer aktualisiert",
            "intro": "Die Telefonnummer Ihres Dynopay-Kontos wurde gerade geändert. Bestätigungscodes und Sicherheitshinweise gehen ab jetzt an die neue Nummer.",
            "preheader": "Codes und Hinweise gehen jetzt an Ihre neue Nummer.",
        },
        "phoneRemoved": {
            "subject": "Telefonnummer aus Ihrem Konto entfernt",
            "heading": "Telefonnummer entfernt",
            "intro": "Die Telefonnummer wurde gerade aus Ihrem Dynopay-Konto entfernt. Die Anmeldung per SMS ist erst wieder möglich, wenn Sie eine neue Nummer hinzufügen.",
            "preheader": "Die Anmeldung per SMS ist für Ihr Konto nicht mehr verfügbar.",
        },
        "phoneLabel": "Telefonnummer",
        "accountDeleted": {
            "subject": "Ihr Dynopay-Konto wurde gelöscht",
            "heading": "Konto gelöscht",
            "intro": "Wie gewünscht wurden Ihr Dynopay-Konto und alle zugehörigen Daten – Marken, Zahlungslinks, API-Schlüssel, Auszahlungs-Wallets und Einstellungen – dauerhaft gelöscht.",
            "outro": "Es tut uns leid, Sie gehen zu sehen. Wenn Sie wieder Krypto-Zahlungen annehmen möchten, sind Sie jederzeit willkommen.",
            "notice": "<strong>Haben Sie das nicht beantragt?</strong> Kontaktieren Sie sofort unseren Support.",
            "preheader": "Ihr Konto und Ihre Daten wurden dauerhaft entfernt.",
        },
        "accountSuspended": {
            "subject": "Ihr Dynopay-Konto wurde gesperrt",
            "heading": "Konto gesperrt",
            "intro": "Ihr Dynopay-Konto wurde vorübergehend gesperrt. Während der Sperre können Sie sich nicht anmelden und keine Zahlungen verarbeiten.",
            "outro": "Wenn Sie glauben, dass dies ein Irrtum ist, oder das Problem lösen möchten, antworten Sie auf diese E-Mail oder kontaktieren Sie unseren Support.",
            "preheader": "Anmeldung und Zahlungen sind für Ihr Konto pausiert.",
        },
        "accountBanned": {
            "subject": "Ihr Dynopay-Konto wurde geschlossen",
            "heading": "Konto geschlossen",
            "intro": "Ihr Dynopay-Konto wurde wegen eines Verstoßes gegen unsere Nutzungsbedingungen dauerhaft geschlossen. Anmeldung und Zahlungsabwicklung sind nicht mehr möglich.",
            "outro": "Wenn Sie diese Entscheidung für falsch halten, kontaktieren Sie unseren Support – wir prüfen den Fall.",
            "preheader": "Ihr Konto wurde wegen eines Verstoßes gegen die Nutzungsbedingungen geschlossen.",
        },
        "accountReactivated": {
            "subject": "Ihr Dynopay-Konto ist wieder aktiv",
            "heading": "Willkommen zurück – Ihr Konto ist aktiv",
            "intro": "Gute Nachrichten: Ihr Dynopay-Konto wurde reaktiviert. Sie können sich wie gewohnt anmelden und Zahlungen annehmen.",
            "preheader": "Sie können sich wieder anmelden und Zahlungen annehmen.",
        },
        "reasonLabel": "Grund",
    },
    "es": {
        "twoFaEnabled": {
            "subject": "La autenticación en dos pasos está activada",
            "heading": "Autenticación en dos pasos activada",
            "intro": "La autenticación en dos pasos (2FA) ya protege su cuenta de Dynopay. A partir de ahora necesitará un código de su aplicación de autenticación cada vez que inicie sesión.",
            "tip": "Guarde sus códigos de respaldo en un lugar seguro: son la única forma de entrar si pierde el acceso a su aplicación de autenticación.",
            "preheader": "Su cuenta ahora requiere un código de autenticación para iniciar sesión.",
        },
        "twoFaDisabled": {
            "subject": "Autenticación en dos pasos desactivada",
            "heading": "Autenticación en dos pasos desactivada",
            "intro": "La autenticación en dos pasos (2FA) acaba de desactivarse en su cuenta de Dynopay. Ahora su contraseña por sí sola desbloquea la cuenta.",
            "cta": "Volver a activar 2FA",
            "preheader": "Se desactivó la 2FA en su cuenta. ¿Fue usted?",
        },
        "backupCodes": {
            "subject": "Nuevos códigos de respaldo 2FA generados",
            "heading": "Códigos de respaldo regenerados",
            "intro": "Se generó un nuevo conjunto de códigos de respaldo para la autenticación en dos pasos de su cuenta de Dynopay. Los códigos anteriores ya no funcionan.",
            "tip": "Guarde los nuevos códigos en un lugar seguro y no los comparta con nadie.",
            "preheader": "Sus códigos de respaldo anteriores ya no funcionan.",
        },
        "phoneAdded": {
            "subject": "Número de teléfono añadido a su cuenta",
            "heading": "Número de teléfono añadido",
            "intro": "Se acaba de añadir un número de teléfono a su cuenta de Dynopay. Ahora puede iniciar sesión y recibir códigos de verificación por SMS.",
            "preheader": "Ahora puede recibir códigos de verificación por SMS.",
        },
        "phoneChanged": {
            "subject": "Número de teléfono actualizado en su cuenta",
            "heading": "Número de teléfono actualizado",
            "intro": "El número de teléfono de su cuenta de Dynopay acaba de cambiar. Los códigos de verificación y las alertas de seguridad se enviarán ahora al nuevo número.",
            "preheader": "Los códigos y alertas ahora van a su nuevo número.",
        },
        "phoneRemoved": {
            "subject": "Número de teléfono eliminado de su cuenta",
            "heading": "Número de teléfono eliminado",
            "intro": "El número de teléfono acaba de eliminarse de su cuenta de Dynopay. El inicio de sesión por SMS no estará disponible hasta que añada un nuevo número.",
            "preheader": "El inicio de sesión por SMS ya no está disponible en su cuenta.",
        },
        "phoneLabel": "Número de teléfono",
        "accountDeleted": {
            "subject": "Su cuenta de Dynopay ha sido eliminada",
            "heading": "Cuenta eliminada",
            "intro": "Como solicitó, su cuenta de Dynopay y todos sus datos (marcas, enlaces de pago, claves API, monederos de cobro y configuración) se han eliminado de forma permanente.",
            "outro": "Lamentamos que se vaya. Si alguna vez quiere volver a aceptar pagos en cripto, será bienvenido en cualquier momento.",
            "notice": "<strong>¿No solicitó esto?</strong> Contacte de inmediato con nuestro equipo de soporte.",
            "preheader": "Su cuenta y sus datos se eliminaron de forma permanente.",
        },
        "accountSuspended": {
            "subject": "Su cuenta de Dynopay ha sido suspendida",
            "heading": "Cuenta suspendida",
            "intro": "Su cuenta de Dynopay ha sido suspendida temporalmente. No podrá iniciar sesión ni procesar pagos mientras esté suspendida.",
            "outro": "Si cree que se trata de un error o desea resolverlo, responda a este correo o contacte con nuestro equipo de soporte.",
            "preheader": "El inicio de sesión y los pagos están en pausa en su cuenta.",
        },
        "accountBanned": {
            "subject": "Su cuenta de Dynopay ha sido cerrada",
            "heading": "Cuenta cerrada",
            "intro": "Su cuenta de Dynopay ha sido cerrada de forma permanente por infringir nuestros términos de servicio. El inicio de sesión y el procesamiento de pagos ya no están disponibles.",
            "outro": "Si cree que esta decisión es incorrecta, contacte con nuestro equipo de soporte y la revisaremos.",
            "preheader": "Su cuenta se cerró por infringir los términos de servicio.",
        },
        "accountReactivated": {
            "subject": "Su cuenta de Dynopay está activa de nuevo",
            "heading": "Bienvenido de nuevo: su cuenta está activa",
            "intro": "Buenas noticias: su cuenta de Dynopay ha sido reactivada. Puede iniciar sesión y aceptar pagos con normalidad.",
            "preheader": "Ya puede iniciar sesión y aceptar pagos de nuevo.",
        },
        "reasonLabel": "Motivo",
    },
    "fr": {
        "twoFaEnabled": {
            "subject": "L'authentification à deux facteurs est activée",
            "heading": "Authentification à deux facteurs activée",
            "intro": "L'authentification à deux facteurs (2FA) protège désormais votre compte Dynopay. À chaque connexion, un code de votre application d'authentification vous sera demandé.",
            "tip": "Conservez vos codes de secours en lieu sûr : ils sont le seul moyen d'accéder à votre compte si vous perdez votre application d'authentification.",
            "preheader": "Un code d'authentification est désormais requis pour vous connecter.",
        },
        "twoFaDisabled": {
            "subject": "Authentification à deux facteurs désactivée",
            "heading": "Authentification à deux facteurs désactivée",
            "intro": "L'authentification à deux facteurs (2FA) vient d'être désactivée sur votre compte Dynopay. Votre mot de passe suffit désormais pour accéder à votre compte.",
            "cta": "Réactiver la 2FA",
            "preheader": "La 2FA a été désactivée sur votre compte : était-ce vous ?",
        },
        "backupCodes": {
            "subject": "Nouveaux codes de secours 2FA générés",
            "heading": "Codes de secours régénérés",
            "intro": "Un nouveau jeu de codes de secours pour l'authentification à deux facteurs a été généré pour votre compte Dynopay. Vos anciens codes ne fonctionnent plus.",
            "tip": "Conservez les nouveaux codes en lieu sûr et ne les partagez jamais.",
            "preheader": "Vos anciens codes de secours ne fonctionnent plus.",
        },
        "phoneAdded": {
            "subject": "Numéro de téléphone ajouté à votre compte",
            "heading": "Numéro de téléphone ajouté",
            "intro": "Un numéro de téléphone vient d'être ajouté à votre compte Dynopay. Vous pouvez désormais vous connecter et recevoir des codes de vérification par SMS.",
            "preheader": "Vous pouvez désormais recevoir des codes de vérification par SMS.",
        },
        "phoneChanged": {
            "subject": "Numéro de téléphone mis à jour sur votre compte",
            "heading": "Numéro de téléphone mis à jour",
            "intro": "Le numéro de téléphone de votre compte Dynopay vient d'être modifié. Les codes de vérification et les alertes de sécurité seront désormais envoyés au nouveau numéro.",
            "preheader": "Les codes et alertes sont désormais envoyés à votre nouveau numéro.",
        },
        "phoneRemoved": {
            "subject": "Numéro de téléphone retiré de votre compte",
            "heading": "Numéro de téléphone retiré",
            "intro": "Le numéro de téléphone vient d'être retiré de votre compte Dynopay. La connexion par SMS ne sera plus disponible jusqu'à l'ajout d'un nouveau numéro.",
            "preheader": "La connexion par SMS n'est plus disponible sur votre compte.",
        },
        "phoneLabel": "Numéro de téléphone",
        "accountDeleted": {
            "subject": "Votre compte Dynopay a été supprimé",
            "heading": "Compte supprimé",
            "intro": "Comme demandé, votre compte Dynopay et toutes ses données (marques, liens de paiement, clés API, portefeuilles de versement et paramètres) ont été définitivement supprimés.",
            "outro": "Nous sommes désolés de vous voir partir. Si vous souhaitez un jour accepter à nouveau des paiements en crypto, vous serez toujours le bienvenu.",
            "notice": "<strong>Vous n'avez pas demandé cette suppression ?</strong> Contactez immédiatement notre équipe support.",
            "preheader": "Votre compte et vos données ont été définitivement supprimés.",
        },
        "accountSuspended": {
            "subject": "Votre compte Dynopay a été suspendu",
            "heading": "Compte suspendu",
            "intro": "Votre compte Dynopay a été temporairement suspendu. Vous ne pourrez ni vous connecter ni traiter de paiements pendant la suspension.",
            "outro": "Si vous pensez qu'il s'agit d'une erreur, ou si vous souhaitez régulariser la situation, répondez à cet e-mail ou contactez notre support.",
            "preheader": "La connexion et les paiements sont suspendus sur votre compte.",
        },
        "accountBanned": {
            "subject": "Votre compte Dynopay a été fermé",
            "heading": "Compte fermé",
            "intro": "Votre compte Dynopay a été définitivement fermé pour non-respect de nos conditions d'utilisation. La connexion et le traitement des paiements ne sont plus disponibles.",
            "outro": "Si vous pensez que cette décision est erronée, contactez notre support et nous la réexaminerons.",
            "preheader": "Votre compte a été fermé pour non-respect des conditions d'utilisation.",
        },
        "accountReactivated": {
            "subject": "Votre compte Dynopay est de nouveau actif",
            "heading": "Bon retour : votre compte est actif",
            "intro": "Bonne nouvelle : votre compte Dynopay a été réactivé. Vous pouvez vous connecter et accepter des paiements comme d'habitude.",
            "preheader": "Vous pouvez de nouveau vous connecter et accepter des paiements.",
        },
        "reasonLabel": "Motif",
    },
    "nl": {
        "twoFaEnabled": {
            "subject": "Tweestapsverificatie staat aan",
            "heading": "Tweestapsverificatie ingeschakeld",
            "intro": "Tweestapsverificatie (2FA) beschermt nu uw Dynopay-account. Vanaf nu heeft u bij elke aanmelding een code uit uw authenticator-app nodig.",
            "tip": "Bewaar uw back-upcodes op een veilige plek: ze zijn de enige toegang als u uw authenticator-app verliest.",
            "preheader": "Voor aanmelden is nu een authenticator-code vereist.",
        },
        "twoFaDisabled": {
            "subject": "Tweestapsverificatie uitgeschakeld",
            "heading": "Tweestapsverificatie uitgeschakeld",
            "intro": "Tweestapsverificatie (2FA) is zojuist uitgeschakeld voor uw Dynopay-account. Alleen uw wachtwoord geeft nu toegang tot uw account.",
            "cta": "2FA weer inschakelen",
            "preheader": "2FA is uitgeschakeld voor uw account – was dit u?",
        },
        "backupCodes": {
            "subject": "Nieuwe 2FA-back-upcodes aangemaakt",
            "heading": "Back-upcodes opnieuw aangemaakt",
            "intro": "Er is een nieuwe set back-upcodes voor tweestapsverificatie aangemaakt voor uw Dynopay-account. Uw vorige back-upcodes werken niet meer.",
            "tip": "Bewaar de nieuwe codes op een veilige plek en deel ze met niemand.",
            "preheader": "Uw oude back-upcodes werken niet meer.",
        },
        "phoneAdded": {
            "subject": "Telefoonnummer toegevoegd aan uw account",
            "heading": "Telefoonnummer toegevoegd",
            "intro": "Er is zojuist een telefoonnummer toegevoegd aan uw Dynopay-account. U kunt nu aanmelden en verificatiecodes ontvangen via sms.",
            "preheader": "U kunt nu verificatiecodes via sms ontvangen.",
        },
        "phoneChanged": {
            "subject": "Telefoonnummer van uw account bijgewerkt",
            "heading": "Telefoonnummer bijgewerkt",
            "intro": "Het telefoonnummer van uw Dynopay-account is zojuist gewijzigd. Verificatiecodes en beveiligingsmeldingen gaan vanaf nu naar het nieuwe nummer.",
            "preheader": "Codes en meldingen gaan nu naar uw nieuwe nummer.",
        },
        "phoneRemoved": {
            "subject": "Telefoonnummer verwijderd van uw account",
            "heading": "Telefoonnummer verwijderd",
            "intro": "Het telefoonnummer is zojuist verwijderd van uw Dynopay-account. Aanmelden via sms is pas weer mogelijk als u een nieuw nummer toevoegt.",
            "preheader": "Aanmelden via sms is niet meer beschikbaar voor uw account.",
        },
        "phoneLabel": "Telefoonnummer",
        "accountDeleted": {
            "subject": "Uw Dynopay-account is verwijderd",
            "heading": "Account verwijderd",
            "intro": "Zoals gevraagd zijn uw Dynopay-account en alle bijbehorende gegevens – merken, betaallinks, API-sleutels, uitbetalingswallets en instellingen – permanent verwijderd.",
            "outro": "We vinden het jammer dat u weggaat. Wilt u ooit weer cryptobetalingen accepteren, dan bent u altijd welkom.",
            "notice": "<strong>Heeft u dit niet aangevraagd?</strong> Neem direct contact op met onze support.",
            "preheader": "Uw account en gegevens zijn permanent verwijderd.",
        },
        "accountSuspended": {
            "subject": "Uw Dynopay-account is geschorst",
            "heading": "Account geschorst",
            "intro": "Uw Dynopay-account is tijdelijk geschorst. Zolang de schorsing duurt, kunt u niet aanmelden en geen betalingen verwerken.",
            "outro": "Denkt u dat dit een vergissing is, of wilt u dit oplossen? Beantwoord deze e-mail of neem contact op met onze support.",
            "preheader": "Aanmelden en betalingen zijn gepauzeerd voor uw account.",
        },
        "accountBanned": {
            "subject": "Uw Dynopay-account is gesloten",
            "heading": "Account gesloten",
            "intro": "Uw Dynopay-account is permanent gesloten wegens een schending van onze servicevoorwaarden. Aanmelden en betalingen verwerken zijn niet meer mogelijk.",
            "outro": "Vindt u deze beslissing onterecht? Neem contact op met onze support, dan bekijken we het opnieuw.",
            "preheader": "Uw account is gesloten wegens een schending van de servicevoorwaarden.",
        },
        "accountReactivated": {
            "subject": "Uw Dynopay-account is weer actief",
            "heading": "Welkom terug – uw account is actief",
            "intro": "Goed nieuws: uw Dynopay-account is opnieuw geactiveerd. U kunt zoals gewoonlijk aanmelden en betalingen accepteren.",
            "preheader": "U kunt weer aanmelden en betalingen accepteren.",
        },
        "reasonLabel": "Reden",
    },
    "pt": {
        "twoFaEnabled": {
            "subject": "A autenticação de dois fatores está ativa",
            "heading": "Autenticação de dois fatores ativada",
            "intro": "A autenticação de dois fatores (2FA) protege agora a sua conta Dynopay. A partir de agora, precisará de um código da sua aplicação de autenticação sempre que iniciar sessão.",
            "tip": "Guarde os seus códigos de recuperação num local seguro: são a única forma de entrar se perder o acesso à sua aplicação de autenticação.",
            "preheader": "A sua conta exige agora um código de autenticação para iniciar sessão.",
        },
        "twoFaDisabled": {
            "subject": "Autenticação de dois fatores desativada",
            "heading": "Autenticação de dois fatores desativada",
            "intro": "A autenticação de dois fatores (2FA) acabou de ser desativada na sua conta Dynopay. Agora apenas a sua palavra-passe protege a conta.",
            "cta": "Voltar a ativar a 2FA",
            "preheader": "A 2FA foi desativada na sua conta — foi você?",
        },
        "backupCodes": {
            "subject": "Novos códigos de recuperação 2FA gerados",
            "heading": "Códigos de recuperação regenerados",
            "intro": "Foi gerado um novo conjunto de códigos de recuperação para a autenticação de dois fatores da sua conta Dynopay. Os códigos anteriores deixaram de funcionar.",
            "tip": "Guarde os novos códigos num local seguro e nunca os partilhe.",
            "preheader": "Os seus códigos de recuperação antigos deixaram de funcionar.",
        },
        "phoneAdded": {
            "subject": "Número de telefone adicionado à sua conta",
            "heading": "Número de telefone adicionado",
            "intro": "Acabou de ser adicionado um número de telefone à sua conta Dynopay. Já pode iniciar sessão e receber códigos de verificação por SMS.",
            "preheader": "Já pode receber códigos de verificação por SMS.",
        },
        "phoneChanged": {
            "subject": "Número de telefone atualizado na sua conta",
            "heading": "Número de telefone atualizado",
            "intro": "O número de telefone da sua conta Dynopay acabou de ser alterado. Os códigos de verificação e os alertas de segurança passam a ser enviados para o novo número.",
            "preheader": "Os códigos e alertas passam a ir para o seu novo número.",
        },
        "phoneRemoved": {
            "subject": "Número de telefone removido da sua conta",
            "heading": "Número de telefone removido",
            "intro": "O número de telefone acabou de ser removido da sua conta Dynopay. O início de sessão por SMS deixa de estar disponível até adicionar um novo número.",
            "preheader": "O início de sessão por SMS já não está disponível na sua conta.",
        },
        "phoneLabel": "Número de telefone",
        "accountDeleted": {
            "subject": "A sua conta Dynopay foi eliminada",
            "heading": "Conta eliminada",
            "intro": "Conforme pedido, a sua conta Dynopay e todos os seus dados — marcas, links de pagamento, chaves API, carteiras de pagamento e definições — foram eliminados permanentemente.",
            "outro": "Lamentamos vê-lo partir. Se algum dia quiser voltar a aceitar pagamentos em cripto, será sempre bem-vindo.",
            "notice": "<strong>Não pediu isto?</strong> Contacte imediatamente a nossa equipa de suporte.",
            "preheader": "A sua conta e os seus dados foram removidos permanentemente.",
        },
        "accountSuspended": {
            "subject": "A sua conta Dynopay foi suspensa",
            "heading": "Conta suspensa",
            "intro": "A sua conta Dynopay foi temporariamente suspensa. Não poderá iniciar sessão nem processar pagamentos enquanto estiver suspensa.",
            "outro": "Se acredita que se trata de um erro, ou se quiser resolver a situação, responda a este e-mail ou contacte a nossa equipa de suporte.",
            "preheader": "O início de sessão e os pagamentos estão em pausa na sua conta.",
        },
        "accountBanned": {
            "subject": "A sua conta Dynopay foi encerrada",
            "heading": "Conta encerrada",
            "intro": "A sua conta Dynopay foi encerrada permanentemente por violação dos nossos termos de serviço. O início de sessão e o processamento de pagamentos deixaram de estar disponíveis.",
            "outro": "Se acredita que esta decisão está errada, contacte a nossa equipa de suporte e iremos rever o caso.",
            "preheader": "A sua conta foi encerrada por violação dos termos de serviço.",
        },
        "accountReactivated": {
            "subject": "A sua conta Dynopay está novamente ativa",
            "heading": "Bem-vindo de volta — a sua conta está ativa",
            "intro": "Boas notícias: a sua conta Dynopay foi reativada. Pode iniciar sessão e aceitar pagamentos normalmente.",
            "preheader": "Já pode iniciar sessão e aceitar pagamentos novamente.",
        },
        "reasonLabel": "Motivo",
    },
}

PAYMENT_REQUEST = {
    "en": {
        "subject": "{{companyName}} sent you a payment request – {{amount}} {{currency}}",
        "heading": "Payment request from {{companyName}}",
        "intro": "<strong>{{companyName}}</strong> is requesting a payment from you. Review the details below and pay securely with crypto.",
        "expires": "Expires",
        "outro": "The payment page shows the exact crypto amount and the coins you can pay with. If you weren't expecting this request, you can simply ignore this email.",
        "cta": "Pay now",
        "preheader": "{{companyName}} is requesting {{amount}} {{currency}}. Pay securely with crypto.",
    },
    "de": {
        "subject": "{{companyName}} hat Ihnen eine Zahlungsanforderung gesendet – {{amount}} {{currency}}",
        "heading": "Zahlungsanforderung von {{companyName}}",
        "intro": "<strong>{{companyName}}</strong> bittet Sie um eine Zahlung. Prüfen Sie die Details unten und zahlen Sie sicher mit Krypto.",
        "expires": "Gültig bis",
        "outro": "Auf der Zahlungsseite sehen Sie den genauen Krypto-Betrag und die verfügbaren Coins. Falls Sie diese Anforderung nicht erwartet haben, können Sie diese E-Mail einfach ignorieren.",
        "cta": "Jetzt bezahlen",
        "preheader": "{{companyName}} fordert {{amount}} {{currency}} an. Sicher mit Krypto bezahlen.",
    },
    "es": {
        "subject": "{{companyName}} le ha enviado una solicitud de pago – {{amount}} {{currency}}",
        "heading": "Solicitud de pago de {{companyName}}",
        "intro": "<strong>{{companyName}}</strong> le solicita un pago. Revise los detalles a continuación y pague de forma segura con cripto.",
        "expires": "Vence",
        "outro": "La página de pago muestra el importe exacto en cripto y las monedas con las que puede pagar. Si no esperaba esta solicitud, puede ignorar este correo.",
        "cta": "Pagar ahora",
        "preheader": "{{companyName}} solicita {{amount}} {{currency}}. Pague de forma segura con cripto.",
    },
    "fr": {
        "subject": "{{companyName}} vous a envoyé une demande de paiement – {{amount}} {{currency}}",
        "heading": "Demande de paiement de {{companyName}}",
        "intro": "<strong>{{companyName}}</strong> vous demande un paiement. Vérifiez les détails ci-dessous et payez en toute sécurité en crypto.",
        "expires": "Expire le",
        "outro": "La page de paiement affiche le montant exact en crypto et les cryptomonnaies acceptées. Si vous n'attendiez pas cette demande, vous pouvez simplement ignorer cet e-mail.",
        "cta": "Payer maintenant",
        "preheader": "{{companyName}} vous demande {{amount}} {{currency}}. Payez en toute sécurité en crypto.",
    },
    "nl": {
        "subject": "{{companyName}} heeft u een betaalverzoek gestuurd – {{amount}} {{currency}}",
        "heading": "Betaalverzoek van {{companyName}}",
        "intro": "<strong>{{companyName}}</strong> vraagt u om een betaling. Controleer de gegevens hieronder en betaal veilig met crypto.",
        "expires": "Verloopt op",
        "outro": "De betaalpagina toont het exacte cryptobedrag en de munten waarmee u kunt betalen. Verwachtte u dit verzoek niet, dan kunt u deze e-mail negeren.",
        "cta": "Nu betalen",
        "preheader": "{{companyName}} vraagt {{amount}} {{currency}}. Betaal veilig met crypto.",
    },
    "pt": {
        "subject": "{{companyName}} enviou-lhe um pedido de pagamento – {{amount}} {{currency}}",
        "heading": "Pedido de pagamento de {{companyName}}",
        "intro": "<strong>{{companyName}}</strong> está a pedir-lhe um pagamento. Reveja os detalhes abaixo e pague em segurança com cripto.",
        "expires": "Expira em",
        "outro": "A página de pagamento mostra o valor exato em cripto e as moedas com que pode pagar. Se não esperava este pedido, pode simplesmente ignorar este e-mail.",
        "cta": "Pagar agora",
        "preheader": "{{companyName}} pede {{amount}} {{currency}}. Pague em segurança com cripto.",
    },
}

for lang in ["en", "de", "es", "fr", "nl", "pt"]:
    path = os.path.join(ROOT, lang, "emails.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    sec = SECURITY[lang]
    sec["didntDoThis"] = DIDNT[lang]
    sec["reviewCta"] = REVIEW_CTA[lang]
    sec["supportCta"] = SUPPORT_CTA[lang]
    sec["profileCta"] = PROFILE_CTA[lang]
    sec["dashboardCta"] = DASH_CTA[lang]
    data["security"] = sec
    data["paymentRequest"] = PAYMENT_REQUEST[lang]
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{lang}: security={len(sec)} keys, paymentRequest={len(PAYMENT_REQUEST[lang])} keys")
