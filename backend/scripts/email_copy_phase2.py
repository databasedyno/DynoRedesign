#!/usr/bin/env python3
"""
Email copy audit — Phase 2: concise subjects + trimmed bodies across all 6 locales.
Every rewritten subject uses ONLY variables already present in the current subject
string (so the sender already interpolates them) — no sender changes required.
Idempotent: sets specific dot-path keys, leaves everything else untouched.
"""
import json, os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "locales")
LANGS = ["en", "pt", "es", "fr", "de", "nl"]

# dot-path -> { lang: value }
DATA = {
    # ── Buyer / merchant payment lifecycle ──────────────────────────────────
    "paymentReceived.subject": {
        "en": "{{amount}} {{currency}} received",
        "de": "{{amount}} {{currency}} erhalten",
        "es": "{{amount}} {{currency}} recibidos",
        "fr": "{{amount}} {{currency}} reçus",
        "pt": "{{amount}} {{currency}} recebidos",
        "nl": "{{amount}} {{currency}} ontvangen",
    },
    "paymentReceived.outro": {
        "en": "The funds are on their way to your payout wallet.",
        "de": "Die Gelder sind auf dem Weg zu deiner Auszahlungs-Wallet.",
        "es": "Los fondos van camino a tu cartera de cobro.",
        "fr": "Les fonds sont en route vers votre portefeuille de paiement.",
        "pt": "Os fundos estão a caminho da sua carteira de recebimento.",
        "nl": "De gelden zijn onderweg naar je uitbetaalwallet.",
    },
    "paymentConfirming.subject": {
        "en": "{{current}}/{{required}} confirmations",
        "de": "{{current}}/{{required}} Bestätigungen",
        "es": "{{current}}/{{required}} confirmaciones",
        "fr": "{{current}}/{{required}} confirmations",
        "pt": "{{current}}/{{required}} confirmações",
        "nl": "{{current}}/{{required}} bevestigingen",
    },
    "overpayment.merchantSubject": {
        "en": "A buyer overpaid by {{excess}}",
        "de": "Ein Käufer hat {{excess}} zu viel gezahlt",
        "es": "Un comprador pagó {{excess}} de más",
        "fr": "Un acheteur a payé {{excess}} de trop",
        "pt": "Um comprador pagou {{excess}} a mais",
        "nl": "Een koper heeft {{excess}} te veel betaald",
    },
    "payoutDigest.subjectActive": {
        "en": "Your week on Dynopay: {{amount}} settled",
        "de": "Deine Woche bei Dynopay: {{amount}} ausgezahlt",
        "es": "Tu semana en Dynopay: {{amount}} liquidados",
        "fr": "Votre semaine sur Dynopay : {{amount}} réglés",
        "pt": "Sua semana na Dynopay: {{amount}} liquidados",
        "nl": "Jouw week op Dynopay: {{amount}} uitbetaald",
    },
    "payoutDigest.subjectQuiet": {
        "en": "Your week on Dynopay: nothing settled yet",
        "de": "Deine Woche bei Dynopay: noch nichts ausgezahlt",
        "es": "Tu semana en Dynopay: aún nada liquidado",
        "fr": "Votre semaine sur Dynopay : rien de réglé pour l'instant",
        "pt": "Sua semana na Dynopay: nada liquidado ainda",
        "nl": "Jouw week op Dynopay: nog niets uitbetaald",
    },
    "payoutDigest.intro": {
        "en": "Here's your Dynopay week at a glance.",
        "de": "Hier ist deine Dynopay-Woche auf einen Blick.",
        "es": "Aquí tienes tu semana en Dynopay de un vistazo.",
        "fr": "Voici votre semaine Dynopay en un coup d'œil.",
        "pt": "Aqui está sua semana na Dynopay num relance.",
        "nl": "Hier is je Dynopay-week in één oogopslag.",
    },
    "paymentRequest.subject": {
        "en": "{{companyName}} requests {{amount}} {{currency}}",
        "de": "{{companyName}} fordert {{amount}} {{currency}} an",
        "es": "{{companyName}} solicita {{amount}} {{currency}}",
        "fr": "{{companyName}} demande {{amount}} {{currency}}",
        "pt": "{{companyName}} solicita {{amount}} {{currency}}",
        "nl": "{{companyName}} vraagt {{amount}} {{currency}}",
    },
    "paymentRequest.outro": {
        "en": "Not expecting this? Ignore it — nothing is charged until you pay.",
        "de": "Nicht erwartet? Ignoriere es — es wird nichts berechnet, bis du zahlst.",
        "es": "¿No lo esperabas? Ignóralo: no se cobra nada hasta que pagues.",
        "fr": "Vous ne l'attendiez pas ? Ignorez-le — rien n'est débité tant que vous ne payez pas.",
        "pt": "Não esperava por isso? Ignore — nada é cobrado até você pagar.",
        "nl": "Niet verwacht? Negeer het — er wordt niets in rekening gebracht tot je betaalt.",
    },
    "contributionReceived.subject": {
        "en": "{{amount}} {{currency}} contribution to {{campaignName}}",
        "de": "{{amount}} {{currency}} Beitrag für {{campaignName}}",
        "es": "Contribución de {{amount}} {{currency}} a {{campaignName}}",
        "fr": "Contribution de {{amount}} {{currency}} à {{campaignName}}",
        "pt": "Contribuição de {{amount}} {{currency}} para {{campaignName}}",
        "nl": "Bijdrage van {{amount}} {{currency}} aan {{campaignName}}",
    },
    "contributionThankYou.subject": {
        "en": "Thanks for supporting {{campaignName}}",
        "de": "Danke für deine Unterstützung von {{campaignName}}",
        "es": "Gracias por apoyar {{campaignName}}",
        "fr": "Merci de soutenir {{campaignName}}",
        "pt": "Obrigado por apoiar {{campaignName}}",
        "nl": "Bedankt voor je steun aan {{campaignName}}",
    },
    "contributionThankYou.contact": {
        "en": "The organizer can see your support and may send campaign updates.",
        "de": "Der Organisator sieht deine Unterstützung und sendet dir eventuell Updates.",
        "es": "El organizador puede ver tu apoyo y quizá te envíe novedades.",
        "fr": "L'organisateur voit votre soutien et pourra vous envoyer des actualités.",
        "pt": "O organizador vê seu apoio e pode enviar novidades da campanha.",
        "nl": "De organisator ziet je steun en stuurt je mogelijk campagne-updates.",
    },

    # ── Merchant account & security ─────────────────────────────────────────
    "merchant.welcome.subject": {
        "en": "Welcome to Dynopay — your first payment is fee-free",
        "de": "Willkommen bei Dynopay — deine erste Zahlung ist gebührenfrei",
        "es": "Bienvenido a Dynopay: tu primer pago es sin comisión",
        "fr": "Bienvenue sur Dynopay — votre premier paiement est sans frais",
        "pt": "Bem-vindo à Dynopay — seu primeiro pagamento é sem taxa",
        "nl": "Welkom bij Dynopay — je eerste betaling is gratis",
    },
    "merchant.welcome.intro2": {
        "en": "Dynopay makes accepting crypto simple and secure — funds settle straight to a wallet you control.",
        "de": "Dynopay macht das Annehmen von Krypto einfach und sicher — Gelder gehen direkt an eine Wallet, die du kontrollierst.",
        "es": "Dynopay facilita aceptar cripto de forma segura: los fondos van directo a una cartera que tú controlas.",
        "fr": "Dynopay rend l'acceptation des cryptos simple et sûre — les fonds arrivent directement sur un portefeuille que vous contrôlez.",
        "pt": "A Dynopay torna aceitar cripto simples e seguro — os fundos vão direto para uma carteira que você controla.",
        "nl": "Dynopay maakt crypto accepteren simpel en veilig — gelden komen direct in een wallet die jij beheert.",
    },
    "merchant.passwordChanged.subject": {
        "en": "Your Dynopay password was changed",
        "de": "Dein Dynopay-Passwort wurde geändert",
        "es": "Tu contraseña de Dynopay fue cambiada",
        "fr": "Votre mot de passe Dynopay a été modifié",
        "pt": "Sua senha da Dynopay foi alterada",
        "nl": "Je Dynopay-wachtwoord is gewijzigd",
    },
    "merchant.profileUpdated.subject": {
        "en": "Your account details were changed",
        "de": "Deine Kontodaten wurden geändert",
        "es": "Los datos de tu cuenta cambiaron",
        "fr": "Les informations de votre compte ont été modifiées",
        "pt": "Os dados da sua conta foram alterados",
        "nl": "Je accountgegevens zijn gewijzigd",
    },
    "merchant.profileUpdated.emailChangedSubject": {
        "en": "Your Dynopay login email was changed",
        "de": "Deine Dynopay-Login-E-Mail wurde geändert",
        "es": "El correo de acceso de Dynopay fue cambiado",
        "fr": "Votre e-mail de connexion Dynopay a été modifié",
        "pt": "Seu e-mail de acesso da Dynopay foi alterado",
        "nl": "Je Dynopay-inlog-e-mail is gewijzigd",
    },
    "merchant.newDeviceLogin.subject": {
        "en": "New device signed in to your account",
        "de": "Neues Gerät bei deinem Konto angemeldet",
        "es": "Un nuevo dispositivo inició sesión en tu cuenta",
        "fr": "Un nouvel appareil s'est connecté à votre compte",
        "pt": "Um novo dispositivo acessou sua conta",
        "nl": "Een nieuw apparaat is ingelogd op je account",
    },
    "merchant.companyCreated.subject": {
        "en": "One step left — add a payout wallet to get paid",
        "de": "Ein Schritt fehlt — füge eine Auszahlungs-Wallet hinzu, um Geld zu erhalten",
        "es": "Falta un paso: añade una cartera de cobro para recibir pagos",
        "fr": "Plus qu'une étape — ajoutez un portefeuille de paiement pour être payé",
        "pt": "Falta um passo — adicione uma carteira de recebimento para receber",
        "nl": "Nog één stap — voeg een uitbetaalwallet toe om betaald te worden",
    },
    "merchant.companyContactWelcome.subject": {
        "en": "{{companyName}} was added to Dynopay",
        "de": "{{companyName}} wurde zu Dynopay hinzugefügt",
        "es": "{{companyName}} se añadió a Dynopay",
        "fr": "{{companyName}} a été ajouté à Dynopay",
        "pt": "{{companyName}} foi adicionado à Dynopay",
        "nl": "{{companyName}} is toegevoegd aan Dynopay",
    },
    "merchant.companyUpdated.subject": {
        "en": "Your brand details were changed",
        "de": "Deine Markendaten wurden geändert",
        "es": "Los datos de tu marca cambiaron",
        "fr": "Les informations de votre marque ont été modifiées",
        "pt": "Os dados da sua marca foram alterados",
        "nl": "Je merkgegevens zijn gewijzigd",
    },
    "merchant.invoice.subject": {
        "en": "Dynopay fee invoice {{number}}",
        "de": "Dynopay-Gebührenrechnung {{number}}",
        "es": "Factura de comisión Dynopay {{number}}",
        "fr": "Facture de frais Dynopay {{number}}",
        "pt": "Fatura de taxa Dynopay {{number}}",
        "nl": "Dynopay-kostenfactuur {{number}}",
    },
    "merchant.invoice.intro": {
        "en": "Your Dynopay fee invoice for transaction #{{transactionId}} is ready.",
        "de": "Deine Dynopay-Gebührenrechnung für Transaktion #{{transactionId}} ist bereit.",
        "es": "Tu factura de comisión de Dynopay para la transacción #{{transactionId}} está lista.",
        "fr": "Votre facture de frais Dynopay pour la transaction #{{transactionId}} est prête.",
        "pt": "Sua fatura de taxa da Dynopay para a transação #{{transactionId}} está pronta.",
        "nl": "Je Dynopay-kostenfactuur voor transactie #{{transactionId}} is klaar.",
    },
    "merchant.volumeTierUpgrade.subject": {
        "en": "Your Dynopay fee is now {{newPercent}}% ({{newTier}} tier)",
        "de": "Deine Dynopay-Gebühr liegt jetzt bei {{newPercent}}% ({{newTier}}-Stufe)",
        "es": "Tu comisión de Dynopay ahora es {{newPercent}}% (nivel {{newTier}})",
        "fr": "Vos frais Dynopay sont désormais de {{newPercent}}% (palier {{newTier}})",
        "pt": "Sua taxa Dynopay agora é {{newPercent}}% (nível {{newTier}})",
        "nl": "Je Dynopay-tarief is nu {{newPercent}}% ({{newTier}}-niveau)",
    },
    "merchant.volumeTierUpgrade.thanks": {
        "en": "",
        "de": "", "es": "", "fr": "", "pt": "", "nl": "",
    },
    "merchant.largeTransaction.subject": {
        "en": "Large payment: {{amount}} {{currency}}",
        "de": "Große Zahlung: {{amount}} {{currency}}",
        "es": "Pago grande: {{amount}} {{currency}}",
        "fr": "Gros paiement : {{amount}} {{currency}}",
        "pt": "Pagamento grande: {{amount}} {{currency}}",
        "nl": "Grote betaling: {{amount}} {{currency}}",
    },
    "merchant.largeTransaction.outro2": {
        "en": "It's already settled to your wallet — worth a quick look before you fulfil the order.",
        "de": "Sie ist bereits in deiner Wallet — ein kurzer Blick lohnt sich, bevor du die Bestellung erfüllst.",
        "es": "Ya está liquidado en tu cartera; conviene revisarlo antes de completar el pedido.",
        "fr": "Il est déjà réglé sur votre portefeuille — un coup d'œil s'impose avant d'honorer la commande.",
        "pt": "Já foi liquidado na sua carteira — vale uma olhada rápida antes de atender o pedido.",
        "nl": "Het staat al in je wallet — even checken voordat je de bestelling uitvoert.",
    },
    "merchant.apiKeyRevoked.subject": {
        "en": "{{keyType}} API key deleted — integrations using it will fail",
        "de": "{{keyType}}-API-Schlüssel gelöscht — Integrationen damit funktionieren nicht mehr",
        "es": "Clave API {{keyType}} eliminada: las integraciones que la usen fallarán",
        "fr": "Clé API {{keyType}} supprimée — les intégrations qui l'utilisent échoueront",
        "pt": "Chave de API {{keyType}} excluída — integrações que a usam vão falhar",
        "nl": "{{keyType}}-API-sleutel verwijderd — integraties die hem gebruiken werken niet meer",
    },
    "merchant.apiKey.subjectCreated": {
        "en": "New {{keyType}} API key created",
        "de": "Neuer {{keyType}}-API-Schlüssel erstellt",
        "es": "Nueva clave API {{keyType}} creada",
        "fr": "Nouvelle clé API {{keyType}} créée",
        "pt": "Nova chave de API {{keyType}} criada",
        "nl": "Nieuwe {{keyType}}-API-sleutel aangemaakt",
    },
    "merchant.apiKey.subjectRegenerated": {
        "en": "{{keyType}} API key rotated — old key stopped working",
        "de": "{{keyType}}-API-Schlüssel rotiert — alter Schlüssel funktioniert nicht mehr",
        "es": "Clave API {{keyType}} rotada: la clave anterior dejó de funcionar",
        "fr": "Clé API {{keyType}} renouvelée — l'ancienne clé ne fonctionne plus",
        "pt": "Chave de API {{keyType}} rotacionada — a chave antiga parou de funcionar",
        "nl": "{{keyType}}-API-sleutel geroteerd — oude sleutel werkt niet meer",
    },
    "merchant.paymentLinkCreated.subject": {
        "en": "Link ready: {{amount}} {{currency}}",
        "de": "Link bereit: {{amount}} {{currency}}",
        "es": "Enlace listo: {{amount}} {{currency}}",
        "fr": "Lien prêt : {{amount}} {{currency}}",
        "pt": "Link pronto: {{amount}} {{currency}}",
        "nl": "Link klaar: {{amount}} {{currency}}",
    },
    "merchant.crowdfundingCreated.subject": {
        "en": "{{title}} is live — share it",
        "de": "{{title}} ist live — teile die Kampagne",
        "es": "{{title}} está en vivo: compártela",
        "fr": "{{title}} est en ligne — partagez-la",
        "pt": "{{title}} está no ar — compartilhe",
        "nl": "{{title}} staat live — deel de campagne",
    },
    "merchant.kycRequired.subject": {
        "en": "Verify your identity to keep accepting payments",
        "de": "Verifiziere deine Identität, um weiter Zahlungen anzunehmen",
        "es": "Verifica tu identidad para seguir aceptando pagos",
        "fr": "Vérifiez votre identité pour continuer à accepter des paiements",
        "pt": "Verifique sua identidade para continuar aceitando pagamentos",
        "nl": "Verifieer je identiteit om betalingen te blijven accepteren",
    },
    "merchant.kycApproved.subject": {
        "en": "You're verified — no limits on payments",
        "de": "Du bist verifiziert — keine Zahlungslimits",
        "es": "Estás verificado: sin límites de pago",
        "fr": "Vous êtes vérifié — aucune limite de paiement",
        "pt": "Você está verificado — sem limites de pagamento",
        "nl": "Je bent geverifieerd — geen betaallimieten",
    },
    "merchant.kycApproved.outro": {
        "en": "You can now accept payments without limits and use every Dynopay feature.",
        "de": "Du kannst jetzt ohne Limits Zahlungen annehmen und alle Dynopay-Funktionen nutzen.",
        "es": "Ahora puedes aceptar pagos sin límites y usar todas las funciones de Dynopay.",
        "fr": "Vous pouvez désormais accepter des paiements sans limite et utiliser toutes les fonctions Dynopay.",
        "pt": "Agora você pode aceitar pagamentos sem limites e usar todos os recursos da Dynopay.",
        "nl": "Je kunt nu zonder limieten betalingen accepteren en alle Dynopay-functies gebruiken.",
    },
    "merchant.kycRejected.subject": {
        "en": "We couldn't verify your ID",
        "de": "Wir konnten deinen Ausweis nicht verifizieren",
        "es": "No pudimos verificar tu identidad",
        "fr": "Nous n'avons pas pu vérifier votre pièce d'identité",
        "pt": "Não conseguimos verificar sua identidade",
        "nl": "We konden je ID niet verifiëren",
    },
    "merchant.kycResubmission.subject": {
        "en": "One more thing for your ID check",
        "de": "Noch eine Sache für deine Ausweisprüfung",
        "es": "Una cosa más para tu verificación de identidad",
        "fr": "Encore une chose pour votre vérification d'identité",
        "pt": "Mais uma coisa para sua verificação de identidade",
        "nl": "Nog één ding voor je ID-controle",
    },
    "merchant.autoConversion.outro": {
        "en": "Your revenue is protected from crypto price swings.",
        "de": "Deine Einnahmen sind vor Krypto-Kursschwankungen geschützt.",
        "es": "Tus ingresos están protegidos de las variaciones de precio de las criptos.",
        "fr": "Vos revenus sont protégés des variations de cours des cryptos.",
        "pt": "Sua receita está protegida das oscilações de preço das criptos.",
        "nl": "Je inkomsten zijn beschermd tegen koersschommelingen van crypto.",
    },
    "merchant.conversionFailed.subject": {
        "en": "Conversion of {{amount}} failed — funds held safely",
        "de": "Umwandlung von {{amount}} fehlgeschlagen — Guthaben sicher verwahrt",
        "es": "La conversión de {{amount}} falló: los fondos están a salvo",
        "fr": "La conversion de {{amount}} a échoué — fonds conservés en sécurité",
        "pt": "A conversão de {{amount}} falhou — fundos guardados com segurança",
        "nl": "Conversie van {{amount}} mislukt — tegoed veilig bewaard",
    },
    "merchant.subscriptionCreated.custSubject": {
        "en": "You're subscribed to {{planName}}",
        "de": "Du bist bei {{planName}} angemeldet",
        "es": "Te suscribiste a {{planName}}",
        "fr": "Vous êtes abonné à {{planName}}",
        "pt": "Você assinou {{planName}}",
        "nl": "Je bent geabonneerd op {{planName}}",
    },
    "merchant.subscriptionCreated.merchSubject": {
        "en": "New subscriber to {{planName}}",
        "de": "Neuer Abonnent für {{planName}}",
        "es": "Nuevo suscriptor a {{planName}}",
        "fr": "Nouvel abonné à {{planName}}",
        "pt": "Novo assinante de {{planName}}",
        "nl": "Nieuwe abonnee op {{planName}}",
    },
    "merchant.subscriptionCreated.custOutro": {
        "en": "Each billing cycle, we'll email you a secure link to pay in crypto.",
        "de": "Zu jedem Abrechnungszeitraum senden wir dir einen sicheren Link zur Krypto-Zahlung.",
        "es": "En cada ciclo de facturación te enviaremos un enlace seguro para pagar en cripto.",
        "fr": "À chaque cycle de facturation, nous vous enverrons un lien sécurisé pour payer en crypto.",
        "pt": "A cada ciclo de cobrança, enviaremos um link seguro para você pagar em cripto.",
        "nl": "Bij elke factureringscyclus mailen we je een veilige link om in crypto te betalen.",
    },
    "merchant.subscriptionCancelled.custSubject": {
        "en": "{{planName}} subscription cancelled",
        "de": "Abo für {{planName}} gekündigt",
        "es": "Suscripción a {{planName}} cancelada",
        "fr": "Abonnement à {{planName}} annulé",
        "pt": "Assinatura de {{planName}} cancelada",
        "nl": "Abonnement op {{planName}} opgezegd",
    },
    "merchant.subscriptionCancelled.merchSubject": {
        "en": "{{name}} cancelled their subscription",
        "de": "{{name}} hat das Abo gekündigt",
        "es": "{{name}} canceló su suscripción",
        "fr": "{{name}} a annulé son abonnement",
        "pt": "{{name}} cancelou a assinatura",
        "nl": "{{name}} heeft het abonnement opgezegd",
    },
    "merchant.subscriptionPaymentFailed.custSubject": {
        "en": "Action needed: {{planName}} payment didn't go through",
        "de": "Aktion nötig: Zahlung für {{planName}} fehlgeschlagen",
        "es": "Acción necesaria: el pago de {{planName}} no se realizó",
        "fr": "Action requise : le paiement de {{planName}} a échoué",
        "pt": "Ação necessária: o pagamento de {{planName}} não foi concluído",
        "nl": "Actie nodig: betaling voor {{planName}} is mislukt",
    },

    # ── Security / 2FA ──────────────────────────────────────────────────────
    "security.twoFaEnabled.subject": {
        "en": "2FA is on for your account",
        "de": "2FA ist für dein Konto aktiv",
        "es": "La 2FA está activada en tu cuenta",
        "fr": "La 2FA est activée sur votre compte",
        "pt": "A 2FA está ativa na sua conta",
        "nl": "2FA staat aan voor je account",
    },
    "security.twoFaDisabled.subject": {
        "en": "2FA was turned off — was that you?",
        "de": "2FA wurde deaktiviert — warst das du?",
        "es": "Se desactivó la 2FA: ¿fuiste tú?",
        "fr": "La 2FA a été désactivée — était-ce vous ?",
        "pt": "A 2FA foi desativada — foi você?",
        "nl": "2FA is uitgezet — was jij dat?",
    },
    "security.backupCodes.subject": {
        "en": "Your 2FA backup codes were replaced",
        "de": "Deine 2FA-Backup-Codes wurden ersetzt",
        "es": "Tus códigos de respaldo 2FA se reemplazaron",
        "fr": "Vos codes de secours 2FA ont été remplacés",
        "pt": "Seus códigos de backup 2FA foram substituídos",
        "nl": "Je 2FA-back-upcodes zijn vervangen",
    },
    "security.accountDeleted.outro": {
        "en": "If you ever want to accept crypto again, you're welcome back any time.",
        "de": "Wenn du wieder Krypto annehmen möchtest, bist du jederzeit willkommen.",
        "es": "Si algún día quieres volver a aceptar cripto, serás bienvenido.",
        "fr": "Si vous souhaitez à nouveau accepter des cryptos, vous êtes le bienvenu à tout moment.",
        "pt": "Se um dia quiser voltar a aceitar cripto, você será bem-vindo.",
        "nl": "Wil je ooit weer crypto accepteren, dan ben je altijd welkom terug.",
    },

    # ── Referral (i18n reminder/invite) ─────────────────────────────────────
    "referral.invite.subject": {
        "en": "Get paid in crypto too — {{discountPercent}}% off Dynopay fees",
        "de": "Werde auch in Krypto bezahlt — {{discountPercent}}% Rabatt auf Dynopay-Gebühren",
        "es": "Cobra tú también en cripto: {{discountPercent}}% de descuento en comisiones de Dynopay",
        "fr": "Soyez payé en crypto aussi — {{discountPercent}}% de réduction sur les frais Dynopay",
        "pt": "Receba em cripto também — {{discountPercent}}% de desconto nas taxas da Dynopay",
        "nl": "Word ook in crypto betaald — {{discountPercent}}% korting op Dynopay-kosten",
    },
    "referral.reminder.subjectWeek1": {
        "en": "Your Dynopay fee discount is waiting",
        "de": "Dein Dynopay-Gebührenrabatt wartet",
        "es": "Tu descuento en comisiones de Dynopay te espera",
        "fr": "Votre réduction sur les frais Dynopay vous attend",
        "pt": "Seu desconto nas taxas da Dynopay está esperando",
        "nl": "Je Dynopay-kortingskorting staat klaar",
    },
    "referral.reminder.subjectWeek2": {
        "en": "{{discountPercent}}% off Dynopay fees — claim it",
        "de": "{{discountPercent}}% Rabatt auf Dynopay-Gebühren — sichere ihn dir",
        "es": "{{discountPercent}}% de descuento en comisiones de Dynopay: reclámalo",
        "fr": "{{discountPercent}}% de réduction sur les frais Dynopay — profitez-en",
        "pt": "{{discountPercent}}% de desconto nas taxas da Dynopay — resgate",
        "nl": "{{discountPercent}}% korting op Dynopay-kosten — claim het",
    },
    "referral.reminder.subjectWeek3": {
        "en": "{{daysRemaining}} days left on your fee discount",
        "de": "Noch {{daysRemaining}} Tage für deinen Gebührenrabatt",
        "es": "Quedan {{daysRemaining}} días para tu descuento en comisiones",
        "fr": "Plus que {{daysRemaining}} jours pour votre réduction de frais",
        "pt": "Faltam {{daysRemaining}} dias para seu desconto nas taxas",
        "nl": "Nog {{daysRemaining}} dagen voor je kostenkorting",
    },
    "referral.reminder.subjectFinal": {
        "en": "Last chance: fee discount ends in {{daysRemaining}} days",
        "de": "Letzte Chance: Gebührenrabatt endet in {{daysRemaining}} Tagen",
        "es": "Última oportunidad: el descuento termina en {{daysRemaining}} días",
        "fr": "Dernière chance : la réduction se termine dans {{daysRemaining}} jours",
        "pt": "Última chance: o desconto termina em {{daysRemaining}} dias",
        "nl": "Laatste kans: kortingskorting eindigt over {{daysRemaining}} dagen",
    },
}


def set_path(obj, dotpath, value):
    parts = dotpath.split(".")
    cur = obj
    for p in parts[:-1]:
        cur = cur.setdefault(p, {})
    cur[parts[-1]] = value


for lang in LANGS:
    path = os.path.join(LOCALES_DIR, lang, "emails.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    for dotpath, per_lang in DATA.items():
        if lang in per_lang:
            set_path(data, dotpath, per_lang[lang])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"updated {lang}/emails.json ({len(DATA)} keys)")

print("done")
