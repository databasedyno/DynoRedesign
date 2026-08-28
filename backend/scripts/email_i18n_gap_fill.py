#!/usr/bin/env python3
"""
Email i18n gap fill (Phase 3 item): move hardcoded EN strings from
accountEmails.sendVolumeTierUpgradeEmail + linkCampaignEmails referee
reminder/invite into backend/locales/<lang>/emails.json (all 6 locales).

Also fixes two latent bugs by parameterizing subjects:
  - week2 subject hardcoded "50%" -> {{discountPercent}}
  - final subject hardcoded "3 days" -> {{daysRemaining}}
Voice: shouty caps ("LAST CHANCE", Title Case CTAs) -> sentence case.
Idempotent.
"""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "locales")

K = {
    "en": {
        "merchant": {"volumeTierUpgrade": {
            "subject": "You just unlocked the {{newTier}} tier — {{newPercent}}% fees",
            "intro": "Great news — you've crossed <strong>{{volume}}</strong> in lifetime processed volume, and your platform-fee tier has just been upgraded from <strong>{{previousTier}}</strong> to <strong>{{newTier}}</strong>.",
            "rateTitle": "Your new rate",
            "previousFee": "Previous fee",
            "newFee": "New fee ({{newTier}})",
            "youSave": "You save",
            "savingsPerTx": "{{savings}}% per transaction",
            "applied": "This is applied automatically to every new payment starting now — no action needed. Keep processing, and the next tier down is waiting for you.",
            "thanks": "Thanks for building on Dynopay.",
            "heading": "You're now {{newTier}} — enjoy {{newPercent}}% fees",
            "cta": "View your dashboard",
        }},
        "referral": {
            "whyTitle": "Why Dynopay?",
            "why1": "Accept Bitcoin, Ethereum, USDT, USDC and 15+ more coins",
            "why2": "Non-custodial — funds settle straight to a wallet you control",
            "why3": "Notifications the moment a payment confirms, and a clean dashboard",
            "why4": "Lower fees than traditional payment processors",
            "codeLabel": "Your code:",
            "unsubscribe": "Unsubscribe",
            "reminder": {
                "subjectWeek1": "Don't forget your exclusive Dynopay offer",
                "subjectWeek2": "Your {{discountPercent}}% discount is waiting - Dynopay",
                "subjectWeek3": "Only {{daysRemaining}} days left on your Dynopay offer",
                "subjectFinal": "Last chance: your Dynopay discount expires in {{daysRemaining}} days",
                "urgencyWeek1": "You still have <strong>{{daysRemaining}} days</strong> to claim your exclusive discount.",
                "urgencyWeek2": "Your exclusive <strong>{{discountPercent}}% discount</strong> is still available. Only <strong>{{daysRemaining}} days</strong> remaining.",
                "urgencyWeek3": "<strong>Time is running out.</strong> Your exclusive {{discountPercent}}% discount expires in just <strong>{{daysRemaining}} days</strong>.",
                "urgencyFinal": "<strong style=\"color: #dc2626;\">Final reminder:</strong> your exclusive {{discountPercent}}% discount expires in just <strong>{{daysRemaining}} days</strong>. This is your last chance.",
                "ctaWeek1": "Claim your discount",
                "ctaWeek2": "Start saving today",
                "ctaWeek3": "Don't miss out",
                "ctaFinal": "Claim it before it's gone",
                "intro": "We noticed you haven't claimed your exclusive Dynopay discount yet.",
                "offerTitle": "Your exclusive offer",
                "offerLine": "<strong>{{discountPercent}}% OFF</strong> all transaction fees for <strong>{{days}} days</strong>",
                "heading": "Your discount is waiting",
                "unsubscribeSuffix": "from these reminders",
            },
            "invite": {
                "subject": "You've got {{discountPercent}}% off Dynopay fees",
                "intro": "Thanks for paying with Dynopay! Did you know you can accept crypto payments for your own business too?",
                "giftTitle": "A welcome gift for you",
                "offerLine": "<strong>{{discountPercent}}% OFF</strong> all Dynopay fees for <strong>{{days}} days</strong>",
                "cta": "Start accepting crypto",
                "heading": "Your welcome gift from Dynopay",
                "unsubscribeSuffix": "from these emails",
            },
        },
    },
    "de": {
        "merchant": {"volumeTierUpgrade": {
            "subject": "Sie haben die Stufe {{newTier}} freigeschaltet — {{newPercent}} % Gebühren",
            "intro": "Gute Nachrichten — Sie haben <strong>{{volume}}</strong> an insgesamt verarbeitetem Volumen überschritten, und Ihre Plattformgebühren-Stufe wurde soeben von <strong>{{previousTier}}</strong> auf <strong>{{newTier}}</strong> angehoben.",
            "rateTitle": "Ihr neuer Satz",
            "previousFee": "Bisherige Gebühr",
            "newFee": "Neue Gebühr ({{newTier}})",
            "youSave": "Sie sparen",
            "savingsPerTx": "{{savings}} % pro Transaktion",
            "applied": "Der neue Satz gilt ab sofort automatisch für jede neue Zahlung — Sie müssen nichts tun. Machen Sie weiter, die nächste Stufe wartet schon auf Sie.",
            "thanks": "Danke, dass Sie auf Dynopay bauen.",
            "heading": "Sie sind jetzt {{newTier}} — profitieren Sie von {{newPercent}} % Gebühren",
            "cta": "Zum Dashboard",
        }},
        "referral": {
            "whyTitle": "Warum Dynopay?",
            "why1": "Akzeptieren Sie Bitcoin, Ethereum, USDT, USDC und 15+ weitere Coins",
            "why2": "Non-custodial — Gelder landen direkt in einer Wallet, die Sie kontrollieren",
            "why3": "Benachrichtigungen, sobald eine Zahlung bestätigt ist, und ein übersichtliches Dashboard",
            "why4": "Niedrigere Gebühren als bei klassischen Zahlungsdienstleistern",
            "codeLabel": "Ihr Code:",
            "unsubscribe": "Abmelden",
            "reminder": {
                "subjectWeek1": "Vergessen Sie Ihr exklusives Dynopay-Angebot nicht",
                "subjectWeek2": "Ihr Rabatt von {{discountPercent}} % wartet - Dynopay",
                "subjectWeek3": "Nur noch {{daysRemaining}} Tage für Ihr Dynopay-Angebot",
                "subjectFinal": "Letzte Chance: Ihr Dynopay-Rabatt läuft in {{daysRemaining}} Tagen ab",
                "urgencyWeek1": "Sie haben noch <strong>{{daysRemaining}} Tage</strong>, um Ihren exklusiven Rabatt einzulösen.",
                "urgencyWeek2": "Ihr exklusiver <strong>Rabatt von {{discountPercent}} %</strong> ist noch verfügbar. Nur noch <strong>{{daysRemaining}} Tage</strong>.",
                "urgencyWeek3": "<strong>Die Zeit läuft ab.</strong> Ihr exklusiver Rabatt von {{discountPercent}} % läuft in nur <strong>{{daysRemaining}} Tagen</strong> ab.",
                "urgencyFinal": "<strong style=\"color: #dc2626;\">Letzte Erinnerung:</strong> Ihr exklusiver Rabatt von {{discountPercent}} % läuft in nur <strong>{{daysRemaining}} Tagen</strong> ab. Das ist Ihre letzte Chance.",
                "ctaWeek1": "Rabatt einlösen",
                "ctaWeek2": "Jetzt sparen",
                "ctaWeek3": "Nicht verpassen",
                "ctaFinal": "Einlösen, bevor es zu spät ist",
                "intro": "Wir haben bemerkt, dass Sie Ihren exklusiven Dynopay-Rabatt noch nicht eingelöst haben.",
                "offerTitle": "Ihr exklusives Angebot",
                "offerLine": "<strong>{{discountPercent}} % RABATT</strong> auf alle Transaktionsgebühren für <strong>{{days}} Tage</strong>",
                "heading": "Ihr Rabatt wartet",
                "unsubscribeSuffix": "von diesen Erinnerungen",
            },
            "invite": {
                "subject": "Sie erhalten {{discountPercent}} % Rabatt auf Dynopay-Gebühren",
                "intro": "Danke, dass Sie mit Dynopay bezahlt haben! Wussten Sie, dass Sie auch für Ihr eigenes Unternehmen Krypto-Zahlungen akzeptieren können?",
                "giftTitle": "Ein Willkommensgeschenk für Sie",
                "offerLine": "<strong>{{discountPercent}} % RABATT</strong> auf alle Dynopay-Gebühren für <strong>{{days}} Tage</strong>",
                "cta": "Krypto akzeptieren",
                "heading": "Ihr Willkommensgeschenk von Dynopay",
                "unsubscribeSuffix": "von diesen E-Mails",
            },
        },
    },
    "es": {
        "merchant": {"volumeTierUpgrade": {
            "subject": "Acabas de desbloquear el nivel {{newTier}} — {{newPercent}}% de comisión",
            "intro": "Buenas noticias — has superado <strong>{{volume}}</strong> en volumen procesado acumulado, y tu nivel de comisión de plataforma acaba de subir de <strong>{{previousTier}}</strong> a <strong>{{newTier}}</strong>.",
            "rateTitle": "Tu nueva tarifa",
            "previousFee": "Comisión anterior",
            "newFee": "Nueva comisión ({{newTier}})",
            "youSave": "Ahorras",
            "savingsPerTx": "{{savings}}% por transacción",
            "applied": "Se aplica automáticamente a cada nuevo pago desde ahora — no necesitas hacer nada. Sigue procesando, el siguiente nivel te está esperando.",
            "thanks": "Gracias por construir con Dynopay.",
            "heading": "Ya eres {{newTier}} — disfruta de {{newPercent}}% de comisión",
            "cta": "Ver tu panel",
        }},
        "referral": {
            "whyTitle": "¿Por qué Dynopay?",
            "why1": "Acepta Bitcoin, Ethereum, USDT, USDC y más de 15 monedas",
            "why2": "Sin custodia — los fondos se liquidan directamente en una wallet que tú controlas",
            "why3": "Notificaciones en cuanto se confirma un pago y un panel claro",
            "why4": "Comisiones más bajas que los procesadores de pago tradicionales",
            "codeLabel": "Tu código:",
            "unsubscribe": "Cancelar suscripción",
            "reminder": {
                "subjectWeek1": "No olvides tu oferta exclusiva de Dynopay",
                "subjectWeek2": "Tu descuento del {{discountPercent}}% te espera - Dynopay",
                "subjectWeek3": "Solo quedan {{daysRemaining}} días de tu oferta de Dynopay",
                "subjectFinal": "Última oportunidad: tu descuento de Dynopay caduca en {{daysRemaining}} días",
                "urgencyWeek1": "Todavía tienes <strong>{{daysRemaining}} días</strong> para reclamar tu descuento exclusivo.",
                "urgencyWeek2": "Tu <strong>descuento exclusivo del {{discountPercent}}%</strong> sigue disponible. Solo quedan <strong>{{daysRemaining}} días</strong>.",
                "urgencyWeek3": "<strong>El tiempo se acaba.</strong> Tu descuento exclusivo del {{discountPercent}}% caduca en solo <strong>{{daysRemaining}} días</strong>.",
                "urgencyFinal": "<strong style=\"color: #dc2626;\">Último recordatorio:</strong> tu descuento exclusivo del {{discountPercent}}% caduca en solo <strong>{{daysRemaining}} días</strong>. Es tu última oportunidad.",
                "ctaWeek1": "Reclama tu descuento",
                "ctaWeek2": "Empieza a ahorrar hoy",
                "ctaWeek3": "No te lo pierdas",
                "ctaFinal": "Reclámalo antes de que caduque",
                "intro": "Hemos visto que aún no has reclamado tu descuento exclusivo de Dynopay.",
                "offerTitle": "Tu oferta exclusiva",
                "offerLine": "<strong>{{discountPercent}}% DE DESCUENTO</strong> en todas las comisiones de transacción durante <strong>{{days}} días</strong>",
                "heading": "Tu descuento te espera",
                "unsubscribeSuffix": "de estos recordatorios",
            },
            "invite": {
                "subject": "Tienes un {{discountPercent}}% de descuento en las comisiones de Dynopay",
                "intro": "¡Gracias por pagar con Dynopay! ¿Sabías que tú también puedes aceptar pagos en cripto para tu propio negocio?",
                "giftTitle": "Un regalo de bienvenida para ti",
                "offerLine": "<strong>{{discountPercent}}% DE DESCUENTO</strong> en todas las comisiones de Dynopay durante <strong>{{days}} días</strong>",
                "cta": "Empieza a aceptar cripto",
                "heading": "Tu regalo de bienvenida de Dynopay",
                "unsubscribeSuffix": "de estos correos",
            },
        },
    },
    "fr": {
        "merchant": {"volumeTierUpgrade": {
            "subject": "Vous venez de débloquer le palier {{newTier}} — {{newPercent}} % de frais",
            "intro": "Bonne nouvelle — vous avez dépassé <strong>{{volume}}</strong> de volume traité cumulé, et votre palier de frais de plateforme vient de passer de <strong>{{previousTier}}</strong> à <strong>{{newTier}}</strong>.",
            "rateTitle": "Votre nouveau taux",
            "previousFee": "Frais précédents",
            "newFee": "Nouveaux frais ({{newTier}})",
            "youSave": "Vous économisez",
            "savingsPerTx": "{{savings}} % par transaction",
            "applied": "Le nouveau taux s'applique automatiquement à chaque nouveau paiement dès maintenant — aucune action nécessaire. Continuez, le palier suivant vous attend.",
            "thanks": "Merci de construire avec Dynopay.",
            "heading": "Vous êtes maintenant {{newTier}} — profitez de {{newPercent}} % de frais",
            "cta": "Voir votre tableau de bord",
        }},
        "referral": {
            "whyTitle": "Pourquoi Dynopay ?",
            "why1": "Acceptez Bitcoin, Ethereum, USDT, USDC et plus de 15 cryptos",
            "why2": "Non-custodial — les fonds arrivent directement dans un wallet que vous contrôlez",
            "why3": "Des notifications dès qu'un paiement est confirmé, et un tableau de bord clair",
            "why4": "Des frais plus bas que les processeurs de paiement traditionnels",
            "codeLabel": "Votre code :",
            "unsubscribe": "Se désinscrire",
            "reminder": {
                "subjectWeek1": "N'oubliez pas votre offre exclusive Dynopay",
                "subjectWeek2": "Votre remise de {{discountPercent}} % vous attend - Dynopay",
                "subjectWeek3": "Plus que {{daysRemaining}} jours pour votre offre Dynopay",
                "subjectFinal": "Dernière chance : votre remise Dynopay expire dans {{daysRemaining}} jours",
                "urgencyWeek1": "Il vous reste <strong>{{daysRemaining}} jours</strong> pour profiter de votre remise exclusive.",
                "urgencyWeek2": "Votre <strong>remise exclusive de {{discountPercent}} %</strong> est toujours disponible. Plus que <strong>{{daysRemaining}} jours</strong>.",
                "urgencyWeek3": "<strong>Le temps presse.</strong> Votre remise exclusive de {{discountPercent}} % expire dans seulement <strong>{{daysRemaining}} jours</strong>.",
                "urgencyFinal": "<strong style=\"color: #dc2626;\">Dernier rappel :</strong> votre remise exclusive de {{discountPercent}} % expire dans seulement <strong>{{daysRemaining}} jours</strong>. C'est votre dernière chance.",
                "ctaWeek1": "Profiter de la remise",
                "ctaWeek2": "Commencez à économiser",
                "ctaWeek3": "N'attendez plus",
                "ctaFinal": "Profitez-en avant expiration",
                "intro": "Nous avons remarqué que vous n'avez pas encore profité de votre remise exclusive Dynopay.",
                "offerTitle": "Votre offre exclusive",
                "offerLine": "<strong>{{discountPercent}} % DE REMISE</strong> sur tous les frais de transaction pendant <strong>{{days}} jours</strong>",
                "heading": "Votre remise vous attend",
                "unsubscribeSuffix": "de ces rappels",
            },
            "invite": {
                "subject": "Vous avez {{discountPercent}} % de remise sur les frais Dynopay",
                "intro": "Merci d'avoir payé avec Dynopay ! Saviez-vous que vous pouvez aussi accepter des paiements crypto pour votre propre activité ?",
                "giftTitle": "Un cadeau de bienvenue pour vous",
                "offerLine": "<strong>{{discountPercent}} % DE REMISE</strong> sur tous les frais Dynopay pendant <strong>{{days}} jours</strong>",
                "cta": "Accepter la crypto",
                "heading": "Votre cadeau de bienvenue Dynopay",
                "unsubscribeSuffix": "de ces e-mails",
            },
        },
    },
    "nl": {
        "merchant": {"volumeTierUpgrade": {
            "subject": "U heeft zojuist het {{newTier}}-niveau ontgrendeld — {{newPercent}}% kosten",
            "intro": "Goed nieuws — u heeft <strong>{{volume}}</strong> aan totaal verwerkt volume overschreden, en uw platformkosten-niveau is zojuist opgewaardeerd van <strong>{{previousTier}}</strong> naar <strong>{{newTier}}</strong>.",
            "rateTitle": "Uw nieuwe tarief",
            "previousFee": "Vorig tarief",
            "newFee": "Nieuw tarief ({{newTier}})",
            "youSave": "U bespaart",
            "savingsPerTx": "{{savings}}% per transactie",
            "applied": "Dit wordt vanaf nu automatisch toegepast op elke nieuwe betaling — u hoeft niets te doen. Ga zo door, het volgende niveau wacht op u.",
            "thanks": "Bedankt dat u op Dynopay bouwt.",
            "heading": "U bent nu {{newTier}} — profiteer van {{newPercent}}% kosten",
            "cta": "Naar uw dashboard",
        }},
        "referral": {
            "whyTitle": "Waarom Dynopay?",
            "why1": "Accepteer Bitcoin, Ethereum, USDT, USDC en 15+ andere munten",
            "why2": "Non-custodial — tegoeden komen rechtstreeks terecht in een wallet die u beheert",
            "why3": "Meldingen zodra een betaling is bevestigd, en een overzichtelijk dashboard",
            "why4": "Lagere kosten dan traditionele betaalproviders",
            "codeLabel": "Uw code:",
            "unsubscribe": "Uitschrijven",
            "reminder": {
                "subjectWeek1": "Vergeet uw exclusieve Dynopay-aanbieding niet",
                "subjectWeek2": "Uw korting van {{discountPercent}}% wacht op u - Dynopay",
                "subjectWeek3": "Nog maar {{daysRemaining}} dagen voor uw Dynopay-aanbieding",
                "subjectFinal": "Laatste kans: uw Dynopay-korting verloopt over {{daysRemaining}} dagen",
                "urgencyWeek1": "U heeft nog <strong>{{daysRemaining}} dagen</strong> om uw exclusieve korting te claimen.",
                "urgencyWeek2": "Uw exclusieve <strong>korting van {{discountPercent}}%</strong> is nog beschikbaar. Nog maar <strong>{{daysRemaining}} dagen</strong>.",
                "urgencyWeek3": "<strong>De tijd dringt.</strong> Uw exclusieve korting van {{discountPercent}}% verloopt over slechts <strong>{{daysRemaining}} dagen</strong>.",
                "urgencyFinal": "<strong style=\"color: #dc2626;\">Laatste herinnering:</strong> uw exclusieve korting van {{discountPercent}}% verloopt over slechts <strong>{{daysRemaining}} dagen</strong>. Dit is uw laatste kans.",
                "ctaWeek1": "Claim uw korting",
                "ctaWeek2": "Begin vandaag met besparen",
                "ctaWeek3": "Mis het niet",
                "ctaFinal": "Claim voordat het verloopt",
                "intro": "We zagen dat u uw exclusieve Dynopay-korting nog niet heeft geclaimd.",
                "offerTitle": "Uw exclusieve aanbieding",
                "offerLine": "<strong>{{discountPercent}}% KORTING</strong> op alle transactiekosten gedurende <strong>{{days}} dagen</strong>",
                "heading": "Uw korting wacht op u",
                "unsubscribeSuffix": "voor deze herinneringen",
            },
            "invite": {
                "subject": "U krijgt {{discountPercent}}% korting op Dynopay-kosten",
                "intro": "Bedankt dat u met Dynopay heeft betaald! Wist u dat u ook cryptobetalingen kunt accepteren voor uw eigen bedrijf?",
                "giftTitle": "Een welkomstcadeau voor u",
                "offerLine": "<strong>{{discountPercent}}% KORTING</strong> op alle Dynopay-kosten gedurende <strong>{{days}} dagen</strong>",
                "cta": "Begin crypto te accepteren",
                "heading": "Uw welkomstcadeau van Dynopay",
                "unsubscribeSuffix": "voor deze e-mails",
            },
        },
    },
    "pt": {
        "merchant": {"volumeTierUpgrade": {
            "subject": "Você desbloqueou o nível {{newTier}} — {{newPercent}}% de taxa",
            "intro": "Boa notícia — você ultrapassou <strong>{{volume}}</strong> em volume processado acumulado, e o seu nível de taxa de plataforma acaba de subir de <strong>{{previousTier}}</strong> para <strong>{{newTier}}</strong>.",
            "rateTitle": "Sua nova taxa",
            "previousFee": "Taxa anterior",
            "newFee": "Nova taxa ({{newTier}})",
            "youSave": "Você economiza",
            "savingsPerTx": "{{savings}}% por transação",
            "applied": "Isso é aplicado automaticamente a cada novo pagamento a partir de agora — nenhuma ação necessária. Continue processando, o próximo nível está esperando por você.",
            "thanks": "Obrigado por construir com a Dynopay.",
            "heading": "Você agora é {{newTier}} — aproveite {{newPercent}}% de taxa",
            "cta": "Ver seu painel",
        }},
        "referral": {
            "whyTitle": "Por que a Dynopay?",
            "why1": "Aceite Bitcoin, Ethereum, USDT, USDC e mais de 15 moedas",
            "why2": "Sem custódia — os fundos são liquidados direto em uma carteira que você controla",
            "why3": "Notificações assim que um pagamento é confirmado e um painel organizado",
            "why4": "Taxas mais baixas que processadores de pagamento tradicionais",
            "codeLabel": "Seu código:",
            "unsubscribe": "Cancelar inscrição",
            "reminder": {
                "subjectWeek1": "Não esqueça sua oferta exclusiva da Dynopay",
                "subjectWeek2": "Seu desconto de {{discountPercent}}% está esperando - Dynopay",
                "subjectWeek3": "Faltam só {{daysRemaining}} dias para sua oferta da Dynopay",
                "subjectFinal": "Última chance: seu desconto da Dynopay expira em {{daysRemaining}} dias",
                "urgencyWeek1": "Você ainda tem <strong>{{daysRemaining}} dias</strong> para resgatar seu desconto exclusivo.",
                "urgencyWeek2": "Seu <strong>desconto exclusivo de {{discountPercent}}%</strong> ainda está disponível. Restam apenas <strong>{{daysRemaining}} dias</strong>.",
                "urgencyWeek3": "<strong>O tempo está acabando.</strong> Seu desconto exclusivo de {{discountPercent}}% expira em apenas <strong>{{daysRemaining}} dias</strong>.",
                "urgencyFinal": "<strong style=\"color: #dc2626;\">Último lembrete:</strong> seu desconto exclusivo de {{discountPercent}}% expira em apenas <strong>{{daysRemaining}} dias</strong>. Esta é sua última chance.",
                "ctaWeek1": "Resgatar seu desconto",
                "ctaWeek2": "Comece a economizar hoje",
                "ctaWeek3": "Não perca",
                "ctaFinal": "Resgate antes que expire",
                "intro": "Notamos que você ainda não resgatou seu desconto exclusivo da Dynopay.",
                "offerTitle": "Sua oferta exclusiva",
                "offerLine": "<strong>{{discountPercent}}% DE DESCONTO</strong> em todas as taxas de transação por <strong>{{days}} dias</strong>",
                "heading": "Seu desconto está esperando",
                "unsubscribeSuffix": "destes lembretes",
            },
            "invite": {
                "subject": "Você tem {{discountPercent}}% de desconto nas taxas da Dynopay",
                "intro": "Obrigado por pagar com a Dynopay! Sabia que você também pode aceitar pagamentos em cripto no seu próprio negócio?",
                "giftTitle": "Um presente de boas-vindas para você",
                "offerLine": "<strong>{{discountPercent}}% DE DESCONTO</strong> em todas as taxas da Dynopay por <strong>{{days}} dias</strong>",
                "cta": "Comece a aceitar cripto",
                "heading": "Seu presente de boas-vindas da Dynopay",
                "unsubscribeSuffix": "destes e-mails",
            },
        },
    },
}


def deep_merge(dst, src):
    changed = 0
    for k, v in src.items():
        if isinstance(v, dict):
            node = dst.setdefault(k, {})
            if not isinstance(node, dict):
                dst[k] = node = {}
            changed += deep_merge(node, v)
        else:
            if dst.get(k) != v:
                dst[k] = v
                changed += 1
    return changed


def main():
    total = 0
    for lang, keys in K.items():
        path = os.path.join(BASE, lang, "emails.json")
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        n = deep_merge(data, keys)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{lang}/emails.json: {n} keys set")
        total += n
    print(f"TOTAL: {total} keys set")


if __name__ == "__main__":
    main()
