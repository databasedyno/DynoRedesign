#!/usr/bin/env python3
"""Part 2 — apply email copy rewrites across all 6 locales.

Does, per locale (en, de, es, fr, nl, pt):
  1. Subject house-style: strip trailing " - Dynopay" suffix + normalise
     " - " separators to " – " (en-dash) on every subject-ish key.
  2. Reworded subjects (explicit, all langs) — clarity fixes.
  3. Add `preheader` keys to every locale-driven, customer/merchant-facing email.
  4. Correctness copy: A2 (crypto subscriptions, not cards/banks) + A4 (KYC = ID
     + selfie, no proof-of-address) + strip the emoji from welcome.promo.

Writes JSON back with 2-space indent, UTF-8 preserved. Idempotent.
Run from backend/:  python3 scripts/apply_part2_locales.py
"""
import json, pathlib, copy

BASE = pathlib.Path(__file__).resolve().parent.parent  # backend/
LOC = BASE / "locales"
LANGS = ["en", "de", "es", "fr", "nl", "pt"]

# ── 1. Subject house-style (mechanical, all langs) ──────────────────────────
SUFFIXES = [" - Dynopay", " — Dynopay", " – Dynopay", " -Dynopay"]

def mech_subject(s: str) -> str:
    if not isinstance(s, str):
        return s
    out = s
    for suf in SUFFIXES:
        if out.endswith(suf):
            out = out[: -len(suf)]
            break
    out = out.replace(" - ", " – ")
    return out.strip()

def is_subject_key(leaf: str) -> bool:
    l = leaf.lower()
    return "subject" in l

# ── 2. Reworded subjects (explicit, all langs) ──────────────────────────────
SUBJECTS = {
    "paymentPending.subject": {
        "en": "Payment detected – confirming on-chain",
        "de": "Zahlung erkannt – wird in der Blockchain bestätigt",
        "es": "Pago detectado – confirmando en la cadena",
        "fr": "Paiement détecté – confirmation en cours sur la blockchain",
        "nl": "Betaling gedetecteerd – wordt on-chain bevestigd",
        "pt": "Pagamento detetado – a confirmar na blockchain",
    },
    "paymentConfirming.subject": {
        "en": "Payment confirming – {{current}} of {{required}} confirmations",
        "de": "Zahlung wird bestätigt – {{current}} von {{required}} Bestätigungen",
        "es": "Confirmando pago – {{current}} de {{required}} confirmaciones",
        "fr": "Paiement en confirmation – {{current}} sur {{required}} confirmations",
        "nl": "Betaling wordt bevestigd – {{current}} van {{required}} bevestigingen",
        "pt": "A confirmar pagamento – {{current}} de {{required}} confirmações",
    },
    "customerPaymentConfirmation.subject": {
        "en": "Your payment to {{companyName}} is confirmed",
        "de": "Ihre Zahlung an {{companyName}} ist bestätigt",
        "es": "Tu pago a {{companyName}} está confirmado",
        "fr": "Votre paiement à {{companyName}} est confirmé",
        "nl": "Je betaling aan {{companyName}} is bevestigd",
        "pt": "O seu pagamento a {{companyName}} está confirmado",
    },
    "merchant.kycRequired.subject": {
        "en": "Verification required at {{threshold}} volume",
        "de": "Verifizierung ab {{threshold}} Umsatz erforderlich",
        "es": "Verificación requerida al alcanzar {{threshold}} de volumen",
        "fr": "Vérification requise à {{threshold}} de volume",
        "nl": "Verificatie vereist bij {{threshold}} volume",
        "pt": "Verificação necessária a {{threshold}} de volume",
    },
}

