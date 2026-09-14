#!/usr/bin/env python3
"""Add v5.faq.myCountry + translate the v5.global band for de/es/fr/pt/nl."""
import json
from collections import OrderedDict

BASE = "/app/langs/locales"

DATA = {
    "de": {
        "myCountry": {
            "q": "Kann ich Dynopay von meinem Land aus nutzen?",
            "a": "Mit ziemlicher Sicherheit ja. Es gibt keine Länderliste, für die man sich bewerben müsste, und keine Bank und kein Kartennetzwerk, das dich freischalten muss – wenn du eine Krypto-Wallet halten kannst, kannst du Zahlungen annehmen und direkt darauf abrechnen. Du registrierst dich mit einer E-Mail, fügst eine Auszahlungs-Wallet hinzu und kannst noch am selben Tag starten. Die einzige Ausnahme sind die wenigen Länder, die unter internationalen Sanktionen stehen.",
        },
        "global": {
            "eyebrow": "Global von Haus aus",
            "headline": "Zahlungen aus über {{countries}} Ländern.",
            "body": "Es gibt keine Länderliste, für die man sich bewerben müsste, und keine Bankfreigabe, auf die man warten muss. Wenn deine Kunden eine Krypto-Wallet halten können, können sie dich von überall auf der Welt bezahlen – und jede Zahlung wird direkt auf eine Wallet abgerechnet, die du kontrollierst.",
            "langs": "6 Sprachen",
            "chainsLabel": "9 Chains",
            "walletLabel": "Non-custodial",
        },
    },
    "es": {
        "myCountry": {
            "q": "¿Puedo usar Dynopay desde mi país?",
            "a": "Casi con toda seguridad, sí. No hay ninguna lista de países a la que solicitar acceso ni ningún banco o red de tarjetas que tenga que aprobarte: si puedes tener una wallet de cripto, puedes aceptar pagos y liquidarlos directamente en ella. Te registras con un correo electrónico, añades una wallet de cobro y puedes empezar el mismo día. La única excepción son las pocas jurisdicciones sujetas a sanciones internacionales.",
        },
        "global": {
            "eyebrow": "Global desde el primer momento",
            "headline": "Pagos desde más de {{countries}} países.",
            "body": "No hay ninguna lista de países a la que solicitar acceso ni aprobación de un banco que esperar. Si tus clientes pueden tener una wallet de cripto, pueden pagarte desde cualquier lugar del mundo, y cada pago se liquida directamente en una wallet que tú controlas.",
            "langs": "6 idiomas",
            "chainsLabel": "9 redes",
            "walletLabel": "Sin custodia",
        },
    },
    "fr": {
        "myCountry": {
            "q": "Puis-je utiliser Dynopay depuis mon pays ?",
            "a": "Presque certainement, oui. Il n'y a aucune liste de pays à laquelle candidater ni aucune banque ou réseau de cartes qui doive vous approuver : si vous pouvez détenir un wallet crypto, vous pouvez accepter des paiements et les recevoir directement dessus. Vous vous inscrivez avec une adresse e-mail, ajoutez un wallet de versement et pouvez démarrer le jour même. La seule exception concerne la poignée de juridictions sous sanctions internationales.",
        },
        "global": {
            "eyebrow": "Mondial par défaut",
            "headline": "Des paiements depuis plus de {{countries}} pays.",
            "body": "Il n'y a aucune liste de pays à laquelle candidater ni aucun accord bancaire à attendre. Si vos clients peuvent détenir un wallet crypto, ils peuvent vous payer depuis n'importe où dans le monde, et chaque paiement est reversé directement sur un wallet que vous contrôlez.",
            "langs": "6 langues",
            "chainsLabel": "9 chaînes",
            "walletLabel": "Non dépositaire",
        },
    },
    "pt": {
        "myCountry": {
            "q": "Posso usar a Dynopay do meu país?",
            "a": "Quase com certeza, sim. Não há nenhuma lista de países à qual se candidatar nem nenhum banco ou rede de cartões que precise aprovar você — se você consegue ter uma carteira de cripto, pode aceitar pagamentos e recebê-los diretamente nela. Você se cadastra com um e-mail, adiciona uma carteira de saque e pode começar no mesmo dia. A única exceção são as poucas jurisdições sob sanções internacionais.",
        },
        "global": {
            "eyebrow": "Global por padrão",
            "headline": "Pagamentos de mais de {{countries}} países.",
            "body": "Não há nenhuma lista de países à qual se candidatar nem aprovação de banco para esperar. Se os seus clientes conseguem ter uma carteira de cripto, eles podem pagar você de qualquer lugar do mundo — e cada pagamento é liquidado diretamente em uma carteira que você controla.",
            "langs": "6 idiomas",
            "chainsLabel": "9 redes",
            "walletLabel": "Sem custódia",
        },
    },
    "nl": {
        "myCountry": {
            "q": "Kan ik Dynopay vanuit mijn land gebruiken?",
            "a": "Vrijwel zeker wel. Er is geen landenlijst waarvoor je je moet aanmelden en geen bank of kaartnetwerk dat je hoeft goed te keuren — als je een crypto-wallet kunt aanhouden, kun je betalingen accepteren en rechtstreeks daarop laten uitkeren. Je meldt je aan met een e-mailadres, voegt een uitbetalingswallet toe en kunt dezelfde dag nog beginnen. De enige uitzondering zijn de paar rechtsgebieden waarvoor internationale sancties gelden.",
        },
        "global": {
            "eyebrow": "Wereldwijd van nature",
            "headline": "Betalingen uit meer dan {{countries}} landen.",
            "body": "Er is geen landenlijst waarvoor je je moet aanmelden en geen bankgoedkeuring om op te wachten. Als je klanten een crypto-wallet kunnen aanhouden, kunnen ze je vanuit de hele wereld betalen — en elke betaling wordt rechtstreeks uitgekeerd op een wallet die jij beheert.",
            "langs": "6 talen",
            "chainsLabel": "9 chains",
            "walletLabel": "Non-custodial",
        },
    },
}


def main():
    for lang, patch in DATA.items():
        path = f"{BASE}/{lang}/landing.json"
        with open(path, encoding="utf-8") as f:
            d = json.load(f, object_pairs_hook=OrderedDict)

        faq = d["v5"]["faq"]
        # Insert myCountry immediately before "countries", preserving order.
        new_faq = OrderedDict()
        for k, v in faq.items():
            if k == "countries" and "myCountry" not in faq:
                new_faq["myCountry"] = OrderedDict(patch["myCountry"])
            new_faq[k] = v
        d["v5"]["faq"] = new_faq

        # Update the whole global band in place (keys already exist).
        for k, v in patch["global"].items():
            d["v5"]["global"][k] = v

        with open(path, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}: myCountry inserted={'myCountry' in d['v5']['faq']}, global updated")


if __name__ == "__main__":
    main()
