#!/usr/bin/env python3
"""One-shot: scrub $1 from landing marketing copy + align audience section to hero voice (6 locales)."""
import json, sys

BASE = "/app/langs/locales/{}/landing.json"

# key: locale -> (old_substring, new_substring) applied inside existing value
SUBS = {
    "hero.body": {
        "en": ("<b>1.5% + $1 per payment, dropping to as low as 0.5% as your volume grows.</b>",
               "<b>Fees from 1.5% per payment, dropping to as low as 0.5% as your volume grows.</b>"),
        "es": ("<b>1,5 % + 1 $ por pago, bajando hasta el 0,5 % a medida que crece tu volumen.</b>",
               "<b>Comisiones desde el 1,5 % por pago, bajando hasta el 0,5 % a medida que crece tu volumen.</b>"),
        "pt": ("<b>1,5% + $1 por pagamento, caindo para até 0,5% conforme seu volume cresce.</b>",
               "<b>Taxas a partir de 1,5% por pagamento, caindo para até 0,5% conforme seu volume cresce.</b>"),
        "fr": ("<b>1,5 % + 1 $ par paiement, jusqu'à 0,5 % à mesure que votre volume augmente.</b>",
               "<b>Frais à partir de 1,5 % par paiement, jusqu'à 0,5 % à mesure que votre volume augmente.</b>"),
        "de": ("<b>1,5 % + 1 $ pro Zahlung, sinkt auf bis zu 0,5 %, wenn dein Volumen wächst.</b>",
               "<b>Gebühren ab 1,5 % pro Zahlung, sinkend auf bis zu 0,5 %, wenn dein Volumen wächst.</b>"),
        "nl": ("<b>1,5% + $1 per betaling, dalend tot 0,5% naarmate je volume groeit.</b>",
               "<b>Kosten vanaf 1,5% per betaling, dalend tot 0,5% naarmate je volume groeit.</b>"),
    },
    "story.step3.body": {
        "en": ("1.5% + $1 to start,", "1.5% to start,"),
        "es": ("1,5 % + 1 $ para empezar,", "1,5 % para empezar,"),
        "pt": ("1,5% + $1 para começar,", "1,5% para começar,"),
        "fr": ("1,5 % + 1 $ pour commencer,", "1,5 % pour commencer,"),
        "de": ("1,5 % + 1 $ zum Start,", "1,5 % zum Start,"),
        "nl": ("1,5% + $1 om te starten,", "1,5% om te starten,"),
    },
    "press.boilerplateBody": {
        "en": ("Fees are 1.5% + $1 per payment,", "Fees start at 1.5% per payment,"),
        "es": ("Las comisiones son del 1,5 % + 1 $ por pago,", "Las comisiones parten del 1,5 % por pago,"),
        "pt": ("As taxas são de 1,5% + $1 por pagamento,", "As taxas partem de 1,5% por pagamento,"),
        "fr": ("Les frais sont de 1,5 % + 1 $ par paiement,", "Les frais démarrent à 1,5 % par paiement,"),
        "de": ("Die Gebühren betragen 1,5 % + 1 $ pro Zahlung,", "Die Gebühren beginnen bei 1,5 % pro Zahlung,"),
        "nl": ("De kosten zijn 1,5% + $1 per betaling,", "De kosten beginnen bij 1,5% per betaling,"),
    },
}