# ── 3. Preheaders (inbox-preview line) — path -> {lang: value} ──────────────
PRE = {
    # payments
    "paymentReceived.preheader": {
        "en": "Funds are settling to your payout wallet now.",
        "de": "Das Geld wird jetzt an Ihre Auszahlungs-Wallet überwiesen.",
        "es": "Los fondos se están liquidando en tu monedero de cobros.",
        "fr": "Les fonds sont en cours de versement sur votre portefeuille.",
        "nl": "Het geld wordt nu naar je uitbetalingswallet overgemaakt.",
        "pt": "Os fundos estão a ser liquidados na sua carteira de pagamentos.",
    },
    "contributionReceived.preheader": {
        "en": "A new contribution just landed for your campaign.",
        "de": "Für Ihre Kampagne ist gerade ein neuer Beitrag eingegangen.",
        "es": "Acaba de llegar una nueva contribución a tu campaña.",
        "fr": "Une nouvelle contribution vient d'arriver pour votre campagne.",
        "nl": "Er is zojuist een nieuwe bijdrage voor je campagne binnengekomen.",
        "pt": "Chegou agora uma nova contribuição para a sua campanha.",
    },
    "paymentPending.preheader": {
        "en": "We'll email you the moment it settles on-chain.",
        "de": "Wir informieren Sie, sobald die Zahlung on-chain bestätigt ist.",
        "es": "Te avisaremos en cuanto se confirme en la cadena.",
        "fr": "Nous vous préviendrons dès la confirmation sur la blockchain.",
        "nl": "We mailen je zodra de betaling on-chain is bevestigd.",
        "pt": "Avisamos assim que for confirmado na blockchain.",
    },
    "paymentConfirming.preheader": {
        "en": "Your payment is gaining network confirmations.",
        "de": "Ihre Zahlung erhält Netzwerk-Bestätigungen.",
        "es": "Tu pago está recibiendo confirmaciones de red.",
        "fr": "Votre paiement reçoit des confirmations réseau.",
        "nl": "Je betaling krijgt netwerkbevestigingen.",
        "pt": "O seu pagamento está a receber confirmações da rede.",
    },
    "transactionConfirmed.preheader": {
        "en": "The latest status of your transaction.",
        "de": "Der aktuelle Status Ihrer Transaktion.",
        "es": "El estado más reciente de tu transacción.",
        "fr": "Le dernier statut de votre transaction.",
        "nl": "De laatste status van je transactie.",
        "pt": "O estado mais recente da sua transação.",
    },
    "paymentPartial.preheader": {
        "en": "The amount received is less than the invoice total.",
        "de": "Der eingegangene Betrag liegt unter dem Rechnungsbetrag.",
        "es": "El importe recibido es inferior al total de la factura.",
        "fr": "Le montant reçu est inférieur au total de la facture.",
        "nl": "Het ontvangen bedrag is lager dan het factuurtotaal.",
        "pt": "O valor recebido é inferior ao total da fatura.",
    },
    "paymentPartialExpired.preheaderCompleted": {
        "en": "We've processed the partial amount you paid.",
        "de": "Wir haben den von Ihnen gezahlten Teilbetrag verarbeitet.",
        "es": "Hemos procesado el importe parcial que pagaste.",
        "fr": "Nous avons traité le montant partiel que vous avez payé.",
        "nl": "We hebben het deelbedrag dat je betaalde verwerkt.",
        "pt": "Processámos o valor parcial que pagou.",
    },
    "paymentPartialExpired.preheaderExpired": {
        "en": "The payment window closed before full payment.",
        "de": "Das Zahlungsfenster wurde vor vollständiger Zahlung geschlossen.",
        "es": "La ventana de pago se cerró antes del pago completo.",
        "fr": "Le délai de paiement a expiré avant le paiement complet.",
        "nl": "Het betaalvenster sloot vóór de volledige betaling.",
        "pt": "A janela de pagamento fechou antes do pagamento total.",
    },
    "paymentFailed.preheader": {
        "en": "This payment didn't go through — no funds were taken.",
        "de": "Diese Zahlung war nicht erfolgreich — es wurde nichts abgebucht.",
        "es": "Este pago no se completó — no se cobró ningún importe.",
        "fr": "Ce paiement n'a pas abouti — aucun montant n'a été prélevé.",
        "nl": "Deze betaling is mislukt — er is niets afgeschreven.",
        "pt": "Este pagamento não foi concluído — nada foi cobrado.",
    },
    "paymentFailed.merchantPreheader": {
        "en": "A customer payment didn't complete.",
        "de": "Eine Kundenzahlung wurde nicht abgeschlossen.",
        "es": "El pago de un cliente no se completó.",
        "fr": "Le paiement d'un client n'a pas abouti.",
        "nl": "Een klantbetaling is niet voltooid.",
        "pt": "O pagamento de um cliente não foi concluído.",
    },
    # account / auth
    "merchant.welcome.preheader": {
        "en": "Your first settled payment is fee-free — here's how to get paid.",
        "de": "Ihre erste abgewickelte Zahlung ist gebührenfrei — so werden Sie bezahlt.",
        "es": "Tu primer pago liquidado es sin comisiones — así empiezas a cobrar.",
        "fr": "Votre premier paiement réglé est sans frais — voici comment être payé.",
        "nl": "Je eerste afgehandelde betaling is gratis — zo word je betaald.",
        "pt": "O seu primeiro pagamento liquidado é sem taxas — veja como receber.",
    },
    "merchant.volumeTierUpgrade.preheader": {
        "en": "Your platform fee just dropped to {{newPercent}}%.",
        "de": "Ihre Plattformgebühr sank soeben auf {{newPercent}}%.",
        "es": "Tu comisión de plataforma bajó a {{newPercent}}%.",
        "fr": "Vos frais de plateforme viennent de baisser à {{newPercent}}%.",
        "nl": "Je platformtarief is zojuist verlaagd naar {{newPercent}}%.",
        "pt": "A sua taxa de plataforma desceu para {{newPercent}}%.",
    },
    "merchant.emailVerifyOtp.preheader": {
        "en": "Enter this code to verify your email address.",
        "de": "Geben Sie diesen Code ein, um Ihre E-Mail zu bestätigen.",
        "es": "Introduce este código para verificar tu correo.",
        "fr": "Saisissez ce code pour vérifier votre adresse e-mail.",
        "nl": "Voer deze code in om je e-mailadres te verifiëren.",
        "pt": "Introduza este código para verificar o seu e-mail.",
    },
    "merchant.loginOtp.preheader": {
        "en": "Your code expires in a few minutes. Never share it.",
        "de": "Ihr Code läuft in wenigen Minuten ab. Geben Sie ihn niemals weiter.",
        "es": "Tu código caduca en unos minutos. Nunca lo compartas.",
        "fr": "Votre code expire dans quelques minutes. Ne le partagez jamais.",
        "nl": "Je code verloopt over enkele minuten. Deel hem nooit.",
        "pt": "O seu código expira em minutos. Nunca o partilhe.",
    },
    "merchant.passwordChanged.preheader": {
        "en": "Your account password was just changed.",
        "de": "Das Passwort Ihres Kontos wurde gerade geändert.",
        "es": "La contraseña de tu cuenta se acaba de cambiar.",
        "fr": "Le mot de passe de votre compte vient d'être modifié.",
        "nl": "Het wachtwoord van je account is zojuist gewijzigd.",
        "pt": "A palavra-passe da sua conta foi alterada.",
    },
    "merchant.profileUpdated.preheader": {
        "en": "A change was made to your account profile.",
        "de": "An Ihrem Kontoprofil wurde eine Änderung vorgenommen.",
        "es": "Se realizó un cambio en el perfil de tu cuenta.",
        "fr": "Une modification a été apportée au profil de votre compte.",
        "nl": "Er is een wijziging aangebracht in je accountprofiel.",
        "pt": "Foi feita uma alteração no perfil da sua conta.",
    },
    "merchant.profileUpdated.emailChangedPreheader": {
        "en": "Your account email address was changed.",
        "de": "Die E-Mail-Adresse Ihres Kontos wurde geändert.",
        "es": "La dirección de correo de tu cuenta cambió.",
        "fr": "L'adresse e-mail de votre compte a été modifiée.",
        "nl": "Het e-mailadres van je account is gewijzigd.",
        "pt": "O e-mail da sua conta foi alterado.",
    },
    "merchant.securityAlert.preheader": {
        "en": "We spotted unusual activity on your account.",
        "de": "Wir haben ungewöhnliche Aktivität in Ihrem Konto festgestellt.",
        "es": "Detectamos actividad inusual en tu cuenta.",
        "fr": "Nous avons détecté une activité inhabituelle sur votre compte.",
        "nl": "We zagen ongebruikelijke activiteit op je account.",
        "pt": "Detetámos atividade invulgar na sua conta.",
    },
    "merchant.loginNotification.preheader": {
        "en": "A new sign-in was detected. Was it you?",
        "de": "Eine neue Anmeldung wurde erkannt. Waren Sie das?",
        "es": "Se detectó un nuevo inicio de sesión. ¿Fuiste tú?",
        "fr": "Une nouvelle connexion a été détectée. Était-ce vous ?",
        "nl": "Er is een nieuwe aanmelding gedetecteerd. Was jij dat?",
        "pt": "Foi detetado um novo início de sessão. Foi você?",
    },
    "merchant.failedLogins.preheader": {
        "en": "Several sign-in attempts failed on your account.",
        "de": "Mehrere Anmeldeversuche bei Ihrem Konto sind fehlgeschlagen.",
        "es": "Varios intentos de inicio de sesión fallaron en tu cuenta.",
        "fr": "Plusieurs tentatives de connexion ont échoué sur votre compte.",
        "nl": "Meerdere aanmeldpogingen op je account zijn mislukt.",
        "pt": "Várias tentativas de início de sessão na sua conta falharam.",
    },
    # company
    "merchant.companyCreated.preheader": {
        "en": "One quick step left before you can accept payments.",
        "de": "Nur noch ein kurzer Schritt, bis Sie Zahlungen annehmen können.",
        "es": "Solo queda un paso para empezar a aceptar pagos.",
        "fr": "Encore une étape avant de pouvoir accepter des paiements.",
        "nl": "Nog één stap voordat je betalingen kunt accepteren.",
        "pt": "Falta apenas um passo para começar a aceitar pagamentos.",
    },
    "merchant.companyContactWelcome.preheader": {
        "en": "Your business is registered — welcome aboard.",
        "de": "Ihr Unternehmen ist registriert — willkommen an Bord.",
        "es": "Tu negocio está registrado — te damos la bienvenida.",
        "fr": "Votre entreprise est enregistrée — bienvenue à bord.",
        "nl": "Je bedrijf is geregistreerd — welkom aan boord.",
        "pt": "A sua empresa está registada — bem-vindo a bordo.",
    },
    "merchant.companyUpdated.preheader": {
        "en": "Your company profile details were updated.",
        "de": "Die Angaben Ihres Unternehmensprofils wurden aktualisiert.",
        "es": "Se actualizaron los datos del perfil de tu empresa.",
        "fr": "Les informations de profil de votre entreprise ont été mises à jour.",
        "nl": "De gegevens van je bedrijfsprofiel zijn bijgewerkt.",
        "pt": "Os dados do perfil da sua empresa foram atualizados.",
    },
    # kyc
    "merchant.kycRequired.preheader": {
        "en": "Verify your identity to keep accepting payments past {{threshold}}.",
        "de": "Verifizieren Sie sich, um über {{threshold}} weiter Zahlungen anzunehmen.",
        "es": "Verifica tu identidad para seguir aceptando pagos por encima de {{threshold}}.",
        "fr": "Vérifiez votre identité pour continuer d'encaisser au-delà de {{threshold}}.",
        "nl": "Verifieer je identiteit om betalingen boven {{threshold}} te blijven accepteren.",
        "pt": "Verifique a sua identidade para continuar a aceitar pagamentos acima de {{threshold}}.",
    },
    "merchant.kycApproved.preheader": {
        "en": "You're verified — no limits on accepting payments.",
        "de": "Sie sind verifiziert — keine Limits beim Annehmen von Zahlungen.",
        "es": "Estás verificado — sin límites para aceptar pagos.",
        "fr": "Vous êtes vérifié — aucune limite pour encaisser des paiements.",
        "nl": "Je bent geverifieerd — geen limieten op betalingen accepteren.",
        "pt": "Está verificado — sem limites para aceitar pagamentos.",
    },
    "merchant.kycRejected.preheader": {
        "en": "We couldn't verify your identity — here's what to do.",
        "de": "Wir konnten Ihre Identität nicht bestätigen — so geht es weiter.",
        "es": "No pudimos verificar tu identidad — esto es lo que debes hacer.",
        "fr": "Nous n'avons pas pu vérifier votre identité — voici la marche à suivre.",
        "nl": "We konden je identiteit niet verifiëren — dit kun je doen.",
        "pt": "Não conseguimos verificar a sua identidade — veja o que fazer.",
    },
    "merchant.kycStarted.preheader": {
        "en": "Finish your quick identity check to lift limits.",
        "de": "Schließen Sie die kurze Identitätsprüfung ab, um Limits aufzuheben.",
        "es": "Completa tu verificación de identidad para quitar los límites.",
        "fr": "Terminez votre vérification d'identité pour lever les limites.",
        "nl": "Rond je snelle identiteitscontrole af om limieten op te heffen.",
        "pt": "Conclua a verificação de identidade para remover os limites.",
    },
    "merchant.kycResubmission.preheader": {
        "en": "We need one more thing to finish verifying you.",
        "de": "Wir benötigen noch eine Sache, um Ihre Verifizierung abzuschließen.",
        "es": "Necesitamos una cosa más para terminar tu verificación.",
        "fr": "Il nous manque un élément pour finaliser votre vérification.",
        "nl": "We hebben nog één ding nodig om je verificatie af te ronden.",
        "pt": "Precisamos de mais uma coisa para concluir a sua verificação.",
    },
    # conversion
    "merchant.autoConversion.preheader": {
        "en": "Your crypto was converted and paid out.",
        "de": "Ihre Kryptowährung wurde umgewandelt und ausgezahlt.",
        "es": "Tu cripto se convirtió y se pagó.",
        "fr": "Votre crypto a été convertie et versée.",
        "nl": "Je crypto is omgezet en uitbetaald.",
        "pt": "A sua cripto foi convertida e paga.",
    },
    "merchant.weeklyConversion.preheader": {
        "en": "Your conversions from the past week, summarized.",
        "de": "Ihre Umwandlungen der vergangenen Woche im Überblick.",
        "es": "Un resumen de tus conversiones de la última semana.",
        "fr": "Le récapitulatif de vos conversions de la semaine.",
        "nl": "Een overzicht van je conversies van afgelopen week.",
        "pt": "Um resumo das suas conversões da última semana.",
    },
    # customer receipt
    "customerPaymentConfirmation.preheader": {
        "en": "Your payment receipt is attached below.",
        "de": "Ihr Zahlungsbeleg ist unten angehängt.",
        "es": "Tu recibo de pago está adjunto abajo.",
        "fr": "Votre reçu de paiement est joint ci-dessous.",
        "nl": "Je betaalbewijs vind je hieronder in de bijlage.",
        "pt": "O seu recibo de pagamento está em anexo abaixo.",
    },
    "contributionThankYou.preheader": {
        "en": "Thank you — your contribution receipt is attached.",
        "de": "Vielen Dank — Ihr Beitragsbeleg ist angehängt.",
        "es": "Gracias — tu recibo de contribución está adjunto.",
        "fr": "Merci — votre reçu de contribution est joint.",
        "nl": "Bedankt — je bijdragebewijs zit in de bijlage.",
        "pt": "Obrigado — o recibo da sua contribuição está em anexo.",
    },
    # billing
    "merchant.weeklySummary.preheader": {
        "en": "Your payments, payouts and fees this week.",
        "de": "Ihre Zahlungen, Auszahlungen und Gebühren dieser Woche.",
        "es": "Tus pagos, cobros y comisiones de esta semana.",
        "fr": "Vos paiements, versements et frais de la semaine.",
        "nl": "Je betalingen, uitbetalingen en kosten van deze week.",
        "pt": "Os seus pagamentos, recebimentos e taxas desta semana.",
    },
    "merchant.invoice.preheader": {
        "en": "Your latest Dynopay invoice is ready to view.",
        "de": "Ihre aktuelle Dynopay-Rechnung ist verfügbar.",
        "es": "Tu última factura de Dynopay está lista.",
        "fr": "Votre dernière facture Dynopay est disponible.",
        "nl": "Je nieuwste Dynopay-factuur staat klaar.",
        "pt": "A sua última fatura Dynopay está disponível.",
    },
    "merchant.apiKey.preheader": {
        "en": "A new API key was created on your account.",
        "de": "In Ihrem Konto wurde ein neuer API-Schlüssel erstellt.",
        "es": "Se creó una nueva clave API en tu cuenta.",
        "fr": "Une nouvelle clé API a été créée sur votre compte.",
        "nl": "Er is een nieuwe API-sleutel op je account aangemaakt.",
        "pt": "Foi criada uma nova chave API na sua conta.",
    },
    "merchant.subscriptionCreated.custPreheader": {
        "en": "Your subscription is now active.",
        "de": "Ihr Abonnement ist jetzt aktiv.",
        "es": "Tu suscripción ya está activa.",
        "fr": "Votre abonnement est désormais actif.",
        "nl": "Je abonnement is nu actief.",
        "pt": "A sua subscrição está agora ativa.",
    },
    "merchant.subscriptionCreated.merchPreheader": {
        "en": "You have a new subscriber.",
        "de": "Sie haben einen neuen Abonnenten.",
        "es": "Tienes un nuevo suscriptor.",
        "fr": "Vous avez un nouvel abonné.",
        "nl": "Je hebt een nieuwe abonnee.",
        "pt": "Tem um novo subscritor.",
    },
    "merchant.subscriptionCancelled.custPreheader": {
        "en": "Your subscription has been cancelled.",
        "de": "Ihr Abonnement wurde gekündigt.",
        "es": "Tu suscripción se ha cancelado.",
        "fr": "Votre abonnement a été annulé.",
        "nl": "Je abonnement is opgezegd.",
        "pt": "A sua subscrição foi cancelada.",
    },
    "merchant.subscriptionCancelled.merchPreheader": {
        "en": "A subscriber cancelled their plan.",
        "de": "Ein Abonnent hat seinen Plan gekündigt.",
        "es": "Un suscriptor canceló su plan.",
        "fr": "Un abonné a annulé son forfait.",
        "nl": "Een abonnee heeft zijn abonnement opgezegd.",
        "pt": "Um subscritor cancelou o seu plano.",
    },
    "merchant.subscriptionPaymentFailed.custPreheader": {
        "en": "Your subscription payment didn't go through.",
        "de": "Ihre Abonnementzahlung war nicht erfolgreich.",
        "es": "El pago de tu suscripción no se completó.",
        "fr": "Le paiement de votre abonnement n'a pas abouti.",
        "nl": "Je abonnementsbetaling is mislukt.",
        "pt": "O pagamento da sua subscrição não foi concluído.",
    },
    "merchant.subscriptionPaymentFailed.merchPreheader": {
        "en": "A subscriber's payment failed.",
        "de": "Die Zahlung eines Abonnenten ist fehlgeschlagen.",
        "es": "Falló el pago de un suscriptor.",
        "fr": "Le paiement d'un abonné a échoué.",
        "nl": "De betaling van een abonnee is mislukt.",
        "pt": "O pagamento de um subscritor falhou.",
    },
    # link / campaign
    "merchant.paymentLinkCreated.preheader": {
        "en": "Your payment link is ready to share.",
        "de": "Ihr Zahlungslink ist bereit zum Teilen.",
        "es": "Tu enlace de pago está listo para compartir.",
        "fr": "Votre lien de paiement est prêt à partager.",
        "nl": "Je betaallink is klaar om te delen.",
        "pt": "O seu link de pagamento está pronto para partilhar.",
    },
    "merchant.crowdfundingCreated.preheader": {
        "en": "Your campaign is live and ready for contributions.",
        "de": "Ihre Kampagne ist live und bereit für Beiträge.",
        "es": "Tu campaña está activa y lista para recibir contribuciones.",
        "fr": "Votre campagne est en ligne et prête à recevoir des contributions.",
        "nl": "Je campagne is live en klaar voor bijdragen.",
        "pt": "A sua campanha está no ar e pronta para contribuições.",
    },
    "contributor.crowdfundingUpdate.preheader": {
        "en": "A new update from {{campaign}}.",
        "de": "Ein neues Update von {{campaign}}.",
        "es": "Una nueva actualización de {{campaign}}.",
        "fr": "Une nouvelle actualité de {{campaign}}.",
        "nl": "Een nieuwe update van {{campaign}}.",
        "pt": "Uma nova atualização de {{campaign}}.",
    },
    # payout digest
    "payoutDigest.preheaderActive": {
        "en": "Your payouts from the past week, summarized.",
        "de": "Ihre Auszahlungen der vergangenen Woche im Überblick.",
        "es": "Un resumen de tus cobros de la última semana.",
        "fr": "Le récapitulatif de vos versements de la semaine.",
        "nl": "Een overzicht van je uitbetalingen van afgelopen week.",
        "pt": "Um resumo dos seus recebimentos da última semana.",
    },
    "payoutDigest.preheaderQuiet": {
        "en": "A quick check-in on your account this week.",
        "de": "Ein kurzer Blick auf Ihr Konto in dieser Woche.",
        "es": "Un vistazo rápido a tu cuenta esta semana.",
        "fr": "Un point rapide sur votre compte cette semaine.",
        "nl": "Een korte update over je account deze week.",
        "pt": "Uma verificação rápida da sua conta esta semana.",
    },
}

