/* eslint-disable */
// One-shot: add the missing v8/v7/v3 homepage keys (inline defaultValues that
// fell back to English in every locale) into landing.json for all 6 locales.
// Idempotent deep-merge — safe to re-run. Run: node scripts/i18n/add_homepage_v8_i18n.cjs
const fs = require("fs");
const path = require("path");

const LOCALES = ["en", "de", "es", "fr", "nl", "pt"];

// dottedKey -> { en, de, es, fr, nl, pt }  (strings)
const T = {
  // ── v3: live fee-breakdown widget ──────────────────────────────────────────
  "v3.bdBlockchainFee": { en: "Blockchain / network fee", de: "Blockchain-/Netzwerkgebühr", es: "Comisión de blockchain / red", fr: "Frais de blockchain / réseau", nl: "Blockchain-/netwerkkosten", pt: "Taxa de blockchain / rede" },
  "v3.bdNetToMerchant": { en: "Net to merchant", de: "Netto an Händler", es: "Neto para el comercio", fr: "Net pour le marchand", nl: "Netto naar verkoper", pt: "Líquido para o comerciante" },
  "v3.bdPaymentAmount": { en: "Payment amount", de: "Zahlungsbetrag", es: "Importe del pago", fr: "Montant du paiement", nl: "Betalingsbedrag", pt: "Valor do pagamento" },
  "v3.breakdownTitle": { en: "Per-payment breakdown", de: "Aufschlüsselung pro Zahlung", es: "Desglose por pago", fr: "Détail par paiement", nl: "Uitsplitsing per betaling", pt: "Detalhamento por pagamento" },
  "v3.cheapestHint": { en: "Cheapest payout route", de: "Günstigste Auszahlungsroute", es: "Ruta de liquidación más barata", fr: "Itinéraire de règlement le moins cher", nl: "Goedkoopste uitbetalingsroute", pt: "Rota de liquidação mais barata" },
  "v3.cheapestOn": { en: "You're on the cheapest payout route", de: "Du nutzt die günstigste Auszahlungsroute", es: "Estás en la ruta de liquidación más barata", fr: "Vous utilisez l'itinéraire de règlement le moins cher", nl: "Je gebruikt de goedkoopste uitbetalingsroute", pt: "Você está na rota de liquidação mais barata" },
  "v3.liveFees": { en: "Live network fees", de: "Aktuelle Netzwerkgebühren", es: "Comisiones de red en vivo", fr: "Frais de réseau en direct", nl: "Live netwerkkosten", pt: "Taxas de rede ao vivo" },
  "v3.lowestFee": { en: "Lowest fee", de: "Niedrigste Gebühr", es: "Comisión más baja", fr: "Frais les plus bas", nl: "Laagste kosten", pt: "Taxa mais baixa" },
  "v3.networkFeeWord": { en: "network fee", de: "Netzwerkgebühr", es: "comisión de red", fr: "frais de réseau", nl: "netwerkkosten", pt: "taxa de rede" },
  "v3.paymentAmount": { en: "Payment amount (USD)", de: "Zahlungsbetrag (USD)", es: "Importe del pago (USD)", fr: "Montant du paiement (USD)", nl: "Betalingsbedrag (USD)", pt: "Valor do pagamento (USD)" },
  "v3.settleCurrency": { en: "Settlement currency", de: "Abwicklungswährung", es: "Moneda de liquidación", fr: "Devise de règlement", nl: "Afwikkelingsvaluta", pt: "Moeda de liquidação" },
  "v3.useCheapest": { en: "Use it", de: "Verwenden", es: "Usarla", fr: "Utiliser", nl: "Gebruiken", pt: "Usar" },
  "v3.volumeSliderLabel": { en: "Monthly volume", de: "Monatliches Volumen", es: "Volumen mensual", fr: "Volume mensuel", nl: "Maandelijks volume", pt: "Volume mensal" },

  // ── v7.security (homepage Security section) ─────────────────────────────────
  "v7.security.eyebrow": { en: "Security & compliance", de: "Sicherheit & Compliance", es: "Seguridad y cumplimiento", fr: "Sécurité et conformité", nl: "Beveiliging & compliance", pt: "Segurança e conformidade" },
  "v7.security.headline": { en: "Built to be trusted with money", de: "Gebaut, damit man uns Geld anvertraut", es: "Diseñado para que confíes tu dinero", fr: "Conçu pour mériter votre confiance financière", nl: "Gebouwd om geld aan toe te vertrouwen", pt: "Feito para ser confiável com o seu dinheiro" },
  "v7.security.body": { en: "Funds move on rails you can verify — never parked on a balance you can't see.", de: "Gelder bewegen sich über nachprüfbare Wege – nie geparkt auf einem Guthaben, das du nicht siehst.", es: "Los fondos circulan por vías que puedes verificar, nunca estacionados en un saldo que no ves.", fr: "Les fonds circulent sur des rails vérifiables — jamais immobilisés sur un solde que vous ne voyez pas.", nl: "Geld beweegt via verifieerbare routes — nooit geparkeerd op een saldo dat je niet ziet.", pt: "Os fundos circulam por trilhos que você pode verificar — nunca parados em um saldo que você não vê." },
  "v7.security.trustLink": { en: "Visit the Trust Centre", de: "Zum Trust Center", es: "Visita el Centro de Confianza", fr: "Accéder au Centre de confiance", nl: "Bezoek het Trust Center", pt: "Acesse a Central de Confiança" },
  "v7.trust.eyebrow": { en: "Live proof", de: "Live-Nachweis", es: "Prueba en vivo", fr: "Preuve en direct", nl: "Live bewijs", pt: "Prova ao vivo" },

  // ── v8.device (DeviceShowcase) ──────────────────────────────────────────────
  "v8.device.b1": { en: "Real-time payment alerts and receipts", de: "Zahlungsbenachrichtigungen und Belege in Echtzeit", es: "Alertas y recibos de pago en tiempo real", fr: "Alertes et reçus de paiement en temps réel", nl: "Realtime betaalmeldingen en bonnen", pt: "Alertas e recibos de pagamento em tempo real" },
  "v8.device.b2": { en: "Manage settlement and auto-convert from your phone", de: "Abwicklung und Auto-Konvertierung vom Smartphone aus verwalten", es: "Gestiona la liquidación y la conversión automática desde el móvil", fr: "Gérez le règlement et la conversion automatique depuis votre téléphone", nl: "Beheer afwikkeling en automatisch omzetten vanaf je telefoon", pt: "Gerencie a liquidação e a conversão automática pelo celular" },
  "v8.device.b3": { en: "Embeddable buy button and widget for any site", de: "Einbettbarer Kauf-Button und Widget für jede Website", es: "Botón de compra y widget integrables en cualquier sitio", fr: "Bouton d'achat et widget intégrables sur n'importe quel site", nl: "Insluitbare koopknop en widget voor elke site", pt: "Botão de compra e widget incorporáveis em qualquer site" },
  "v8.device.eyebrow": { en: "Works on every device", de: "Funktioniert auf jedem Gerät", es: "Funciona en todos los dispositivos", fr: "Fonctionne sur tous les appareils", nl: "Werkt op elk apparaat", pt: "Funciona em todos os dispositivos" },
  "v8.device.lead": { en: "No app to install. The full Dynopay dashboard runs in any browser — desktop, tablet or phone — with the same live data everywhere.", de: "Keine App nötig. Das komplette Dynopay-Dashboard läuft in jedem Browser – Desktop, Tablet oder Smartphone – überall mit denselben Live-Daten.", es: "Sin apps que instalar. El panel completo de Dynopay funciona en cualquier navegador — ordenador, tablet o móvil — con los mismos datos en vivo en todas partes.", fr: "Aucune application à installer. Le tableau de bord complet de Dynopay s'exécute dans n'importe quel navigateur — ordinateur, tablette ou téléphone — avec les mêmes données en direct partout.", nl: "Geen app te installeren. Het volledige Dynopay-dashboard draait in elke browser — desktop, tablet of telefoon — overal met dezelfde live gegevens.", pt: "Sem app para instalar. O painel completo da Dynopay funciona em qualquer navegador — computador, tablet ou celular — com os mesmos dados ao vivo em todo lugar." },
  "v8.device.primary": { en: "Open the dashboard", de: "Dashboard öffnen", es: "Abrir el panel", fr: "Ouvrir le tableau de bord", nl: "Dashboard openen", pt: "Abrir o painel" },
  "v8.device.secondary": { en: "Try the demo checkout", de: "Demo-Checkout testen", es: "Prueba el checkout de demostración", fr: "Essayer le paiement de démonstration", nl: "Probeer de demo-checkout", pt: "Experimente o checkout de demonstração" },
  "v8.device.title": { en: "Your dashboard, wherever you are", de: "Dein Dashboard, wo immer du bist", es: "Tu panel, estés donde estés", fr: "Votre tableau de bord, où que vous soyez", nl: "Je dashboard, waar je ook bent", pt: "Seu painel, onde você estiver" },

  // ── v8.final (closing CTA) ──────────────────────────────────────────────────
  "v8.final.badge": { en: "Live in minutes · no credit card", de: "In Minuten live · keine Kreditkarte", es: "Activo en minutos · sin tarjeta de crédito", fr: "Opérationnel en quelques minutes · sans carte bancaire", nl: "In enkele minuten live · geen creditcard", pt: "No ar em minutos · sem cartão de crédito" },
  "v8.final.lead": { en: "Create your account in two minutes, share your first payment link, and your first payment is fee-free.", de: "Erstelle dein Konto in zwei Minuten, teile deinen ersten Zahlungslink – und deine erste Zahlung ist gebührenfrei.", es: "Crea tu cuenta en dos minutos, comparte tu primer enlace de pago y tu primer pago es sin comisiones.", fr: "Créez votre compte en deux minutes, partagez votre premier lien de paiement, et votre premier paiement est sans frais.", nl: "Maak je account in twee minuten aan, deel je eerste betaallink en je eerste betaling is gratis.", pt: "Crie sua conta em dois minutos, compartilhe seu primeiro link de pagamento e seu primeiro pagamento é sem taxas." },
  "v8.final.primary": { en: "Start free", de: "Kostenlos starten", es: "Empieza gratis", fr: "Commencer gratuitement", nl: "Gratis beginnen", pt: "Comece grátis" },
  "v8.final.secondary": { en: "See pricing", de: "Preise ansehen", es: "Ver precios", fr: "Voir les tarifs", nl: "Bekijk prijzen", pt: "Ver preços" },
  "v8.final.t1": { en: "No setup fees", de: "Keine Einrichtungsgebühren", es: "Sin costes de instalación", fr: "Aucuns frais d'installation", nl: "Geen installatiekosten", pt: "Sem taxas de configuração" },
  "v8.final.t2": { en: "No lock-in", de: "Keine Vertragsbindung", es: "Sin permanencia", fr: "Sans engagement", nl: "Geen verplichtingen", pt: "Sem fidelidade" },
  "v8.final.t3": { en: "Cancel anytime", de: "Jederzeit kündbar", es: "Cancela cuando quieras", fr: "Annulez à tout moment", nl: "Altijd opzegbaar", pt: "Cancele quando quiser" },
  "v8.final.title1": { en: "Start accepting crypto", de: "Nimm Krypto-Zahlungen an", es: "Empieza a aceptar cripto", fr: "Commencez à accepter la crypto", nl: "Begin met crypto accepteren", pt: "Comece a aceitar cripto" },
  "v8.final.title2": { en: "today.", de: "ab heute.", es: "hoy mismo.", fr: "dès aujourd'hui.", nl: "vandaag nog.", pt: "hoje mesmo." },

  // ── v8.hero ─────────────────────────────────────────────────────────────────
  "v8.hero.body": { en: "The non-custodial gateway for businesses and creators. Get paid in Bitcoin, stablecoins and {{coins}} coins across {{chains}} blockchains — straight to a wallet only you control.", de: "Das nicht-verwahrende Gateway für Unternehmen und Creator. Lass dich in Bitcoin, Stablecoins und {{coins}} Coins über {{chains}} Blockchains bezahlen – direkt auf ein Wallet, das nur du kontrollierst.", es: "La pasarela sin custodia para empresas y creadores. Cobra en Bitcoin, stablecoins y {{coins}} criptomonedas en {{chains}} blockchains, directo a una wallet que solo tú controlas.", fr: "La passerelle non-dépositaire pour les entreprises et les créateurs. Soyez payé en Bitcoin, stablecoins et {{coins}} cryptos sur {{chains}} blockchains — directement sur un portefeuille que vous seul contrôlez.", nl: "De non-custodial gateway voor bedrijven en creators. Word betaald in Bitcoin, stablecoins en {{coins}} coins op {{chains}} blockchains — rechtstreeks naar een wallet die alleen jij beheert.", pt: "O gateway sem custódia para empresas e criadores. Receba em Bitcoin, stablecoins e {{coins}} criptomoedas em {{chains}} blockchains — direto para uma carteira que só você controla." },
  "v8.hero.emailError": { en: "Please enter a valid email address.", de: "Bitte gib eine gültige E-Mail-Adresse ein.", es: "Introduce una dirección de correo válida.", fr: "Veuillez saisir une adresse e-mail valide.", nl: "Voer een geldig e-mailadres in.", pt: "Insira um endereço de e-mail válido." },
  "v8.hero.emailPlaceholder": { en: "Enter your work email", de: "Geschäftliche E-Mail eingeben", es: "Introduce tu correo de trabajo", fr: "Saisissez votre e-mail professionnel", nl: "Voer je zakelijke e-mail in", pt: "Digite seu e-mail de trabalho" },
  "v8.hero.google": { en: "Continue with Google", de: "Mit Google fortfahren", es: "Continuar con Google", fr: "Continuer avec Google", nl: "Doorgaan met Google", pt: "Continuar com o Google" },
  "v8.hero.h1": { en: "Accept crypto payments.", de: "Krypto-Zahlungen annehmen.", es: "Acepta pagos cripto.", fr: "Acceptez les paiements crypto.", nl: "Accepteer cryptobetalingen.", pt: "Aceite pagamentos em cripto." },
  "v8.hero.h2a": { en: "Settle to ", de: "Direkt auf ", es: "Liquida en ", fr: "Réglés sur ", nl: "Direct naar ", pt: "Liquide na " },
  "v8.hero.h2b": { en: "your wallet.", de: "dein Wallet.", es: "tu wallet.", fr: "votre portefeuille.", nl: "je eigen wallet.", pt: "sua carteira." },
  "v8.hero.or": { en: "or", de: "oder", es: "o", fr: "ou", nl: "of", pt: "ou" },
  "v8.hero.primary": { en: "Start free", de: "Kostenlos starten", es: "Empieza gratis", fr: "Commencer gratuitement", nl: "Gratis beginnen", pt: "Comece grátis" },

  // ── v8.how (HowItWorks) ─────────────────────────────────────────────────────
  "v8.how.cta": { en: "Developers: read the integration docs", de: "Entwickler: zur Integrationsdokumentation", es: "Desarrolladores: lee la documentación de integración", fr: "Développeurs : consultez la documentation d'intégration", nl: "Ontwikkelaars: lees de integratiedocumentatie", pt: "Desenvolvedores: leia a documentação de integração" },
  "v8.how.eyebrow": { en: "How it works", de: "So funktioniert's", es: "Cómo funciona", fr: "Comment ça marche", nl: "Hoe het werkt", pt: "Como funciona" },
  "v8.how.lead": { en: "Minutes from sign-up to your first crypto payment — whether you sell online, invoice clients or take donations.", de: "Von der Anmeldung bis zur ersten Krypto-Zahlung in wenigen Minuten – ob du online verkaufst, Kunden Rechnungen stellst oder Spenden sammelst.", es: "Minutos desde el registro hasta tu primer pago cripto, ya vendas online, factures a clientes o recibas donaciones.", fr: "Quelques minutes entre l'inscription et votre premier paiement crypto — que vous vendiez en ligne, facturiez des clients ou receviez des dons.", nl: "Binnen enkele minuten van aanmelden tot je eerste cryptobetaling — of je nu online verkoopt, klanten factureert of donaties ontvangt.", pt: "Minutos do cadastro ao seu primeiro pagamento em cripto — seja você vendendo online, faturando clientes ou recebendo doações." },
  "v8.how.s1.title": { en: "Create a link or connect the API", de: "Link erstellen oder API anbinden", es: "Crea un enlace o conecta la API", fr: "Créez un lien ou connectez l'API", nl: "Maak een link of koppel de API", pt: "Crie um link ou conecte a API" },
  "v8.how.s1.desc": { en: "Make a payment link, hosted checkout or invoice in the dashboard — or create payments from your server with one call.", de: "Erstelle im Dashboard einen Zahlungslink, ein gehostetes Checkout oder eine Rechnung – oder erzeuge Zahlungen mit einem Aufruf von deinem Server.", es: "Crea un enlace de pago, un checkout alojado o una factura en el panel, o genera pagos desde tu servidor con una sola llamada.", fr: "Créez un lien de paiement, un checkout hébergé ou une facture dans le tableau de bord — ou générez des paiements depuis votre serveur en un seul appel.", nl: "Maak een betaallink, gehoste checkout of factuur in het dashboard — of maak betalingen vanaf je server met één aanroep.", pt: "Crie um link de pagamento, checkout hospedado ou fatura no painel — ou gere pagamentos a partir do seu servidor com uma única chamada." },
  "v8.how.s2.title": { en: "Your customer pays", de: "Dein Kunde zahlt", es: "Tu cliente paga", fr: "Votre client paie", nl: "Je klant betaalt", pt: "Seu cliente paga" },
  "v8.how.s2.desc": { en: "They scan and send from any wallet, in the coin they already hold. You watch it confirm on-chain in real time.", de: "Er scannt und sendet aus einem beliebigen Wallet, in der Coin, die er bereits hält. Du siehst die Bestätigung on-chain in Echtzeit.", es: "Escanea y envía desde cualquier wallet, en la moneda que ya tiene. Tú ves la confirmación on-chain en tiempo real.", fr: "Il scanne et envoie depuis n'importe quel portefeuille, dans la crypto qu'il possède déjà. Vous voyez la confirmation on-chain en temps réel.", nl: "Ze scannen en versturen vanuit elke wallet, in de coin die ze al hebben. Jij ziet de bevestiging on-chain in realtime.", pt: "Ele escaneia e envia de qualquer carteira, na moeda que já possui. Você acompanha a confirmação on-chain em tempo real." },
  "v8.how.s3.title": { en: "It settles to your wallet", de: "Es wird auf dein Wallet abgewickelt", es: "Se liquida en tu wallet", fr: "Le règlement arrive sur votre portefeuille", nl: "Het wordt afgewikkeld naar je wallet", pt: "A liquidação cai na sua carteira" },
  "v8.how.s3.desc": { en: "Funds land in a wallet only you control — as the coin you were paid, or as USDT/USDC if auto-convert is on.", de: "Gelder landen in einem Wallet, das nur du kontrollierst – als die Coin, in der du bezahlt wurdest, oder als USDT/USDC, wenn die Auto-Konvertierung aktiv ist.", es: "Los fondos llegan a una wallet que solo tú controlas, en la moneda en que te pagaron o como USDT/USDC si la conversión automática está activada.", fr: "Les fonds arrivent sur un portefeuille que vous seul contrôlez — dans la crypto reçue, ou en USDT/USDC si la conversion automatique est activée.", nl: "Geld komt binnen op een wallet die alleen jij beheert — in de coin waarin je bent betaald, of als USDT/USDC als automatisch omzetten aan staat.", pt: "Os fundos chegam a uma carteira que só você controla — na moeda em que você recebeu, ou como USDT/USDC se a conversão automática estiver ativada." },
  "v8.how.title": { en: "Live in three steps", de: "In drei Schritten live", es: "Activo en tres pasos", fr: "Opérationnel en trois étapes", nl: "Live in drie stappen", pt: "No ar em três passos" },

  // ── v8.product (ProductShowcase bento) ──────────────────────────────────────
  "v8.product.accept.title": { en: "Accept payments", de: "Zahlungen annehmen", es: "Acepta pagos", fr: "Acceptez les paiements", nl: "Betalingen accepteren", pt: "Aceite pagamentos" },
  "v8.product.accept.desc": { en: "Bitcoin, Ethereum, USDT, USDC and every major coin your customers already hold — on a checkout page that confirms in real time.", de: "Bitcoin, Ethereum, USDT, USDC und jede gängige Coin, die deine Kunden bereits halten – auf einer Checkout-Seite, die in Echtzeit bestätigt.", es: "Bitcoin, Ethereum, USDT, USDC y todas las principales monedas que tus clientes ya tienen, en una página de pago que confirma en tiempo real.", fr: "Bitcoin, Ethereum, USDT, USDC et toutes les grandes cryptos que vos clients possèdent déjà — sur une page de paiement qui confirme en temps réel.", nl: "Bitcoin, Ethereum, USDT, USDC en elke grote coin die je klanten al hebben — op een checkoutpagina die in realtime bevestigt.", pt: "Bitcoin, Ethereum, USDT, USDC e todas as principais moedas que seus clientes já têm — em uma página de checkout que confirma em tempo real." },
  "v8.product.checkout.title": { en: "Checkout & links", de: "Checkout & Links", es: "Checkout y enlaces", fr: "Checkout et liens", nl: "Checkout & links", pt: "Checkout e links" },
  "v8.product.checkout.desc": { en: "A hosted checkout, shareable payment links, buy buttons and invoices — live in seconds, no code required.", de: "Ein gehostetes Checkout, teilbare Zahlungslinks, Kauf-Buttons und Rechnungen – in Sekunden live, ganz ohne Code.", es: "Un checkout alojado, enlaces de pago para compartir, botones de compra y facturas, activos en segundos y sin código.", fr: "Un checkout hébergé, des liens de paiement partageables, des boutons d'achat et des factures — opérationnels en quelques secondes, sans code.", nl: "Een gehoste checkout, deelbare betaallinks, koopknoppen en facturen — in seconden live, zonder code.", pt: "Um checkout hospedado, links de pagamento compartilháveis, botões de compra e faturas — no ar em segundos, sem código." },
  "v8.product.convert.title": { en: "Auto-convert", de: "Auto-Konvertierung", es: "Conversión automática", fr: "Conversion automatique", nl: "Automatisch omzetten", pt: "Conversão automática" },
  "v8.product.convert.desc": { en: "Opt in to convert incoming crypto to USDT or USDC the instant it lands, at a locked rate — or keep the coin you're paid.", de: "Optional: eingehende Krypto im Moment des Eingangs zu einem fixierten Kurs in USDT oder USDC umwandeln – oder die erhaltene Coin behalten.", es: "Activa la conversión de la cripto entrante a USDT o USDC en el instante en que llega, a una tasa fija, o conserva la moneda que recibes.", fr: "Activez la conversion des cryptos entrantes en USDT ou USDC dès leur arrivée, à un taux verrouillé — ou conservez la crypto reçue.", nl: "Kies ervoor om inkomende crypto direct bij binnenkomst om te zetten naar USDT of USDC tegen een vaste koers — of houd de ontvangen coin.", pt: "Opte por converter a cripto recebida em USDT ou USDC no instante em que chega, a uma taxa travada — ou mantenha a moeda recebida." },
  "v8.product.cta": { en: "Start free", de: "Kostenlos starten", es: "Empieza gratis", fr: "Commencer gratuitement", nl: "Gratis beginnen", pt: "Comece grátis" },
  "v8.product.eyebrow": { en: "One platform", de: "Eine Plattform", es: "Una sola plataforma", fr: "Une seule plateforme", nl: "Eén platform", pt: "Uma plataforma" },
  "v8.product.learn": { en: "Learn more", de: "Mehr erfahren", es: "Saber más", fr: "En savoir plus", nl: "Meer informatie", pt: "Saiba mais" },
  "v8.product.title1": { en: "Everything you need to ", de: "Alles, was du brauchst, um ", es: "Todo lo que necesitas para ", fr: "Tout ce qu'il faut pour ", nl: "Alles wat je nodig hebt om ", pt: "Tudo o que você precisa para " },
  "v8.product.title2": { en: "get paid in crypto", de: "in Krypto bezahlt zu werden", es: "cobrar en cripto", fr: "être payé en crypto", nl: "in crypto betaald te worden", pt: "receber em cripto" },

  // ── v8.stats (sub-labels) ───────────────────────────────────────────────────
  "v8.stats.assetsSub": { en: "Across {{chains}} blockchains", de: "Über {{chains}} Blockchains", es: "En {{chains}} blockchains", fr: "Sur {{chains}} blockchains", nl: "Over {{chains}} blockchains", pt: "Em {{chains}} blockchains" },
  "v8.stats.countriesSub": { en: "Buyers paying in 6 languages", de: "Käufer zahlen in 6 Sprachen", es: "Compradores pagando en 6 idiomas", fr: "Des acheteurs qui paient en 6 langues", nl: "Kopers betalen in 6 talen", pt: "Compradores pagando em 6 idiomas" },
  "v8.stats.paymentsSub": { en: "On-chain, to merchant wallets", de: "On-chain, auf Händler-Wallets", es: "On-chain, a wallets de comercios", fr: "On-chain, vers les portefeuilles des marchands", nl: "On-chain, naar wallets van verkopers", pt: "On-chain, para carteiras de comerciantes" },
  "v8.stats.uptimeSub": { en: "Public status page", de: "Öffentliche Statusseite", es: "Página de estado pública", fr: "Page de statut publique", nl: "Openbare statuspagina", pt: "Página de status pública" },

  // ── v8.trust (TrustBand) ────────────────────────────────────────────────────
  "v8.trust.centreLink": { en: "Visit the Trust Centre", de: "Zum Trust Center", es: "Visita el Centro de Confianza", fr: "Accéder au Centre de confiance", nl: "Bezoek het Trust Center", pt: "Acesse a Central de Confiança" },
  "v8.trust.eyebrow": { en: "Trust & compliance", de: "Vertrauen & Compliance", es: "Confianza y cumplimiento", fr: "Confiance et conformité", nl: "Vertrouwen & compliance", pt: "Confiança e conformidade" },
  "v8.trust.lead": { en: "Compliant by default and transparent about every number — so you can integrate with confidence.", de: "Standardmäßig regelkonform und transparent bei jeder Zahl – damit du mit Zuversicht integrierst.", es: "Conforme por defecto y transparente con cada cifra, para que integres con confianza.", fr: "Conforme par défaut et transparent sur chaque chiffre — pour intégrer en toute confiance.", nl: "Standaard compliant en transparant over elk cijfer — zodat je met vertrouwen integreert.", pt: "Em conformidade por padrão e transparente em cada número — para você integrar com confiança." },
  "v8.trust.p1": { en: "You hold the keys", de: "Du hältst die Schlüssel", es: "Tú tienes las claves", fr: "Vous détenez les clés", nl: "Jij houdt de sleutels", pt: "As chaves são suas" },
  "v8.trust.p1d": { en: "We never take custody. Payments settle to your own wallet, so there is nothing of yours for us to hold, freeze or lose.", de: "Wir übernehmen nie die Verwahrung. Zahlungen werden auf dein eigenes Wallet abgewickelt – es gibt also nichts von dir, das wir halten, einfrieren oder verlieren könnten.", es: "Nunca tenemos la custodia. Los pagos se liquidan en tu propia wallet, así que no hay nada tuyo que podamos retener, congelar o perder.", fr: "Nous ne prenons jamais la garde de vos fonds. Les paiements sont réglés sur votre propre portefeuille — il n'y a donc rien à vous que nous puissions détenir, geler ou perdre.", nl: "Wij nemen nooit custody. Betalingen worden afgewikkeld naar je eigen wallet, dus er is niets van jou dat wij kunnen vasthouden, bevriezen of verliezen.", pt: "Nunca ficamos com a custódia. Os pagamentos são liquidados na sua própria carteira, então não há nada seu para retermos, congelarmos ou perdermos." },
  "v8.trust.p2": { en: "Final payments", de: "Endgültige Zahlungen", es: "Pagos definitivos", fr: "Paiements définitifs", nl: "Definitieve betalingen", pt: "Pagamentos definitivos" },
  "v8.trust.p2d": { en: "On-chain payments cannot be reversed — no disputes, no chargebacks, no rolling reserve held against your revenue.", de: "On-chain-Zahlungen lassen sich nicht rückgängig machen – keine Streitfälle, keine Rückbuchungen, keine Rücklage auf deinen Umsatz.", es: "Los pagos on-chain no se pueden revertir: sin disputas, sin contracargos, sin reserva retenida sobre tus ingresos.", fr: "Les paiements on-chain sont irréversibles — aucun litige, aucune rétrofacturation, aucune réserve prélevée sur vos revenus.", nl: "On-chain-betalingen kunnen niet worden teruggedraaid — geen disputen, geen chargebacks, geen reserve die op je omzet wordt ingehouden.", pt: "Pagamentos on-chain não podem ser revertidos — sem disputas, sem estornos, sem reserva retida sobre a sua receita." },
  "v8.trust.p3": { en: "KYC / AML by design", de: "KYC / AML von Grund auf", es: "KYC / AML por diseño", fr: "KYC / AML dès la conception", nl: "KYC / AML by design", pt: "KYC / AML por princípio" },
  "v8.trust.p3d": { en: "Merchant verification above threshold and wallet-address screening keep your business on the right side of regulators.", de: "Händler-Verifizierung ab einem Schwellenwert und das Screening von Wallet-Adressen halten dein Unternehmen auf der richtigen Seite der Aufsichtsbehörden.", es: "La verificación de comercios por encima del umbral y el cribado de direcciones de wallet mantienen tu negocio del lado correcto de los reguladores.", fr: "La vérification des marchands au-delà d'un seuil et le filtrage des adresses de portefeuille maintiennent votre entreprise du bon côté des régulateurs.", nl: "Verkopersverificatie boven een drempel en het screenen van walletadressen houden je bedrijf aan de goede kant van toezichthouders.", pt: "A verificação de comerciantes acima do limite e a triagem de endereços de carteira mantêm seu negócio do lado certo dos reguladores." },
  "v8.trust.p4": { en: "Hardened & transparent", de: "Gehärtet & transparent", es: "Reforzado y transparente", fr: "Renforcé et transparent", nl: "Gehard & transparant", pt: "Reforçado e transparente" },
  "v8.trust.p4d": { en: "Encrypted key infrastructure, TLS everywhere, and a public status page with 90-day uptime history.", de: "Verschlüsselte Schlüsselinfrastruktur, TLS überall und eine öffentliche Statusseite mit 90-Tage-Verfügbarkeitsverlauf.", es: "Infraestructura de claves cifrada, TLS en todas partes y una página de estado pública con historial de disponibilidad de 90 días.", fr: "Infrastructure de clés chiffrée, TLS partout, et une page de statut publique avec 90 jours d'historique de disponibilité.", nl: "Versleutelde sleutelinfrastructuur, overal TLS en een openbare statuspagina met 90 dagen uptime-historie.", pt: "Infraestrutura de chaves criptografada, TLS em tudo e uma página de status pública com histórico de disponibilidade de 90 dias." },
  "v8.trust.payments": { en: "payments", de: "Zahlungen", es: "pagos", fr: "paiements", nl: "betalingen", pt: "pagamentos" },
  "v8.trust.sharesEyebrow": { en: "Live · last 30 days", de: "Live · letzte 30 Tage", es: "En vivo · últimos 30 días", fr: "En direct · 30 derniers jours", nl: "Live · afgelopen 30 dagen", pt: "Ao vivo · últimos 30 dias" },
  "v8.trust.sharesNote": { en: "Shares of confirmed, settled payments across the platform — the same data that powers our public status page.", de: "Anteile bestätigter, abgewickelter Zahlungen über die gesamte Plattform – dieselben Daten, die unsere öffentliche Statusseite speisen.", es: "Proporción de pagos confirmados y liquidados en toda la plataforma: los mismos datos que alimentan nuestra página de estado pública.", fr: "Répartition des paiements confirmés et réglés sur l'ensemble de la plateforme — les mêmes données qui alimentent notre page de statut publique.", nl: "Aandelen van bevestigde, afgewikkelde betalingen op het hele platform — dezelfde gegevens die onze openbare statuspagina voeden.", pt: "Participação de pagamentos confirmados e liquidados em toda a plataforma — os mesmos dados que alimentam nossa página de status pública." },
  "v8.trust.sharesTitle": { en: "Settled payments by chain", de: "Abgewickelte Zahlungen nach Chain", es: "Pagos liquidados por blockchain", fr: "Paiements réglés par blockchain", nl: "Afgewikkelde betalingen per chain", pt: "Pagamentos liquidados por blockchain" },
  "v8.trust.title": { en: "Built to be trusted with money", de: "Gebaut, damit man uns Geld anvertraut", es: "Diseñado para que confíes tu dinero", fr: "Conçu pour mériter votre confiance financière", nl: "Gebouwd om geld aan toe te vertrouwen", pt: "Feito para ser confiável com o seu dinheiro" },
};