# key: locale -> full new value
SETS = {
    "hero.metaSettle": {
        "en": "Settles to the coin you choose · <b>fees from 1.5%, down to 0.5% at scale</b>",
        "es": "Se liquida en la moneda que elijas · <b>comisiones desde el 1,5 %, hasta el 0,5 % a escala</b>",
        "pt": "Liquida na moeda que você escolher · <b>taxas a partir de 1,5%, até 0,5% em escala</b>",
        "fr": "Règlement dans la crypto de votre choix · <b>frais à partir de 1,5 %, jusqu'à 0,5 % à grande échelle</b>",
        "de": "Auszahlung in der Coin deiner Wahl · <b>Gebühren ab 1,5 %, bis zu 0,5 % bei Skalierung</b>",
        "nl": "Uitbetaling in de munt die jij kiest · <b>kosten vanaf 1,5%, tot 0,5% bij schaal</b>",
    },
    "faq.a3": {
        "en": "Every payment costs a simple percentage — from 1.5% (Starter) down to 0.5% (Enterprise), based on your all-time settled volume — and your first payment is fee-free. No monthly fee, no setup fee, no chargebacks. See the Fees page for full pricing details.",
        "es": "Cada pago cuesta un porcentaje simple: del 1,5 % (Starter) al 0,5 % (Enterprise), según tu volumen liquidado histórico, y tu primer pago es sin comisión. Sin cuota mensual, sin coste de alta, sin contracargos. Consulta la página de Comisiones para ver el detalle completo.",
        "pt": "Cada pagamento custa uma porcentagem simples — de 1,5% (Starter) até 0,5% (Enterprise), com base no seu volume liquidado total — e seu primeiro pagamento é sem taxa. Sem taxa mensal, sem taxa de configuração, sem estornos. Veja a página de Taxas para os detalhes completos.",
        "fr": "Chaque paiement coûte un simple pourcentage — de 1,5 % (Starter) à 0,5 % (Enterprise), selon votre volume réglé cumulé — et votre premier paiement est sans frais. Aucun frais mensuel, aucun frais d'installation, aucune rétrofacturation. Voir la page Tarifs pour le détail complet.",
        "de": "Jede Zahlung kostet einen einfachen Prozentsatz — von 1,5 % (Starter) bis 0,5 % (Enterprise), basierend auf deinem gesamten abgewickelten Volumen — und deine erste Zahlung ist gebührenfrei. Keine monatliche Gebühr, keine Einrichtungsgebühr, keine Rückbuchungen. Alle Details findest du auf der Gebührenseite.",
        "nl": "Elke betaling kost een eenvoudig percentage — van 1,5% (Starter) tot 0,5% (Enterprise), op basis van je totale afgewikkelde volume — en je eerste betaling is gratis. Geen maandkosten, geen opstartkosten, geen terugboekingen. Zie de Tarievenpagina voor alle details.",
    },
    "learn.fees.desc": {
        "en": "From 1.5% per payment down to 0.5% as you grow. No monthly fee, no setup fee, no chargebacks — ever.",
        "es": "Desde el 1,5 % por pago hasta el 0,5 % a medida que creces. Sin cuota mensual, sin coste de alta, sin contracargos, nunca.",
        "pt": "A partir de 1,5% por pagamento, até 0,5% conforme você cresce. Sem taxa mensal, sem taxa de configuração, sem estornos — nunca.",
        "fr": "À partir de 1,5 % par paiement, jusqu'à 0,5 % à mesure que vous grandissez. Aucun frais mensuel, aucun frais d'installation, aucune rétrofacturation — jamais.",
        "de": "Ab 1,5 % pro Zahlung, bis auf 0,5 %, wenn du wächst. Keine monatliche Gebühr, keine Einrichtungsgebühr, keine Rückbuchungen – niemals.",
        "nl": "Vanaf 1,5% per betaling, tot 0,5% naarmate je groeit. Geen maandkosten, geen opstartkosten, geen terugboekingen — nooit.",
    },
    "whopays.merchantNote": {
        "en": "You cover the fee, so the price your customer sees stays exactly $100.",
        "es": "Tú cubres la comisión, así que el precio que ve tu cliente sigue siendo exactamente $100.",
        "pt": "Você cobre a taxa, então o preço que o cliente vê continua exatamente $100.",
        "fr": "Vous couvrez les frais, donc le prix que voit votre client reste exactement $100.",
        "de": "Sie tragen die Gebühr, sodass der Preis für Ihren Kunden exakt $100 bleibt.",
        "nl": "Jij draagt de kosten, dus de prijs die je klant ziet blijft precies $100.",
    },
    "whopays.feeFootnote": {
        "en": "Example at the Starter rate with all per-payment fees included — see the Fees page for full pricing. Your rate drops to 0.5% as your volume grows.",
        "es": "Ejemplo con la tarifa Starter, con todas las comisiones por pago incluidas — consulta la página de Comisiones para el detalle completo. Tu tarifa baja al 0,5 % a medida que crece tu volumen.",
        "pt": "Exemplo com a tarifa Starter, com todas as taxas por pagamento incluídas — veja a página de Taxas para os detalhes completos. Sua tarifa cai para 0,5% conforme seu volume cresce.",
        "fr": "Exemple au tarif Starter, tous les frais par paiement inclus — voir la page Tarifs pour le détail complet. Votre taux descend à 0,5 % à mesure que le volume augmente.",
        "de": "Beispiel zum Starter-Satz, alle Gebühren pro Zahlung inklusive — alle Details auf der Gebührenseite. Ihr Satz sinkt mit dem Volumen auf 0,5 %.",
        "nl": "Voorbeeld met het Starter-tarief, alle kosten per betaling inbegrepen — zie de Tarievenpagina voor alle details. Je tarief daalt naar 0,5% naarmate je volume groeit.",
    },
    "audience.headline1": {
        "en": "One crypto checkout.", "es": "Un checkout cripto.", "pt": "Um checkout cripto.",
        "fr": "Un checkout crypto.", "de": "Ein Krypto-Checkout.", "nl": "Eén crypto-checkout.",
    },
    "audience.headline2": {
        "en": "Every kind of business.", "es": "Todo tipo de negocio.", "pt": "Todo tipo de negócio.",
        "fr": "Tous les types d'activité.", "de": "Jede Art von Business.", "nl": "Elk soort bedrijf.",
    },
    "audience.body": {
        "en": "Merchants, creators, fundraisers, developers — pick your door. The same hosted checkout and payment links, the same wallet you control, the same simple fee.",
        "es": "Comercios, creadores, recaudadores, desarrolladores: elige tu puerta. El mismo checkout alojado y enlaces de pago, la misma wallet que tú controlas, la misma comisión simple.",
        "pt": "Lojistas, criadores, arrecadadores, desenvolvedores — escolha sua porta. O mesmo checkout hospedado e links de pagamento, a mesma carteira que você controla, a mesma taxa simples.",
        "fr": "Marchands, créateurs, collecteurs de fonds, développeurs — choisissez votre porte. Le même checkout hébergé et les mêmes liens de paiement, le même wallet que vous contrôlez, les mêmes frais simples.",
        "de": "Händler, Creator, Fundraiser, Entwickler – wähle deine Tür. Derselbe gehostete Checkout und dieselben Zahlungslinks, dieselbe Wallet, die du kontrollierst, dieselbe einfache Gebühr.",
        "nl": "Verkopers, creators, fondsenwervers, developers — kies je deur. Dezelfde gehoste checkout en betaallinks, dezelfde wallet die jij beheert, dezelfde eenvoudige kosten.",
    },
    "press.facts.pricing.value": {
        "en": "From 1.5% per transaction, as low as 0.5% at scale — no monthly fees",
        "es": "Desde el 1,5 % por transacción, hasta el 0,5 % a escala — sin cuotas mensuales",
        "pt": "A partir de 1,5% por transação, até 0,5% em escala — sem taxas mensais",
        "fr": "À partir de 1,5 % par transaction, jusqu'à 0,5 % à grande échelle — aucun frais mensuel",
        "de": "Ab 1,5 % pro Transaktion, bis zu 0,5 % bei Skalierung – keine monatlichen Gebühren",
        "nl": "Vanaf 1,5% per transactie, tot 0,5% bij schaal — geen maandkosten",
    },
}


def resolve(doc, dotted):
    parts = dotted.split(".")
    if parts[0] == "press":
        node = doc["press"]
        parts = parts[1:]
    else:
        node = doc["v3"]
    for p in parts[:-1]:
        node = node[p]
    return node, parts[-1]


errors = []
for lang in ["en", "es", "pt", "fr", "de", "nl"]:
    path = BASE.format(lang)
    doc = json.load(open(path, encoding="utf-8"))

    for key, per in SUBS.items():
        old, new = per[lang]
        node, leaf = resolve(doc, key)
        if old not in node[leaf]:
            errors.append(f"{lang}:{key} — old substring not found")
            continue
        node[leaf] = node[leaf].replace(old, new)

    for key, per in SETS.items():
        node, leaf = resolve(doc, key)
        if leaf not in node:
            errors.append(f"{lang}:{key} — key missing")
            continue
        node[leaf] = per[lang]

    with open(path, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"{lang}: OK")

if errors:
    print("ERRORS:", *errors, sep="\n  ")
    sys.exit(1)
print("all locales updated")
