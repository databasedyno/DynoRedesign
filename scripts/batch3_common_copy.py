#!/usr/bin/env python3
"""
Batch 3 — Common Copy re-author + 6-language translation.

Re-authors the shared, cross-surface strings in common.json into the warm,
benefit-led, concise Dynopay voice (matching Batches 1 & 2) and applies the
translations to all 6 locales. Deep-sets only the touched dotted paths so
untouched keys + structure are preserved byte-for-byte elsewhere.

Deliberately EXCLUDED (kept verbatim):
  - Legal `terms.*` and `aml.*` clause bodies/titles (rewording legal text is a
    compliance risk).
  - `currency.*` display names (standard names, no tone).
"""

import json
import os

LOCALES = ["en", "pt", "es", "fr", "de", "nl"]
BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

# path -> { lang: value }
DATA = {
    # ── Generic / system ────────────────────────────────────────────────
    "homeTagline": {
        "en": "Manage crypto payments with confidence — all in one place.",
        "pt": "Faça a gestão dos seus pagamentos em cripto com confiança — tudo num só lugar.",
        "es": "Gestiona tus pagos en cripto con confianza — todo en un solo lugar.",
        "fr": "Gérez vos paiements en crypto en toute confiance — tout au même endroit.",
        "de": "Verwalte Krypto-Zahlungen mit Zuversicht — alles an einem Ort.",
        "nl": "Beheer je cryptobetalingen met vertrouwen — alles op één plek.",
    },
    "copiedToClipboard": {
        "en": "Copied to clipboard",
        "pt": "Copiado para a área de transferência",
        "es": "Copiado al portapapeles",
        "fr": "Copié dans le presse-papiers",
        "de": "In die Zwischenablage kopiert",
        "nl": "Gekopieerd naar klembord",
    },
    "unexpectedErrorRefresh": {
        "en": "Something didn't load right — a quick refresh usually fixes it.",
        "pt": "Algo não carregou bem — atualizar a página costuma resolver.",
        "es": "Algo no cargó bien — actualizar la página suele solucionarlo.",
        "fr": "Un souci de chargement — un rafraîchissement règle souvent le problème.",
        "de": "Etwas wurde nicht richtig geladen — ein kurzes Neuladen hilft meist.",
        "nl": "Er ging iets mis met laden — even verversen lost dit meestal op.",
    },
    "noDataToShow": {
        "en": "Nothing to show here yet.",
        "pt": "Ainda não há nada para mostrar aqui.",
        "es": "Aún no hay nada que mostrar aquí.",
        "fr": "Rien à afficher ici pour le moment.",
        "de": "Hier gibt es noch nichts zu sehen.",
        "nl": "Hier is nog niets te zien.",
    },
    "verifyEmailBanner": {
        "en": "Verify your email to unlock every feature.",
        "pt": "Verifique o seu e-mail para desbloquear todas as funcionalidades.",
        "es": "Verifica tu correo para desbloquear todas las funciones.",
        "fr": "Vérifiez votre e-mail pour débloquer toutes les fonctionnalités.",
        "de": "Bestätige deine E-Mail, um alle Funktionen freizuschalten.",
        "nl": "Verifieer je e-mail om alle functies te ontgrendelen.",
    },
    "paymentReceived": {
        "en": "Payment received",
        "pt": "Pagamento recebido",
        "es": "Pago recibido",
        "fr": "Paiement reçu",
        "de": "Zahlung erhalten",
        "nl": "Betaling ontvangen",
    },
    "returnHome": {
        "en": "Return home",
        "pt": "Voltar ao início",
        "es": "Volver al inicio",
        "fr": "Retour à l'accueil",
        "de": "Zurück zur Startseite",
        "nl": "Terug naar start",
    },
    "tryAgain": {
        "en": "Try again",
        "pt": "Tentar novamente",
        "es": "Intentar de nuevo",
        "fr": "Réessayer",
        "de": "Erneut versuchen",
        "nl": "Opnieuw proberen",
    },
    "refreshPage": {
        "en": "Refresh page",
        "pt": "Atualizar página",
        "es": "Actualizar página",
        "fr": "Actualiser la page",
        "de": "Seite neu laden",
        "nl": "Pagina verversen",
    },
    "verifyingPayment": {
        "en": "Verifying your payment…",
        "pt": "A verificar o seu pagamento…",
        "es": "Verificando tu pago…",
        "fr": "Vérification de votre paiement…",
        "de": "Zahlung wird überprüft…",
        "nl": "Je betaling wordt gecontroleerd…",
    },
    "paymentSuccessful": {
        "en": "Payment successful",
        "pt": "Pagamento concluído",
        "es": "Pago realizado",
        "fr": "Paiement réussi",
        "de": "Zahlung erfolgreich",
        "nl": "Betaling geslaagd",
    },
    "paymentProcessedSuccessfully": {
        "en": "Your payment went through — you're all set.",
        "pt": "O seu pagamento foi concluído — está tudo pronto.",
        "es": "Tu pago se realizó — todo listo.",
        "fr": "Votre paiement est passé — tout est en ordre.",
        "de": "Deine Zahlung ist durch — alles erledigt.",
        "nl": "Je betaling is gelukt — je bent helemaal klaar.",
    },
    "paymentFailed": {
        "en": "Payment failed",
        "pt": "Pagamento falhou",
        "es": "El pago falló",
        "fr": "Échec du paiement",
        "de": "Zahlung fehlgeschlagen",
        "nl": "Betaling mislukt",
    },
    "paymentFailedBody": {
        "en": "Your payment couldn't be processed. Please try again, or reach out to support.",
        "pt": "Não foi possível processar o seu pagamento. Tente novamente ou contacte o suporte.",
        "es": "No se pudo procesar tu pago. Inténtalo de nuevo o contacta con soporte.",
        "fr": "Votre paiement n'a pas pu être traité. Réessayez ou contactez le support.",
        "de": "Deine Zahlung konnte nicht verarbeitet werden. Bitte versuche es erneut oder wende dich an den Support.",
        "nl": "Je betaling kon niet worden verwerkt. Probeer het opnieuw of neem contact op met support.",
    },
    "scanQrPayWallet": {
        "en": "Scan the QR code to pay this wallet directly",
        "pt": "Leia o código QR para pagar diretamente a esta carteira",
        "es": "Escanea el código QR para pagar directamente a esta billetera",
        "fr": "Scannez le QR code pour payer directement ce portefeuille",
        "de": "Scanne den QR-Code, um direkt an diese Wallet zu zahlen",
        "nl": "Scan de QR-code om direct naar deze wallet te betalen",
    },
    "whatIsPayoutWallet": {
        "en": "What's a payout wallet?",
        "pt": "O que é uma carteira de recebimento?",
        "es": "¿Qué es una billetera de cobros?",
        "fr": "Qu'est-ce qu'un portefeuille de versement ?",
        "de": "Was ist eine Auszahlungs-Wallet?",
        "nl": "Wat is een uitbetalingswallet?",
    },
    "redirectToCompletePayment": {
        "en": "We'll take you to the next step to complete your payment.",
        "pt": "Vamos levá-lo ao passo seguinte para concluir o pagamento.",
        "es": "Te llevaremos al siguiente paso para completar tu pago.",
        "fr": "Nous vous emmenons à l'étape suivante pour finaliser votre paiement.",
        "de": "Wir bringen dich zum nächsten Schritt, um deine Zahlung abzuschließen.",
        "nl": "We brengen je naar de volgende stap om je betaling af te ronden.",
    },
    "proceedToBankApp": {
        "en": "Open your bank app to finish this transfer",
        "pt": "Abra a app do seu banco para concluir esta transferência",
        "es": "Abre la app de tu banco para completar esta transferencia",
        "fr": "Ouvrez l'app de votre banque pour finaliser ce virement",
        "de": "Öffne deine Banking-App, um diese Überweisung abzuschließen",
        "nl": "Open je bank-app om deze overboeking af te ronden",
    },
    "completeFromMpesa": {
        "en": "Finish this payment from your M-PESA app.",
        "pt": "Conclua este pagamento a partir da sua app M-PESA.",
        "es": "Completa este pago desde tu app M-PESA.",
        "fr": "Terminez ce paiement depuis votre app M-PESA.",
        "de": "Schließe diese Zahlung in deiner M-PESA-App ab.",
        "nl": "Rond deze betaling af in je M-PESA-app.",
    },
    "chooseBankToBegin": {
        "en": "Pick your bank to get started",
        "pt": "Escolha o seu banco para começar",
        "es": "Elige tu banco para empezar",
        "fr": "Choisissez votre banque pour commencer",
        "de": "Wähle deine Bank, um zu starten",
        "nl": "Kies je bank om te beginnen",
    },
    "enterPaymentCodeIfNecessary": {
        "en": "Enter the payment code if prompted to complete payment.",
        "pt": "Introduza o código de pagamento, se solicitado, para concluir.",
        "es": "Introduce el código de pago si se te solicita para completar el pago.",
        "fr": "Saisissez le code de paiement si demandé pour finaliser.",
        "de": "Gib bei Aufforderung den Zahlungscode ein, um abzuschließen.",
        "nl": "Voer de betaalcode in indien gevraagd om af te ronden.",
    },
    "madeBankTransfer": {
        "en": "I've made this bank transfer",
        "pt": "Já fiz esta transferência bancária",
        "es": "Ya hice esta transferencia bancaria",
        "fr": "J'ai effectué ce virement bancaire",
        "de": "Ich habe diese Überweisung getätigt",
        "nl": "Ik heb deze overboeking gedaan",
    },
    "completedPayment": {
        "en": "I've completed this payment",
        "pt": "Já concluí este pagamento",
        "es": "Ya completé este pago",
        "fr": "J'ai finalisé ce paiement",
        "de": "Ich habe diese Zahlung abgeschlossen",
        "nl": "Ik heb deze betaling voltooid",
    },

    # ── Checkout ─────────────────────────────────────────────────────────
    "checkout.subtitleDefault": {
        "en": "You're one step away from completing your order.",
        "pt": "Está a um passo de concluir a sua encomenda.",
        "es": "Estás a un paso de completar tu pedido.",
        "fr": "Vous êtes à une étape de finaliser votre commande.",
        "de": "Nur noch ein Schritt bis zum Abschluss deiner Bestellung.",
        "nl": "Je bent één stap verwijderd van het afronden van je bestelling.",
    },
    "checkout.transactionIdNote": {
        "en": "Want to finish later? Save your Transaction ID:",
        "pt": "Quer concluir mais tarde? Guarde o seu ID de transação:",
        "es": "¿Quieres terminar más tarde? Guarda tu ID de transacción:",
        "fr": "Envie de finir plus tard ? Notez votre ID de transaction :",
        "de": "Später fertig machen? Speichere deine Transaktions-ID:",
        "nl": "Later afronden? Bewaar je transactie-ID:",
    },
    "checkout.validPaymentLinkRequired": {
        "en": "This checkout needs a valid payment link to continue.",
        "pt": "Este checkout precisa de um link de pagamento válido para continuar.",
        "es": "Este pago necesita un enlace de pago válido para continuar.",
        "fr": "Ce paiement nécessite un lien de paiement valide pour continuer.",
        "de": "Für diesen Checkout wird ein gültiger Zahlungslink benötigt.",
        "nl": "Deze checkout heeft een geldige betaallink nodig om door te gaan.",
    },
    "checkout.paymentLinkExpired": {
        "en": "This payment link has expired — please ask the merchant for a fresh one.",
        "pt": "Este link de pagamento expirou — peça um novo ao comerciante.",
        "es": "Este enlace de pago caducó — pide uno nuevo al comercio.",
        "fr": "Ce lien de paiement a expiré — demandez-en un nouveau au marchand.",
        "de": "Dieser Zahlungslink ist abgelaufen — bitte den Händler um einen neuen.",
        "nl": "Deze betaallink is verlopen — vraag de verkoper om een nieuwe.",
    },
    "checkout.secureTransfer": {
        "en": "Secure bank transfer with automatic confirmation — no need to notify us.",
        "pt": "Transferência bancária segura com confirmação automática — não precisa de nos avisar.",
        "es": "Transferencia bancaria segura con confirmación automática — no necesitas avisarnos.",
        "fr": "Virement bancaire sécurisé avec confirmation automatique — inutile de nous prévenir.",
        "de": "Sichere Banküberweisung mit automatischer Bestätigung — du musst uns nicht benachrichtigen.",
        "nl": "Veilige bankoverboeking met automatische bevestiging — je hoeft ons niets te melden.",
    },
    "checkout.accountUnique": {
        "en": "This account number is unique to this transaction.",
        "pt": "Este número de conta é único para esta transação.",
        "es": "Este número de cuenta es único para esta transacción.",
        "fr": "Ce numéro de compte est propre à cette transaction.",
        "de": "Diese Kontonummer gilt nur für diese Transaktion.",
        "nl": "Dit rekeningnummer is uniek voor deze transactie.",
    },
    "checkout.madePayment": {
        "en": "I've made the payment",
        "pt": "Já fiz o pagamento",
        "es": "Ya hice el pago",
        "fr": "J'ai effectué le paiement",
        "de": "Ich habe die Zahlung getätigt",
        "nl": "Ik heb de betaling gedaan",
    },
    "checkout.noAccountToCopy": {
        "en": "No account number to copy yet.",
        "pt": "Ainda não há número de conta para copiar.",
        "es": "Aún no hay número de cuenta para copiar.",
        "fr": "Aucun numéro de compte à copier pour l'instant.",
        "de": "Noch keine Kontonummer zum Kopieren.",
        "nl": "Nog geen rekeningnummer om te kopiëren.",
    },
    "checkout.paymentNotVerified": {
        "en": "We couldn't verify that payment.",
        "pt": "Não conseguimos verificar esse pagamento.",
        "es": "No pudimos verificar ese pago.",
        "fr": "Nous n'avons pas pu vérifier ce paiement.",
        "de": "Wir konnten diese Zahlung nicht bestätigen.",
        "nl": "We konden die betaling niet verifiëren.",
    },
    "checkout.subtitleContributionDefault": {
        "en": "Chip in with crypto — every contribution counts.",
        "pt": "Contribua com cripto — cada contributo conta.",
        "es": "Aporta con cripto — cada contribución cuenta.",
        "fr": "Participez en crypto — chaque contribution compte.",
        "de": "Trag mit Krypto bei — jeder Beitrag zählt.",
        "nl": "Draag bij met crypto — elke bijdrage telt.",
    },

    # ── Crypto ───────────────────────────────────────────────────────────
    "crypto.sendOnlyWarning": {
        "en": "Send only {{crypto}} on the {{network}} network to this address — anything else will be lost.",
        "pt": "Envie apenas {{crypto}} na rede {{network}} para este endereço — qualquer outra coisa será perdida.",
        "es": "Envía solo {{crypto}} en la red {{network}} a esta dirección — cualquier otra cosa se perderá.",
        "fr": "Envoyez uniquement des {{crypto}} sur le réseau {{network}} à cette adresse — tout le reste sera perdu.",
        "de": "Sende nur {{crypto}} im {{network}}-Netzwerk an diese Adresse — alles andere geht verloren.",
        "nl": "Stuur alleen {{crypto}} via het {{network}}-netwerk naar dit adres — al het andere gaat verloren.",
    },
    "crypto.sendOnlyWarningSimple": {
        "en": "Send only {{crypto}} to this address — anything else will be lost.",
        "pt": "Envie apenas {{crypto}} para este endereço — qualquer outra coisa será perdida.",
        "es": "Envía solo {{crypto}} a esta dirección — cualquier otra cosa se perderá.",
        "fr": "Envoyez uniquement des {{crypto}} à cette adresse — tout le reste sera perdu.",
        "de": "Sende nur {{crypto}} an diese Adresse — alles andere geht verloren.",
        "nl": "Stuur alleen {{crypto}} naar dit adres — al het andere gaat verloren.",
    },
    "crypto.paymentDetected": {
        "en": "Payment detected — waiting for confirmation…",
        "pt": "Pagamento detetado — a aguardar confirmação…",
        "es": "Pago detectado — esperando confirmación…",
        "fr": "Paiement détecté — en attente de confirmation…",
        "de": "Zahlung erkannt — warte auf Bestätigung…",
        "nl": "Betaling gedetecteerd — wachten op bevestiging…",
    },
    "crypto.paymentDetectedToast": {
        "en": "Payment detected! Waiting for blockchain confirmation…",
        "pt": "Pagamento detetado! A aguardar confirmação na blockchain…",
        "es": "¡Pago detectado! Esperando confirmación en la blockchain…",
        "fr": "Paiement détecté ! En attente de confirmation sur la blockchain…",
        "de": "Zahlung erkannt! Warte auf Bestätigung in der Blockchain…",
        "nl": "Betaling gedetecteerd! Wachten op bevestiging op de blockchain…",
    },
    "crypto.paymentConfirmed": {
        "en": "Payment confirmed!",
        "pt": "Pagamento confirmado!",
        "es": "¡Pago confirmado!",
        "fr": "Paiement confirmé !",
        "de": "Zahlung bestätigt!",
        "nl": "Betaling bevestigd!",
    },
    "crypto.noCurrenciesConfigured": {
        "en": "No currencies set up yet — please contact support.",
        "pt": "Ainda não há moedas configuradas — contacte o suporte.",
        "es": "Aún no hay monedas configuradas — contacta con soporte.",
        "fr": "Aucune devise configurée pour l'instant — contactez le support.",
        "de": "Noch keine Währungen eingerichtet — bitte den Support kontaktieren.",
        "nl": "Nog geen valuta ingesteld — neem contact op met support.",
    },
    "crypto.noCryptoAvailable": {
        "en": "No cryptocurrencies available for this payment.",
        "pt": "Nenhuma criptomoeda disponível para este pagamento.",
        "es": "No hay criptomonedas disponibles para este pago.",
        "fr": "Aucune cryptomonnaie disponible pour ce paiement.",
        "de": "Keine Kryptowährungen für diese Zahlung verfügbar.",
        "nl": "Geen cryptovaluta beschikbaar voor deze betaling.",
    },
    "crypto.gettingRates": {
        "en": "Fetching live exchange rates…",
        "pt": "A obter as taxas de câmbio em tempo real…",
        "es": "Obteniendo tipos de cambio en tiempo real…",
        "fr": "Récupération des taux de change en direct…",
        "de": "Live-Wechselkurse werden abgerufen…",
        "nl": "Live wisselkoersen ophalen…",
    },
    "crypto.creatingPayment": {
        "en": "Setting up your payment…",
        "pt": "A preparar o seu pagamento…",
        "es": "Preparando tu pago…",
        "fr": "Préparation de votre paiement…",
        "de": "Deine Zahlung wird vorbereitet…",
        "nl": "Je betaling wordt klaargezet…",
    },
    "crypto.monitoringPayment": {
        "en": "Watching for your incoming payment…",
        "pt": "A aguardar o seu pagamento…",
        "es": "Atentos a tu pago entrante…",
        "fr": "En attente de votre paiement entrant…",
        "de": "Wir warten auf deinen Zahlungseingang…",
        "nl": "We letten op je inkomende betaling…",
    },
    "crypto.paymentExpired": {
        "en": "This payment window has closed — please start again.",
        "pt": "Esta janela de pagamento fechou — comece novamente.",
        "es": "La ventana de pago se cerró — vuelve a empezar.",
        "fr": "La fenêtre de paiement est fermée — veuillez recommencer.",
        "de": "Das Zahlungsfenster ist geschlossen — bitte starte erneut.",
        "nl": "Dit betaalvenster is gesloten — begin opnieuw.",
    },
    "crypto.paymentFailed": {
        "en": "We couldn't process that payment — please try again.",
        "pt": "Não conseguimos processar esse pagamento — tente novamente.",
        "es": "No pudimos procesar ese pago — inténtalo de nuevo.",
        "fr": "Nous n'avons pas pu traiter ce paiement — réessayez.",
        "de": "Wir konnten diese Zahlung nicht verarbeiten — bitte versuche es erneut.",
        "nl": "We konden die betaling niet verwerken — probeer het opnieuw.",
    },
    "crypto.addressCopied": {
        "en": "Address copied!",
        "pt": "Endereço copiado!",
        "es": "¡Dirección copiada!",
        "fr": "Adresse copiée !",
        "de": "Adresse kopiert!",
        "nl": "Adres gekopieerd!",
    },
    "crypto.amountCopied": {
        "en": "Amount copied!",
        "pt": "Valor copiado!",
        "es": "¡Importe copiado!",
        "fr": "Montant copié !",
        "de": "Betrag kopiert!",
        "nl": "Bedrag gekopieerd!",
    },
    "crypto.memoWarning": {
        "en": "You must include this memo/tag, or your funds may be lost.",
        "pt": "Tem de incluir este memo/tag, ou os seus fundos podem ser perdidos.",
        "es": "Debes incluir este memo/tag, o tus fondos podrían perderse.",
        "fr": "Vous devez inclure ce mémo/tag, sinon vos fonds pourraient être perdus.",
        "de": "Du musst dieses Memo/Tag angeben, sonst können deine Gelder verloren gehen.",
        "nl": "Voeg deze memo/tag toe, anders kunnen je fondsen verloren gaan.",
    },
    "crypto.memoCopied": {
        "en": "Memo/tag copied!",
        "pt": "Memo/tag copiado!",
        "es": "¡Memo/tag copiado!",
        "fr": "Mémo/tag copié !",
        "de": "Memo/Tag kopiert!",
        "nl": "Memo/tag gekopieerd!",
    },

    # ── Underpayment / Overpayment ──────────────────────────────────────
    "underpayment.subtitle": {
        "en": "Almost there — just finish the remaining balance.",
        "pt": "Quase lá — só falta concluir o valor restante.",
        "es": "Casi listo — solo completa el saldo restante.",
        "fr": "Presque terminé — il ne reste que le solde à régler.",
        "de": "Fast geschafft — zahle nur noch den Restbetrag.",
        "nl": "Bijna klaar — rond alleen het resterende bedrag af.",
    },
    "underpayment.graceWarning": {
        "en": "Pay the rest within {{minutes}} minutes to keep the same address.",
        "pt": "Pague o restante em {{minutes}} minutos para manter o mesmo endereço.",
        "es": "Paga el resto en {{minutes}} minutos para mantener la misma dirección.",
        "fr": "Payez le reste sous {{minutes}} minutes pour conserver la même adresse.",
        "de": "Zahle den Rest innerhalb von {{minutes}} Minuten, um dieselbe Adresse zu behalten.",
        "nl": "Betaal de rest binnen {{minutes}} minuten om hetzelfde adres te houden.",
    },
    "overpayment.subtitle": {
        "en": "Thanks — you sent a little extra.",
        "pt": "Obrigado — enviou um pouco a mais.",
        "es": "Gracias — enviaste un poco de más.",
        "fr": "Merci — vous avez envoyé un peu trop.",
        "de": "Danke — du hast etwas zu viel gesendet.",
        "nl": "Bedankt — je hebt iets te veel gestuurd.",
    },
    "overpayment.refundNotice": {
        "en": "The extra will be refunded to your wallet at the store you paid.",
        "pt": "O valor a mais será reembolsado na sua carteira da loja onde pagou.",
        "es": "El excedente se reembolsará a tu billetera en la tienda donde pagaste.",
        "fr": "Le surplus sera remboursé sur votre portefeuille de la boutique où vous avez payé.",
        "de": "Der Mehrbetrag wird deiner Wallet im Shop erstattet, in dem du bezahlt hast.",
        "nl": "Het extra bedrag wordt terugbetaald naar je wallet bij de winkel waar je betaalde.",
    },

    # ── Expired / Failed ────────────────────────────────────────────────
    "expired.message": {
        "en": "This payment link has expired. Ask the merchant for a fresh one to continue.",
        "pt": "Este link de pagamento expirou. Peça um novo ao comerciante para continuar.",
        "es": "Este enlace de pago caducó. Pide uno nuevo al comercio para continuar.",
        "fr": "Ce lien de paiement a expiré. Demandez-en un nouveau au marchand pour continuer.",
        "de": "Dieser Zahlungslink ist abgelaufen. Bitte den Händler um einen neuen, um fortzufahren.",
        "nl": "Deze betaallink is verlopen. Vraag de verkoper om een nieuwe om door te gaan.",
    },
    "failed.message": {
        "en": "We hit a snag processing your payment. Please try again, or contact support if it keeps happening.",
        "pt": "Tivemos um problema ao processar o seu pagamento. Tente novamente ou contacte o suporte se persistir.",
        "es": "Tuvimos un problema al procesar tu pago. Inténtalo de nuevo o contacta con soporte si continúa.",
        "fr": "Un souci est survenu lors du traitement de votre paiement. Réessayez ou contactez le support si cela persiste.",
        "de": "Beim Verarbeiten deiner Zahlung gab es ein Problem. Versuche es erneut oder wende dich an den Support, falls es weiter auftritt.",
        "nl": "Er ging iets mis bij het verwerken van je betaling. Probeer het opnieuw of neem contact op met support als het blijft gebeuren.",
    },

    # ── Success ─────────────────────────────────────────────────────────
    "success.paymentSuccessful": {
        "en": "Payment successful",
        "pt": "Pagamento concluído",
        "es": "Pago realizado",
        "fr": "Paiement réussi",
        "de": "Zahlung erfolgreich",
        "nl": "Betaling geslaagd",
    },
    "success.saveForRecords": {
        "en": "Keep this for your records",
        "pt": "Guarde isto para os seus registos",
        "es": "Guarda esto para tus registros",
        "fr": "Conservez ceci pour vos archives",
        "de": "Bewahre dies für deine Unterlagen auf",
        "nl": "Bewaar dit voor je administratie",
    },
    "success.thankYou": {
        "en": "Thanks for your payment",
        "pt": "Obrigado pelo seu pagamento",
        "es": "Gracias por tu pago",
        "fr": "Merci pour votre paiement",
        "de": "Danke für deine Zahlung",
        "nl": "Bedankt voor je betaling",
    },
    "success.transferPending": {
        "en": "If you've sent the transfer, you're all set — we'll confirm the moment it arrives.",
        "pt": "Se já fez a transferência, está tudo pronto — vamos confirmar assim que chegar.",
        "es": "Si ya hiciste la transferencia, todo listo — confirmaremos en cuanto llegue.",
        "fr": "Si vous avez envoyé le virement, tout est en ordre — nous confirmerons dès son arrivée.",
        "de": "Wenn du die Überweisung gesendet hast, ist alles erledigt — wir bestätigen, sobald sie eintrifft.",
        "nl": "Als je de overboeking hebt verstuurd, ben je klaar — we bevestigen zodra deze binnen is.",
    },
    "success.donationThanks": {
        "en": "Thank you for your donation!",
        "pt": "Obrigado pela sua doação!",
        "es": "¡Gracias por tu donación!",
        "fr": "Merci pour votre don !",
        "de": "Danke für deine Spende!",
        "nl": "Bedankt voor je donatie!",
    },
    "success.donationConfirmed": {
        "en": "Your donation is in — thank you!",
        "pt": "A sua doação foi registada — obrigado!",
        "es": "Tu donación se registró — ¡gracias!",
        "fr": "Votre don est enregistré — merci !",
        "de": "Deine Spende ist eingegangen — danke!",
        "nl": "Je donatie is binnen — bedankt!",
    },

    # ── Donation ────────────────────────────────────────────────────────
    "donation.chooseAmount": {
        "en": "Pick an amount",
        "pt": "Escolha um valor",
        "es": "Elige un importe",
        "fr": "Choisissez un montant",
        "de": "Wähle einen Betrag",
        "nl": "Kies een bedrag",
    },
    "donation.minAmountError": {
        "en": "The minimum donation is {{amount}}.",
        "pt": "A doação mínima é {{amount}}.",
        "es": "La donación mínima es {{amount}}.",
        "fr": "Le don minimum est de {{amount}}.",
        "de": "Die Mindestspende beträgt {{amount}}.",
        "nl": "De minimale donatie is {{amount}}.",
    },
    "donation.enterAmount": {
        "en": "Choose or enter a donation amount to continue.",
        "pt": "Escolha ou introduza um valor de doação para continuar.",
        "es": "Elige o introduce un importe de donación para continuar.",
        "fr": "Choisissez ou saisissez un montant de don pour continuer.",
        "de": "Wähle oder gib einen Spendenbetrag ein, um fortzufahren.",
        "nl": "Kies of voer een donatiebedrag in om door te gaan.",
    },
    "donation.secureNote": {
        "en": "Secure crypto payment — you'll choose a coin on the next step.",
        "pt": "Pagamento seguro em cripto — escolherá a moeda no passo seguinte.",
        "es": "Pago seguro en cripto — elegirás la moneda en el siguiente paso.",
        "fr": "Paiement crypto sécurisé — vous choisirez une cryptomonnaie à l'étape suivante.",
        "de": "Sichere Krypto-Zahlung — die Coin wählst du im nächsten Schritt.",
        "nl": "Veilige cryptobetaling — je kiest een coin bij de volgende stap.",
    },
    "donation.startError": {
        "en": "We couldn't start your donation — please try again.",
        "pt": "Não conseguimos iniciar a sua doação — tente novamente.",
        "es": "No pudimos iniciar tu donación — inténtalo de nuevo.",
        "fr": "Nous n'avons pas pu démarrer votre don — réessayez.",
        "de": "Wir konnten deine Spende nicht starten — bitte versuche es erneut.",
        "nl": "We konden je donatie niet starten — probeer het opnieuw.",
    },

    # ── Customers (validation) ──────────────────────────────────────────
    "customers.validAmountError": {
        "en": "Please enter a valid amount greater than zero.",
        "pt": "Introduza um valor válido superior a zero.",
        "es": "Introduce un importe válido mayor que cero.",
        "fr": "Saisissez un montant valide supérieur à zéro.",
        "de": "Bitte gib einen gültigen Betrag größer als null ein.",
        "nl": "Voer een geldig bedrag groter dan nul in.",
    },
    "customers.descriptionRequired": {
        "en": "Please add a description.",
        "pt": "Adicione uma descrição.",
        "es": "Añade una descripción.",
        "fr": "Ajoutez une description.",
        "de": "Bitte füge eine Beschreibung hinzu.",
        "nl": "Voeg een omschrijving toe.",
    },
    "customers.walletOpFailed": {
        "en": "We couldn't complete that wallet operation.",
        "pt": "Não conseguimos concluir essa operação na carteira.",
        "es": "No pudimos completar esa operación de billetera.",
        "fr": "Nous n'avons pas pu effectuer cette opération de portefeuille.",
        "de": "Wir konnten diesen Wallet-Vorgang nicht abschließen.",
        "nl": "We konden die wallet-bewerking niet voltooien.",
    },

    # ── Settings ────────────────────────────────────────────────────────
    "settingsPage.noCompanies": {
        "en": "Create your first company to set up payments, webhooks, and branding.",
        "pt": "Crie a sua primeira empresa para configurar pagamentos, webhooks e a marca.",
        "es": "Crea tu primera empresa para configurar pagos, webhooks y tu marca.",
        "fr": "Créez votre première entreprise pour configurer paiements, webhooks et image de marque.",
        "de": "Erstelle dein erstes Unternehmen, um Zahlungen, Webhooks und Branding einzurichten.",
        "nl": "Maak je eerste bedrijf aan om betalingen, webhooks en branding in te stellen.",
    },
}


def set_by_path(obj: dict, dotted: str, value: str) -> None:
    parts = dotted.split(".")
    cur = obj
    for p in parts[:-1]:
        cur = cur[p]
    cur[parts[-1]] = value


def main() -> None:
    for lang in LOCALES:
        path = os.path.join(BASE, lang, "common.json")
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        changed = 0
        for dotted, values in DATA.items():
            if lang in values:
                set_by_path(data, dotted, values[lang])
                changed += 1
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}: updated {changed} keys -> {path}")


if __name__ == "__main__":
    main()
