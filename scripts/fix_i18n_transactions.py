#!/usr/bin/env python3
import json, io

T = {
  "de": {
    "settlementWallet": "Auszahlungs-Wallet",
    "settlementWalletHint": "Gelder werden erst hierher gesendet, nachdem die Zahlung eingegangen und on-chain bestätigt wurde.",
    "awaitingPaymentTitle": "Warten auf Zahlung – noch keine Gelder eingegangen",
    "awaitingPaymentBody": "Wir haben für diese Zahlung noch keinen On-Chain-Eingang erkannt, daher wurde noch nichts an Ihre Wallet gesendet. Dieser Eintrag wird automatisch aktualisiert, sobald die Gelder des Kunden eingehen und bestätigt sind.",
  },
  "es": {
    "settlementWallet": "Billetera de liquidación",
    "settlementWalletHint": "Los fondos se envían aquí solo después de que el pago se reciba y se confirme on-chain.",
    "awaitingPaymentTitle": "Esperando el pago: aún no se han recibido fondos",
    "awaitingPaymentBody": "No hemos detectado un depósito on-chain para este pago, por lo que aún no se ha enviado nada a tu billetera. Esta entrada se actualizará automáticamente cuando los fondos del cliente lleguen y se confirmen.",
  },
  "fr": {
    "settlementWallet": "Portefeuille de règlement",
    "settlementWalletHint": "Les fonds ne sont envoyés ici qu'après réception et confirmation du paiement on-chain.",
    "awaitingPaymentTitle": "En attente de paiement — aucun fonds reçu pour le moment",
    "awaitingPaymentBody": "Nous n'avons pas détecté de dépôt on-chain pour ce paiement, donc rien n'a encore été envoyé vers votre portefeuille. Cette entrée sera mise à jour automatiquement dès que les fonds du client seront reçus et confirmés.",
  },
  "nl": {
    "settlementWallet": "Uitbetalingswallet",
    "settlementWalletHint": "Geld wordt hier pas naartoe gestuurd nadat de betaling is ontvangen en on-chain bevestigd.",
    "awaitingPaymentTitle": "Wachten op betaling — nog geen geld ontvangen",
    "awaitingPaymentBody": "We hebben nog geen on-chain storting voor deze betaling gedetecteerd, dus er is nog niets naar je wallet gestuurd. Dit item wordt automatisch bijgewerkt zodra het geld van de klant binnenkomt en is bevestigd.",
  },
  "pt": {
    "settlementWallet": "Carteira de liquidação",
    "settlementWalletHint": "Os fundos só são enviados para aqui depois de o pagamento ser recebido e confirmado on-chain.",
    "awaitingPaymentTitle": "Aguardando pagamento — nenhum fundo recebido ainda",
    "awaitingPaymentBody": "Não detetámos um depósito on-chain para este pagamento, por isso ainda não foi enviado nada para a sua carteira. Esta entrada será atualizada automaticamente assim que os fundos do cliente chegarem e forem confirmados.",
  },
}

ORDER = ["settlementWallet", "settlementWalletHint", "awaitingPaymentTitle", "awaitingPaymentBody"]

for lang, keys in T.items():
    path = f"/app/langs/locales/{lang}/transactions.json"
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    added = []
    for k in ORDER:
        if k not in data:
            data[k] = keys[k]
            added.append(k)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{lang}: added {added}")
