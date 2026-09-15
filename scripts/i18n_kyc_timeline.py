#!/usr/bin/env python3
"""Idempotent: adds dashboardLayout.kycTimeline.* to all 6 locales."""
import json, os

ROOT = "/app/langs/locales"
KEYS = {
    "en": {
        "title": "How verification works",
        "nextUp": "Next up — use the button above to continue.",
        "prepare": {"title": "Get your documents ready", "body": "A government photo ID (passport, ID card or driving licence) and a device with a camera for a quick selfie.", "wait": "2 minutes"},
        "submit": {"title": "Submit your verification", "body": "Follow the secure Veriff flow: photograph your ID, take a selfie, done.", "retryBody": "Your last attempt didn't go through — start again with a clear, well-lit photo of the full document.", "wait": "5–10 minutes"},
        "review": {"title": "We review it", "body": "Most checks clear automatically within minutes. If a manual look is needed you'll get an email either way — nothing else to do.", "wait": "Minutes · up to 48 h"},
        "verified": {"title": "Verified — payouts unlocked", "body": "Full limits, live payment links and settlements to your payout addresses.", "wait": "Done"},
    },
    "de": {
        "title": "So funktioniert die Verifizierung",
        "nextUp": "Als Nächstes — nutzen Sie den Button oben, um fortzufahren.",
        "prepare": {"title": "Dokumente bereitlegen", "body": "Ein amtlicher Lichtbildausweis (Reisepass, Personalausweis oder Führerschein) und ein Gerät mit Kamera für ein kurzes Selfie.", "wait": "2 Minuten"},
        "submit": {"title": "Verifizierung einreichen", "body": "Folgen Sie dem sicheren Veriff-Ablauf: Ausweis fotografieren, Selfie aufnehmen, fertig.", "retryBody": "Ihr letzter Versuch ist nicht durchgegangen — starten Sie erneut mit einem klaren, gut ausgeleuchteten Foto des gesamten Dokuments.", "wait": "5–10 Minuten"},
        "review": {"title": "Wir prüfen", "body": "Die meisten Prüfungen werden innerhalb von Minuten automatisch abgeschlossen. Falls eine manuelle Prüfung nötig ist, erhalten Sie in jedem Fall eine E-Mail — sonst nichts zu tun.", "wait": "Minuten · bis zu 48 Std."},
        "verified": {"title": "Verifiziert — Auszahlungen freigeschaltet", "body": "Volle Limits, aktive Zahlungslinks und Abrechnungen an Ihre Auszahlungsadressen.", "wait": "Erledigt"},
    },
    "es": {
        "title": "Cómo funciona la verificación",
        "nextUp": "Siguiente paso — usa el botón de arriba para continuar.",
        "prepare": {"title": "Prepara tus documentos", "body": "Un documento de identidad oficial con foto (pasaporte, DNI o carnet de conducir) y un dispositivo con cámara para una selfie rápida.", "wait": "2 minutos"},
        "submit": {"title": "Envía tu verificación", "body": "Sigue el flujo seguro de Veriff: fotografía tu documento, hazte una selfie y listo.", "retryBody": "Tu último intento no se completó — vuelve a empezar con una foto nítida y bien iluminada del documento completo.", "wait": "5–10 minutos"},
        "review": {"title": "Lo revisamos", "body": "La mayoría de las comprobaciones se aprueban automáticamente en minutos. Si hace falta una revisión manual, recibirás un correo en cualquier caso — no tienes que hacer nada más.", "wait": "Minutos · hasta 48 h"},
        "verified": {"title": "Verificado — pagos desbloqueados", "body": "Límites completos, enlaces de pago activos y liquidaciones a tus direcciones de cobro.", "wait": "Hecho"},
    },
    "fr": {
        "title": "Comment fonctionne la vérification",
        "nextUp": "Étape suivante — utilisez le bouton ci-dessus pour continuer.",
        "prepare": {"title": "Préparez vos documents", "body": "Une pièce d'identité officielle avec photo (passeport, carte d'identité ou permis de conduire) et un appareil avec caméra pour un selfie rapide.", "wait": "2 minutes"},
        "submit": {"title": "Soumettez votre vérification", "body": "Suivez le parcours sécurisé Veriff : photographiez votre pièce d'identité, prenez un selfie, c'est terminé.", "retryBody": "Votre dernière tentative n'a pas abouti — recommencez avec une photo nette et bien éclairée du document entier.", "wait": "5–10 minutes"},
        "review": {"title": "Nous vérifions", "body": "La plupart des contrôles sont validés automatiquement en quelques minutes. Si un examen manuel est nécessaire, vous recevrez un e-mail dans tous les cas — rien d'autre à faire.", "wait": "Minutes · jusqu'à 48 h"},
        "verified": {"title": "Vérifié — versements débloqués", "body": "Limites complètes, liens de paiement actifs et règlements vers vos adresses de versement.", "wait": "Terminé"},
    },
    "nl": {
        "title": "Zo werkt de verificatie",
        "nextUp": "Volgende stap — gebruik de knop hierboven om verder te gaan.",
        "prepare": {"title": "Leg je documenten klaar", "body": "Een officieel identiteitsbewijs met foto (paspoort, ID-kaart of rijbewijs) en een apparaat met camera voor een snelle selfie.", "wait": "2 minuten"},
        "submit": {"title": "Dien je verificatie in", "body": "Volg de beveiligde Veriff-flow: fotografeer je ID, maak een selfie, klaar.", "retryBody": "Je laatste poging is niet gelukt — begin opnieuw met een scherpe, goed belichte foto van het volledige document.", "wait": "5–10 minuten"},
        "review": {"title": "Wij beoordelen", "body": "De meeste controles worden binnen enkele minuten automatisch goedgekeurd. Als een handmatige controle nodig is, krijg je in elk geval een e-mail — verder hoef je niets te doen.", "wait": "Minuten · tot 48 uur"},
        "verified": {"title": "Geverifieerd — uitbetalingen ontgrendeld", "body": "Volledige limieten, actieve betaallinks en afwikkelingen naar je uitbetalingsadressen.", "wait": "Klaar"},
    },
    "pt": {
        "title": "Como funciona a verificação",
        "nextUp": "Próximo passo — usa o botão acima para continuar.",
        "prepare": {"title": "Prepara os teus documentos", "body": "Um documento de identificação oficial com fotografia (passaporte, cartão de cidadão ou carta de condução) e um dispositivo com câmara para uma selfie rápida.", "wait": "2 minutos"},
        "submit": {"title": "Envia a tua verificação", "body": "Segue o fluxo seguro da Veriff: fotografa o teu documento, tira uma selfie e pronto.", "retryBody": "A tua última tentativa não foi concluída — recomeça com uma fotografia nítida e bem iluminada do documento completo.", "wait": "5–10 minutos"},
        "review": {"title": "Nós analisamos", "body": "A maioria das verificações é aprovada automaticamente em minutos. Se for necessária uma análise manual, recebes um e-mail em qualquer caso — não há mais nada a fazer.", "wait": "Minutos · até 48 h"},
        "verified": {"title": "Verificado — pagamentos desbloqueados", "body": "Limites completos, links de pagamento ativos e liquidações para os teus endereços de pagamento.", "wait": "Concluído"},
    },
}

for lang, block in KEYS.items():
    p = os.path.join(ROOT, lang, "dashboardLayout.json")
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    if data.get("kycTimeline") == block:
        print(lang, "already up to date")
        continue
    data["kycTimeline"] = block
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(lang, "updated")
