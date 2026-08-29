#!/usr/bin/env python3
"""One-shot i18n injector for the 2026-06 landing/fees enhancements (a-e).
Adds v3.ways / v3.whopays / v3.coins / v3.refunds to landing.json and the
whoPays/included/inc* keys to fees.json across all 6 locales. Format-preserving
(indent=2, ensure_ascii=False, trailing newline kept)."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), "..", "langs", "locales")

LANDING = {
  "en": {
    "ways": {
      "eyebrow": "[ Ways to get paid ]", "headline1": "Nine ways to", "headline2": "take a payment.",
      "body": "Pick the surface that fits — a link, a hosted page, an API call or a full storefront. One wallet, one dashboard behind them all.",
      "links": {"title": "Payment links", "desc": "Share one link anywhere. Buyers pay in seconds — no account needed."},
      "checkout": {"title": "Hosted checkout", "desc": "A branded, drop-in payment page for any amount or product."},
      "api": {"title": "REST API", "desc": "Create charges from your backend, with signed webhooks and sandbox keys."},
      "buttons": {"title": "Buy buttons", "desc": "Embed a pay button on any website with a snippet of HTML."},
      "elements": {"title": "Embeddable elements", "desc": "Drop checkout into your own pages using publishable keys."},
      "storefront": {"title": "Storefront", "desc": "A full catalog — digital, physical or service — with cart and VAT."},
      "tips": {"title": "Creator tips", "desc": "Your own @handle page for one-tap tips from your fans."},
      "donations": {"title": "Donations", "desc": "Fundraising links with goals, tiers and a live donor wall."},
      "invoices": {"title": "Invoices", "desc": "Send crypto invoices with VAT, reverse-charge and PDF receipts."}
    },
    "whopays": {
      "eyebrow": "[ Fees, your way ]", "headline": "You choose who pays the fee.",
      "body": "Absorb the fee yourself, or pass it to the customer and keep 100% of your price. Switch it per link or per checkout, whenever you like.",
      "tabMerchant": "I pay the fee", "tabCustomer": "Customer pays", "exampleLabel": "On a $100 payment",
      "customerPaysLabel": "Customer pays", "youReceiveLabel": "You receive",
      "merchantNote": "You cover the 1.5% + $1 fee, so the price your customer sees stays exactly $100.",
      "customerNote": "The fee is added on top — the customer covers it and you keep your full $100.",
      "feeFootnote": "Example at the 1.5% Starter rate + $1 per payment. Your rate drops to 0.5% as volume grows."
    },
    "coins": {
      "eyebrow": "[ Coins & tokens ]", "headline": "15 coins & tokens.", "headline2": "Nine chains.",
      "body": "Bitcoin, Ethereum, Solana, XRP and more — plus USDT, USDC and RLUSD across Ethereum, Tron and Polygon.",
      "convertTitle": "Keep it, or auto-convert.",
      "convertDesc": "Get paid in any coin and keep it, or auto-convert to USDC or USDT the moment it confirms. Your choice, every time."
    },
    "refunds": {
      "eyebrow": "[ Trust, built in ]", "headline": "Crypto you can actually refund.",
      "body": "The parts that make crypto feel risky? Handled. Refunds, custody and webhooks — done right.",
      "refundsTitle": "One-click crypto refunds",
      "refundsDesc": "Refund a payment on its original chain, full or partial — the customer gets an emailed receipt.",
      "custodyTitle": "Non-custodial by design",
      "custodyDesc": "Funds settle straight to your own wallet. We never hold your money — your keys, your crypto.",
      "webhooksTitle": "Signed webhooks",
      "webhooksDesc": "HMAC-signed events, automatic retries and a dead-letter queue keep your systems in sync."
    }
  },
  "es": {
    "ways": {
      "eyebrow": "[ Formas de cobrar ]", "headline1": "Nueve formas de", "headline2": "recibir un pago.",
      "body": "Elige la que encaje: un enlace, una página alojada, una llamada a la API o una tienda completa. Detrás de todas, una sola cartera y un solo panel.",
      "links": {"title": "Enlaces de pago", "desc": "Comparte un enlace donde quieras. Tus clientes pagan en segundos, sin cuenta."},
      "checkout": {"title": "Checkout alojado", "desc": "Una página de pago con tu marca, lista para cualquier importe o producto."},
      "api": {"title": "API REST", "desc": "Crea cobros desde tu backend, con webhooks firmados y claves de prueba."},
      "buttons": {"title": "Botones de compra", "desc": "Añade un botón de pago a cualquier web con un fragmento de HTML."},
      "elements": {"title": "Elementos integrables", "desc": "Integra el checkout en tus propias páginas con claves publicables."},
      "storefront": {"title": "Tienda", "desc": "Un catálogo completo —digital, físico o servicios— con carrito e IVA."},
      "tips": {"title": "Propinas de creador", "desc": "Tu propia página @usuario para recibir propinas con un toque."},
      "donations": {"title": "Donaciones", "desc": "Enlaces de recaudación con metas, niveles y muro de donantes en vivo."},
      "invoices": {"title": "Facturas", "desc": "Envía facturas cripto con IVA, inversión del sujeto pasivo y recibos en PDF."}
    },
    "whopays": {
      "eyebrow": "[ Comisiones a tu manera ]", "headline": "Tú eliges quién paga la comisión.",
      "body": "Asume tú la comisión o pásasela al cliente y quédate con el 100% de tu precio. Cámbialo por enlace o por checkout, cuando quieras.",
      "tabMerchant": "La pago yo", "tabCustomer": "La paga el cliente", "exampleLabel": "En un pago de $100",
      "customerPaysLabel": "El cliente paga", "youReceiveLabel": "Tú recibes",
      "merchantNote": "Tú cubres la comisión del 1,5% + $1, así que el precio que ve tu cliente sigue siendo exactamente $100.",
      "customerNote": "La comisión se añade encima: la paga el cliente y tú te quedas con tus $100 completos.",
      "feeFootnote": "Ejemplo con la tarifa Starter del 1,5% + $1 por pago. Tu tarifa baja al 0,5% a medida que creces."
    },
    "coins": {
      "eyebrow": "[ Monedas y tokens ]", "headline": "15 monedas y tokens.", "headline2": "Nueve redes.",
      "body": "Bitcoin, Ethereum, Solana, XRP y más, además de USDT, USDC y RLUSD en Ethereum, Tron y Polygon.",
      "convertTitle": "Consérvala o conviértela sola.",
      "convertDesc": "Cobra en cualquier moneda y consérvala, o conviértela automáticamente a USDC o USDT en cuanto se confirme. Tú eliges, siempre."
    },
    "refunds": {
      "eyebrow": "[ Confianza de serie ]", "headline": "Cripto que sí puedes reembolsar.",
      "body": "¿Lo que hace que la cripto dé respeto? Resuelto. Reembolsos, custodia y webhooks, bien hechos.",
      "refundsTitle": "Reembolsos cripto en un clic",
      "refundsDesc": "Reembolsa un pago en su red original, total o parcial; el cliente recibe un recibo por email.",
      "custodyTitle": "Sin custodia por diseño",
      "custodyDesc": "Los fondos llegan directos a tu propia cartera. Nunca guardamos tu dinero: tus claves, tu cripto.",
      "webhooksTitle": "Webhooks firmados",
      "webhooksDesc": "Eventos firmados con HMAC, reintentos automáticos y cola de mensajes fallidos mantienen tus sistemas al día."
    }
  },
  "pt": {
    "ways": {
      "eyebrow": "[ Formas de receber ]", "headline1": "Nove formas de", "headline2": "receber um pagamento.",
      "body": "Escolha a que encaixa: um link, uma página hospedada, uma chamada de API ou uma loja completa. Por trás de todas, uma só carteira e um só painel.",
      "links": {"title": "Links de pagamento", "desc": "Compartilhe um link em qualquer lugar. Os clientes pagam em segundos, sem conta."},
      "checkout": {"title": "Checkout hospedado", "desc": "Uma página de pagamento com a sua marca, pronta para qualquer valor ou produto."},
      "api": {"title": "API REST", "desc": "Crie cobranças a partir do seu backend, com webhooks assinados e chaves de teste."},
      "buttons": {"title": "Botões de compra", "desc": "Adicione um botão de pagamento a qualquer site com um trecho de HTML."},
      "elements": {"title": "Elementos incorporáveis", "desc": "Coloque o checkout nas suas próprias páginas com chaves publicáveis."},
      "storefront": {"title": "Loja", "desc": "Um catálogo completo — digital, físico ou serviço — com carrinho e IVA."},
      "tips": {"title": "Gorjetas de criador", "desc": "Sua própria página @usuário para receber gorjetas com um toque."},
      "donations": {"title": "Doações", "desc": "Links de arrecadação com metas, níveis e mural de doadores ao vivo."},
      "invoices": {"title": "Faturas", "desc": "Envie faturas cripto com IVA, autoliquidação e recibos em PDF."}
    },
    "whopays": {
      "eyebrow": "[ Taxas do seu jeito ]", "headline": "Você escolhe quem paga a taxa.",
      "body": "Assuma a taxa ou repasse ao cliente e fique com 100% do seu preço. Troque por link ou por checkout, quando quiser.",
      "tabMerchant": "Eu pago a taxa", "tabCustomer": "O cliente paga", "exampleLabel": "Em um pagamento de $100",
      "customerPaysLabel": "O cliente paga", "youReceiveLabel": "Você recebe",
      "merchantNote": "Você cobre a taxa de 1,5% + $1, então o preço que o cliente vê continua exatamente $100.",
      "customerNote": "A taxa é somada por cima: o cliente paga e você fica com os seus $100 completos.",
      "feeFootnote": "Exemplo com a tarifa Starter de 1,5% + $1 por pagamento. Sua tarifa cai para 0,5% conforme você cresce."
    },
    "coins": {
      "eyebrow": "[ Moedas e tokens ]", "headline": "15 moedas e tokens.", "headline2": "Nove redes.",
      "body": "Bitcoin, Ethereum, Solana, XRP e mais, além de USDT, USDC e RLUSD em Ethereum, Tron e Polygon.",
      "convertTitle": "Guarde ou converta sozinho.",
      "convertDesc": "Receba em qualquer moeda e guarde, ou converta automaticamente para USDC ou USDT assim que confirmar. A escolha é sempre sua."
    },
    "refunds": {
      "eyebrow": "[ Confiança de fábrica ]", "headline": "Cripto que você pode mesmo reembolsar.",
      "body": "As partes que fazem a cripto parecer arriscada? Resolvidas. Reembolsos, custódia e webhooks, bem feitos.",
      "refundsTitle": "Reembolsos cripto em um clique",
      "refundsDesc": "Reembolse um pagamento na rede original, total ou parcial; o cliente recebe um recibo por e-mail.",
      "custodyTitle": "Sem custódia por design",
      "custodyDesc": "Os fundos vão direto para a sua própria carteira. Nunca guardamos o seu dinheiro: suas chaves, sua cripto.",
      "webhooksTitle": "Webhooks assinados",
      "webhooksDesc": "Eventos assinados com HMAC, novas tentativas automáticas e fila de mensagens mantêm seus sistemas em sincronia."
    }
  },
  "fr": {
    "ways": {
      "eyebrow": "[ Façons d'être payé ]", "headline1": "Neuf façons", "headline2": "d'encaisser un paiement.",
      "body": "Choisissez ce qui vous convient : un lien, une page hébergée, un appel API ou une boutique complète. Derrière tout ça, un seul portefeuille et un seul tableau de bord.",
      "links": {"title": "Liens de paiement", "desc": "Partagez un lien partout. Vos clients paient en quelques secondes, sans compte."},
      "checkout": {"title": "Checkout hébergé", "desc": "Une page de paiement à votre marque, prête pour n'importe quel montant ou produit."},
      "api": {"title": "API REST", "desc": "Créez des paiements depuis votre backend, avec webhooks signés et clés de test."},
      "buttons": {"title": "Boutons d'achat", "desc": "Ajoutez un bouton de paiement à n'importe quel site avec un extrait de HTML."},
      "elements": {"title": "Éléments intégrables", "desc": "Intégrez le checkout à vos propres pages avec des clés publiables."},
      "storefront": {"title": "Boutique", "desc": "Un catalogue complet — numérique, physique ou service — avec panier et TVA."},
      "tips": {"title": "Pourboires créateurs", "desc": "Votre propre page @pseudo pour recevoir des pourboires en un geste."},
      "donations": {"title": "Dons", "desc": "Des liens de collecte avec objectifs, paliers et mur des donateurs en direct."},
      "invoices": {"title": "Factures", "desc": "Envoyez des factures crypto avec TVA, autoliquidation et reçus PDF."}
    },
    "whopays": {
      "eyebrow": "[ Frais à votre façon ]", "headline": "Vous choisissez qui paie les frais.",
      "body": "Prenez les frais à votre charge, ou reportez-les sur le client et gardez 100 % de votre prix. Modifiable par lien ou par checkout, quand vous voulez.",
      "tabMerchant": "Je paie les frais", "tabCustomer": "Le client paie", "exampleLabel": "Sur un paiement de $100",
      "customerPaysLabel": "Le client paie", "youReceiveLabel": "Vous recevez",
      "merchantNote": "Vous couvrez les frais de 1,5 % + $1, donc le prix que voit votre client reste exactement $100.",
      "customerNote": "Les frais s'ajoutent au-dessus : le client les paie et vous gardez vos $100 entiers.",
      "feeFootnote": "Exemple au tarif Starter de 1,5 % + $1 par paiement. Votre taux descend à 0,5 % à mesure que le volume augmente."
    },
    "coins": {
      "eyebrow": "[ Cryptos et tokens ]", "headline": "15 cryptos et tokens.", "headline2": "Neuf chaînes.",
      "body": "Bitcoin, Ethereum, Solana, XRP et plus, ainsi que USDT, USDC et RLUSD sur Ethereum, Tron et Polygon.",
      "convertTitle": "Gardez, ou convertissez tout seul.",
      "convertDesc": "Encaissez dans n'importe quelle crypto et gardez-la, ou convertissez automatiquement en USDC ou USDT dès la confirmation. Votre choix, à chaque fois."
    },
    "refunds": {
      "eyebrow": "[ La confiance intégrée ]", "headline": "De la crypto que vous pouvez vraiment rembourser.",
      "body": "Ce qui rend la crypto stressante ? Réglé. Remboursements, garde des fonds et webhooks, bien faits.",
      "refundsTitle": "Remboursements crypto en un clic",
      "refundsDesc": "Remboursez un paiement sur sa chaîne d'origine, total ou partiel ; le client reçoit un reçu par e-mail.",
      "custodyTitle": "Non-dépositaire par conception",
      "custodyDesc": "Les fonds arrivent directement dans votre propre portefeuille. Nous ne détenons jamais votre argent : vos clés, votre crypto.",
      "webhooksTitle": "Webhooks signés",
      "webhooksDesc": "Événements signés HMAC, nouvelles tentatives automatiques et file d'attente d'échecs gardent vos systèmes synchronisés."
    }
  },
  "de": {
    "ways": {
      "eyebrow": "[ Wege zur Bezahlung ]", "headline1": "Neun Wege,", "headline2": "eine Zahlung anzunehmen.",
      "body": "Wählen Sie, was passt: ein Link, eine gehostete Seite, ein API-Aufruf oder ein kompletter Shop. Dahinter: eine Wallet, ein Dashboard.",
      "links": {"title": "Zahlungslinks", "desc": "Teilen Sie einen Link überall. Käufer zahlen in Sekunden – ganz ohne Konto."},
      "checkout": {"title": "Gehosteter Checkout", "desc": "Eine Zahlungsseite in Ihrem Branding, bereit für jeden Betrag oder jedes Produkt."},
      "api": {"title": "REST-API", "desc": "Erstellen Sie Zahlungen aus Ihrem Backend – mit signierten Webhooks und Test-Keys."},
      "buttons": {"title": "Kauf-Buttons", "desc": "Fügen Sie jeder Website mit einem HTML-Schnipsel einen Bezahl-Button hinzu."},
      "elements": {"title": "Einbettbare Elemente", "desc": "Binden Sie den Checkout mit veröffentlichbaren Keys in Ihre Seiten ein."},
      "storefront": {"title": "Shop", "desc": "Ein voller Katalog – digital, physisch oder Service – mit Warenkorb und USt."},
      "tips": {"title": "Creator-Trinkgeld", "desc": "Ihre eigene @handle-Seite für Trinkgeld mit einem Tipp."},
      "donations": {"title": "Spenden", "desc": "Spendenlinks mit Zielen, Stufen und einer Live-Spenderwand."},
      "invoices": {"title": "Rechnungen", "desc": "Senden Sie Krypto-Rechnungen mit USt, Reverse-Charge und PDF-Belegen."}
    },
    "whopays": {
      "eyebrow": "[ Gebühren nach Ihrer Wahl ]", "headline": "Sie wählen, wer die Gebühr zahlt.",
      "body": "Übernehmen Sie die Gebühr selbst, oder geben Sie sie an den Kunden weiter und behalten Sie 100 % Ihres Preises. Umschaltbar pro Link oder pro Checkout, wann immer Sie wollen.",
      "tabMerchant": "Ich zahle die Gebühr", "tabCustomer": "Kunde zahlt", "exampleLabel": "Bei einer Zahlung von $100",
      "customerPaysLabel": "Kunde zahlt", "youReceiveLabel": "Sie erhalten",
      "merchantNote": "Sie tragen die Gebühr von 1,5 % + $1, sodass der Preis für Ihren Kunden exakt $100 bleibt.",
      "customerNote": "Die Gebühr kommt oben drauf – der Kunde trägt sie und Sie behalten Ihre vollen $100.",
      "feeFootnote": "Beispiel zum Starter-Satz von 1,5 % + $1 pro Zahlung. Ihr Satz sinkt mit dem Volumen auf 0,5 %."
    },
    "coins": {
      "eyebrow": "[ Coins & Tokens ]", "headline": "15 Coins & Tokens.", "headline2": "Neun Chains.",
      "body": "Bitcoin, Ethereum, Solana, XRP und mehr – dazu USDT, USDC und RLUSD auf Ethereum, Tron und Polygon.",
      "convertTitle": "Behalten oder automatisch wandeln.",
      "convertDesc": "Werden Sie in jedem Coin bezahlt und behalten Sie ihn – oder wandeln Sie ihn bei Bestätigung automatisch in USDC oder USDT. Ihre Wahl, jedes Mal."
    },
    "refunds": {
      "eyebrow": "[ Vertrauen eingebaut ]", "headline": "Krypto, das Sie wirklich erstatten können.",
      "body": "Was Krypto riskant wirken lässt? Gelöst. Rückerstattungen, Verwahrung und Webhooks – richtig gemacht.",
      "refundsTitle": "Krypto-Rückerstattungen mit einem Klick",
      "refundsDesc": "Erstatten Sie eine Zahlung auf ihrer ursprünglichen Chain, ganz oder teilweise – der Kunde erhält einen Beleg per E-Mail.",
      "custodyTitle": "Non-custodial by Design",
      "custodyDesc": "Gelder gehen direkt in Ihre eigene Wallet. Wir halten Ihr Geld nie – Ihre Keys, Ihr Krypto.",
      "webhooksTitle": "Signierte Webhooks",
      "webhooksDesc": "HMAC-signierte Events, automatische Wiederholungen und eine Dead-Letter-Queue halten Ihre Systeme synchron."
    }
  },
  "nl": {
    "ways": {
      "eyebrow": "[ Manieren om betaald te worden ]", "headline1": "Negen manieren", "headline2": "om een betaling te innen.",
      "body": "Kies wat past: een link, een gehoste pagina, een API-aanroep of een volledige winkel. Erachter: één wallet, één dashboard.",
      "links": {"title": "Betaallinks", "desc": "Deel één link overal. Kopers betalen in seconden – zonder account."},
      "checkout": {"title": "Gehoste checkout", "desc": "Een betaalpagina in jouw huisstijl, klaar voor elk bedrag of product."},
      "api": {"title": "REST-API", "desc": "Maak betalingen vanuit je backend, met ondertekende webhooks en testsleutels."},
      "buttons": {"title": "Koopknoppen", "desc": "Voeg met een stukje HTML een betaalknop toe aan elke website."},
      "elements": {"title": "Insluitbare elementen", "desc": "Zet de checkout in je eigen pagina's met publiceerbare sleutels."},
      "storefront": {"title": "Winkel", "desc": "Een volledige catalogus – digitaal, fysiek of dienst – met winkelwagen en btw."},
      "tips": {"title": "Creator-fooien", "desc": "Je eigen @handle-pagina voor fooien met één tik."},
      "donations": {"title": "Donaties", "desc": "Inzamelingslinks met doelen, niveaus en een live donateursmuur."},
      "invoices": {"title": "Facturen", "desc": "Verstuur crypto-facturen met btw, verlegging en pdf-bonnen."}
    },
    "whopays": {
      "eyebrow": "[ Kosten op jouw manier ]", "headline": "Jij kiest wie de kosten betaalt.",
      "body": "Neem de kosten zelf op je, of geef ze door aan de klant en houd 100% van je prijs. Wissel per link of per checkout, wanneer je wilt.",
      "tabMerchant": "Ik betaal de kosten", "tabCustomer": "Klant betaalt", "exampleLabel": "Bij een betaling van $100",
      "customerPaysLabel": "Klant betaalt", "youReceiveLabel": "Jij ontvangt",
      "merchantNote": "Jij draagt de kosten van 1,5% + $1, dus de prijs die je klant ziet blijft precies $100.",
      "customerNote": "De kosten komen er bovenop: de klant betaalt ze en jij houdt je volle $100.",
      "feeFootnote": "Voorbeeld met het Starter-tarief van 1,5% + $1 per betaling. Je tarief daalt naar 0,5% naarmate je volume groeit."
    },
    "coins": {
      "eyebrow": "[ Munten & tokens ]", "headline": "15 munten & tokens.", "headline2": "Negen chains.",
      "body": "Bitcoin, Ethereum, Solana, XRP en meer, plus USDT, USDC en RLUSD op Ethereum, Tron en Polygon.",
      "convertTitle": "Houd het, of zet automatisch om.",
      "convertDesc": "Word betaald in elke munt en houd 'm, of zet automatisch om naar USDC of USDT zodra de betaling bevestigt. Jouw keuze, elke keer."
    },
    "refunds": {
      "eyebrow": "[ Vertrouwen ingebouwd ]", "headline": "Crypto die je écht kunt terugbetalen.",
      "body": "De dingen die crypto spannend maken? Opgelost. Terugbetalingen, bewaring en webhooks, goed geregeld.",
      "refundsTitle": "Crypto-terugbetalingen met één klik",
      "refundsDesc": "Betaal een betaling terug op de oorspronkelijke chain, volledig of gedeeltelijk; de klant krijgt een bon per e-mail.",
      "custodyTitle": "Non-custodial van opzet",
      "custodyDesc": "Geld komt direct in je eigen wallet. Wij houden je geld nooit vast: jouw sleutels, jouw crypto.",
      "webhooksTitle": "Ondertekende webhooks",
      "webhooksDesc": "Met HMAC ondertekende events, automatische herhalingen en een dead-letter-queue houden je systemen in sync."
    }
  }
}

FEES = {
  "en": {
    "whoPaysEyebrow": "[ 04 · Who pays? ]", "whoPaysTitle": "Who pays the fee? You decide.",
    "whoPaysBody": "On every link and checkout you choose whether to absorb the fee or pass it to the customer — there's no wrong answer.",
    "wpMerchantTitle": "You absorb the fee",
    "wpMerchantDesc": "The price stays exactly what you set. On a $100 payment at 1.5% + $1, you receive $97.50.",
    "wpCustomerTitle": "Customer pays the fee",
    "wpCustomerDesc": "The fee is added on top. On a $100 payment the customer pays $102.50 and you keep the full $100.",
    "wpFootnote": "Shown at the 1.5% Starter rate. Your rate falls to 0.5% as monthly volume grows.",
    "includedEyebrow": "[ 05 · Included free ]", "includedTitle": "Everything included. No add-ons.",
    "includedBody": "One percentage covers it. No monthly fee, no setup, no per-feature pricing — every tool below is on the house.",
    "inc1": "On-chain payouts to your own wallet", "inc2": "One-click crypto refunds",
    "inc3": "Signed webhooks + event console", "inc4": "Hosted storefront & product catalog",
    "inc5": "Invoices with VAT & EU reverse-charge", "inc6": "Auto-convert to USDC / USDT",
    "inc7": "Payment links & buy buttons", "inc8": "Checkout in 6 languages", "inc9": "No monthly or setup fees"
  },
  "es": {
    "whoPaysEyebrow": "[ 04 · ¿Quién paga? ]", "whoPaysTitle": "¿Quién paga la comisión? Tú decides.",
    "whoPaysBody": "En cada enlace y checkout eliges si asumes la comisión o se la pasas al cliente. No hay respuesta incorrecta.",
    "wpMerchantTitle": "Asumes la comisión",
    "wpMerchantDesc": "El precio sigue siendo el que fijaste. En un pago de $100 al 1,5% + $1, recibes $97,50.",
    "wpCustomerTitle": "La paga el cliente",
    "wpCustomerDesc": "La comisión se añade encima. En un pago de $100 el cliente paga $102,50 y tú te quedas con los $100 completos.",
    "wpFootnote": "Mostrado con la tarifa Starter del 1,5%. Tu tarifa baja al 0,5% a medida que crece tu volumen mensual.",
    "includedEyebrow": "[ 05 · Incluido gratis ]", "includedTitle": "Todo incluido. Sin extras.",
    "includedBody": "Un solo porcentaje lo cubre todo. Sin cuota mensual, sin alta, sin precios por función: todo lo de abajo va por nuestra cuenta.",
    "inc1": "Pagos on-chain a tu propia cartera", "inc2": "Reembolsos cripto en un clic",
    "inc3": "Webhooks firmados + consola de eventos", "inc4": "Tienda alojada y catálogo de productos",
    "inc5": "Facturas con IVA e inversión del sujeto pasivo (UE)", "inc6": "Conversión automática a USDC / USDT",
    "inc7": "Enlaces de pago y botones de compra", "inc8": "Checkout en 6 idiomas", "inc9": "Sin cuotas mensuales ni de alta"
  },
  "pt": {
    "whoPaysEyebrow": "[ 04 · Quem paga? ]", "whoPaysTitle": "Quem paga a taxa? Você decide.",
    "whoPaysBody": "Em cada link e checkout você escolhe se assume a taxa ou repassa ao cliente. Não há resposta errada.",
    "wpMerchantTitle": "Você assume a taxa",
    "wpMerchantDesc": "O preço continua o que você definiu. Em um pagamento de $100 a 1,5% + $1, você recebe $97,50.",
    "wpCustomerTitle": "O cliente paga a taxa",
    "wpCustomerDesc": "A taxa é somada por cima. Em um pagamento de $100 o cliente paga $102,50 e você fica com os $100 completos.",
    "wpFootnote": "Mostrado com a tarifa Starter de 1,5%. Sua tarifa cai para 0,5% conforme seu volume mensal cresce.",
    "includedEyebrow": "[ 05 · Incluído grátis ]", "includedTitle": "Tudo incluído. Sem extras.",
    "includedBody": "Uma única porcentagem cobre tudo. Sem mensalidade, sem setup, sem preço por recurso: tudo abaixo é por nossa conta.",
    "inc1": "Pagamentos on-chain para a sua própria carteira", "inc2": "Reembolsos cripto em um clique",
    "inc3": "Webhooks assinados + console de eventos", "inc4": "Loja hospedada e catálogo de produtos",
    "inc5": "Faturas com IVA e autoliquidação (UE)", "inc6": "Conversão automática para USDC / USDT",
    "inc7": "Links de pagamento e botões de compra", "inc8": "Checkout em 6 idiomas", "inc9": "Sem mensalidade ou taxa de setup"
  },
  "fr": {
    "whoPaysEyebrow": "[ 04 · Qui paie ? ]", "whoPaysTitle": "Qui paie les frais ? À vous de choisir.",
    "whoPaysBody": "Sur chaque lien et checkout, vous choisissez d'assumer les frais ou de les reporter sur le client. Il n'y a pas de mauvaise réponse.",
    "wpMerchantTitle": "Vous assumez les frais",
    "wpMerchantDesc": "Le prix reste celui que vous avez fixé. Sur un paiement de $100 à 1,5 % + $1, vous recevez $97,50.",
    "wpCustomerTitle": "Le client paie les frais",
    "wpCustomerDesc": "Les frais s'ajoutent au-dessus. Sur un paiement de $100, le client paie $102,50 et vous gardez vos $100 entiers.",
    "wpFootnote": "Affiché au tarif Starter de 1,5 %. Votre taux descend à 0,5 % à mesure que votre volume mensuel augmente.",
    "includedEyebrow": "[ 05 · Inclus gratuitement ]", "includedTitle": "Tout inclus. Aucune option payante.",
    "includedBody": "Un seul pourcentage couvre tout. Pas d'abonnement, pas de frais d'installation, pas de tarif par fonctionnalité : tout ci-dessous est offert.",
    "inc1": "Versements on-chain vers votre propre portefeuille", "inc2": "Remboursements crypto en un clic",
    "inc3": "Webhooks signés + console d'événements", "inc4": "Boutique hébergée et catalogue produits",
    "inc5": "Factures avec TVA et autoliquidation (UE)", "inc6": "Conversion automatique en USDC / USDT",
    "inc7": "Liens de paiement et boutons d'achat", "inc8": "Checkout en 6 langues", "inc9": "Aucun frais mensuel ni d'installation"
  },
  "de": {
    "whoPaysEyebrow": "[ 04 · Wer zahlt? ]", "whoPaysTitle": "Wer zahlt die Gebühr? Sie entscheiden.",
    "whoPaysBody": "Bei jedem Link und Checkout wählen Sie, ob Sie die Gebühr übernehmen oder an den Kunden weitergeben. Es gibt keine falsche Antwort.",
    "wpMerchantTitle": "Sie übernehmen die Gebühr",
    "wpMerchantDesc": "Der Preis bleibt genau der, den Sie festgelegt haben. Bei einer Zahlung von $100 zu 1,5 % + $1 erhalten Sie $97,50.",
    "wpCustomerTitle": "Der Kunde zahlt die Gebühr",
    "wpCustomerDesc": "Die Gebühr kommt oben drauf. Bei einer Zahlung von $100 zahlt der Kunde $102,50 und Sie behalten die vollen $100.",
    "wpFootnote": "Gezeigt zum Starter-Satz von 1,5 %. Ihr Satz sinkt mit steigendem Monatsvolumen auf 0,5 %.",
    "includedEyebrow": "[ 05 · Kostenlos inklusive ]", "includedTitle": "Alles inklusive. Keine Zusatzkosten.",
    "includedBody": "Ein Prozentsatz deckt alles ab. Keine Monatsgebühr, keine Einrichtung, kein Preis pro Funktion – alles unten geht aufs Haus.",
    "inc1": "On-Chain-Auszahlungen in Ihre eigene Wallet", "inc2": "Krypto-Rückerstattungen mit einem Klick",
    "inc3": "Signierte Webhooks + Event-Konsole", "inc4": "Gehosteter Shop & Produktkatalog",
    "inc5": "Rechnungen mit USt & EU-Reverse-Charge", "inc6": "Automatische Wandlung in USDC / USDT",
    "inc7": "Zahlungslinks & Kauf-Buttons", "inc8": "Checkout in 6 Sprachen", "inc9": "Keine Monats- oder Einrichtungsgebühren"
  },
  "nl": {
    "whoPaysEyebrow": "[ 04 · Wie betaalt? ]", "whoPaysTitle": "Wie betaalt de kosten? Jij beslist.",
    "whoPaysBody": "Bij elke link en checkout kies je of je de kosten opneemt of doorgeeft aan de klant. Er is geen fout antwoord.",
    "wpMerchantTitle": "Jij neemt de kosten op je",
    "wpMerchantDesc": "De prijs blijft precies wat je instelde. Bij een betaling van $100 tegen 1,5% + $1 ontvang je $97,50.",
    "wpCustomerTitle": "De klant betaalt de kosten",
    "wpCustomerDesc": "De kosten komen er bovenop. Bij een betaling van $100 betaalt de klant $102,50 en houd jij de volle $100.",
    "wpFootnote": "Getoond tegen het Starter-tarief van 1,5%. Je tarief daalt naar 0,5% naarmate je maandvolume groeit.",
    "includedEyebrow": "[ 05 · Gratis inbegrepen ]", "includedTitle": "Alles inbegrepen. Geen add-ons.",
    "includedBody": "Eén percentage dekt alles. Geen maandbedrag, geen setup, geen prijs per functie: alles hieronder is van het huis.",
    "inc1": "On-chain uitbetalingen naar je eigen wallet", "inc2": "Crypto-terugbetalingen met één klik",
    "inc3": "Ondertekende webhooks + event-console", "inc4": "Gehoste winkel & productcatalogus",
    "inc5": "Facturen met btw & EU-verlegging", "inc6": "Automatische omzetting naar USDC / USDT",
    "inc7": "Betaallinks & koopknoppen", "inc8": "Checkout in 6 talen", "inc9": "Geen maand- of setupkosten"
  }
}


def load(path):
    with open(path, "rb") as f:
        b = f.read()
    return json.loads(b), b.endswith(b"\n")


def save(path, data, nl):
    txt = json.dumps(data, indent=2, ensure_ascii=False)
    if nl:
        txt += "\n"
    with open(path, "w", encoding="utf-8") as f:
        f.write(txt)


for loc in ["en", "es", "pt", "fr", "de", "nl"]:
    # landing.json
    lp = os.path.join(BASE, loc, "landing.json")
    d, nl = load(lp)
    d.setdefault("v3", {})
    for k, v in LANDING[loc].items():
        d["v3"][k] = v
    save(lp, d, nl)
    # fees.json
    fp = os.path.join(BASE, loc, "fees.json")
    d, nl = load(fp)
    d.setdefault("v3", {})
    for k, v in FEES[loc].items():
        d["v3"][k] = v
    save(fp, d, nl)
    print(f"[{loc}] landing + fees updated")

print("DONE")
