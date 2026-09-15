#!/usr/bin/env python3
"""Add the dashboard command-centre i18n keys (EN + 5 locales) to dashboardLayout.json. Idempotent."""
import json, os

ROOT = "/app/langs/locales"

EN = {
    "rangeToday": "Today",
    "command": {
        "justNow": "just now",
        "minAgo": "{{count}} min ago",
        "hrAgo": "{{count}} h ago",
        "underMinute": "<1 min",
        "minutes": "{{count}} min",
        "days": "{{count}} d",
        "pulseConfirming": "{{count}} confirming",
        "pulseOpen": "{{count}} checkouts open",
        "pulseQuiet": "Quiet",
        "lastPaid": "last paid {{when}}",
        "noPaymentsYet": "no payments yet",
        "needsAttention": "Needs attention",
        "showAll": "Show all ({{count}} more)",
        "showLess": "Show less",
        "kycDays": "Verify your identity within {{count}} days to keep processing payments",
        "mfaRequired": "Two-step verification is now required to keep using Dynopay",
        "mfaDays": "Two-step verification becomes required in {{count}} days",
        "setUp": "Set up",
        "walletFrozenUntil": "Payout-wallet changes are frozen until {{until}} after a security reset",
        "walletFrozen": "Payout-wallet changes are frozen after a security reset",
        "viewSecurity": "View security",
        "noPassword": "You sign in with a one-time code — set a password to sign in instantly",
        "underpaid": "{{count}} underpaid payments are waiting for your decision",
        "review": "Review",
        "view": "View",
        "confirmingStale": "{{count}} payments have been confirming for over an hour",
        "expiredToday": "{{count}} checkouts expired unpaid today (≈ {{amount}})",
        "coinsNoWallet": "Live links accept {{coins}} but you have no payout wallet for them",
        "addWallet": "Add wallet",
        "webhookFailures": "{{count}} webhook deliveries failed in the last 24 hours",
        "inspect": "Inspect",
        "staleApiKey": "API key {{hint}} is {{months}} months old — rotate it",
        "rotate": "Rotate",
        "outOfStock": "{{count}} live products are out of stock",
        "restock": "Restock",
        "linksExpiring": "{{count}} payment links expire within 48 hours, still unpaid",
        "claimHandle": "Reserve your dynopay.com handle so your public page and checkout URL go live",
        "claim": "Claim",
        "referralPending": "{{count}} referral rewards are on their way to you",
        "feeFree": "{{amount}} of fee-free volume is still unused",
        "createLink": "Create a link",
        "settled": "Settled",
        "settledCaption": "{{count}} payments · vs previous period",
        "grossFees": "gross {{gross}} · fees {{fees}}",
        "inFlight": "In flight",
        "inFlightCaption": "{{count}} payments seen on-chain, awaiting confirmations",
        "inFlightEmpty": "Nothing confirming right now",
        "checkoutsOpen": "{{count}} checkouts open, no funds yet",
        "forwarded": "Forwarded to your wallets",
        "forwardedEmpty": "No payouts forwarded in this range",
        "lastForward": "Last forward {{when}}",
        "convertedTo": "Converted to {{target}}: {{amount}}",
        "trend": "Trend",
        "metricVolume": "Volume",
        "metricPayments": "Payments",
        "metricAvgTicket": "Avg ticket",
        "assetMix": "Asset mix",
        "noAssets": "No settled payments in this range",
        "trendEmpty": "No settled payments in this range yet.",
        "completionRate": "Checkout completion",
        "completionTip": "{{paid}} of {{created}} checkouts paid",
        "medianSettle": "Median time to settle",
        "medianSettleTip": "From checkout created to funds settled, median of paid checkouts",
        "exceptionRate": "Underpaid + expired",
        "exceptionTip": "{{underpaid}} underpaid · {{expired}} expired unpaid",
        "topSources": "Top links & products",
        "topSourcesEmpty": "No paid links or products in this range yet. Payments through your links and store show up here.",
        "untitledLink": "Untitled link #{{id}}",
        "paidCount": "{{count}} paid",
        "planLine": "{{tier}} tier · {{pct}}% · {{used}} of {{limit}} to {{next}} ({{nextPct}}%)",
        "planLineTop": "{{tier}} tier · {{pct}}% per payment",
        "planDetails": "Plan & fees",
        "hidePlan": "Hide",
    },
}