# ── 4. Correctness copy (A2 + A4), all langs ────────────────────────────────
CORR = {
    # A4 — KYC = government ID + selfie/liveness only (no proof of address).
    "merchant.kycRequired.need1": {
        "en": "1. A government-issued photo ID",
        "de": "1. Ein amtlicher Lichtbildausweis",
        "es": "1. Un documento de identidad oficial con foto",
        "fr": "1. Une pièce d'identité officielle avec photo",
        "nl": "1. Een geldig identiteitsbewijs met foto",
        "pt": "1. Um documento de identificação com foto",
    },
    "merchant.kycRequired.need2": {
        "en": "2. A quick selfie for liveness",
        "de": "2. Ein kurzes Selfie zur Lebendprüfung",
        "es": "2. Un selfie rápido para la prueba de vida",
        "fr": "2. Un selfie rapide pour la détection du vivant",
        "nl": "2. Een snelle selfie voor de live-check",
        "pt": "2. Uma selfie rápida para a prova de vida",
    },
    "merchant.kycRequired.need3": {
        "en": "3. About 5 minutes",
        "de": "3. Etwa 5 Minuten",
        "es": "3. Unos 5 minutos",
        "fr": "3. Environ 5 minutes",
        "nl": "3. Ongeveer 5 minuten",
        "pt": "3. Cerca de 5 minutos",
    },
    "merchant.kycStarted.need1": {
        "en": "1. A government-issued photo ID",
        "de": "1. Ein amtlicher Lichtbildausweis",
        "es": "1. Un documento de identidad oficial con foto",
        "fr": "1. Une pièce d'identité officielle avec photo",
        "nl": "1. Een geldig identiteitsbewijs met foto",
        "pt": "1. Um documento de identificação com foto",
    },
    "merchant.kycStarted.need2": {
        "en": "2. A quick selfie for liveness",
        "de": "2. Ein kurzes Selfie zur Lebendprüfung",
        "es": "2. Un selfie rápido para la prueba de vida",
        "fr": "2. Un selfie rapide pour la détection du vivant",
        "nl": "2. Een snelle selfie voor de live-check",
        "pt": "2. Uma selfie rápida para a prova de vida",
    },
    "merchant.kycStarted.need3": {
        "en": "3. About 5 minutes",
        "de": "3. Etwa 5 Minuten",
        "es": "3. Unos 5 minutos",
        "fr": "3. Environ 5 minutes",
        "nl": "3. Ongeveer 5 minuten",
        "pt": "3. Cerca de 5 minutos",
    },
    # A2 — crypto subscriptions (not cards/banks).
    "merchant.subscriptionPaymentFailed.custSteps": {
        "en": "To keep your subscription active:<br />1. Open the secure payment link below<br />2. Make sure your wallet has enough balance, including network fees<br />3. Contact the merchant if you need a hand",
        "de": "So bleibt Ihr Abonnement aktiv:<br />1. Öffnen Sie den sicheren Zahlungslink unten<br />2. Stellen Sie sicher, dass Ihre Wallet genug Guthaben inkl. Netzwerkgebühren hat<br />3. Kontaktieren Sie den Händler, wenn Sie Hilfe brauchen",
        "es": "Para mantener activa tu suscripción:<br />1. Abre el enlace de pago seguro de abajo<br />2. Asegúrate de que tu monedero tenga saldo suficiente, incluidas las comisiones de red<br />3. Contacta con el comercio si necesitas ayuda",
        "fr": "Pour garder votre abonnement actif :<br />1. Ouvrez le lien de paiement sécurisé ci-dessous<br />2. Vérifiez que votre portefeuille a un solde suffisant, frais de réseau inclus<br />3. Contactez le marchand si vous avez besoin d'aide",
        "nl": "Zo houd je je abonnement actief:<br />1. Open de beveiligde betaallink hieronder<br />2. Zorg dat je wallet genoeg saldo heeft, inclusief netwerkkosten<br />3. Neem contact op met de verkoper als je hulp nodig hebt",
        "pt": "Para manter a subscrição ativa:<br />1. Abra o link de pagamento seguro abaixo<br />2. Confirme que a sua carteira tem saldo suficiente, incluindo taxas de rede<br />3. Contacte o comerciante se precisar de ajuda",
    },
    "merchant.subscriptionPaymentFailed.custCta": {
        "en": "Complete payment",
        "de": "Zahlung abschließen",
        "es": "Completar pago",
        "fr": "Finaliser le paiement",
        "nl": "Betaling voltooien",
        "pt": "Concluir pagamento",
    },
    "merchant.subscriptionCreated.custOutro": {
        "en": "Each billing cycle, we'll send you a secure link to pay in crypto. You can cancel anytime.",
        "de": "Zu jedem Abrechnungszeitraum senden wir Ihnen einen sicheren Link zur Zahlung in Krypto. Sie können jederzeit kündigen.",
        "es": "En cada ciclo de facturación te enviaremos un enlace seguro para pagar en cripto. Puedes cancelar cuando quieras.",
        "fr": "À chaque cycle de facturation, nous vous enverrons un lien sécurisé pour payer en crypto. Vous pouvez annuler à tout moment.",
        "nl": "Bij elke factuurcyclus sturen we je een beveiligde link om in crypto te betalen. Je kunt altijd opzeggen.",
        "pt": "Em cada ciclo de faturação, enviamos-lhe um link seguro para pagar em cripto. Pode cancelar quando quiser.",
    },
}


