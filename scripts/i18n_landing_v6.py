#!/usr/bin/env python3
"""Inject landing v6 (hero + product bento) i18n keys into all 6 locales. Idempotent."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V6 = {
    "en": {
        "hero": {"h1a": "Get paid in crypto.", "h1b": "Keep it, or settle in stablecoins.", "primary": "Start now", "google": "Sign up with Google", "sandboxTag": "Live sandbox · real prices", "liveLabel": "Settled through Dynopay — live"},
        "vig": {"paid": "Paid", "settledAs": "settled as", "yourWallet": "your wallet", "more": "+{{n}} more", "oneTime": "one-time link", "pay": "Pay", "chooseCoin": "Choose a coin", "sendExactly": "Send exactly", "settlesIn": "Settles in USDC", "detected": "Detected", "confirming": "Confirming", "paidStep": "Paid", "addToCart": "Add to cart", "cart": "Cart", "live": "Live", "support": "Support {{name}}", "monthlyGoal": "{{pct}}% of monthly goal", "tip": "Tip", "donors": "{{n}} supporters", "invoice": "Invoice", "due": "Due", "total": "Total", "paidIn": "Paid in {{coin}}", "receipt": "Receipt PDF", "taxIncl": "VAT included", "buyNow": "Buy now", "oneLine": "One line of HTML", "request": "Request", "response": "Response", "webhook": "Webhook · payment.settled"},
    },
    "de": {
        "hero": {"h1a": "Werde in Krypto bezahlt.", "h1b": "Behalten – oder in Stablecoins abrechnen.", "primary": "Jetzt starten", "google": "Mit Google registrieren", "sandboxTag": "Live-Sandbox · echte Kurse", "liveLabel": "Über Dynopay abgerechnet — live"},
        "vig": {"paid": "Bezahlt", "settledAs": "abgerechnet als", "yourWallet": "deine Wallet", "more": "+{{n}} weitere", "oneTime": "Einmal-Link", "pay": "Zahlen", "chooseCoin": "Coin wählen", "sendExactly": "Genau senden", "settlesIn": "Abrechnung in USDC", "detected": "Erkannt", "confirming": "Bestätigung", "paidStep": "Bezahlt", "addToCart": "In den Warenkorb", "cart": "Warenkorb", "live": "Live", "support": "Unterstütze {{name}}", "monthlyGoal": "{{pct}} % des Monatsziels", "tip": "Trinkgeld", "donors": "{{n}} Unterstützer", "invoice": "Rechnung", "due": "Fällig", "total": "Gesamt", "paidIn": "Bezahlt in {{coin}}", "receipt": "Beleg als PDF", "taxIncl": "inkl. MwSt.", "buyNow": "Jetzt kaufen", "oneLine": "Eine Zeile HTML", "request": "Anfrage", "response": "Antwort", "webhook": "Webhook · payment.settled"},
    },
    "es": {
        "hero": {"h1a": "Cobra en cripto.", "h1b": "Quédatelo o liquida en stablecoins.", "primary": "Empezar ahora", "google": "Registrarse con Google", "sandboxTag": "Sandbox en vivo · precios reales", "liveLabel": "Liquidado a través de Dynopay — en vivo"},
        "vig": {"paid": "Pagado", "settledAs": "liquidado como", "yourWallet": "tu wallet", "more": "+{{n}} más", "oneTime": "enlace de un solo uso", "pay": "Pagar", "chooseCoin": "Elige una moneda", "sendExactly": "Envía exactamente", "settlesIn": "Se liquida en USDC", "detected": "Detectado", "confirming": "Confirmando", "paidStep": "Pagado", "addToCart": "Añadir al carrito", "cart": "Carrito", "live": "En vivo", "support": "Apoya a {{name}}", "monthlyGoal": "{{pct}} % del objetivo mensual", "tip": "Propina", "donors": "{{n}} colaboradores", "invoice": "Factura", "due": "Vence", "total": "Total", "paidIn": "Pagado en {{coin}}", "receipt": "Recibo en PDF", "taxIncl": "IVA incluido", "buyNow": "Comprar ahora", "oneLine": "Una línea de HTML", "request": "Solicitud", "response": "Respuesta", "webhook": "Webhook · payment.settled"},
    },
    "fr": {
        "hero": {"h1a": "Soyez payé en crypto.", "h1b": "Gardez-la, ou réglez en stablecoins.", "primary": "Commencer", "google": "S'inscrire avec Google", "sandboxTag": "Sandbox en direct · prix réels", "liveLabel": "Réglé via Dynopay — en direct"},
        "vig": {"paid": "Payé", "settledAs": "réglé en", "yourWallet": "votre wallet", "more": "+{{n}} autres", "oneTime": "lien unique", "pay": "Payer", "chooseCoin": "Choisir une crypto", "sendExactly": "Envoyez exactement", "settlesIn": "Réglé en USDC", "detected": "Détecté", "confirming": "Confirmation", "paidStep": "Payé", "addToCart": "Ajouter au panier", "cart": "Panier", "live": "En ligne", "support": "Soutenir {{name}}", "monthlyGoal": "{{pct}} % de l'objectif mensuel", "tip": "Pourboire", "donors": "{{n}} soutiens", "invoice": "Facture", "due": "Échéance", "total": "Total", "paidIn": "Payée en {{coin}}", "receipt": "Reçu PDF", "taxIncl": "TVA incluse", "buyNow": "Acheter", "oneLine": "Une ligne de HTML", "request": "Requête", "response": "Réponse", "webhook": "Webhook · payment.settled"},
    },
    "nl": {
        "hero": {"h1a": "Word betaald in crypto.", "h1b": "Houd het, of reken af in stablecoins.", "primary": "Nu starten", "google": "Registreren met Google", "sandboxTag": "Live sandbox · echte koersen", "liveLabel": "Afgerekend via Dynopay — live"},
        "vig": {"paid": "Betaald", "settledAs": "afgerekend als", "yourWallet": "jouw wallet", "more": "+{{n}} meer", "oneTime": "eenmalige link", "pay": "Betalen", "chooseCoin": "Kies een coin", "sendExactly": "Stuur precies", "settlesIn": "Afrekening in USDC", "detected": "Gedetecteerd", "confirming": "Bevestigen", "paidStep": "Betaald", "addToCart": "In winkelwagen", "cart": "Winkelwagen", "live": "Live", "support": "Steun {{name}}", "monthlyGoal": "{{pct}}% van het maanddoel", "tip": "Fooi", "donors": "{{n}} supporters", "invoice": "Factuur", "due": "Vervalt", "total": "Totaal", "paidIn": "Betaald in {{coin}}", "receipt": "Bon als PDF", "taxIncl": "incl. btw", "buyNow": "Nu kopen", "oneLine": "Eén regel HTML", "request": "Verzoek", "response": "Antwoord", "webhook": "Webhook · payment.settled"},
    },
    "pt": {
        "hero": {"h1a": "Receba em cripto.", "h1b": "Fique com ela, ou liquide em stablecoins.", "primary": "Começar agora", "google": "Registar com o Google", "sandboxTag": "Sandbox ao vivo · preços reais", "liveLabel": "Liquidado através da Dynopay — em direto"},
        "vig": {"paid": "Pago", "settledAs": "liquidado como", "yourWallet": "a sua carteira", "more": "+{{n}} mais", "oneTime": "ligação única", "pay": "Pagar", "chooseCoin": "Escolha uma moeda", "sendExactly": "Envie exatamente", "settlesIn": "Liquida em USDC", "detected": "Detetado", "confirming": "A confirmar", "paidStep": "Pago", "addToCart": "Adicionar ao carrinho", "cart": "Carrinho", "live": "Ao vivo", "support": "Apoie {{name}}", "monthlyGoal": "{{pct}}% do objetivo mensal", "tip": "Gorjeta", "donors": "{{n}} apoiantes", "invoice": "Fatura", "due": "Vencimento", "total": "Total", "paidIn": "Paga em {{coin}}", "receipt": "Recibo em PDF", "taxIncl": "IVA incluído", "buyNow": "Comprar agora", "oneLine": "Uma linha de HTML", "request": "Pedido", "response": "Resposta", "webhook": "Webhook · payment.settled"},
    },
}

for lang, block in V6.items():
    p = os.path.join(ROOT, "langs", "locales", lang, "landing.json")
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("v6", {})
    for k, v in block.items():
        data["v6"].setdefault(k, {}).update(v)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(lang, "ok", len(data["v6"]["vig"]), "vig keys")
