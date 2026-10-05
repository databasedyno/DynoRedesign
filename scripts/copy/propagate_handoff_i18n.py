#!/usr/bin/env python3
"""
Idempotent i18n propagation for the NEXT_AGENT_HANDOFF tasks:

  #2  landing.json  -> v7.security.* (13 keys) + v7.trust.eyebrow into es/fr/de/pt/nl
      (EN already has them; es/fr/de/pt/nl were entirely missing v7.security.)
  #1/#3 createPaymentLinkScreen.json -> new post-creation panel + preview-tier
      keys into en + es/fr/de/pt/nl.

Only the keys below are written; every other key is left untouched. Safe to re-run.
"""
import json
import os

LOCALES_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales")

# ── #2 landing: v7.security (+ v7.trust.eyebrow) per locale ──────────────────
LANDING_SECURITY = {
    "en": {
        "eyebrow": "Security & compliance",
        "headline": "Built to be trusted with money",
        "body": "Funds move on rails you can verify — never parked on a balance you can't see.",
        "noncustodial": {
            "title": "Non-custodial by design",
            "body": "Settled funds go straight to the wallet you control. Dynopay never holds your balance in between.",
        },
        "compliance": {
            "title": "KYC & AML built in",
            "body": "Identity and anti-money-laundering checks run on merchants above regulatory thresholds, keeping your account in good standing.",
        },
        "keys": {
            "title": "Hardened key infrastructure",
            "body": "Wallet keys are encrypted and isolated. Signing happens in a protected environment — never in the browser.",
        },
        "uptime": {
            "title": "Verifiable uptime",
            "body": "A public status page and round-the-clock monitoring let you confirm payments and settlement are healthy.",
        },
        "trustLink": "Visit the Trust Centre",
    },
    "es": {
        "eyebrow": "Seguridad y cumplimiento",
        "headline": "Diseñado para que confíes tu dinero",
        "body": "Los fondos circulan por vías que puedes verificar, nunca retenidos en un saldo que no ves.",
        "noncustodial": {
            "title": "Sin custodia por diseño",
            "body": "Los fondos liquidados van directamente a la cartera que tú controlas. Dynopay nunca retiene tu saldo en el camino.",
        },
        "compliance": {
            "title": "KYC y AML integrados",
            "body": "Las verificaciones de identidad y antiblanqueo de capitales se aplican a los comercios que superan los umbrales regulatorios, manteniendo tu cuenta en regla.",
        },
        "keys": {
            "title": "Infraestructura de claves reforzada",
            "body": "Las claves de las carteras están cifradas y aisladas. La firma se realiza en un entorno protegido, nunca en el navegador.",
        },
        "uptime": {
            "title": "Disponibilidad verificable",
            "body": "Una página de estado pública y una supervisión ininterrumpida te permiten confirmar que los pagos y las liquidaciones funcionan correctamente.",
        },
        "trustLink": "Visita el Centro de Confianza",
    },
    "fr": {
        "eyebrow": "Sécurité et conformité",
        "headline": "Conçu pour qu'on vous confie de l'argent",
        "body": "Les fonds circulent sur des rails que vous pouvez vérifier, jamais immobilisés sur un solde invisible.",
        "noncustodial": {
            "title": "Sans conservation, par conception",
            "body": "Les fonds réglés vont directement vers le portefeuille que vous contrôlez. Dynopay ne détient jamais votre solde entre-temps.",
        },
        "compliance": {
            "title": "KYC et LAB intégrés",
            "body": "Les contrôles d'identité et de lutte contre le blanchiment s'appliquent aux marchands dépassant les seuils réglementaires, afin que votre compte reste en règle.",
        },
        "keys": {
            "title": "Infrastructure de clés renforcée",
            "body": "Les clés des portefeuilles sont chiffrées et isolées. La signature se fait dans un environnement protégé, jamais dans le navigateur.",
        },
        "uptime": {
            "title": "Disponibilité vérifiable",
            "body": "Une page de statut publique et une surveillance permanente vous permettent de confirmer que les paiements et les règlements sont opérationnels.",
        },
        "trustLink": "Visitez le Centre de confiance",
    },
    "de": {
        "eyebrow": "Sicherheit und Compliance",
        "headline": "Gebaut, um mit Geld betraut zu werden",
        "body": "Gelder bewegen sich auf Wegen, die Sie überprüfen können – niemals geparkt auf einem Guthaben, das Sie nicht sehen.",
        "noncustodial": {
            "title": "Nicht-verwahrend von Grund auf",
            "body": "Abgewickelte Gelder gehen direkt in die von Ihnen kontrollierte Wallet. Dynopay hält Ihr Guthaben zwischendurch nie.",
        },
        "compliance": {
            "title": "KYC und AML integriert",
            "body": "Identitäts- und Geldwäscheprüfungen gelten für Händler oberhalb der regulatorischen Schwellenwerte und halten Ihr Konto in gutem Stand.",
        },
        "keys": {
            "title": "Gehärtete Schlüssel-Infrastruktur",
            "body": "Wallet-Schlüssel werden verschlüsselt und isoliert. Das Signieren erfolgt in einer geschützten Umgebung – niemals im Browser.",
        },
        "uptime": {
            "title": "Nachprüfbare Verfügbarkeit",
            "body": "Eine öffentliche Statusseite und eine Rund-um-die-Uhr-Überwachung lassen Sie bestätigen, dass Zahlungen und Abwicklung einwandfrei laufen.",
        },
        "trustLink": "Zum Trust Center",
    },
    "pt": {
        "eyebrow": "Segurança e conformidade",
        "headline": "Feito para merecer a confiança do seu dinheiro",
        "body": "Os fundos circulam por trilhos que você pode verificar — nunca parados num saldo que você não vê.",
        "noncustodial": {
            "title": "Sem custódia, por princípio",
            "body": "Os fundos liquidados vão direto para a carteira que você controla. A Dynopay nunca retém o seu saldo no meio do caminho.",
        },
        "compliance": {
            "title": "KYC e AML integrados",
            "body": "As verificações de identidade e de combate à lavagem de dinheiro aplicam-se aos comerciantes acima dos limites regulatórios, mantendo a sua conta em conformidade.",
        },
        "keys": {
            "title": "Infraestrutura de chaves reforçada",
            "body": "As chaves das carteiras são criptografadas e isoladas. A assinatura ocorre num ambiente protegido — nunca no navegador.",
        },
        "uptime": {
            "title": "Disponibilidade verificável",
            "body": "Uma página de status pública e monitoramento ininterrupto permitem confirmar que os pagamentos e a liquidação estão saudáveis.",
        },
        "trustLink": "Visite a Central de Confiança",
    },
    "nl": {
        "eyebrow": "Beveiliging en naleving",
        "headline": "Gebouwd om met geld te worden vertrouwd",
        "body": "Geld beweegt via routes die je kunt verifiëren — nooit geparkeerd op een saldo dat je niet ziet.",
        "noncustodial": {
            "title": "Non-custodiaal van opzet",
            "body": "Afgewikkelde bedragen gaan rechtstreeks naar de wallet die jij beheert. Dynopay houdt je saldo er nooit tussenin vast.",
        },
        "compliance": {
            "title": "KYC en AML ingebouwd",
            "body": "Identiteits- en antiwitwascontroles gelden voor handelaren boven de wettelijke drempels, zodat je account in goede staat blijft.",
        },
        "keys": {
            "title": "Geharde sleutelinfrastructuur",
            "body": "Wallet-sleutels zijn versleuteld en geïsoleerd. Ondertekenen gebeurt in een beschermde omgeving — nooit in de browser.",
        },
        "uptime": {
            "title": "Verifieerbare beschikbaarheid",
            "body": "Een openbare statuspagina en monitoring rond de klok laten je bevestigen dat betalingen en afwikkeling gezond zijn.",
        },
        "trustLink": "Bezoek het Trust Center",
    },
}

