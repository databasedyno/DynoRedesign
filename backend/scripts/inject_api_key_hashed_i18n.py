#!/usr/bin/env python3
"""Inject merchant.apiKeyHashed.* email i18n (6 locales). Idempotent."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "locales")

T = {
    "en": {
        "subject": "Security update: your API keys are now shown only once",
        "preheader": "Your keys keep working. Nothing to do unless you need to re-copy a key.",
        "heading": "API key security update",
        "intro": "We have upgraded how Dynopay stores your API keys. Keys are now kept as a one-way hash — the same model used by Stripe and Coinbase — so even a copy of our database could never reveal your key.",
        "whatLabel": "What changed",
        "whatValue": "Keys are shown once, at creation or rotation, and can no longer be revealed from the dashboard.",
        "keysLabel": "Your current keys",
        "keysValue": "Keep working exactly as before. No change is needed in your integration.",
        "actionLabel": "Action needed",
        "actionValue": "None — unless you have not saved your key anywhere. In that case, rotate it once from Developer › API keys.",
        "rotate": "To rotate: open <strong>Developer › API keys</strong>, press <strong>Regenerate</strong>, copy the new key immediately and update your integration. The old key stops working the moment you regenerate.",
        "outro": "Questions? Reply to this email — we are happy to help.",
        "cta": "Open API keys"
    },
    "de": {
        "subject": "Sicherheitsupdate: Ihre API-Schlüssel werden nur noch einmal angezeigt",
        "preheader": "Ihre Schlüssel funktionieren weiterhin. Nichts zu tun, sofern Sie einen Schlüssel nicht erneut kopieren müssen.",
        "heading": "Sicherheitsupdate für API-Schlüssel",
        "intro": "Wir haben die Speicherung Ihrer API-Schlüssel bei Dynopay verbessert. Schlüssel werden jetzt als Einweg-Hash gespeichert — dasselbe Modell wie bei Stripe und Coinbase —, sodass selbst eine Kopie unserer Datenbank Ihren Schlüssel niemals offenlegen könnte.",
        "whatLabel": "Was sich geändert hat",
        "whatValue": "Schlüssel werden nur einmal angezeigt (bei Erstellung oder Rotation) und können nicht mehr im Dashboard eingeblendet werden.",
        "keysLabel": "Ihre aktuellen Schlüssel",
        "keysValue": "Funktionieren genau wie zuvor. An Ihrer Integration ist keine Änderung nötig.",
        "actionLabel": "Handlungsbedarf",
        "actionValue": "Keiner — es sei denn, Sie haben Ihren Schlüssel nirgends gespeichert. Rotieren Sie ihn dann einmal unter Entwickler › API-Schlüssel.",
        "rotate": "So rotieren Sie: <strong>Entwickler › API-Schlüssel</strong> öffnen, <strong>Neu generieren</strong> drücken, den neuen Schlüssel sofort kopieren und Ihre Integration aktualisieren. Der alte Schlüssel wird mit der Neugenerierung sofort ungültig.",
        "outro": "Fragen? Antworten Sie einfach auf diese E-Mail — wir helfen gern.",
        "cta": "API-Schlüssel öffnen"
    },
    "es": {
        "subject": "Actualización de seguridad: sus claves API ahora se muestran una sola vez",
        "preheader": "Sus claves siguen funcionando. No hay que hacer nada salvo que necesite volver a copiar una clave.",
        "heading": "Actualización de seguridad de claves API",
        "intro": "Hemos mejorado la forma en que Dynopay almacena sus claves API. Ahora se guardan como un hash unidireccional —el mismo modelo que usan Stripe y Coinbase—, de modo que ni siquiera una copia de nuestra base de datos podría revelar su clave.",
        "whatLabel": "Qué ha cambiado",
        "whatValue": "Las claves se muestran una sola vez, al crearlas o rotarlas, y ya no pueden revelarse desde el panel.",
        "keysLabel": "Sus claves actuales",
        "keysValue": "Siguen funcionando exactamente igual. No es necesario cambiar nada en su integración.",
        "actionLabel": "Acción necesaria",
        "actionValue": "Ninguna, salvo que no haya guardado su clave en ningún sitio. En ese caso, rótela una vez desde Desarrollador › Claves API.",
        "rotate": "Para rotar: abra <strong>Desarrollador › Claves API</strong>, pulse <strong>Regenerar</strong>, copie la nueva clave de inmediato y actualice su integración. La clave anterior deja de funcionar en el momento en que regenera.",
        "outro": "¿Preguntas? Responda a este correo; estaremos encantados de ayudarle.",
        "cta": "Abrir claves API"
    },
    "fr": {
        "subject": "Mise à jour de sécurité : vos clés API ne s'affichent plus qu'une seule fois",
        "preheader": "Vos clés continuent de fonctionner. Rien à faire, sauf si vous devez recopier une clé.",
        "heading": "Mise à jour de sécurité des clés API",
        "intro": "Nous avons amélioré la façon dont Dynopay stocke vos clés API. Elles sont désormais conservées sous forme de hachage à sens unique — le même modèle que Stripe et Coinbase — de sorte qu'une copie de notre base de données ne pourrait jamais révéler votre clé.",
        "whatLabel": "Ce qui change",
        "whatValue": "Les clés s'affichent une seule fois, à la création ou à la rotation, et ne peuvent plus être révélées depuis le tableau de bord.",
        "keysLabel": "Vos clés actuelles",
        "keysValue": "Continuent de fonctionner exactement comme avant. Aucune modification de votre intégration n'est nécessaire.",
        "actionLabel": "Action requise",
        "actionValue": "Aucune — sauf si vous n'avez enregistré votre clé nulle part. Dans ce cas, effectuez une rotation depuis Développeur › Clés API.",
        "rotate": "Pour effectuer une rotation : ouvrez <strong>Développeur › Clés API</strong>, cliquez sur <strong>Régénérer</strong>, copiez immédiatement la nouvelle clé et mettez à jour votre intégration. L'ancienne clé cesse de fonctionner dès la régénération.",
        "outro": "Des questions ? Répondez à cet e-mail, nous serons ravis de vous aider.",
        "cta": "Ouvrir les clés API"
    },
    "pt": {
        "subject": "Atualização de segurança: as suas chaves API passam a ser mostradas apenas uma vez",
        "preheader": "As suas chaves continuam a funcionar. Nada a fazer, salvo se precisar de copiar novamente uma chave.",
        "heading": "Atualização de segurança das chaves API",
        "intro": "Melhorámos a forma como a Dynopay guarda as suas chaves API. As chaves passam a ser guardadas como um hash unidirecional — o mesmo modelo usado pela Stripe e pela Coinbase —, pelo que nem uma cópia da nossa base de dados poderia revelar a sua chave.",
        "whatLabel": "O que mudou",
        "whatValue": "As chaves são mostradas uma única vez, na criação ou rotação, e deixam de poder ser reveladas no painel.",
        "keysLabel": "As suas chaves atuais",
        "keysValue": "Continuam a funcionar exatamente como antes. Não é necessária qualquer alteração na sua integração.",
        "actionLabel": "Ação necessária",
        "actionValue": "Nenhuma — a menos que não tenha guardado a sua chave em nenhum lugar. Nesse caso, faça uma rotação em Programador › Chaves API.",
        "rotate": "Para rodar: abra <strong>Programador › Chaves API</strong>, carregue em <strong>Regenerar</strong>, copie de imediato a nova chave e atualize a sua integração. A chave antiga deixa de funcionar no momento em que regenera.",
        "outro": "Dúvidas? Responda a este e-mail — teremos todo o gosto em ajudar.",
        "cta": "Abrir chaves API"
    },
    "nl": {
        "subject": "Beveiligingsupdate: uw API-sleutels worden nog maar één keer getoond",
        "preheader": "Uw sleutels blijven werken. Niets te doen, tenzij u een sleutel opnieuw moet kopiëren.",
        "heading": "Beveiligingsupdate API-sleutels",
        "intro": "We hebben de manier waarop Dynopay uw API-sleutels opslaat verbeterd. Sleutels worden nu bewaard als een eenrichtingshash — hetzelfde model als Stripe en Coinbase — zodat zelfs een kopie van onze database uw sleutel nooit kan onthullen.",
        "whatLabel": "Wat is er veranderd",
        "whatValue": "Sleutels worden één keer getoond, bij aanmaken of roteren, en kunnen niet meer vanuit het dashboard worden onthuld.",
        "keysLabel": "Uw huidige sleutels",
        "keysValue": "Blijven precies zo werken als voorheen. Er is geen wijziging in uw integratie nodig.",
        "actionLabel": "Actie vereist",
        "actionValue": "Geen — tenzij u uw sleutel nergens hebt opgeslagen. Roteer hem dan één keer via Ontwikkelaar › API-sleutels.",
        "rotate": "Roteren: open <strong>Ontwikkelaar › API-sleutels</strong>, klik op <strong>Opnieuw genereren</strong>, kopieer de nieuwe sleutel direct en werk uw integratie bij. De oude sleutel stopt met werken zodra u opnieuw genereert.",
        "outro": "Vragen? Beantwoord deze e-mail — we helpen u graag.",
        "cta": "API-sleutels openen"
    },
}

for lang, block in T.items():
    path = os.path.join(BASE, lang, "emails.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("merchant", {})["apiKeyHashed"] = block
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"{lang}: merchant.apiKeyHashed written ({len(block)} keys)")
