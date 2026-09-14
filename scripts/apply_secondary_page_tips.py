#!/usr/bin/env python3
"""Add first-visit page tips for the secondary pages to common.json (6 langs)."""
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1] / "langs" / "locales"

TIPS = {
    "en": {
        "storefront": ("Your page, one link", "Everything you sell — tips, products and payment links — lives behind one short URL. Set it up here, then share it anywhere."),
        "settings": ("Account vs. brand settings", "Some settings apply to your whole account (profile, notifications); others apply only to the selected brand. The chip under each section title tells you which."),
        "developers": ("Your API keys stay secret", "Use a secret key on your server and a publishable key in the browser. Copy from here whenever you need — never paste secret keys into client code."),
        "notifications": ("Every event, in one feed", "Payments, payouts, KYC and security alerts land here. Tap any item to open the matching transaction or setting."),
        "helpSupport": ("Help is one search away", "Search the guides first — most answers are here. Still stuck? Start a chat and a human will pick it up."),
    },
    "pt": {
        "storefront": ("Sua página, um único link", "Tudo o que você vende — gorjetas, produtos e links de pagamento — fica atrás de um único URL curto. Configure aqui e compartilhe onde quiser."),
        "settings": ("Configurações da conta vs. da marca", "Algumas configurações valem para toda a conta (perfil, notificações); outras apenas para a marca selecionada. O selo abaixo de cada título indica qual."),
        "developers": ("Suas chaves de API são secretas", "Use uma chave secreta no seu servidor e uma chave publicável no navegador. Copie daqui sempre que precisar — nunca cole chaves secretas em código do cliente."),
        "notifications": ("Todos os eventos em um só feed", "Pagamentos, repasses, KYC e alertas de segurança chegam aqui. Toque em qualquer item para abrir a transação ou configuração correspondente."),
        "helpSupport": ("A ajuda está a uma busca de distância", "Pesquise primeiro nos guias — a maioria das respostas está aqui. Ainda com dúvida? Inicie um chat e uma pessoa da equipe assume."),
    },
    "fr": {
        "storefront": ("Votre page, un seul lien", "Tout ce que vous vendez — pourboires, produits et liens de paiement — se trouve derrière une seule URL courte. Configurez-la ici, puis partagez-la partout."),
        "settings": ("Paramètres du compte vs. de la marque", "Certains paramètres s'appliquent à tout votre compte (profil, notifications) ; d'autres uniquement à la marque sélectionnée. La pastille sous chaque titre de section vous l'indique."),
        "developers": ("Vos clés API restent secrètes", "Utilisez une clé secrète côté serveur et une clé publiable dans le navigateur. Copiez-les ici quand vous en avez besoin — ne collez jamais de clé secrète dans du code client."),
        "notifications": ("Tous les événements, un seul fil", "Paiements, versements, KYC et alertes de sécurité arrivent ici. Touchez un élément pour ouvrir la transaction ou le paramètre correspondant."),
        "helpSupport": ("L'aide est à une recherche près", "Cherchez d'abord dans les guides — la plupart des réponses s'y trouvent. Toujours bloqué ? Lancez un chat et une personne de l'équipe prend le relais."),
    },
    "es": {
        "storefront": ("Tu página, un solo enlace", "Todo lo que vendes — propinas, productos y enlaces de pago — vive detrás de una única URL corta. Configúrala aquí y compártela donde quieras."),
        "settings": ("Ajustes de cuenta vs. de marca", "Algunos ajustes aplican a toda tu cuenta (perfil, notificaciones); otros solo a la marca seleccionada. La etiqueta bajo cada título de sección te indica cuál."),
        "developers": ("Tus claves API son secretas", "Usa una clave secreta en tu servidor y una clave publicable en el navegador. Cópialas desde aquí cuando las necesites — nunca pegues claves secretas en código del cliente."),
        "notifications": ("Todos los eventos, en un solo feed", "Pagos, liquidaciones, KYC y alertas de seguridad llegan aquí. Toca cualquier elemento para abrir la transacción o el ajuste correspondiente."),
        "helpSupport": ("La ayuda está a una búsqueda", "Busca primero en las guías — la mayoría de las respuestas están aquí. ¿Sigues atascado? Inicia un chat y una persona del equipo lo atenderá."),
    },
    "de": {
        "storefront": ("Ihre Seite, ein Link", "Alles, was Sie verkaufen — Trinkgelder, Produkte und Zahlungslinks — liegt hinter einer kurzen URL. Richten Sie sie hier ein und teilen Sie sie überall."),
        "settings": ("Konto- vs. Markeneinstellungen", "Einige Einstellungen gelten für Ihr gesamtes Konto (Profil, Benachrichtigungen), andere nur für die ausgewählte Marke. Das Kennzeichen unter jedem Abschnittstitel zeigt, welche."),
        "developers": ("Ihre API-Schlüssel bleiben geheim", "Verwenden Sie einen geheimen Schlüssel auf Ihrem Server und einen veröffentlichbaren Schlüssel im Browser. Kopieren Sie hier bei Bedarf — geheime Schlüssel niemals in Client-Code einfügen."),
        "notifications": ("Alle Ereignisse in einem Feed", "Zahlungen, Auszahlungen, KYC und Sicherheitswarnungen landen hier. Tippen Sie auf einen Eintrag, um die passende Transaktion oder Einstellung zu öffnen."),
        "helpSupport": ("Hilfe ist nur eine Suche entfernt", "Durchsuchen Sie zuerst die Anleitungen — die meisten Antworten finden Sie hier. Kommen Sie nicht weiter? Starten Sie einen Chat, und ein Mensch übernimmt."),
    },
    "nl": {
        "storefront": ("Uw pagina, één link", "Alles wat u verkoopt — tips, producten en betaallinks — staat achter één korte URL. Stel die hier in en deel hem overal."),
        "settings": ("Account- vs. merkinstellingen", "Sommige instellingen gelden voor uw hele account (profiel, meldingen); andere alleen voor het geselecteerde merk. Het label onder elke sectietitel geeft aan welke."),
        "developers": ("Uw API-sleutels blijven geheim", "Gebruik een geheime sleutel op uw server en een publiceerbare sleutel in de browser. Kopieer hier wanneer nodig — plak geheime sleutels nooit in clientcode."),
        "notifications": ("Elke gebeurtenis in één feed", "Betalingen, uitbetalingen, KYC en beveiligingswaarschuwingen komen hier binnen. Tik op een item om de bijbehorende transactie of instelling te openen."),
        "helpSupport": ("Hulp is één zoekopdracht verwijderd", "Zoek eerst in de handleidingen — de meeste antwoorden staan hier. Komt u er niet uit? Start een chat en een medewerker neemt het over."),
    },
}

for lang, tips in TIPS.items():
    path = ROOT / lang / "common.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    block = data.setdefault("pageTips", {})
    for key, (title, body) in tips.items():
        block[key] = {"title": title, "body": body}
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(lang, "ok", sorted(block.keys()))
