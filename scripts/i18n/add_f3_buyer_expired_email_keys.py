#!/usr/bin/env python3
"""One-off: F3 buyer payment-expired email keys for backend/locales/*/emails.json."""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "backend", "locales")

KEYS = {
  "en": {
    "subject": "Your payment to {{companyName}} didn't complete",
    "heading": "Payment window closed",
    "preheader": "The remaining amount didn't arrive in time.",
    "intro": "You sent a partial payment to <strong>{{companyName}}</strong>, but the remaining amount didn't arrive before the payment window closed.",
    "received": "You sent",
    "expected": "Amount due",
    "whatNext": "What happens next: {{companyName}} has been notified and can see exactly what arrived. Please contact them directly to settle the difference or arrange a refund of the partial amount.",
  },
  "de": {
    "subject": "Deine Zahlung an {{companyName}} wurde nicht abgeschlossen",
    "heading": "Zahlungsfenster geschlossen",
    "preheader": "Der Restbetrag ist nicht rechtzeitig eingegangen.",
    "intro": "Du hast eine Teilzahlung an <strong>{{companyName}}</strong> gesendet, aber der Restbetrag ist nicht vor Ablauf des Zahlungsfensters eingegangen.",
    "received": "Gesendet",
    "expected": "Fälliger Betrag",
    "whatNext": "Wie geht es weiter: {{companyName}} wurde benachrichtigt und sieht genau, was eingegangen ist. Bitte wende dich direkt an den Händler, um die Differenz zu begleichen oder eine Rückerstattung des Teilbetrags zu vereinbaren.",
  },
  "es": {
    "subject": "Tu pago a {{companyName}} no se completó",
    "heading": "Ventana de pago cerrada",
    "preheader": "El importe restante no llegó a tiempo.",
    "intro": "Enviaste un pago parcial a <strong>{{companyName}}</strong>, pero el importe restante no llegó antes de que se cerrara la ventana de pago.",
    "received": "Enviaste",
    "expected": "Importe pendiente",
    "whatNext": "Qué pasa ahora: {{companyName}} ha sido notificado y puede ver exactamente lo que llegó. Contacta con el comercio directamente para saldar la diferencia o acordar la devolución del importe parcial.",
  },
  "fr": {
    "subject": "Votre paiement à {{companyName}} n'a pas abouti",
    "heading": "Fenêtre de paiement fermée",
    "preheader": "Le montant restant n'est pas arrivé à temps.",
    "intro": "Vous avez envoyé un paiement partiel à <strong>{{companyName}}</strong>, mais le montant restant n'est pas arrivé avant la fermeture de la fenêtre de paiement.",
    "received": "Vous avez envoyé",
    "expected": "Montant dû",
    "whatNext": "Et maintenant : {{companyName}} a été informé et voit exactement ce qui est arrivé. Contactez-le directement pour régler la différence ou convenir d'un remboursement du montant partiel.",
  },
  "nl": {
    "subject": "Je betaling aan {{companyName}} is niet afgerond",
    "heading": "Betaalvenster gesloten",
    "preheader": "Het resterende bedrag kwam niet op tijd aan.",
    "intro": "Je hebt een gedeeltelijke betaling aan <strong>{{companyName}}</strong> gestuurd, maar het resterende bedrag kwam niet aan voordat het betaalvenster sloot.",
    "received": "Je hebt gestuurd",
    "expected": "Verschuldigd bedrag",
    "whatNext": "Wat nu: {{companyName}} is op de hoogte gebracht en ziet precies wat er is aangekomen. Neem rechtstreeks contact op om het verschil te voldoen of een terugbetaling van het deelbedrag af te spreken.",
  },
  "pt": {
    "subject": "O teu pagamento a {{companyName}} não foi concluído",
    "heading": "Janela de pagamento encerrada",
    "preheader": "O valor restante não chegou a tempo.",
    "intro": "Enviaste um pagamento parcial a <strong>{{companyName}}</strong>, mas o valor restante não chegou antes de a janela de pagamento encerrar.",
    "received": "Enviaste",
    "expected": "Valor em dívida",
    "whatNext": "O que acontece a seguir: {{companyName}} foi notificado e vê exatamente o que chegou. Contacta-o diretamente para acertar a diferença ou combinar o reembolso do valor parcial.",
  },
}

for lang, block in KEYS.items():
    fp = os.path.join(ROOT, lang, "emails.json")
    d = json.load(open(fp, encoding="utf-8"))
    d.setdefault("buyerPaymentExpired", {}).update(block)
    json.dump(d, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(fp, "a", encoding="utf-8").write("\n")
    print(lang, "ok")
