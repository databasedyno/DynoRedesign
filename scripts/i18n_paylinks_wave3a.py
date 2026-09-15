#!/usr/bin/env python3
"""Wave 3a — Payment links table/filter i18n keys in paymentLinks.json (EN + 5). Idempotent."""
import json, os

ROOT = "/app/langs/locales"

KEYS = {
    "en": {
        "last30Header": "Last 30 days", "last30Tooltip": "Settled payments on this link in the last 30 days (count · gross USD).",
        "last30Tip": "{{count}} settled payments all-time", "paidCount": "{{count}} paid", "noPayments30d": "— none in 30d",
        "expiringSoon": "Expiring soon", "expiringSoonTip": "Closes in about {{count}} h — extend it or share it now.",
        "statusEarning": "Earning (30d)", "statusExpiringSoon": "Expiring soon",
        "qrTooltip": "Show QR code", "shareTooltip": "Share link",
    },
    "de": {
        "last30Header": "Letzte 30 Tage", "last30Tooltip": "Abgerechnete Zahlungen über diesen Link in den letzten 30 Tagen (Anzahl · Brutto-USD).",
        "last30Tip": "{{count}} abgerechnete Zahlungen insgesamt", "paidCount": "{{count}} bezahlt", "noPayments30d": "— keine in 30 T.",
        "expiringSoon": "Läuft bald ab", "expiringSoonTip": "Schließt in etwa {{count}} Std. — verlängern oder jetzt teilen.",
        "statusEarning": "Verdient (30 T.)", "statusExpiringSoon": "Läuft bald ab",
        "qrTooltip": "QR-Code anzeigen", "shareTooltip": "Link teilen",
    },
    "es": {
        "last30Header": "Últimos 30 días", "last30Tooltip": "Pagos liquidados en este enlace en los últimos 30 días (número · USD bruto).",
        "last30Tip": "{{count}} pagos liquidados en total", "paidCount": "{{count}} pagados", "noPayments30d": "— ninguno en 30 d",
        "expiringSoon": "Expira pronto", "expiringSoonTip": "Se cierra en unas {{count}} h — amplíalo o compártelo ahora.",
        "statusEarning": "Con ingresos (30 d)", "statusExpiringSoon": "Expira pronto",
        "qrTooltip": "Mostrar código QR", "shareTooltip": "Compartir enlace",
    },
    "fr": {
        "last30Header": "30 derniers jours", "last30Tooltip": "Paiements réglés sur ce lien au cours des 30 derniers jours (nombre · USD brut).",
        "last30Tip": "{{count}} paiements réglés au total", "paidCount": "{{count}} payés", "noPayments30d": "— aucun en 30 j",
        "expiringSoon": "Expire bientôt", "expiringSoonTip": "Se ferme dans environ {{count}} h — prolongez-le ou partagez-le maintenant.",
        "statusEarning": "Rapporte (30 j)", "statusExpiringSoon": "Expire bientôt",
        "qrTooltip": "Afficher le QR code", "shareTooltip": "Partager le lien",
    },
    "nl": {
        "last30Header": "Laatste 30 dagen", "last30Tooltip": "Afgerekende betalingen via deze link in de laatste 30 dagen (aantal · bruto USD).",
        "last30Tip": "{{count}} afgerekende betalingen in totaal", "paidCount": "{{count}} betaald", "noPayments30d": "— geen in 30 d",
        "expiringSoon": "Verloopt binnenkort", "expiringSoonTip": "Sluit in ongeveer {{count}} u — verleng of deel nu.",
        "statusEarning": "Verdient (30 d)", "statusExpiringSoon": "Verloopt binnenkort",
        "qrTooltip": "QR-code tonen", "shareTooltip": "Link delen",
    },
    "pt": {
        "last30Header": "Últimos 30 dias", "last30Tooltip": "Pagamentos liquidados neste link nos últimos 30 dias (número · USD bruto).",
        "last30Tip": "{{count}} pagamentos liquidados no total", "paidCount": "{{count}} pagos", "noPayments30d": "— nenhum em 30 d",
        "expiringSoon": "Expira em breve", "expiringSoonTip": "Fecha em cerca de {{count}} h — prolongue ou partilhe agora.",
        "statusEarning": "A render (30 d)", "statusExpiringSoon": "Expira em breve",
        "qrTooltip": "Mostrar código QR", "shareTooltip": "Partilhar link",
    },
}

for lang, patch in KEYS.items():
    p = os.path.join(ROOT, lang, "paymentLinks.json")
    if not os.path.exists(p):
        continue
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    data.update(patch)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
