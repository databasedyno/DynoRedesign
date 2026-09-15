#!/usr/bin/env python3
"""Idempotent: adds emails.json tipGoal.* (creator monthly tip-goal milestone emails) to all 6 backend locales."""
import json, os

ROOT = "/app/backend/locales"
KEYS = {
    "en": {
        "cta": "View your page",
        "ofGoal": "of your {{goal}} monthly goal",
        "percentFunded": "{{pct}}% funded",
        "supportersOne": "That's 1 supporter this month.",
        "supportersOther": "That's {{count}} supporters this month.",
        "footnote": "Your goal resets on the 1st of every month. Change or remove it any time under Your page → Tips settings. Every tip is paid straight to your payout address — Dynopay never holds your funds.",
        "halfway": {
            "subject": "You're halfway to your monthly tip goal",
            "preheader": "{{raised}} of {{goal}} raised — halfway there.",
            "heading": "Halfway there!",
            "intro": "Supporters of {{brand}} have chipped in {{raised}} so far in {{month}} — that's over half of your {{goal}} goal.",
            "next": "Keep the momentum: share your page or thank your recent supporters on the wall."
        },
        "reached": {
            "subject": "You hit your monthly tip goal 🎉",
            "preheader": "{{raised}} raised — your {{goal}} goal is complete.",
            "heading": "Goal reached!",
            "intro": "Supporters of {{brand}} have tipped {{raised}} in {{month}}, so your {{goal}} goal is complete. Well done!",
            "next": "Anything from here on is a bonus — the bar on your page now shows the goal as reached."
        }
    },
    "de": {
        "cta": "Ihre Seite ansehen",
        "ofGoal": "Ihres Monatsziels von {{goal}}",
        "percentFunded": "{{pct}}% erreicht",
        "supportersOne": "Das ist 1 Unterstützer in diesem Monat.",
        "supportersOther": "Das sind {{count}} Unterstützer in diesem Monat.",
        "footnote": "Ihr Ziel wird am 1. jedes Monats zurückgesetzt. Sie können es jederzeit unter Ihre Seite → Trinkgeld-Einstellungen ändern oder entfernen. Jedes Trinkgeld geht direkt an Ihre Auszahlungsadresse — Dynopay verwahrt Ihre Gelder nie.",
        "halfway": {
            "subject": "Sie haben die Hälfte Ihres monatlichen Trinkgeld-Ziels erreicht",
            "preheader": "{{raised}} von {{goal}} gesammelt — die Hälfte ist geschafft.",
            "heading": "Die Hälfte ist geschafft!",
            "intro": "Unterstützer von {{brand}} haben im {{month}} bereits {{raised}} beigetragen — mehr als die Hälfte Ihres Ziels von {{goal}}.",
            "next": "Bleiben Sie dran: Teilen Sie Ihre Seite oder bedanken Sie sich bei Ihren letzten Unterstützern auf der Wall."
        },
        "reached": {
            "subject": "Sie haben Ihr monatliches Trinkgeld-Ziel erreicht 🎉",
            "preheader": "{{raised}} gesammelt — Ihr Ziel von {{goal}} ist erreicht.",
            "heading": "Ziel erreicht!",
            "intro": "Unterstützer von {{brand}} haben im {{month}} {{raised}} Trinkgeld gegeben — Ihr Ziel von {{goal}} ist damit erreicht. Glückwunsch!",
            "next": "Alles Weitere ist ein Bonus — der Balken auf Ihrer Seite zeigt das Ziel jetzt als erreicht an."
        }
    },
    "es": {
        "cta": "Ver tu página",
        "ofGoal": "de tu objetivo mensual de {{goal}}",
        "percentFunded": "{{pct}}% alcanzado",
        "supportersOne": "Eso es 1 seguidor este mes.",
        "supportersOther": "Eso son {{count}} seguidores este mes.",
        "footnote": "Tu objetivo se reinicia el día 1 de cada mes. Puedes cambiarlo o quitarlo en cualquier momento en Tu página → Ajustes de propinas. Cada propina se paga directamente a tu dirección de cobro — Dynopay nunca retiene tus fondos.",
        "halfway": {
            "subject": "Vas por la mitad de tu objetivo mensual de propinas",
            "preheader": "{{raised}} de {{goal}} recaudados — ya vas por la mitad.",
            "heading": "¡Ya vas por la mitad!",
            "intro": "Los seguidores de {{brand}} han aportado {{raised}} hasta ahora en {{month}} — más de la mitad de tu objetivo de {{goal}}.",
            "next": "Mantén el impulso: comparte tu página o agradece a tus seguidores recientes en el muro."
        },
        "reached": {
            "subject": "Has alcanzado tu objetivo mensual de propinas 🎉",
            "preheader": "{{raised}} recaudados — tu objetivo de {{goal}} está completo.",
            "heading": "¡Objetivo alcanzado!",
            "intro": "Los seguidores de {{brand}} han dado {{raised}} en propinas en {{month}}, así que tu objetivo de {{goal}} está completo. ¡Enhorabuena!",
            "next": "Todo lo que llegue a partir de ahora es un extra — la barra de tu página ya muestra el objetivo como alcanzado."
        }
    },
    "fr": {
        "cta": "Voir votre page",
        "ofGoal": "de votre objectif mensuel de {{goal}}",
        "percentFunded": "{{pct}}% atteint",
        "supportersOne": "Soit 1 soutien ce mois-ci.",
        "supportersOther": "Soit {{count}} soutiens ce mois-ci.",
        "footnote": "Votre objectif est remis à zéro le 1er de chaque mois. Modifiez-le ou supprimez-le à tout moment dans Votre page → Paramètres des pourboires. Chaque pourboire est versé directement à votre adresse de versement — Dynopay ne détient jamais vos fonds.",
        "halfway": {
            "subject": "Vous êtes à mi-chemin de votre objectif mensuel de pourboires",
            "preheader": "{{raised}} sur {{goal}} collectés — la moitié est faite.",
            "heading": "À mi-chemin !",
            "intro": "Les soutiens de {{brand}} ont déjà versé {{raised}} en {{month}} — plus de la moitié de votre objectif de {{goal}}.",
            "next": "Gardez le rythme : partagez votre page ou remerciez vos derniers soutiens sur le mur."
        },
        "reached": {
            "subject": "Vous avez atteint votre objectif mensuel de pourboires 🎉",
            "preheader": "{{raised}} collectés — votre objectif de {{goal}} est atteint.",
            "heading": "Objectif atteint !",
            "intro": "Les soutiens de {{brand}} ont versé {{raised}} de pourboires en {{month}} : votre objectif de {{goal}} est atteint. Bravo !",
            "next": "Tout ce qui arrive désormais est un bonus — la barre de votre page indique maintenant l'objectif comme atteint."
        }
    },
    "nl": {
        "cta": "Bekijk je pagina",
        "ofGoal": "van je maanddoel van {{goal}}",
        "percentFunded": "{{pct}}% behaald",
        "supportersOne": "Dat is 1 supporter deze maand.",
        "supportersOther": "Dat zijn {{count}} supporters deze maand.",
        "footnote": "Je doel wordt op de 1e van elke maand gereset. Pas het aan of verwijder het wanneer je wilt via Jouw pagina → Fooi-instellingen. Elke fooi gaat rechtstreeks naar je uitbetalingsadres — Dynopay houdt je geld nooit vast.",
        "halfway": {
            "subject": "Je bent halverwege je maandelijkse fooidoel",
            "preheader": "{{raised}} van {{goal}} opgehaald — je bent halverwege.",
            "heading": "Halverwege!",
            "intro": "Supporters van {{brand}} hebben in {{month}} al {{raised}} bijgedragen — meer dan de helft van je doel van {{goal}}.",
            "next": "Houd het momentum vast: deel je pagina of bedank je recente supporters op de wall."
        },
        "reached": {
            "subject": "Je hebt je maandelijkse fooidoel bereikt 🎉",
            "preheader": "{{raised}} opgehaald — je doel van {{goal}} is behaald.",
            "heading": "Doel bereikt!",
            "intro": "Supporters van {{brand}} hebben in {{month}} {{raised}} aan fooien gegeven, dus je doel van {{goal}} is behaald. Goed gedaan!",
            "next": "Alles wat er nu nog bijkomt is een bonus — de balk op je pagina toont het doel nu als behaald."
        }
    },
    "pt": {
        "cta": "Ver a tua página",
        "ofGoal": "da tua meta mensal de {{goal}}",
        "percentFunded": "{{pct}}% alcançado",
        "supportersOne": "Isso é 1 apoiante este mês.",
        "supportersOther": "Isso são {{count}} apoiantes este mês.",
        "footnote": "A tua meta é reposta no dia 1 de cada mês. Podes alterá-la ou removê-la a qualquer momento em A tua página → Definições de gorjetas. Cada gorjeta é paga diretamente para o teu endereço de pagamento — a Dynopay nunca retém os teus fundos.",
        "halfway": {
            "subject": "Estás a meio da tua meta mensal de gorjetas",
            "preheader": "{{raised}} de {{goal}} angariados — já estás a meio.",
            "heading": "Já estás a meio!",
            "intro": "Os apoiantes de {{brand}} já contribuíram com {{raised}} em {{month}} — mais de metade da tua meta de {{goal}}.",
            "next": "Mantém o ritmo: partilha a tua página ou agradece aos teus apoiantes recentes no mural."
        },
        "reached": {
            "subject": "Atingiste a tua meta mensal de gorjetas 🎉",
            "preheader": "{{raised}} angariados — a tua meta de {{goal}} está completa.",
            "heading": "Meta alcançada!",
            "intro": "Os apoiantes de {{brand}} deram {{raised}} em gorjetas em {{month}}, por isso a tua meta de {{goal}} está completa. Parabéns!",
            "next": "Tudo o que chegar a partir de agora é um bónus — a barra na tua página mostra agora a meta como alcançada."
        }
    },
}

for lang, block in KEYS.items():
    path = os.path.join(ROOT, lang, "emails.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("tipGoal") == block:
        print(lang, "already up to date")
        continue
    data["tipGoal"] = block
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(lang, "updated")
