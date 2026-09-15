#!/usr/bin/env python3
"""Wave 2d — Receipts & Tax header/empty-state i18n keys under common.json → invoices (EN + 5). Idempotent."""
import json, os

ROOT = "/app/langs/locales"

KEYS = {
    "en": {
        "showingPeriod": "Showing", "exportPeriod": "Export period (CSV)", "exporting": "Exporting…",
        "headerCollected": "Collected", "headerCollectedCaption": "{{count}} settled payments",
        "headerTax": "Tax collected", "headerTaxCaption": "from {{count}} paid orders", "headerTaxNone": "No buyer tax charged in this period",
        "headerFees": "Fees", "headerFeesCaption": "Dynopay fees deducted · {{count}} receipts",
        "periodEmptyHint": "Nothing settled in this period yet. Receipts and tax lines appear here automatically once a payment settles.",
        "noInvoicesPeriodTitle": "No receipts in this period",
        "noInvoicesPeriodDesc": "Receipts are created automatically when a payment settles. Widen the period, or check Transactions for payments that are still confirming.",
        "emptyStep1": "A customer pays a link, product or API invoice", "emptyStep2": "The payment settles on-chain",
        "emptyStep3": "A numbered receipt with fee & VAT lines appears here",
        "showAllTime": "Show all time", "viewTransactions": "View transactions",
    },
    "de": {
        "showingPeriod": "Zeitraum", "exportPeriod": "Zeitraum exportieren (CSV)", "exporting": "Wird exportiert…",
        "headerCollected": "Eingenommen", "headerCollectedCaption": "{{count}} abgerechnete Zahlungen",
        "headerTax": "Erhobene Steuer", "headerTaxCaption": "aus {{count}} bezahlten Bestellungen", "headerTaxNone": "In diesem Zeitraum keine Käufersteuer erhoben",
        "headerFees": "Gebühren", "headerFeesCaption": "Abgezogene Dynopay-Gebühren · {{count}} Belege",
        "periodEmptyHint": "In diesem Zeitraum wurde noch nichts abgerechnet. Belege und Steuerzeilen erscheinen hier automatisch, sobald eine Zahlung abgerechnet ist.",
        "noInvoicesPeriodTitle": "Keine Belege in diesem Zeitraum",
        "noInvoicesPeriodDesc": "Belege werden automatisch erstellt, wenn eine Zahlung abgerechnet wird. Erweitern Sie den Zeitraum oder prüfen Sie unter Transaktionen noch bestätigende Zahlungen.",
        "emptyStep1": "Ein Kunde bezahlt einen Link, ein Produkt oder eine API-Rechnung", "emptyStep2": "Die Zahlung wird on-chain abgerechnet",
        "emptyStep3": "Ein nummerierter Beleg mit Gebühren- und USt-Zeilen erscheint hier",
        "showAllTime": "Gesamten Zeitraum anzeigen", "viewTransactions": "Transaktionen ansehen",
    },
    "es": {
        "showingPeriod": "Mostrando", "exportPeriod": "Exportar período (CSV)", "exporting": "Exportando…",
        "headerCollected": "Cobrado", "headerCollectedCaption": "{{count}} pagos liquidados",
        "headerTax": "Impuestos cobrados", "headerTaxCaption": "de {{count}} pedidos pagados", "headerTaxNone": "Sin impuestos al comprador en este período",
        "headerFees": "Comisiones", "headerFeesCaption": "Comisiones de Dynopay descontadas · {{count}} recibos",
        "periodEmptyHint": "Aún no hay nada liquidado en este período. Los recibos y las líneas de impuestos aparecen aquí automáticamente cuando un pago se liquida.",
        "noInvoicesPeriodTitle": "No hay recibos en este período",
        "noInvoicesPeriodDesc": "Los recibos se crean automáticamente cuando un pago se liquida. Amplía el período o revisa en Transacciones los pagos que aún se están confirmando.",
        "emptyStep1": "Un cliente paga un enlace, producto o factura API", "emptyStep2": "El pago se liquida en la cadena",
        "emptyStep3": "Aquí aparece un recibo numerado con líneas de comisión e IVA",
        "showAllTime": "Mostrar todo", "viewTransactions": "Ver transacciones",
    },
    "fr": {
        "showingPeriod": "Période", "exportPeriod": "Exporter la période (CSV)", "exporting": "Export en cours…",
        "headerCollected": "Encaissé", "headerCollectedCaption": "{{count}} paiements réglés",
        "headerTax": "Taxes collectées", "headerTaxCaption": "sur {{count}} commandes payées", "headerTaxNone": "Aucune taxe acheteur sur cette période",
        "headerFees": "Frais", "headerFeesCaption": "Frais Dynopay déduits · {{count}} reçus",
        "periodEmptyHint": "Rien n'a encore été réglé sur cette période. Les reçus et lignes de taxe apparaissent ici automatiquement dès qu'un paiement est réglé.",
        "noInvoicesPeriodTitle": "Aucun reçu sur cette période",
        "noInvoicesPeriodDesc": "Les reçus sont créés automatiquement lorsqu'un paiement est réglé. Élargissez la période ou consultez Transactions pour les paiements encore en confirmation.",
        "emptyStep1": "Un client paie un lien, un produit ou une facture API", "emptyStep2": "Le paiement est réglé on-chain",
        "emptyStep3": "Un reçu numéroté avec lignes de frais et TVA apparaît ici",
        "showAllTime": "Afficher tout", "viewTransactions": "Voir les transactions",
    },
    "nl": {
        "showingPeriod": "Periode", "exportPeriod": "Periode exporteren (CSV)", "exporting": "Exporteren…",
        "headerCollected": "Ontvangen", "headerCollectedCaption": "{{count}} afgerekende betalingen",
        "headerTax": "Geïnde belasting", "headerTaxCaption": "uit {{count}} betaalde bestellingen", "headerTaxNone": "Geen koperbelasting in deze periode",
        "headerFees": "Kosten", "headerFeesCaption": "Ingehouden Dynopay-kosten · {{count}} bonnen",
        "periodEmptyHint": "Er is in deze periode nog niets afgerekend. Bonnen en belastingregels verschijnen hier automatisch zodra een betaling is afgerekend.",
        "noInvoicesPeriodTitle": "Geen bonnen in deze periode",
        "noInvoicesPeriodDesc": "Bonnen worden automatisch aangemaakt wanneer een betaling is afgerekend. Verruim de periode of bekijk bij Transacties de betalingen die nog bevestigen.",
        "emptyStep1": "Een klant betaalt een link, product of API-factuur", "emptyStep2": "De betaling wordt on-chain afgerekend",
        "emptyStep3": "Hier verschijnt een genummerde bon met kosten- en btw-regels",
        "showAllTime": "Alles tonen", "viewTransactions": "Transacties bekijken",
    },
    "pt": {
        "showingPeriod": "A mostrar", "exportPeriod": "Exportar período (CSV)", "exporting": "A exportar…",
        "headerCollected": "Recebido", "headerCollectedCaption": "{{count}} pagamentos liquidados",
        "headerTax": "Impostos cobrados", "headerTaxCaption": "de {{count}} encomendas pagas", "headerTaxNone": "Sem imposto ao comprador neste período",
        "headerFees": "Taxas", "headerFeesCaption": "Taxas Dynopay deduzidas · {{count}} recibos",
        "periodEmptyHint": "Ainda nada foi liquidado neste período. Os recibos e linhas de imposto aparecem aqui automaticamente quando um pagamento liquida.",
        "noInvoicesPeriodTitle": "Sem recibos neste período",
        "noInvoicesPeriodDesc": "Os recibos são criados automaticamente quando um pagamento liquida. Alargue o período ou verifique em Transações os pagamentos ainda a confirmar.",
        "emptyStep1": "Um cliente paga um link, produto ou fatura API", "emptyStep2": "O pagamento liquida on-chain",
        "emptyStep3": "Aparece aqui um recibo numerado com linhas de taxa e IVA",
        "showAllTime": "Mostrar tudo", "viewTransactions": "Ver transações",
    },
}

for lang, patch in KEYS.items():
    p = os.path.join(ROOT, lang, "common.json")
    if not os.path.exists(p):
        continue
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    inv = data.get("invoices") or {}
    inv.update(patch)
    data["invoices"] = inv
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
