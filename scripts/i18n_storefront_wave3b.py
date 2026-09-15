#!/usr/bin/env python3
"""Wave 3b — "Your page" header/funnel i18n keys under common.json → storefront.funnel (EN + 5). Idempotent."""
import json, os

ROOT = "/app/langs/locales"

KEYS = {
    "en": {
        "live": "Live", "draft": "Draft", "unclaimed": "Not claimed",
        "liveTitle": "Your page is live", "draftTitle": "Your page is a draft", "claimTitle": "Claim your handle to publish your page",
        "liveHint": "Changes you save appear on your public page instantly.",
        "draftHint": "Only you can see it. Turn on the publish toggle in the editor to go live.",
        "claimHint": "Pick a handle below — tips, products and payment links will live behind one link.",
        "editPage": "Edit page", "claimCta": "Claim handle", "copyUrl": "Copy link",
        "tipsNudge": "Tips are off — set up your tip box →",
        "views": "Views", "checkouts": "Checkouts", "paid": "Paid", "split": "{{tips}} tips · {{orders}} orders",
    },
    "de": {
        "live": "Live", "draft": "Entwurf", "unclaimed": "Nicht reserviert",
        "liveTitle": "Ihre Seite ist live", "draftTitle": "Ihre Seite ist ein Entwurf", "claimTitle": "Reservieren Sie Ihr Handle, um Ihre Seite zu veröffentlichen",
        "liveHint": "Gespeicherte Änderungen erscheinen sofort auf Ihrer öffentlichen Seite.",
        "draftHint": "Nur Sie können sie sehen. Aktivieren Sie den Veröffentlichen-Schalter im Editor, um live zu gehen.",
        "claimHint": "Wählen Sie unten ein Handle — Trinkgelder, Produkte und Zahlungslinks stehen dann hinter einem Link.",
        "editPage": "Seite bearbeiten", "claimCta": "Handle reservieren", "copyUrl": "Link kopieren",
        "tipsNudge": "Trinkgelder sind aus — Trinkgeldbox einrichten →",
        "views": "Aufrufe", "checkouts": "Checkouts", "paid": "Bezahlt", "split": "{{tips}} Trinkgelder · {{orders}} Bestellungen",
    },
    "es": {
        "live": "En vivo", "draft": "Borrador", "unclaimed": "Sin reclamar",
        "liveTitle": "Tu página está en vivo", "draftTitle": "Tu página es un borrador", "claimTitle": "Reclama tu handle para publicar tu página",
        "liveHint": "Los cambios que guardes aparecen al instante en tu página pública.",
        "draftHint": "Solo tú puedes verla. Activa el interruptor de publicación en el editor para salir en vivo.",
        "claimHint": "Elige un handle abajo: propinas, productos y enlaces de pago vivirán tras un solo enlace.",
        "editPage": "Editar página", "claimCta": "Reclamar handle", "copyUrl": "Copiar enlace",
        "tipsNudge": "Las propinas están desactivadas — configura tu bote de propinas →",
        "views": "Visitas", "checkouts": "Checkouts", "paid": "Pagados", "split": "{{tips}} propinas · {{orders}} pedidos",
    },
    "fr": {
        "live": "En ligne", "draft": "Brouillon", "unclaimed": "Non réservé",
        "liveTitle": "Votre page est en ligne", "draftTitle": "Votre page est un brouillon", "claimTitle": "Réservez votre identifiant pour publier votre page",
        "liveHint": "Les modifications enregistrées apparaissent instantanément sur votre page publique.",
        "draftHint": "Vous seul pouvez la voir. Activez le bouton de publication dans l'éditeur pour la mettre en ligne.",
        "claimHint": "Choisissez un identifiant ci-dessous — pourboires, produits et liens de paiement derrière un seul lien.",
        "editPage": "Modifier la page", "claimCta": "Réserver l'identifiant", "copyUrl": "Copier le lien",
        "tipsNudge": "Les pourboires sont désactivés — configurez votre boîte à pourboires →",
        "views": "Vues", "checkouts": "Paiements lancés", "paid": "Payés", "split": "{{tips}} pourboires · {{orders}} commandes",
    },
    "nl": {
        "live": "Live", "draft": "Concept", "unclaimed": "Niet geclaimd",
        "liveTitle": "Je pagina is live", "draftTitle": "Je pagina is een concept", "claimTitle": "Claim je handle om je pagina te publiceren",
        "liveHint": "Opgeslagen wijzigingen verschijnen direct op je openbare pagina.",
        "draftHint": "Alleen jij kunt hem zien. Zet de publiceer-schakelaar in de editor aan om live te gaan.",
        "claimHint": "Kies hieronder een handle — tips, producten en betaallinks staan dan achter één link.",
        "editPage": "Pagina bewerken", "claimCta": "Handle claimen", "copyUrl": "Link kopiëren",
        "tipsNudge": "Tips staan uit — stel je tipbox in →",
        "views": "Weergaven", "checkouts": "Checkouts", "paid": "Betaald", "split": "{{tips}} tips · {{orders}} bestellingen",
    },
    "pt": {
        "live": "Publicada", "draft": "Rascunho", "unclaimed": "Não reservado",
        "liveTitle": "A sua página está publicada", "draftTitle": "A sua página é um rascunho", "claimTitle": "Reserve o seu handle para publicar a sua página",
        "liveHint": "As alterações que guardar aparecem de imediato na sua página pública.",
        "draftHint": "Só você a pode ver. Ative o interruptor de publicação no editor para a publicar.",
        "claimHint": "Escolha um handle abaixo — gorjetas, produtos e links de pagamento ficam atrás de um só link.",
        "editPage": "Editar página", "claimCta": "Reservar handle", "copyUrl": "Copiar link",
        "tipsNudge": "As gorjetas estão desativadas — configure a sua caixa de gorjetas →",
        "views": "Visualizações", "checkouts": "Checkouts", "paid": "Pagos", "split": "{{tips}} gorjetas · {{orders}} encomendas",
    },
}

for lang, patch in KEYS.items():
    p = os.path.join(ROOT, lang, "common.json")
    if not os.path.exists(p):
        continue
    with open(p, encoding="utf-8") as f:
        data = json.load(f)
    sf = data.get("storefront") or {}
    funnel = sf.get("funnel") or {}
    funnel.update(patch)
    sf["funnel"] = funnel
    data["storefront"] = sf
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")
print("ok")
