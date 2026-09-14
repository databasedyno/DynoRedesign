#!/usr/bin/env python3
"""One-off: add missing creator/store/checkout keys (C7 audit) to all 6 landing.json locales."""
import json, os

ROOT = os.path.join(os.path.dirname(__file__), "..", "..", "langs", "locales")

T = {
  "checkout.failedTitle": {
    "en": "Payment failed", "de": "Zahlung fehlgeschlagen", "es": "Pago fallido", "fr": "Paiement échoué", "nl": "Betaling mislukt", "pt": "Pagamento falhou"},
  "checkout.feeCalcError": {
    "en": "Could not calculate the network fee for this coin. Please try again or choose a different coin.",
    "de": "Die Netzwerkgebühr für diesen Coin konnte nicht berechnet werden. Bitte erneut versuchen oder einen anderen Coin wählen.",
    "es": "No se pudo calcular la comisión de red para esta moneda. Inténtalo de nuevo o elige otra moneda.",
    "fr": "Impossible de calculer les frais de réseau pour cette crypto. Réessayez ou choisissez une autre crypto.",
    "nl": "De netwerkkosten voor deze coin konden niet worden berekend. Probeer het opnieuw of kies een andere coin.",
    "pt": "Não foi possível calcular a taxa de rede desta moeda. Tente novamente ou escolha outra moeda."},
  "checkout.pleaseTryAgain": {
    "en": "Please try again.", "de": "Bitte erneut versuchen.", "es": "Inténtalo de nuevo.", "fr": "Veuillez réessayer.", "nl": "Probeer het opnieuw.", "pt": "Tente novamente."},
  "checkout.redirectingIn": {
    "en": "Taking you there in {{s}}s", "de": "Weiterleitung in {{s}} s", "es": "Te llevamos allí en {{s}} s", "fr": "Redirection dans {{s}} s", "nl": "We brengen je erheen in {{s}} s", "pt": "A levar-te lá em {{s}} s"},
  "checkout.stayHere": {
    "en": "Stay here", "de": "Hier bleiben", "es": "Quedarse aquí", "fr": "Rester ici", "nl": "Hier blijven", "pt": "Ficar aqui"},
  "checkout.store.businessPurchase": {
    "en": "Business purchase? Add a VAT ID", "de": "Geschäftlicher Kauf? USt-IdNr. hinzufügen", "es": "¿Compra de empresa? Añade tu NIF-IVA", "fr": "Achat professionnel ? Ajoutez un numéro de TVA", "nl": "Zakelijke aankoop? Voeg een btw-nummer toe", "pt": "Compra empresarial? Adicione o NIF/IVA"},
  "checkout.store.feeNote": {
    "en": "No extra charges — the merchant covers the processing fee. Your wallet's own network fee is separate.",
    "de": "Keine Zusatzkosten – der Händler übernimmt die Bearbeitungsgebühr. Die Netzwerkgebühr deiner Wallet ist separat.",
    "es": "Sin cargos adicionales: el comercio cubre la comisión de procesamiento. La comisión de red de tu monedero es aparte.",
    "fr": "Aucun frais supplémentaire — le marchand prend en charge les frais de traitement. Les frais de réseau de votre portefeuille sont distincts.",
    "nl": "Geen extra kosten — de verkoper betaalt de verwerkingskosten. De netwerkkosten van je wallet staan hier los van.",
    "pt": "Sem custos extra — o comerciante cobre a taxa de processamento. A taxa de rede da tua carteira é à parte."},
  "checkout.store.minTotalAdd": {
    "en": "Minimum order is {{min}} — add {{more}} more to check out.",
    "de": "Mindestbestellwert {{min}} – füge noch {{more}} hinzu, um zur Kasse zu gehen.",
    "es": "El pedido mínimo es {{min}}: añade {{more}} más para pagar.",
    "fr": "Commande minimum : {{min}} — ajoutez encore {{more}} pour passer au paiement.",
    "nl": "Minimale bestelling is {{min}} — voeg nog {{more}} toe om af te rekenen.",
    "pt": "O pedido mínimo é {{min}} — adiciona mais {{more}} para finalizar."},
  "checkout.store.viewOrder": {
    "en": "View your order & downloads", "de": "Bestellung & Downloads ansehen", "es": "Ver tu pedido y descargas", "fr": "Voir votre commande et vos téléchargements", "nl": "Bekijk je bestelling & downloads", "pt": "Ver o teu pedido e downloads"},
  "checkout.underpaid.secondFeeNote": {
    "en": "Your wallet will charge a second network fee for this top-up — that's normal and doesn't change the amount above.",
    "de": "Deine Wallet berechnet für diese Nachzahlung eine zweite Netzwerkgebühr – das ist normal und ändert den Betrag oben nicht.",
    "es": "Tu monedero cobrará una segunda comisión de red por este complemento; es normal y no cambia el importe de arriba.",
    "fr": "Votre portefeuille facturera des frais de réseau pour ce complément — c'est normal et cela ne change pas le montant ci-dessus.",
    "nl": "Je wallet rekent netwerkkosten voor deze aanvulling — dat is normaal en verandert het bedrag hierboven niet.",
    "pt": "A tua carteira cobrará uma segunda taxa de rede por este complemento — é normal e não altera o valor acima."},
  "creator.featured.raisedOf": {
    "en": "raised of {{goal}}", "de": "gesammelt von {{goal}}", "es": "recaudado de {{goal}}", "fr": "collectés sur {{goal}}", "nl": "opgehaald van {{goal}}", "pt": "angariado de {{goal}}"},
  "creator.featured.supportName": {
    "en": "Support {{name}}", "de": "{{name}} unterstützen", "es": "Apoya a {{name}}", "fr": "Soutenir {{name}}", "nl": "Steun {{name}}", "pt": "Apoiar {{name}}"},
  "creator.inline.cancel": {
    "en": "Cancel", "de": "Abbrechen", "es": "Cancelar", "fr": "Annuler", "nl": "Annuleren", "pt": "Cancelar"},
  "creator.inline.copiedExclaim": {
    "en": "Copied!", "de": "Kopiert!", "es": "¡Copiado!", "fr": "Copié !", "nl": "Gekopieerd!", "pt": "Copiado!"},
  "creator.inline.copyLink": {
    "en": "Copy link", "de": "Link kopieren", "es": "Copiar enlace", "fr": "Copier le lien", "nl": "Link kopiëren", "pt": "Copiar link"},
  "creator.inline.expiredBody": {
    "en": "No payment was received in time. Nothing was charged — you can try again.",
    "de": "Es ist keine Zahlung rechtzeitig eingegangen. Es wurde nichts abgebucht – du kannst es erneut versuchen.",
    "es": "No se recibió el pago a tiempo. No se cobró nada: puedes intentarlo de nuevo.",
    "fr": "Aucun paiement reçu à temps. Rien n'a été débité — vous pouvez réessayer.",
    "nl": "Er is geen betaling op tijd ontvangen. Er is niets afgeschreven — je kunt het opnieuw proberen.",
    "pt": "Nenhum pagamento foi recebido a tempo. Nada foi cobrado — podes tentar novamente."},
  "creator.inline.failedBody": {
    "en": "We couldn't process your payment. Please try again.",
    "de": "Deine Zahlung konnte nicht verarbeitet werden. Bitte erneut versuchen.",
    "es": "No pudimos procesar tu pago. Inténtalo de nuevo.",
    "fr": "Nous n'avons pas pu traiter votre paiement. Veuillez réessayer.",
    "nl": "We konden je betaling niet verwerken. Probeer het opnieuw.",
    "pt": "Não conseguimos processar o teu pagamento. Tenta novamente."},
  "creator.inline.gracePeriod": {
    "en": "{{minutes}}-min grace period", "de": "{{minutes}} Min. Kulanzzeit", "es": "{{minutes}} min de periodo de gracia", "fr": "Délai de grâce de {{minutes}} min", "nl": "{{minutes}} min respijt", "pt": "{{minutes}} min de tolerância"},
  "creator.inline.includesFee": {
    "en": "includes network fee", "de": "inkl. Netzwerkgebühr", "es": "incluye comisión de red", "fr": "frais de réseau inclus", "nl": "inclusief netwerkkosten", "pt": "inclui taxa de rede"},
  "creator.inline.networkWarning": {
    "en": "Send only {{coin}} on the {{network}} network. Other coins or networks can't be recovered.",
    "de": "Sende nur {{coin}} über das {{network}}-Netzwerk. Andere Coins oder Netzwerke können nicht wiederhergestellt werden.",
    "es": "Envía solo {{coin}} por la red {{network}}. Otras monedas o redes no se pueden recuperar.",
    "fr": "Envoyez uniquement du {{coin}} sur le réseau {{network}}. Les autres cryptos ou réseaux ne peuvent pas être récupérés.",
    "nl": "Stuur alleen {{coin}} via het {{network}}-netwerk. Andere coins of netwerken kunnen niet worden teruggehaald.",
    "pt": "Envia apenas {{coin}} na rede {{network}}. Outras moedas ou redes não podem ser recuperadas."},
  "creator.inline.onNetwork": {
    "en": "on {{network}}", "de": "über {{network}}", "es": "en {{network}}", "fr": "sur {{network}}", "nl": "via {{network}}", "pt": "em {{network}}"},
  "creator.inline.successNextOrder": {
    "en": "Your payment is confirmed. Your downloads, license keys and booking details are on your order page.",
    "de": "Deine Zahlung ist bestätigt. Downloads, Lizenzschlüssel und Buchungsdetails findest du auf deiner Bestellseite.",
    "es": "Tu pago está confirmado. Tus descargas, claves de licencia y detalles de reserva están en la página de tu pedido.",
    "fr": "Votre paiement est confirmé. Vos téléchargements, clés de licence et détails de réservation sont sur la page de votre commande.",
    "nl": "Je betaling is bevestigd. Je downloads, licentiesleutels en boekingsgegevens staan op je bestelpagina.",
    "pt": "O teu pagamento está confirmado. Os teus downloads, chaves de licença e detalhes de reserva estão na página do pedido."},
  "creator.inline.viewOrder": {
    "en": "View your order & downloads", "de": "Bestellung & Downloads ansehen", "es": "Ver tu pedido y descargas", "fr": "Voir votre commande et vos téléchargements", "nl": "Bekijk je bestelling & downloads", "pt": "Ver o teu pedido e downloads"},
  "creator.poweredBy": {
    "en": "Powered by", "de": "Bereitgestellt von", "es": "Con la tecnología de", "fr": "Propulsé par", "nl": "Mogelijk gemaakt door", "pt": "Disponibilizado por"},
  "creator.raised": {
    "en": "raised", "de": "gesammelt", "es": "recaudado", "fr": "collectés", "nl": "opgehaald", "pt": "angariado"},
  "creator.shareLabel": {
    "en": "Share", "de": "Teilen", "es": "Compartir", "fr": "Partager", "nl": "Delen", "pt": "Partilhar"},
  "creator.share.copied": {
    "en": "Link copied!", "de": "Link kopiert!", "es": "¡Enlace copiado!", "fr": "Lien copié !", "nl": "Link gekopieerd!", "pt": "Link copiado!"},
  "creator.share.copyLink": {
    "en": "Copy link", "de": "Link kopieren", "es": "Copiar enlace", "fr": "Copier le lien", "nl": "Link kopiëren", "pt": "Copiar link"},
  "creator.share.pageOf": {
    "en": "Share {{name}}'s page", "de": "Seite von {{name}} teilen", "es": "Compartir la página de {{name}}", "fr": "Partager la page de {{name}}", "nl": "Deel de pagina van {{name}}", "pt": "Partilhar a página de {{name}}"},
  "creator.socials.label": {
    "en": "Find {{name}} on", "de": "{{name}} findest du auf", "es": "Encuentra a {{name}} en", "fr": "Retrouvez {{name}} sur", "nl": "Vind {{name}} op", "pt": "Encontra {{name}} em"},
  "creator.support.addEmail": {
    "en": "Want a receipt? Add your email", "de": "Beleg gewünscht? E-Mail hinzufügen", "es": "¿Quieres un recibo? Añade tu correo", "fr": "Un reçu ? Ajoutez votre e-mail", "nl": "Bonnetje nodig? Voeg je e-mail toe", "pt": "Queres um recibo? Adiciona o teu e-mail"},
  "creator.support.custom": {
    "en": "Custom", "de": "Eigener Betrag", "es": "Personalizado", "fr": "Montant libre", "nl": "Eigen bedrag", "pt": "Personalizado"},
  "creator.support.emailInvalid": {
    "en": "Please enter a valid email address, or leave it blank.",
    "de": "Bitte gib eine gültige E-Mail-Adresse ein oder lass das Feld leer.",
    "es": "Introduce un correo válido o deja el campo en blanco.",
    "fr": "Saisissez une adresse e-mail valide ou laissez le champ vide.",
    "nl": "Vul een geldig e-mailadres in of laat het veld leeg.",
    "pt": "Introduz um e-mail válido ou deixa em branco."},
  "creator.support.emailPlaceholder": {
    "en": "Email for your receipt (optional)", "de": "E-Mail für deinen Beleg (optional)", "es": "Correo para tu recibo (opcional)", "fr": "E-mail pour votre reçu (facultatif)", "nl": "E-mail voor je bonnetje (optioneel)", "pt": "E-mail para o teu recibo (opcional)"},
  "creator.support.genericError": {
    "en": "Something went wrong. Please try again.", "de": "Etwas ist schiefgelaufen. Bitte erneut versuchen.", "es": "Algo salió mal. Inténtalo de nuevo.", "fr": "Une erreur s'est produite. Veuillez réessayer.", "nl": "Er ging iets mis. Probeer het opnieuw.", "pt": "Algo correu mal. Tenta novamente."},
  "creator.support.messagePlaceholder": {
    "en": "Say something nice to {{name}} (optional)", "de": "Sag {{name}} etwas Nettes (optional)", "es": "Dile algo bonito a {{name}} (opcional)", "fr": "Un petit mot pour {{name}} (facultatif)", "nl": "Zeg iets aardigs tegen {{name}} (optioneel)", "pt": "Diz algo simpático a {{name}} (opcional)"},
  "creator.support.networkError": {
    "en": "Network error. Please try again.", "de": "Netzwerkfehler. Bitte erneut versuchen.", "es": "Error de red. Inténtalo de nuevo.", "fr": "Erreur réseau. Veuillez réessayer.", "nl": "Netwerkfout. Probeer het opnieuw.", "pt": "Erro de rede. Tenta novamente."},
  "creator.support.publicNote": {
    "en": "Your first name and amount may appear on this page unless you tick this.",
    "de": "Dein Vorname und Betrag können auf dieser Seite erscheinen, sofern du dies nicht ankreuzt.",
    "es": "Tu nombre y el importe pueden aparecer en esta página a menos que marques esta casilla.",
    "fr": "Votre prénom et le montant peuvent apparaître sur cette page sauf si vous cochez cette case.",
    "nl": "Je voornaam en bedrag kunnen op deze pagina verschijnen tenzij je dit aanvinkt.",
    "pt": "O teu primeiro nome e o valor podem aparecer nesta página, a menos que assinales esta opção."},
  "creator.supporters": {
    "en": "supporters", "de": "Unterstützer", "es": "seguidores", "fr": "soutiens", "nl": "supporters", "pt": "apoiantes"},
  "shop.emptyVisitPage": {
    "en": "Visit {{name}}'s page", "de": "Seite von {{name}} besuchen", "es": "Visitar la página de {{name}}", "fr": "Voir la page de {{name}}", "nl": "Bezoek de pagina van {{name}}", "pt": "Visitar a página de {{name}}"},
  "shop.emptyVisitorBodyV2": {
    "en": "Check back soon — or show your support on their page in the meantime.",
    "de": "Schau bald wieder vorbei – oder zeige in der Zwischenzeit deine Unterstützung auf der Seite.",
    "es": "Vuelve pronto o, mientras tanto, muestra tu apoyo en su página.",
    "fr": "Revenez bientôt — ou montrez votre soutien sur sa page en attendant.",
    "nl": "Kom snel terug — of toon in de tussentijd je steun op de pagina.",
    "pt": "Volta em breve — ou mostra o teu apoio na página entretanto."},
  "shop.emptyVisitorTitleV2": {
    "en": "{{name}} hasn't listed anything yet", "de": "{{name}} hat noch nichts eingestellt", "es": "{{name}} aún no ha publicado nada", "fr": "{{name}} n'a encore rien mis en vente", "nl": "{{name}} heeft nog niets aangeboden", "pt": "{{name}} ainda não publicou nada"},
  "shop.galleryImage": {
    "en": "Image", "de": "Bild", "es": "Imagen", "fr": "Image", "nl": "Afbeelding", "pt": "Imagem"},
  "shop.minOrderHint": {
    "en": "Min. order {{min}} — combine with other items", "de": "Mindestbestellwert {{min}} – mit anderen Artikeln kombinieren", "es": "Pedido mín. {{min}}: combínalo con otros artículos", "fr": "Commande min. {{min}} — à combiner avec d'autres articles", "nl": "Min. bestelling {{min}} — combineer met andere items", "pt": "Pedido mín. {{min}} — combina com outros artigos"},
  "shop.minOrderNotice": {
    "en": "Minimum order is {{min}} — add this to your cart and combine it with other items to check out.",
    "de": "Mindestbestellwert {{min}} – lege den Artikel in den Warenkorb und kombiniere ihn mit anderen, um zur Kasse zu gehen.",
    "es": "El pedido mínimo es {{min}}: añádelo al carrito y combínalo con otros artículos para pagar.",
    "fr": "Commande minimum : {{min}} — ajoutez cet article au panier et combinez-le avec d'autres pour passer au paiement.",
    "nl": "Minimale bestelling is {{min}} — voeg dit toe aan je winkelwagen en combineer het met andere items om af te rekenen.",
    "pt": "O pedido mínimo é {{min}} — adiciona ao carrinho e combina com outros artigos para finalizar."},
}

def set_path(d, path, val):
    parts = path.split(".")
    for p in parts[:-1]:
        nxt = d.get(p)
        if not isinstance(nxt, dict):
            nxt = {}
            d[p] = nxt
        d = nxt
    d.setdefault(parts[-1], val)

for lang in ["en", "de", "es", "fr", "nl", "pt"]:
    fp = os.path.join(ROOT, lang, "landing.json")
    data = json.load(open(fp, encoding="utf-8"))
    # creator.share was a string in code but is a namespace in JSON — drop the string form.
    if isinstance(data.get("creator", {}).get("share"), str):
        del data["creator"]["share"]
    for k, v in T.items():
        set_path(data, k, v[lang])
    json.dump(data, open(fp, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(fp, "a", encoding="utf-8").write("\n")
    print(lang, "ok")
