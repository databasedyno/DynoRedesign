#!/usr/bin/env python3
"""Injector for v3.solutions (Solutions grid) into all 6 landing.json locales.
Format-preserving (indent=2, ensure_ascii=False, trailing newline kept)."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

SOLUTIONS = {
  "en": {
    "eyebrow": "[ Solutions ]", "headline1": "Built for how", "headline2": "you get paid.",
    "body": "Whatever you sell, there's a Dynopay setup for it — same wallet, same low fees, same non-custodial rails.",
    "ecommerce": {"title": "E-commerce", "desc": "A hosted cart with VAT and instant crypto checkout for physical or digital goods."},
    "saas": {"title": "SaaS", "desc": "Bill subscriptions and seats through the API, with signed webhooks for provisioning."},
    "downloads": {"title": "Digital downloads", "desc": "Deliver files, license keys or links automatically the moment payment confirms."},
    "freelancers": {"title": "Freelancers", "desc": "Send crypto invoices with VAT and get paid straight to your own wallet."},
    "remittance": {"title": "Remittance", "desc": "Move value across borders in minutes — no bank hours, no chargebacks."},
    "gaming": {"title": "Gaming", "desc": "Take global top-ups and in-game purchases with low, predictable fees."}
  },
  "es": {
    "eyebrow": "[ Soluciones ]", "headline1": "Hecho para tu", "headline2": "forma de cobrar.",
    "body": "Vendas lo que vendas, hay una configuración de Dynopay para ti: la misma cartera, las mismas comisiones bajas, los mismos rieles sin custodia.",
    "ecommerce": {"title": "E-commerce", "desc": "Un carrito alojado con IVA y checkout cripto instantáneo para productos físicos o digitales."},
    "saas": {"title": "SaaS", "desc": "Cobra suscripciones y licencias vía API, con webhooks firmados para el aprovisionamiento."},
    "downloads": {"title": "Descargas digitales", "desc": "Entrega archivos, claves de licencia o enlaces automáticamente en cuanto se confirma el pago."},
    "freelancers": {"title": "Freelancers", "desc": "Envía facturas cripto con IVA y cobra directo en tu propia cartera."},
    "remittance": {"title": "Remesas", "desc": "Mueve valor entre países en minutos: sin horarios bancarios ni contracargos."},
    "gaming": {"title": "Gaming", "desc": "Acepta recargas globales y compras dentro del juego con comisiones bajas y predecibles."}
  },
  "pt": {
    "eyebrow": "[ Soluções ]", "headline1": "Feito para o seu", "headline2": "jeito de receber.",
    "body": "Não importa o que você venda, há uma configuração Dynopay para isso: a mesma carteira, as mesmas taxas baixas, os mesmos trilhos sem custódia.",
    "ecommerce": {"title": "E-commerce", "desc": "Um carrinho hospedado com IVA e checkout cripto instantâneo para produtos físicos ou digitais."},
    "saas": {"title": "SaaS", "desc": "Cobre assinaturas e licenças pela API, com webhooks assinados para o provisionamento."},
    "downloads": {"title": "Downloads digitais", "desc": "Entregue arquivos, chaves de licença ou links automaticamente assim que o pagamento confirmar."},
    "freelancers": {"title": "Freelancers", "desc": "Envie faturas cripto com IVA e receba direto na sua própria carteira."},
    "remittance": {"title": "Remessas", "desc": "Mova valor entre países em minutos — sem horário bancário, sem estornos."},
    "gaming": {"title": "Games", "desc": "Aceite recargas globais e compras no jogo com taxas baixas e previsíveis."}
  },
  "fr": {
    "eyebrow": "[ Solutions ]", "headline1": "Pensé pour votre", "headline2": "façon d'encaisser.",
    "body": "Quoi que vous vendiez, il y a une configuration Dynopay pour ça : le même portefeuille, les mêmes frais bas, les mêmes rails non dépositaires.",
    "ecommerce": {"title": "E-commerce", "desc": "Un panier hébergé avec TVA et checkout crypto instantané pour produits physiques ou numériques."},
    "saas": {"title": "SaaS", "desc": "Facturez abonnements et sièges via l'API, avec webhooks signés pour le provisionnement."},
    "downloads": {"title": "Téléchargements", "desc": "Livrez fichiers, clés de licence ou liens automatiquement dès la confirmation du paiement."},
    "freelancers": {"title": "Freelances", "desc": "Envoyez des factures crypto avec TVA et soyez payé directement sur votre propre portefeuille."},
    "remittance": {"title": "Transferts", "desc": "Déplacez de la valeur entre pays en minutes — sans horaires bancaires ni rétrofacturations."},
    "gaming": {"title": "Gaming", "desc": "Acceptez recharges mondiales et achats in-game avec des frais bas et prévisibles."}
  },
  "de": {
    "eyebrow": "[ Lösungen ]", "headline1": "Gebaut für Ihre", "headline2": "Art, bezahlt zu werden.",
    "body": "Was auch immer Sie verkaufen — es gibt ein Dynopay-Setup dafür: dieselbe Wallet, dieselben niedrigen Gebühren, dieselben Non-custodial-Rails.",
    "ecommerce": {"title": "E-Commerce", "desc": "Ein gehosteter Warenkorb mit USt und sofortigem Krypto-Checkout für physische oder digitale Waren."},
    "saas": {"title": "SaaS", "desc": "Rechnen Sie Abos und Sitze über die API ab – mit signierten Webhooks fürs Provisioning."},
    "downloads": {"title": "Digitale Downloads", "desc": "Liefern Sie Dateien, Lizenzschlüssel oder Links automatisch, sobald die Zahlung bestätigt ist."},
    "freelancers": {"title": "Freelancer", "desc": "Senden Sie Krypto-Rechnungen mit USt und werden Sie direkt in Ihre eigene Wallet bezahlt."},
    "remittance": {"title": "Überweisungen", "desc": "Bewegen Sie Werte in Minuten über Grenzen – ohne Bankzeiten, ohne Rückbuchungen."},
    "gaming": {"title": "Gaming", "desc": "Nehmen Sie weltweite Aufladungen und In-Game-Käufe mit niedrigen, planbaren Gebühren an."}
  },
  "nl": {
    "eyebrow": "[ Oplossingen ]", "headline1": "Gebouwd voor hoe", "headline2": "jij betaald wordt.",
    "body": "Wat je ook verkoopt, er is een Dynopay-opzet voor: dezelfde wallet, dezelfde lage kosten, dezelfde non-custodial rails.",
    "ecommerce": {"title": "E-commerce", "desc": "Een gehoste winkelwagen met btw en directe crypto-checkout voor fysieke of digitale producten."},
    "saas": {"title": "SaaS", "desc": "Factureer abonnementen en seats via de API, met ondertekende webhooks voor provisioning."},
    "downloads": {"title": "Digitale downloads", "desc": "Lever bestanden, licentiesleutels of links automatisch zodra de betaling bevestigt."},
    "freelancers": {"title": "Freelancers", "desc": "Verstuur crypto-facturen met btw en word direct betaald in je eigen wallet."},
    "remittance": {"title": "Overboekingen", "desc": "Verplaats waarde in minuten over grenzen — geen banktijden, geen terugboekingen."},
    "gaming": {"title": "Gaming", "desc": "Accepteer wereldwijde top-ups en in-game aankopen met lage, voorspelbare kosten."}
  }
}


def load(path):
    with open(path, "rb") as f:
        b = f.read()
    return json.loads(b), b.endswith(b"\n")


def save(path, data, nl):
    txt = json.dumps(data, indent=2, ensure_ascii=False)
    if nl:
        txt += "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)


for loc in ["en", "es", "pt", "fr", "de", "nl"]:
    lp = os.path.join(BASE, loc, "landing.json")
    d, nl = load(lp)
    d.setdefault("v3", {})
    d["v3"]["solutions"] = SOLUTIONS[loc]
    save(lp, d, nl)
    print(f"[{loc}] solutions injected")

print("DONE")
