#!/usr/bin/env python3
"""Wave 3c–3g i18n keys (EN + 5): customers cols, referral reward status, settings Language,
developer health strip, notifications kind filter + attention mirror. Idempotent."""
import json, os

ROOT = "/app/langs/locales"

# (file, dotted path prefix or None for flat) → {lang: {key: value}}
PATCHES = [
    ("common.json", "customers", {
        "en": {"colPreferredAsset": "Pays with", "colLastPaid": "Last paid"},
        "de": {"colPreferredAsset": "Zahlt mit", "colLastPaid": "Zuletzt bezahlt"},
        "es": {"colPreferredAsset": "Paga con", "colLastPaid": "Último pago"},
        "fr": {"colPreferredAsset": "Paie en", "colLastPaid": "Dernier paiement"},
        "nl": {"colPreferredAsset": "Betaalt met", "colLastPaid": "Laatst betaald"},
        "pt": {"colPreferredAsset": "Paga com", "colLastPaid": "Último pagamento"},
    }),
    ("common.json", "settingsPage", {
        "en": {"language": "Language", "languageDesc": "The language of your dashboard and the e-mails we send you. Saved to your account so it follows you across devices."},
        "de": {"language": "Sprache", "languageDesc": "Die Sprache Ihres Dashboards und der E-Mails, die wir Ihnen senden. In Ihrem Konto gespeichert, damit sie auf allen Geräten gilt."},
        "es": {"language": "Idioma", "languageDesc": "El idioma de tu panel y de los correos que te enviamos. Se guarda en tu cuenta para que te acompañe en todos tus dispositivos."},
        "fr": {"language": "Langue", "languageDesc": "La langue de votre tableau de bord et des e-mails que nous vous envoyons. Enregistrée sur votre compte pour vous suivre sur tous vos appareils."},
        "nl": {"language": "Taal", "languageDesc": "De taal van je dashboard en de e-mails die we je sturen. Opgeslagen in je account zodat hij je volgt op al je apparaten."},
        "pt": {"language": "Idioma", "languageDesc": "O idioma do seu painel e dos e-mails que lhe enviamos. Guardado na sua conta para o acompanhar em todos os dispositivos."},
    }),
    ("referrals.json", None, {
        "en": {"rewardPending": "Reward pending", "rewardEarned": "Earned ${{amount}}", "rewardPaid": "Paid ${{amount}}",
               "rewardPendingTip": "Earns once they complete a qualifying payment.", "joinedOn": "Joined {{date}}",
               "refStatus_pending": "Pending", "refStatus_active": "Active", "refStatus_rewarded": "Rewarded", "refStatus_expired": "Expired"},
        "de": {"rewardPending": "Prämie ausstehend", "rewardEarned": "Verdient ${{amount}}", "rewardPaid": "Ausgezahlt ${{amount}}",
               "rewardPendingTip": "Wird verdient, sobald eine qualifizierende Zahlung abgeschlossen ist.", "joinedOn": "Beigetreten am {{date}}",
               "refStatus_pending": "Ausstehend", "refStatus_active": "Aktiv", "refStatus_rewarded": "Belohnt", "refStatus_expired": "Abgelaufen"},
        "es": {"rewardPending": "Recompensa pendiente", "rewardEarned": "Ganado ${{amount}}", "rewardPaid": "Pagado ${{amount}}",
               "rewardPendingTip": "Se gana cuando completan un pago que califica.", "joinedOn": "Se unió el {{date}}",
               "refStatus_pending": "Pendiente", "refStatus_active": "Activo", "refStatus_rewarded": "Recompensado", "refStatus_expired": "Expirado"},
        "fr": {"rewardPending": "Récompense en attente", "rewardEarned": "Gagné ${{amount}}", "rewardPaid": "Versé ${{amount}}",
               "rewardPendingTip": "Acquise dès qu'un paiement éligible est effectué.", "joinedOn": "Inscrit le {{date}}",
               "refStatus_pending": "En attente", "refStatus_active": "Actif", "refStatus_rewarded": "Récompensé", "refStatus_expired": "Expiré"},
        "nl": {"rewardPending": "Beloning in afwachting", "rewardEarned": "Verdiend ${{amount}}", "rewardPaid": "Uitbetaald ${{amount}}",
               "rewardPendingTip": "Wordt verdiend zodra ze een kwalificerende betaling voltooien.", "joinedOn": "Lid sinds {{date}}",
               "refStatus_pending": "In afwachting", "refStatus_active": "Actief", "refStatus_rewarded": "Beloond", "refStatus_expired": "Verlopen"},
        "pt": {"rewardPending": "Recompensa pendente", "rewardEarned": "Ganho ${{amount}}", "rewardPaid": "Pago ${{amount}}",
               "rewardPendingTip": "É ganha quando concluem um pagamento qualificado.", "joinedOn": "Aderiu em {{date}}",
               "refStatus_pending": "Pendente", "refStatus_active": "Ativo", "refStatus_rewarded": "Recompensado", "refStatus_expired": "Expirado"},
    }),
    ("apiScreen.json", "health", {
        "en": {"webhooks": "Webhooks · 24 h", "notConfigured": "Not set up", "paused": "Paused", "noDeliveries": "No deliveries",
               "notConfiguredHint": "Add an endpoint to get payment events pushed to your server.",
               "lastFailure": "Last failure {{when}} · {{event}} · HTTP {{status}}",
               "deliveries24h": "{{count}} deliveries in 24 h · avg {{ms}} ms",
               "quiet24h": "Nothing sent in the last 24 h — no failures on record.",
               "retry": "Retry last failure", "retrying": "Retrying…", "viewEvents": "Events log", "setupWebhook": "Set up webhook",
               "apiKeys": "API keys", "noKeys": "No keys", "activeKeys": "{{count}} active",
               "rotateDue": "{{count}} live key older than {{days}} months — rotate it to limit exposure.",
               "oldestKey": "Oldest: {{name}} · {{days}} days since issue/rotation", "noKeysHint": "Create a key to start integrating.",
               "rotateNow": "Rotate now", "manageKeys": "Manage keys", "quickLinks": "Quick links", "docsTitle": "Docs & tools",
               "docsHint": "Reference, signatures and the delivery log — everything to debug an integration.",
               "apiReference": "API reference", "apiReferenceTip": "Full API reference (opens in a new tab)"},
        "de": {"webhooks": "Webhooks · 24 Std.", "notConfigured": "Nicht eingerichtet", "paused": "Pausiert", "noDeliveries": "Keine Zustellungen",
               "notConfiguredHint": "Fügen Sie einen Endpunkt hinzu, um Zahlungsereignisse an Ihren Server zu senden.",
               "lastFailure": "Letzter Fehler {{when}} · {{event}} · HTTP {{status}}",
               "deliveries24h": "{{count}} Zustellungen in 24 Std. · Ø {{ms}} ms",
               "quiet24h": "In den letzten 24 Std. nichts gesendet — keine Fehler verzeichnet.",
               "retry": "Letzten Fehler wiederholen", "retrying": "Wird wiederholt…", "viewEvents": "Ereignisprotokoll", "setupWebhook": "Webhook einrichten",
               "apiKeys": "API-Schlüssel", "noKeys": "Keine Schlüssel", "activeKeys": "{{count}} aktiv",
               "rotateDue": "{{count}} Live-Schlüssel älter als {{days}} Monate — rotieren Sie ihn, um das Risiko zu begrenzen.",
               "oldestKey": "Ältester: {{name}} · {{days}} Tage seit Ausgabe/Rotation", "noKeysHint": "Erstellen Sie einen Schlüssel, um zu integrieren.",
               "rotateNow": "Jetzt rotieren", "manageKeys": "Schlüssel verwalten", "quickLinks": "Schnellzugriff", "docsTitle": "Doku & Tools",
               "docsHint": "Referenz, Signaturen und das Zustellprotokoll — alles zum Debuggen einer Integration.",
               "apiReference": "API-Referenz", "apiReferenceTip": "Vollständige API-Referenz (öffnet in neuem Tab)"},
        "es": {"webhooks": "Webhooks · 24 h", "notConfigured": "Sin configurar", "paused": "Pausado", "noDeliveries": "Sin entregas",
               "notConfiguredHint": "Añade un endpoint para recibir los eventos de pago en tu servidor.",
               "lastFailure": "Último fallo {{when}} · {{event}} · HTTP {{status}}",
               "deliveries24h": "{{count}} entregas en 24 h · media {{ms}} ms",
               "quiet24h": "Nada enviado en las últimas 24 h — sin fallos registrados.",
               "retry": "Reintentar último fallo", "retrying": "Reintentando…", "viewEvents": "Registro de eventos", "setupWebhook": "Configurar webhook",
               "apiKeys": "Claves API", "noKeys": "Sin claves", "activeKeys": "{{count}} activas",
               "rotateDue": "{{count}} clave live con más de {{days}} meses — rótala para limitar la exposición.",
               "oldestKey": "Más antigua: {{name}} · {{days}} días desde emisión/rotación", "noKeysHint": "Crea una clave para empezar a integrar.",
               "rotateNow": "Rotar ahora", "manageKeys": "Gestionar claves", "quickLinks": "Accesos rápidos", "docsTitle": "Docs y herramientas",
               "docsHint": "Referencia, firmas y el registro de entregas — todo para depurar una integración.",
               "apiReference": "Referencia de la API", "apiReferenceTip": "Referencia completa de la API (se abre en otra pestaña)"},
        "fr": {"webhooks": "Webhooks · 24 h", "notConfigured": "Non configuré", "paused": "En pause", "noDeliveries": "Aucune livraison",
               "notConfiguredHint": "Ajoutez un endpoint pour recevoir les événements de paiement sur votre serveur.",
               "lastFailure": "Dernier échec {{when}} · {{event}} · HTTP {{status}}",
               "deliveries24h": "{{count}} livraisons en 24 h · moy. {{ms}} ms",
               "quiet24h": "Rien d'envoyé ces 24 dernières heures — aucun échec enregistré.",
               "retry": "Réessayer le dernier échec", "retrying": "Nouvel essai…", "viewEvents": "Journal des événements", "setupWebhook": "Configurer le webhook",
               "apiKeys": "Clés API", "noKeys": "Aucune clé", "activeKeys": "{{count}} actives",
               "rotateDue": "{{count}} clé live de plus de {{days}} mois — faites-la tourner pour limiter l'exposition.",
               "oldestKey": "La plus ancienne : {{name}} · {{days}} jours depuis l'émission/rotation", "noKeysHint": "Créez une clé pour commencer l'intégration.",
               "rotateNow": "Faire tourner", "manageKeys": "Gérer les clés", "quickLinks": "Liens rapides", "docsTitle": "Docs et outils",
               "docsHint": "Référence, signatures et journal de livraison — tout pour déboguer une intégration.",
               "apiReference": "Référence API", "apiReferenceTip": "Référence API complète (nouvel onglet)"},
        "nl": {"webhooks": "Webhooks · 24 u", "notConfigured": "Niet ingesteld", "paused": "Gepauzeerd", "noDeliveries": "Geen leveringen",
               "notConfiguredHint": "Voeg een endpoint toe om betalingsgebeurtenissen naar je server te pushen.",
               "lastFailure": "Laatste fout {{when}} · {{event}} · HTTP {{status}}",
               "deliveries24h": "{{count}} leveringen in 24 u · gem. {{ms}} ms",
               "quiet24h": "Niets verzonden in de laatste 24 u — geen fouten geregistreerd.",
               "retry": "Laatste fout opnieuw proberen", "retrying": "Opnieuw proberen…", "viewEvents": "Gebeurtenissenlog", "setupWebhook": "Webhook instellen",
               "apiKeys": "API-sleutels", "noKeys": "Geen sleutels", "activeKeys": "{{count}} actief",
               "rotateDue": "{{count}} live-sleutel ouder dan {{days}} maanden — roteer hem om het risico te beperken.",
               "oldestKey": "Oudste: {{name}} · {{days}} dagen sinds uitgifte/rotatie", "noKeysHint": "Maak een sleutel om te integreren.",
               "rotateNow": "Nu roteren", "manageKeys": "Sleutels beheren", "quickLinks": "Snelkoppelingen", "docsTitle": "Docs & tools",
               "docsHint": "Referentie, signatures en het leveringslog — alles om een integratie te debuggen.",
               "apiReference": "API-referentie", "apiReferenceTip": "Volledige API-referentie (opent in nieuw tabblad)"},
        "pt": {"webhooks": "Webhooks · 24 h", "notConfigured": "Não configurado", "paused": "Em pausa", "noDeliveries": "Sem entregas",
               "notConfiguredHint": "Adicione um endpoint para receber eventos de pagamento no seu servidor.",
               "lastFailure": "Última falha {{when}} · {{event}} · HTTP {{status}}",
               "deliveries24h": "{{count}} entregas em 24 h · média {{ms}} ms",
               "quiet24h": "Nada enviado nas últimas 24 h — sem falhas registadas.",
               "retry": "Repetir última falha", "retrying": "A repetir…", "viewEvents": "Registo de eventos", "setupWebhook": "Configurar webhook",
               "apiKeys": "Chaves API", "noKeys": "Sem chaves", "activeKeys": "{{count}} ativas",
               "rotateDue": "{{count}} chave live com mais de {{days}} meses — rode-a para limitar a exposição.",
               "oldestKey": "Mais antiga: {{name}} · {{days}} dias desde emissão/rotação", "noKeysHint": "Crie uma chave para começar a integrar.",
               "rotateNow": "Rodar agora", "manageKeys": "Gerir chaves", "quickLinks": "Ligações rápidas", "docsTitle": "Docs e ferramentas",
               "docsHint": "Referência, assinaturas e o registo de entregas — tudo para depurar uma integração.",
               "apiReference": "Referência da API", "apiReferenceTip": "Referência completa da API (abre num novo separador)"},
    }),
    ("notifications.json", "kind", {
        "en": {"all": "All", "payments": "Payments", "security": "Security", "system": "System", "growth": "Growth", "empty": "No {{kind}} notifications yet."},
        "de": {"all": "Alle", "payments": "Zahlungen", "security": "Sicherheit", "system": "System", "growth": "Wachstum", "empty": "Noch keine Benachrichtigungen: {{kind}}."},
        "es": {"all": "Todas", "payments": "Pagos", "security": "Seguridad", "system": "Sistema", "growth": "Crecimiento", "empty": "Aún no hay notificaciones de {{kind}}."},
        "fr": {"all": "Toutes", "payments": "Paiements", "security": "Sécurité", "system": "Système", "growth": "Croissance", "empty": "Aucune notification {{kind}} pour l'instant."},
        "nl": {"all": "Alle", "payments": "Betalingen", "security": "Beveiliging", "system": "Systeem", "growth": "Groei", "empty": "Nog geen meldingen: {{kind}}."},
        "pt": {"all": "Todas", "payments": "Pagamentos", "security": "Segurança", "system": "Sistema", "growth": "Crescimento", "empty": "Ainda sem notificações de {{kind}}."},
    }),
    ("notifications.json", "attention", {
        "en": {"title": "Needs attention", "hint": "Mirrored from your dashboard — nothing is lost when you hide a row there.", "hiddenOnDashboard": "Hidden on the dashboard", "restore": "Show on dashboard"},
        "de": {"title": "Erfordert Aufmerksamkeit", "hint": "Vom Dashboard gespiegelt — nichts geht verloren, wenn Sie dort eine Zeile ausblenden.", "hiddenOnDashboard": "Im Dashboard ausgeblendet", "restore": "Im Dashboard anzeigen"},
        "es": {"title": "Requiere atención", "hint": "Reflejado desde tu panel: no se pierde nada cuando ocultas una fila allí.", "hiddenOnDashboard": "Oculto en el panel", "restore": "Mostrar en el panel"},
        "fr": {"title": "À traiter", "hint": "Reflet de votre tableau de bord — rien n'est perdu quand vous y masquez une ligne.", "hiddenOnDashboard": "Masqué sur le tableau de bord", "restore": "Afficher sur le tableau de bord"},
        "nl": {"title": "Aandacht nodig", "hint": "Gespiegeld vanaf je dashboard — er gaat niets verloren als je daar een rij verbergt.", "hiddenOnDashboard": "Verborgen op het dashboard", "restore": "Tonen op dashboard"},
        "pt": {"title": "Precisa de atenção", "hint": "Espelhado do seu painel — nada se perde quando oculta uma linha lá.", "hiddenOnDashboard": "Oculto no painel", "restore": "Mostrar no painel"},
    }),
]

for fname, prefix, by_lang in PATCHES:
    for lang, patch in by_lang.items():
        p = os.path.join(ROOT, lang, fname)
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            data = json.load(f)
        target = data
        if prefix:
            node = data.get(prefix)
            if not isinstance(node, dict):
                node = {}
            node.update(patch)
            data[prefix] = node
        else:
            target.update(patch)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
print("ok")
