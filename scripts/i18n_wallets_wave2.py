#!/usr/bin/env python3
"""Wave 2c — Payout-wallets page i18n keys (walletScreen.json, EN + 5 locales). Idempotent."""
import json, os

ROOT = "/app/langs/locales"

TOP = {
    "en": {
        "coverageTitle": "{{count}} accepted coins have no payout wallet",
        "coverageBody": "Your live payment links accept these coins, but payments in them have nowhere to land. Add a wallet to start receiving them.",
        "formatOk": "Format OK", "formatUnusual": "Unusual format",
        "formatOkTip": "This address matches the usual {{chain}} format.",
        "formatUnusualTip": "This doesn't look like a typical {{chain}} address. Double-check it before your next payout.",
        "lastPayoutNone": "No payouts to this wallet yet", "lastPayoutAt": "Last payout {{when}}", "in30d": "in 30d",
    },
    "de": {
        "coverageTitle": "{{count}} akzeptierte Coins haben keine Auszahlungs-Wallet",
        "coverageBody": "Ihre aktiven Zahlungslinks akzeptieren diese Coins, aber Zahlungen darin haben kein Ziel. Fügen Sie eine Wallet hinzu, um sie zu empfangen.",
        "formatOk": "Format OK", "formatUnusual": "Ungewöhnliches Format",
        "formatOkTip": "Diese Adresse entspricht dem üblichen {{chain}}-Format.",
        "formatUnusualTip": "Das sieht nicht wie eine typische {{chain}}-Adresse aus. Prüfen Sie sie vor der nächsten Auszahlung.",
        "lastPayoutNone": "Noch keine Auszahlungen an diese Wallet", "lastPayoutAt": "Letzte Auszahlung {{when}}", "in30d": "in 30 T",
    },
    "es": {
        "coverageTitle": "{{count}} monedas aceptadas no tienen wallet de pago",
        "coverageBody": "Tus enlaces de pago activos aceptan estas monedas, pero los pagos en ellas no tienen destino. Añade una wallet para empezar a recibirlas.",
        "formatOk": "Formato correcto", "formatUnusual": "Formato inusual",
        "formatOkTip": "Esta dirección coincide con el formato habitual de {{chain}}.",
        "formatUnusualTip": "No parece una dirección típica de {{chain}}. Revísala antes de tu próximo pago.",
        "lastPayoutNone": "Aún no hay pagos a esta wallet", "lastPayoutAt": "Último pago {{when}}", "in30d": "en 30 d",
    },
    "fr": {
        "coverageTitle": "{{count}} cryptos acceptées n'ont pas de wallet de versement",
        "coverageBody": "Vos liens de paiement actifs acceptent ces cryptos, mais les paiements n'ont nulle part où arriver. Ajoutez un wallet pour les recevoir.",
        "formatOk": "Format OK", "formatUnusual": "Format inhabituel",
        "formatOkTip": "Cette adresse correspond au format habituel {{chain}}.",
        "formatUnusualTip": "Cela ne ressemble pas à une adresse {{chain}} classique. Vérifiez-la avant votre prochain versement.",
        "lastPayoutNone": "Aucun versement vers ce wallet pour l'instant", "lastPayoutAt": "Dernier versement {{when}}", "in30d": "sur 30 j",
    },
    "nl": {
        "coverageTitle": "{{count}} geaccepteerde coins hebben geen uitbetalingswallet",
        "coverageBody": "Je actieve betaallinks accepteren deze coins, maar betalingen erin kunnen nergens landen. Voeg een wallet toe om ze te ontvangen.",
        "formatOk": "Formaat OK", "formatUnusual": "Ongewoon formaat",
        "formatOkTip": "Dit adres komt overeen met het gebruikelijke {{chain}}-formaat.",
        "formatUnusualTip": "Dit lijkt geen typisch {{chain}}-adres. Controleer het voor je volgende uitbetaling.",
        "lastPayoutNone": "Nog geen uitbetalingen naar deze wallet", "lastPayoutAt": "Laatste uitbetaling {{when}}", "in30d": "in 30 d",
    },
    "pt": {
        "coverageTitle": "{{count}} moedas aceites não têm wallet de pagamento",
        "coverageBody": "Os seus links de pagamento ativos aceitam estas moedas, mas os pagamentos nelas não têm destino. Adicione uma wallet para começar a recebê-las.",
        "formatOk": "Formato OK", "formatUnusual": "Formato incomum",
        "formatOkTip": "Este endereço corresponde ao formato habitual de {{chain}}.",
        "formatUnusualTip": "Isto não parece um endereço {{chain}} típico. Verifique-o antes do próximo pagamento.",
        "lastPayoutNone": "Ainda sem pagamentos para esta wallet", "lastPayoutAt": "Último pagamento {{when}}", "in30d": "em 30 d",
    },
}

