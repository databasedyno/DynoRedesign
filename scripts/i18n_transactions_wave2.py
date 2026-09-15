#!/usr/bin/env python3
"""Wave 2a — Transactions page i18n keys (EN + 5 locales) in transactions.json. Idempotent."""
import json, os

ROOT = "/app/langs/locales"

KEYS = {
    "en": {
        "rangeLabel": "Date range", "rangeToday": "Today", "range7d": "7D", "range30d": "30D", "range90d": "90D",
        "rangeAll": "All time", "customRange": "Custom range", "customShort": "Custom",
        "needsAction": "Needs action",
        "needsActionHint": "Underpaid payments and payments still confirming after an hour.",
        "customer": "Customer", "confirmationsShort": "{{value}} conf.",
        "resolveUnderpaid": "Buyer still owes the remainder — nudge them to finish paying.",
        "resolveSettled": "Need to send money back? Start a refund to the buyer.",
        "requestTopup": "Request top-up", "topupSentShort": "Reminder sent",
        "topupSent": "Reminder sent to {{email}}", "topupFailed": "Couldn't send the reminder.", "refund": "Refund",
    },
    "de": {
        "rangeLabel": "Zeitraum", "rangeToday": "Heute", "range7d": "7T", "range30d": "30T", "range90d": "90T",
        "rangeAll": "Gesamt", "customRange": "Benutzerdefiniert", "customShort": "Eigener",
        "needsAction": "Handlung nötig",
        "needsActionHint": "Unterbezahlte Zahlungen und Zahlungen, die seit über einer Stunde bestätigt werden.",
        "customer": "Kunde", "confirmationsShort": "{{value}} Best.",
        "resolveUnderpaid": "Der Käufer schuldet noch den Restbetrag — erinnern Sie ihn ans Nachzahlen.",
        "resolveSettled": "Geld zurücksenden? Starten Sie eine Rückerstattung an den Käufer.",
        "requestTopup": "Nachzahlung anfordern", "topupSentShort": "Erinnerung gesendet",
        "topupSent": "Erinnerung an {{email}} gesendet", "topupFailed": "Erinnerung konnte nicht gesendet werden.", "refund": "Rückerstattung",
    },
    "es": {
        "rangeLabel": "Rango de fechas", "rangeToday": "Hoy", "range7d": "7D", "range30d": "30D", "range90d": "90D",
        "rangeAll": "Todo", "customRange": "Rango personalizado", "customShort": "Personalizado",
        "needsAction": "Requiere acción",
        "needsActionHint": "Pagos incompletos y pagos que siguen confirmándose tras una hora.",
        "customer": "Cliente", "confirmationsShort": "{{value}} conf.",
        "resolveUnderpaid": "El comprador aún debe el resto — recuérdale que termine de pagar.",
        "resolveSettled": "¿Necesitas devolver dinero? Inicia un reembolso al comprador.",
        "requestTopup": "Solicitar complemento", "topupSentShort": "Recordatorio enviado",
        "topupSent": "Recordatorio enviado a {{email}}", "topupFailed": "No se pudo enviar el recordatorio.", "refund": "Reembolsar",
    },
    "fr": {
        "rangeLabel": "Période", "rangeToday": "Aujourd’hui", "range7d": "7J", "range30d": "30J", "range90d": "90J",
        "rangeAll": "Tout", "customRange": "Période personnalisée", "customShort": "Personnalisée",
        "needsAction": "À traiter",
        "needsActionHint": "Paiements insuffisants et paiements encore en confirmation après une heure.",
        "customer": "Client", "confirmationsShort": "{{value}} conf.",
        "resolveUnderpaid": "L’acheteur doit encore le reste — invitez-le à finaliser le paiement.",
        "resolveSettled": "Besoin de rembourser ? Lancez un remboursement vers l’acheteur.",
        "requestTopup": "Demander le complément", "topupSentShort": "Rappel envoyé",
        "topupSent": "Rappel envoyé à {{email}}", "topupFailed": "Impossible d’envoyer le rappel.", "refund": "Rembourser",
    },
    "nl": {
        "rangeLabel": "Periode", "rangeToday": "Vandaag", "range7d": "7D", "range30d": "30D", "range90d": "90D",
        "rangeAll": "Alles", "customRange": "Aangepaste periode", "customShort": "Aangepast",
        "needsAction": "Actie nodig",
        "needsActionHint": "Onderbetaalde betalingen en betalingen die na een uur nog bevestigen.",
        "customer": "Klant", "confirmationsShort": "{{value}} bev.",
        "resolveUnderpaid": "De koper is nog het restant verschuldigd — herinner hem om af te rekenen.",
        "resolveSettled": "Geld terugsturen? Start een terugbetaling aan de koper.",
        "requestTopup": "Bijbetaling vragen", "topupSentShort": "Herinnering verzonden",
        "topupSent": "Herinnering verzonden naar {{email}}", "topupFailed": "Herinnering kon niet worden verzonden.", "refund": "Terugbetalen",
    },
    "pt": {
        "rangeLabel": "Período", "rangeToday": "Hoje", "range7d": "7D", "range30d": "30D", "range90d": "90D",
        "rangeAll": "Tudo", "customRange": "Período personalizado", "customShort": "Personalizado",
        "needsAction": "Requer ação",
        "needsActionHint": "Pagamentos incompletos e pagamentos ainda em confirmação após uma hora.",
        "customer": "Cliente", "confirmationsShort": "{{value}} conf.",
        "resolveUnderpaid": "O comprador ainda deve o restante — lembre-o de concluir o pagamento.",
        "resolveSettled": "Precisa devolver dinheiro? Inicie um reembolso ao comprador.",
        "requestTopup": "Pedir complemento", "topupSentShort": "Lembrete enviado",
        "topupSent": "Lembrete enviado para {{email}}", "topupFailed": "Não foi possível enviar o lembrete.", "refund": "Reembolsar",
    },
}

for lang, patch in KEYS.items():
    p = os.path.join(ROOT, lang, "transactions.json")
    if not os.path.exists(p):
        continue
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    data.update(patch)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