def set_path(d: dict, dotted: str, value: str):
    parts = dotted.split(".")
    node = d
    for p in parts[:-1]:
        if p not in node or not isinstance(node[p], dict):
            node[p] = {}
        node = node[p]
    node[parts[-1]] = value


def walk_subjects(node):
    """Yield (parent_dict, leaf_key) for every subject-ish leaf string."""
    for k, v in list(node.items()):
        if isinstance(v, dict):
            yield from walk_subjects(v)
        elif isinstance(v, str) and is_subject_key(k):
            yield node, k


EXPLICIT_SUBJECT_PATHS = set(SUBJECTS.keys())


def main():
    for lang in LANGS:
        fp = LOC / lang / "emails.json"
        data = json.loads(fp.read_text(encoding="utf-8"))

        # 1. mechanical subject house-style on every subject-ish leaf
        for parent, leaf in walk_subjects(data):
            parent[leaf] = mech_subject(parent[leaf])

        # 2. explicit reworded subjects
        for path, tr in SUBJECTS.items():
            if lang in tr:
                set_path(data, path, tr[lang])

        # 3. preheaders (fallback to en if a lang missing)
        for path, tr in PRE.items():
            set_path(data, path, tr.get(lang, tr["en"]))

        # 4a. correctness copy
        for path, tr in CORR.items():
            set_path(data, path, tr.get(lang, tr["en"]))

        # 4b. strip leading emoji from welcome.promo (all langs)
        promo = data.get("merchant", {}).get("welcome", {}).get("promo")
        if isinstance(promo, str):
            data["merchant"]["welcome"]["promo"] = promo.replace("🎉 ", "").replace("🎉", "").strip()

        fp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"{lang}: written")

    print("done")


if __name__ == "__main__":
    main()