// Array-valued keys (i18next resolves "<path>.<index>")
const ARR = {
  "v8.hero.trust": {
    en: ["No credit card", "Fees from {{fee}}", "Live in minutes"],
    de: ["Keine Kreditkarte", "Gebühren ab {{fee}}", "In Minuten live"],
    es: ["Sin tarjeta de crédito", "Comisiones desde {{fee}}", "Activo en minutos"],
    fr: ["Sans carte bancaire", "Frais à partir de {{fee}}", "Opérationnel en minutes"],
    nl: ["Geen creditcard", "Kosten vanaf {{fee}}", "In enkele minuten live"],
    pt: ["Sem cartão de crédito", "Taxas a partir de {{fee}}", "No ar em minutos"],
  },
  "v8.hero.flow": {
    en: ["Accept", "Convert", "Settle"],
    de: ["Annehmen", "Konvertieren", "Abwickeln"],
    es: ["Aceptar", "Convertir", "Liquidar"],
    fr: ["Accepter", "Convertir", "Régler"],
    nl: ["Accepteren", "Omzetten", "Afwikkelen"],
    pt: ["Aceitar", "Converter", "Liquidar"],
  },
};

function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null || Array.isArray(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}

let report = [];
for (const loc of LOCALES) {
  const file = path.join(__dirname, "..", "..", "langs", "locales", loc, "landing.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  let added = 0;
  for (const [dotted, vals] of Object.entries(T)) {
    setDeep(json, dotted, vals[loc]);
    added++;
  }
  for (const [dotted, vals] of Object.entries(ARR)) {
    setDeep(json, dotted, vals[loc]);
    added++;
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  report.push(`${loc}: wrote ${added} keys -> ${path.relative(path.join(__dirname, "..", ".."), file)}`);
}
console.log(report.join("\n"));
console.log("DONE");