SECURITY = {
    "en": {
        "stripTitle": "Wallet protection", "stripManage": "Manage in Settings",
        "stripLocked": "Wallet changes are frozen after a “this wasn't me” report.",
        "stripStrong": "One-time code on every change · undo link by email · two-factor sign-in on.",
        "stripStandard": "One-time code on every change · undo link by email. Turn on two-factor sign-in to reach Strong.",
    },
    "de": {
        "stripTitle": "Wallet-Schutz", "stripManage": "In Einstellungen verwalten",
        "stripLocked": "Wallet-Änderungen sind nach einer „Das war ich nicht“-Meldung gesperrt.",
        "stripStrong": "Einmalcode bei jeder Änderung · Rückgängig-Link per E-Mail · Zwei-Faktor-Anmeldung aktiv.",
        "stripStandard": "Einmalcode bei jeder Änderung · Rückgängig-Link per E-Mail. Aktivieren Sie die Zwei-Faktor-Anmeldung für „Stark“.",
    },
    "es": {
        "stripTitle": "Protección de wallets", "stripManage": "Gestionar en Ajustes",
        "stripLocked": "Los cambios de wallet están congelados tras un aviso de “no fui yo”.",
        "stripStrong": "Código de un solo uso en cada cambio · enlace para deshacer por email · inicio de sesión en dos pasos activo.",
        "stripStandard": "Código de un solo uso en cada cambio · enlace para deshacer por email. Activa la verificación en dos pasos para llegar a Fuerte.",
    },
    "fr": {
        "stripTitle": "Protection des wallets", "stripManage": "Gérer dans les Paramètres",
        "stripLocked": "Les modifications de wallet sont gelées après un signalement « ce n'était pas moi ».",
        "stripStrong": "Code à usage unique à chaque modification · lien d'annulation par e-mail · connexion à deux facteurs activée.",
        "stripStandard": "Code à usage unique à chaque modification · lien d'annulation par e-mail. Activez la connexion à deux facteurs pour atteindre Fort.",
    },
    "nl": {
        "stripTitle": "Walletbeveiliging", "stripManage": "Beheren in Instellingen",
        "stripLocked": "Walletwijzigingen zijn bevroren na een “dit was ik niet”-melding.",
        "stripStrong": "Eenmalige code bij elke wijziging · ongedaan-maken-link per e-mail · tweestapsverificatie aan.",
        "stripStandard": "Eenmalige code bij elke wijziging · ongedaan-maken-link per e-mail. Zet tweestapsverificatie aan voor Sterk.",
    },
    "pt": {
        "stripTitle": "Proteção das wallets", "stripManage": "Gerir nas Definições",
        "stripLocked": "As alterações de wallet estão congeladas após um aviso de “não fui eu”.",
        "stripStrong": "Código único em cada alteração · link para anular por e-mail · autenticação de dois fatores ativa.",
        "stripStandard": "Código único em cada alteração · link para anular por e-mail. Ative a autenticação de dois fatores para chegar a Forte.",
    },
}

for lang in TOP:
    p = os.path.join(ROOT, lang, "walletScreen.json")
    if not os.path.exists(p):
        continue
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    data.update(TOP[lang])
    sec = data.get("security") or {}
    sec.update(SECURITY[lang])
    data["security"] = sec
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