LANDING_TRUST_EYEBROW = {
    "en": "Live proof",
    "es": "Prueba en vivo",
    "fr": "Preuve en direct",
    "de": "Live-Nachweis",
    "pt": "Prova ao vivo",
    "nl": "Live bewijs",
}

# ── #1/#3 createPaymentLinkScreen: post-creation panel + preview-tier labels ──
CREATE_PAYLINK = {
    "en": {
        "nextStepsTitle": "What's next",
        "nextManageLinks": "See all links",
        "nextManageCampaigns": "See all campaigns",
        "nextShareQr": "Share & QR",
        "nextTrack": "Track payments",
        "successDone": "Done",
        "previewRewardTiers": "Reward tiers",
        "previewTierFrom": "from {{amount}}",
    },
    "es": {
        "nextStepsTitle": "¿Qué sigue?",
        "nextManageLinks": "Ver todos los enlaces",
        "nextManageCampaigns": "Ver todas las campañas",
        "nextShareQr": "Compartir y QR",
        "nextTrack": "Seguir pagos",
        "successDone": "Listo",
        "previewRewardTiers": "Niveles de recompensa",
        "previewTierFrom": "desde {{amount}}",
    },
    "fr": {
        "nextStepsTitle": "Et maintenant ?",
        "nextManageLinks": "Voir tous les liens",
        "nextManageCampaigns": "Voir toutes les campagnes",
        "nextShareQr": "Partager et QR",
        "nextTrack": "Suivre les paiements",
        "successDone": "Terminé",
        "previewRewardTiers": "Paliers de récompense",
        "previewTierFrom": "à partir de {{amount}}",
    },
    "de": {
        "nextStepsTitle": "Wie geht's weiter?",
        "nextManageLinks": "Alle Links ansehen",
        "nextManageCampaigns": "Alle Kampagnen ansehen",
        "nextShareQr": "Teilen & QR",
        "nextTrack": "Zahlungen verfolgen",
        "successDone": "Fertig",
        "previewRewardTiers": "Belohnungsstufen",
        "previewTierFrom": "ab {{amount}}",
    },
    "pt": {
        "nextStepsTitle": "E agora?",
        "nextManageLinks": "Ver todos os links",
        "nextManageCampaigns": "Ver todas as campanhas",
        "nextShareQr": "Compartilhar e QR",
        "nextTrack": "Acompanhar pagamentos",
        "successDone": "Concluído",
        "previewRewardTiers": "Níveis de recompensa",
        "previewTierFrom": "a partir de {{amount}}",
    },
    "nl": {
        "nextStepsTitle": "Wat nu?",
        "nextManageLinks": "Alle links bekijken",
        "nextManageCampaigns": "Alle campagnes bekijken",
        "nextShareQr": "Delen & QR",
        "nextTrack": "Betalingen volgen",
        "successDone": "Klaar",
        "previewRewardTiers": "Beloningsniveaus",
        "previewTierFrom": "vanaf {{amount}}",
    },
}


def load(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def apply_landing():
    for loc, sec in LANDING_SECURITY.items():
        path = os.path.join(LOCALES_DIR, loc, "landing.json")
        data = load(path)
        v7 = data.setdefault("v7", {})
        v7["security"] = sec  # full overwrite of the security block (idempotent)
        v7.setdefault("trust", {})["eyebrow"] = LANDING_TRUST_EYEBROW[loc]
        save(path, data)
        print(f"  landing/{loc}: v7.security ({len(sec)} keys) + v7.trust.eyebrow")


def apply_createpaylink():
    for loc, keys in CREATE_PAYLINK.items():
        path = os.path.join(LOCALES_DIR, loc, "createPaymentLinkScreen.json")
        data = load(path)
        for k, v in keys.items():
            data[k] = v
        save(path, data)
        print(f"  createPaymentLinkScreen/{loc}: +{len(keys)} keys")


if __name__ == "__main__":
    print("Applying landing (#2) security + trust.eyebrow:")
    apply_landing()
    print("Applying createPaymentLinkScreen (#1/#3) keys:")
    apply_createpaylink()
    print("Done.")