L10N = {
    "de": {
        "rangeToday": "Heute",
        "command": {
            "justNow": "gerade eben", "minAgo": "vor {{count}} Min.", "hrAgo": "vor {{count}} Std.", "underMinute": "<1 Min.", "minutes": "{{count}} Min.", "days": "{{count}} T.",
            "pulseConfirming": "{{count}} in Bestätigung", "pulseOpen": "{{count}} offene Checkouts", "pulseQuiet": "Ruhig", "lastPaid": "letzte Zahlung {{when}}", "noPaymentsYet": "noch keine Zahlungen",
            "needsAttention": "Braucht Aufmerksamkeit", "showAll": "Alle anzeigen ({{count}} weitere)", "showLess": "Weniger anzeigen",
            "kycDays": "Verifizieren Sie Ihre Identität innerhalb von {{count}} Tagen, um weiter Zahlungen zu empfangen", "mfaRequired": "Die Zwei-Faktor-Verifizierung ist jetzt Pflicht, um Dynopay weiter zu nutzen", "mfaDays": "Die Zwei-Faktor-Verifizierung wird in {{count}} Tagen Pflicht", "setUp": "Einrichten",
            "walletFrozenUntil": "Änderungen an Auszahlungs-Wallets sind nach einem Sicherheits-Reset bis {{until}} gesperrt", "walletFrozen": "Änderungen an Auszahlungs-Wallets sind nach einem Sicherheits-Reset gesperrt", "viewSecurity": "Sicherheit ansehen",
            "noPassword": "Sie melden sich mit Einmalcodes an — legen Sie ein Passwort fest, um sich sofort anzumelden",
            "underpaid": "{{count}} unterbezahlte Zahlungen warten auf Ihre Entscheidung", "review": "Prüfen", "view": "Ansehen", "confirmingStale": "{{count}} Zahlungen bestätigen sich seit über einer Stunde", "expiredToday": "{{count}} Checkouts sind heute unbezahlt abgelaufen (≈ {{amount}})",
            "coinsNoWallet": "Aktive Links akzeptieren {{coins}}, aber Sie haben dafür keine Auszahlungs-Wallet", "addWallet": "Wallet hinzufügen", "webhookFailures": "{{count}} Webhook-Zustellungen sind in den letzten 24 Stunden fehlgeschlagen", "inspect": "Prüfen", "staleApiKey": "API-Schlüssel {{hint}} ist {{months}} Monate alt — rotieren Sie ihn", "rotate": "Rotieren", "outOfStock": "{{count}} aktive Produkte sind ausverkauft", "restock": "Auffüllen", "linksExpiring": "{{count}} Zahlungslinks laufen innerhalb von 48 Stunden unbezahlt ab",
            "claimHandle": "Reservieren Sie Ihr dynopay.com-Handle, damit Ihre öffentliche Seite und Checkout-URL live gehen", "claim": "Sichern", "referralPending": "{{count}} Empfehlungsprämien sind auf dem Weg zu Ihnen", "feeFree": "{{amount}} gebührenfreies Volumen ist noch ungenutzt", "createLink": "Link erstellen",
            "settled": "Abgerechnet", "settledCaption": "{{count}} Zahlungen · vs. Vorperiode", "grossFees": "brutto {{gross}} · Gebühren {{fees}}", "inFlight": "Unterwegs", "inFlightCaption": "{{count}} Zahlungen on-chain erkannt, warten auf Bestätigungen", "inFlightEmpty": "Derzeit wird nichts bestätigt", "checkoutsOpen": "{{count}} Checkouts offen, noch kein Geld", "forwarded": "An Ihre Wallets weitergeleitet", "forwardedEmpty": "Keine Auszahlungen in diesem Zeitraum weitergeleitet", "lastForward": "Letzte Weiterleitung {{when}}", "convertedTo": "In {{target}} umgewandelt: {{amount}}",
            "trend": "Trend", "metricVolume": "Volumen", "metricPayments": "Zahlungen", "metricAvgTicket": "Ø Betrag", "assetMix": "Asset-Mix", "noAssets": "Keine abgerechneten Zahlungen in diesem Zeitraum", "trendEmpty": "Noch keine abgerechneten Zahlungen in diesem Zeitraum.",
            "completionRate": "Checkout-Abschluss", "completionTip": "{{paid}} von {{created}} Checkouts bezahlt", "medianSettle": "Mediane Abrechnungszeit", "medianSettleTip": "Vom Erstellen des Checkouts bis zur Gutschrift, Median der bezahlten Checkouts", "exceptionRate": "Unterbezahlt + abgelaufen", "exceptionTip": "{{underpaid}} unterbezahlt · {{expired}} unbezahlt abgelaufen",
            "topSources": "Top-Links & Produkte", "topSourcesEmpty": "Noch keine bezahlten Links oder Produkte in diesem Zeitraum. Zahlungen über Ihre Links und Ihren Shop erscheinen hier.", "untitledLink": "Unbenannter Link #{{id}}", "paidCount": "{{count}} bezahlt",
            "planLine": "Stufe {{tier}} · {{pct}} % · {{used}} von {{limit}} bis {{next}} ({{nextPct}} %)", "planLineTop": "Stufe {{tier}} · {{pct}} % pro Zahlung", "planDetails": "Tarif & Gebühren", "hidePlan": "Ausblenden",
        },
    },
    "es": {
        "rangeToday": "Hoy",
        "command": {
            "justNow": "justo ahora", "minAgo": "hace {{count}} min", "hrAgo": "hace {{count}} h", "underMinute": "<1 min", "minutes": "{{count}} min", "days": "{{count}} d",
            "pulseConfirming": "{{count}} confirmando", "pulseOpen": "{{count}} checkouts abiertos", "pulseQuiet": "Tranquilo", "lastPaid": "último pago {{when}}", "noPaymentsYet": "aún sin pagos",
            "needsAttention": "Requiere atención", "showAll": "Mostrar todo ({{count}} más)", "showLess": "Mostrar menos",
            "kycDays": "Verifica tu identidad en {{count}} días para seguir procesando pagos", "mfaRequired": "La verificación en dos pasos ahora es obligatoria para seguir usando Dynopay", "mfaDays": "La verificación en dos pasos será obligatoria en {{count}} días", "setUp": "Configurar",
            "walletFrozenUntil": "Los cambios en las wallets de pago están congelados hasta {{until}} tras un restablecimiento de seguridad", "walletFrozen": "Los cambios en las wallets de pago están congelados tras un restablecimiento de seguridad", "viewSecurity": "Ver seguridad",
            "noPassword": "Inicias sesión con un código de un solo uso — define una contraseña para entrar al instante",
            "underpaid": "{{count}} pagos incompletos esperan tu decisión", "review": "Revisar", "view": "Ver", "confirmingStale": "{{count}} pagos llevan más de una hora confirmándose", "expiredToday": "{{count}} checkouts caducaron sin pagar hoy (≈ {{amount}})",
            "coinsNoWallet": "Hay enlaces activos que aceptan {{coins}} pero no tienes wallet de pago para ellas", "addWallet": "Añadir wallet", "webhookFailures": "{{count}} entregas de webhook fallaron en las últimas 24 horas", "inspect": "Inspeccionar", "staleApiKey": "La clave API {{hint}} tiene {{months}} meses — rótala", "rotate": "Rotar", "outOfStock": "{{count}} productos activos están agotados", "restock": "Reponer", "linksExpiring": "{{count}} enlaces de pago caducan en 48 horas sin pagar",
            "claimHandle": "Reserva tu identificador de dynopay.com para publicar tu página y URL de checkout", "claim": "Reservar", "referralPending": "{{count}} recompensas por referidos van en camino", "feeFree": "{{amount}} de volumen sin comisiones sigue sin usar", "createLink": "Crear un enlace",
            "settled": "Liquidado", "settledCaption": "{{count}} pagos · vs. periodo anterior", "grossFees": "bruto {{gross}} · comisiones {{fees}}", "inFlight": "En curso", "inFlightCaption": "{{count}} pagos detectados on-chain, esperando confirmaciones", "inFlightEmpty": "Nada confirmándose ahora", "checkoutsOpen": "{{count}} checkouts abiertos, sin fondos aún", "forwarded": "Enviado a tus wallets", "forwardedEmpty": "Sin pagos enviados en este periodo", "lastForward": "Último envío {{when}}", "convertedTo": "Convertido a {{target}}: {{amount}}",
            "trend": "Tendencia", "metricVolume": "Volumen", "metricPayments": "Pagos", "metricAvgTicket": "Ticket medio", "assetMix": "Mezcla de activos", "noAssets": "Sin pagos liquidados en este periodo", "trendEmpty": "Aún no hay pagos liquidados en este periodo.",
            "completionRate": "Conversión de checkout", "completionTip": "{{paid}} de {{created}} checkouts pagados", "medianSettle": "Tiempo medio de liquidación", "medianSettleTip": "Desde la creación del checkout hasta la liquidación, mediana de los checkouts pagados", "exceptionRate": "Incompletos + caducados", "exceptionTip": "{{underpaid}} incompletos · {{expired}} caducados sin pagar",
            "topSources": "Mejores enlaces y productos", "topSourcesEmpty": "Aún no hay enlaces ni productos pagados en este periodo. Los pagos por tus enlaces y tienda aparecerán aquí.", "untitledLink": "Enlace sin título #{{id}}", "paidCount": "{{count}} pagados",
            "planLine": "Nivel {{tier}} · {{pct}} % · {{used}} de {{limit}} hasta {{next}} ({{nextPct}} %)", "planLineTop": "Nivel {{tier}} · {{pct}} % por pago", "planDetails": "Plan y comisiones", "hidePlan": "Ocultar",
        },
    },
    "fr": {
        "rangeToday": "Aujourd'hui",
        "command": {
            "justNow": "à l'instant", "minAgo": "il y a {{count}} min", "hrAgo": "il y a {{count}} h", "underMinute": "<1 min", "minutes": "{{count}} min", "days": "{{count}} j",
            "pulseConfirming": "{{count}} en confirmation", "pulseOpen": "{{count}} paiements ouverts", "pulseQuiet": "Calme", "lastPaid": "dernier paiement {{when}}", "noPaymentsYet": "aucun paiement pour l'instant",
            "needsAttention": "À traiter", "showAll": "Tout afficher ({{count}} de plus)", "showLess": "Afficher moins",
            "kycDays": "Vérifiez votre identité sous {{count}} jours pour continuer à encaisser", "mfaRequired": "La vérification en deux étapes est désormais obligatoire pour utiliser Dynopay", "mfaDays": "La vérification en deux étapes devient obligatoire dans {{count}} jours", "setUp": "Configurer",
            "walletFrozenUntil": "Les modifications des portefeuilles de versement sont gelées jusqu'à {{until}} après une réinitialisation de sécurité", "walletFrozen": "Les modifications des portefeuilles de versement sont gelées après une réinitialisation de sécurité", "viewSecurity": "Voir la sécurité",
            "noPassword": "Vous vous connectez par code à usage unique — définissez un mot de passe pour vous connecter instantanément",
            "underpaid": "{{count}} paiements insuffisants attendent votre décision", "review": "Examiner", "view": "Voir", "confirmingStale": "{{count}} paiements sont en confirmation depuis plus d'une heure", "expiredToday": "{{count}} paiements ont expiré sans être réglés aujourd'hui (≈ {{amount}})",
            "coinsNoWallet": "Des liens actifs acceptent {{coins}} mais vous n'avez pas de portefeuille de versement pour ces actifs", "addWallet": "Ajouter un portefeuille", "webhookFailures": "{{count}} livraisons de webhook ont échoué ces dernières 24 heures", "inspect": "Inspecter", "staleApiKey": "La clé API {{hint}} a {{months}} mois — faites-la tourner", "rotate": "Renouveler", "outOfStock": "{{count}} produits en ligne sont en rupture de stock", "restock": "Réapprovisionner", "linksExpiring": "{{count}} liens de paiement expirent sous 48 heures sans être réglés",
            "claimHandle": "Réservez votre identifiant dynopay.com pour mettre en ligne votre page publique et votre URL de paiement", "claim": "Réserver", "referralPending": "{{count}} récompenses de parrainage sont en route", "feeFree": "{{amount}} de volume sans frais reste inutilisé", "createLink": "Créer un lien",
            "settled": "Réglé", "settledCaption": "{{count}} paiements · vs période précédente", "grossFees": "brut {{gross}} · frais {{fees}}", "inFlight": "En cours", "inFlightCaption": "{{count}} paiements détectés on-chain, en attente de confirmations", "inFlightEmpty": "Rien en confirmation pour le moment", "checkoutsOpen": "{{count}} paiements ouverts, aucun fonds reçu", "forwarded": "Transféré vers vos portefeuilles", "forwardedEmpty": "Aucun versement transféré sur cette période", "lastForward": "Dernier transfert {{when}}", "convertedTo": "Converti en {{target}} : {{amount}}",
            "trend": "Tendance", "metricVolume": "Volume", "metricPayments": "Paiements", "metricAvgTicket": "Panier moyen", "assetMix": "Répartition des actifs", "noAssets": "Aucun paiement réglé sur cette période", "trendEmpty": "Aucun paiement réglé sur cette période pour l'instant.",
            "completionRate": "Taux de conversion", "completionTip": "{{paid}} paiements réglés sur {{created}}", "medianSettle": "Délai médian de règlement", "medianSettleTip": "De la création du paiement au règlement des fonds, médiane des paiements réglés", "exceptionRate": "Insuffisants + expirés", "exceptionTip": "{{underpaid}} insuffisants · {{expired}} expirés non réglés",
            "topSources": "Meilleurs liens et produits", "topSourcesEmpty": "Aucun lien ni produit réglé sur cette période. Les paiements via vos liens et votre boutique apparaîtront ici.", "untitledLink": "Lien sans titre #{{id}}", "paidCount": "{{count}} réglés",
            "planLine": "Palier {{tier}} · {{pct}} % · {{used}} sur {{limit}} vers {{next}} ({{nextPct}} %)", "planLineTop": "Palier {{tier}} · {{pct}} % par paiement", "planDetails": "Offre et frais", "hidePlan": "Masquer",
        },
    },
    "nl": {
        "rangeToday": "Vandaag",
        "command": {
            "justNow": "zojuist", "minAgo": "{{count}} min geleden", "hrAgo": "{{count}} u geleden", "underMinute": "<1 min", "minutes": "{{count}} min", "days": "{{count}} d",
            "pulseConfirming": "{{count}} in bevestiging", "pulseOpen": "{{count}} open checkouts", "pulseQuiet": "Rustig", "lastPaid": "laatste betaling {{when}}", "noPaymentsYet": "nog geen betalingen",
            "needsAttention": "Vraagt aandacht", "showAll": "Alles tonen ({{count}} meer)", "showLess": "Minder tonen",
            "kycDays": "Verifieer je identiteit binnen {{count}} dagen om betalingen te blijven ontvangen", "mfaRequired": "Tweestapsverificatie is nu verplicht om Dynopay te blijven gebruiken", "mfaDays": "Tweestapsverificatie wordt over {{count}} dagen verplicht", "setUp": "Instellen",
            "walletFrozenUntil": "Wijzigingen aan uitbetaalwallets zijn na een beveiligingsreset bevroren tot {{until}}", "walletFrozen": "Wijzigingen aan uitbetaalwallets zijn na een beveiligingsreset bevroren", "viewSecurity": "Beveiliging bekijken",
            "noPassword": "Je logt in met een eenmalige code — stel een wachtwoord in om direct in te loggen",
            "underpaid": "{{count}} onderbetaalde betalingen wachten op je beslissing", "review": "Beoordelen", "view": "Bekijken", "confirmingStale": "{{count}} betalingen worden al meer dan een uur bevestigd", "expiredToday": "{{count}} checkouts zijn vandaag onbetaald verlopen (≈ {{amount}})",
            "coinsNoWallet": "Actieve links accepteren {{coins}}, maar je hebt er geen uitbetaalwallet voor", "addWallet": "Wallet toevoegen", "webhookFailures": "{{count}} webhook-leveringen zijn de afgelopen 24 uur mislukt", "inspect": "Bekijken", "staleApiKey": "API-sleutel {{hint}} is {{months}} maanden oud — roteer hem", "rotate": "Roteren", "outOfStock": "{{count}} live producten zijn uitverkocht", "restock": "Aanvullen", "linksExpiring": "{{count}} betaallinks verlopen binnen 48 uur, nog onbetaald",
            "claimHandle": "Reserveer je dynopay.com-handle zodat je publieke pagina en checkout-URL live gaan", "claim": "Claimen", "referralPending": "{{count}} verwijzingsbeloningen zijn onderweg", "feeFree": "{{amount}} aan kostenvrij volume is nog ongebruikt", "createLink": "Link maken",
            "settled": "Afgewikkeld", "settledCaption": "{{count}} betalingen · vs. vorige periode", "grossFees": "bruto {{gross}} · kosten {{fees}}", "inFlight": "Onderweg", "inFlightCaption": "{{count}} betalingen on-chain gezien, wachten op bevestigingen", "inFlightEmpty": "Er wordt nu niets bevestigd", "checkoutsOpen": "{{count}} checkouts open, nog geen geld", "forwarded": "Doorgestuurd naar je wallets", "forwardedEmpty": "Geen uitbetalingen doorgestuurd in deze periode", "lastForward": "Laatste doorsturing {{when}}", "convertedTo": "Omgezet naar {{target}}: {{amount}}",
            "trend": "Trend", "metricVolume": "Volume", "metricPayments": "Betalingen", "metricAvgTicket": "Gem. bedrag", "assetMix": "Assetmix", "noAssets": "Geen afgewikkelde betalingen in deze periode", "trendEmpty": "Nog geen afgewikkelde betalingen in deze periode.",
            "completionRate": "Checkout-conversie", "completionTip": "{{paid}} van {{created}} checkouts betaald", "medianSettle": "Mediane afwikkeltijd", "medianSettleTip": "Van aangemaakte checkout tot afgewikkeld geld, mediaan van betaalde checkouts", "exceptionRate": "Onderbetaald + verlopen", "exceptionTip": "{{underpaid}} onderbetaald · {{expired}} onbetaald verlopen",
            "topSources": "Toplinks & producten", "topSourcesEmpty": "Nog geen betaalde links of producten in deze periode. Betalingen via je links en winkel verschijnen hier.", "untitledLink": "Naamloze link #{{id}}", "paidCount": "{{count}} betaald",
            "planLine": "{{tier}}-niveau · {{pct}}% · {{used}} van {{limit}} naar {{next}} ({{nextPct}}%)", "planLineTop": "{{tier}}-niveau · {{pct}}% per betaling", "planDetails": "Plan & kosten", "hidePlan": "Verbergen",
        },
    },
    "pt": {
        "rangeToday": "Hoje",
        "command": {
            "justNow": "agora mesmo", "minAgo": "há {{count}} min", "hrAgo": "há {{count}} h", "underMinute": "<1 min", "minutes": "{{count}} min", "days": "{{count}} d",
            "pulseConfirming": "{{count}} a confirmar", "pulseOpen": "{{count}} checkouts abertos", "pulseQuiet": "Calmo", "lastPaid": "último pagamento {{when}}", "noPaymentsYet": "ainda sem pagamentos",
            "needsAttention": "Precisa de atenção", "showAll": "Mostrar tudo ({{count}} mais)", "showLess": "Mostrar menos",
            "kycDays": "Verifica a tua identidade em {{count}} dias para continuar a processar pagamentos", "mfaRequired": "A verificação em dois passos é agora obrigatória para continuar a usar a Dynopay", "mfaDays": "A verificação em dois passos passa a ser obrigatória em {{count}} dias", "setUp": "Configurar",
            "walletFrozenUntil": "As alterações às wallets de pagamento estão congeladas até {{until}} após uma reposição de segurança", "walletFrozen": "As alterações às wallets de pagamento estão congeladas após uma reposição de segurança", "viewSecurity": "Ver segurança",
            "noPassword": "Inicias sessão com um código único — define uma palavra-passe para entrar de imediato",
            "underpaid": "{{count}} pagamentos incompletos aguardam a tua decisão", "review": "Rever", "view": "Ver", "confirmingStale": "{{count}} pagamentos estão a confirmar há mais de uma hora", "expiredToday": "{{count}} checkouts expiraram sem pagamento hoje (≈ {{amount}})",
            "coinsNoWallet": "Links ativos aceitam {{coins}}, mas não tens wallet de pagamento para elas", "addWallet": "Adicionar wallet", "webhookFailures": "{{count}} entregas de webhook falharam nas últimas 24 horas", "inspect": "Inspecionar", "staleApiKey": "A chave API {{hint}} tem {{months}} meses — roda-a", "rotate": "Rodar", "outOfStock": "{{count}} produtos ativos estão esgotados", "restock": "Repor stock", "linksExpiring": "{{count}} links de pagamento expiram em 48 horas, ainda por pagar",
            "claimHandle": "Reserva o teu identificador dynopay.com para publicar a tua página e URL de checkout", "claim": "Reservar", "referralPending": "{{count}} recompensas de indicação estão a caminho", "feeFree": "{{amount}} de volume sem comissões continua por usar", "createLink": "Criar um link",
            "settled": "Liquidado", "settledCaption": "{{count}} pagamentos · vs. período anterior", "grossFees": "bruto {{gross}} · comissões {{fees}}", "inFlight": "Em curso", "inFlightCaption": "{{count}} pagamentos detetados on-chain, a aguardar confirmações", "inFlightEmpty": "Nada a confirmar neste momento", "checkoutsOpen": "{{count}} checkouts abertos, ainda sem fundos", "forwarded": "Enviado para as tuas wallets", "forwardedEmpty": "Sem pagamentos enviados neste período", "lastForward": "Último envio {{when}}", "convertedTo": "Convertido para {{target}}: {{amount}}",
            "trend": "Tendência", "metricVolume": "Volume", "metricPayments": "Pagamentos", "metricAvgTicket": "Ticket médio", "assetMix": "Mix de ativos", "noAssets": "Sem pagamentos liquidados neste período", "trendEmpty": "Ainda sem pagamentos liquidados neste período.",
            "completionRate": "Conclusão de checkout", "completionTip": "{{paid}} de {{created}} checkouts pagos", "medianSettle": "Tempo mediano de liquidação", "medianSettleTip": "Desde a criação do checkout até à liquidação dos fundos, mediana dos checkouts pagos", "exceptionRate": "Incompletos + expirados", "exceptionTip": "{{underpaid}} incompletos · {{expired}} expirados sem pagamento",
            "topSources": "Principais links e produtos", "topSourcesEmpty": "Ainda sem links ou produtos pagos neste período. Os pagamentos pelos teus links e loja aparecem aqui.", "untitledLink": "Link sem título #{{id}}", "paidCount": "{{count}} pagos",
            "planLine": "Nível {{tier}} · {{pct}}% · {{used}} de {{limit}} até {{next}} ({{nextPct}}%)", "planLineTop": "Nível {{tier}} · {{pct}}% por pagamento", "planDetails": "Plano e comissões", "hidePlan": "Ocultar",
        },
    },
}


def merge(path, patch):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data["rangeToday"] = patch["rangeToday"]
    cmd = data.get("command") or {}
    cmd.update(patch["command"])
    data["command"] = cmd
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


merge(os.path.join(ROOT, "en", "dashboardLayout.json"), EN)
for lang, patch in L10N.items():
    p = os.path.join(ROOT, lang, "dashboardLayout.json")
    if os.path.exists(p):
        merge(p, patch)
print("ok")
