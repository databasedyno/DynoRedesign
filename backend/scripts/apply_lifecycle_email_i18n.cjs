/* One-off: (1) reword merchant.welcome to a "finish setup" tone, and
   (2) add merchant.onboardingComplete + merchant.firstPayment (merchant-facing)
   namespaces, across all 6 locales. Surgical (brace-matched replace for welcome,
   insert for the new namespaces) so the rest of each file stays byte-identical.
   Idempotent. Delete after use. */
const fs = require("fs");
const path = require("path");

// first line stays `{`, every following line gets +2 spaces (3-space inner / 2-space close)
const ser = (obj) => JSON.stringify(obj, null, 1).split("\n").map((l, i) => (i === 0 ? l : "  " + l)).join("\n");

function replaceWelcome(txt, welcomeObj) {
  const anchor = '"welcome": {';
  const at = txt.indexOf(anchor);
  if (at === -1) throw new Error("welcome anchor not found");
  const braceStart = at + anchor.length - 1; // index of '{'
  let depth = 0, i = braceStart;
  for (; i < txt.length; i++) {
    if (txt[i] === "{") depth++;
    else if (txt[i] === "}") { depth--; if (depth === 0) break; }
  }
  return txt.slice(0, braceStart) + ser(welcomeObj) + txt.slice(i + 1);
}

const T = {
  en: {
    welcome: {
      subject: "Welcome to Dynopay — let's finish setting up",
      heading: "Welcome — let's finish your setup",
      intro1: "You're in! Your Dynopay account is ready. A couple of quick steps and you'll be accepting crypto.",
      intro2: "Dynopay makes accepting crypto simple and secure — funds settle straight to a wallet you control.",
      promo: "And your first payment is on us — we waive our entire platform fee on your first settled payment, any amount.",
      nextTitle: "Finish setup to go live:",
      next1: "1. Create your brand profile",
      next2: "2. Add your payout address",
      next3: "3. Share a payment link or connect the API — and get paid",
      questions: "Questions along the way? Just reply to this email or open the chat on our site — we're happy to help.",
      cta: "Finish setup",
      preheader: "You're in — finish a couple of quick steps to start accepting crypto.",
    },
    onboardingComplete: {
      subject: "You're all set — start accepting crypto",
      heading: "You're all set",
      intro: "Setup complete! <strong>{{companyName}}</strong> is verified, your payout address is in, and you're ready to accept crypto payments.",
      nextTitle: "Ways to get paid:",
      next1: "Create a payment link and share it anywhere",
      next2: "Drop a checkout on your site or connect the API",
      next3: "Add products to your storefront",
      promo: "And remember — your first payment is fee-free. We waive our entire platform fee on your first settled payment.",
      cta: "Go to dashboard",
      preheader: "Setup complete — here's how to take your first payment.",
    },
    firstPayment: {
      subject: "You got your first payment",
      heading: "Your first payment landed",
      heroPill: "First payment",
      heroSub: "Your first payment on Dynopay",
      intro: "Congratulations — <strong>{{companyName}}</strong> just received its <strong>first payment</strong> on Dynopay. This one's on us: we waived our entire platform fee.",
      amountLabel: "Amount received",
      outro: "The funds settled straight to your payout wallet. Here's to many more — keep sharing your links and checkout.",
      cta: "View your payments",
      preheader: "Your first payment landed — and it was fee-free.",
    },
  },
  de: {
    welcome: {
      subject: "Willkommen bei Dynopay — lass uns die Einrichtung abschließen",
      heading: "Willkommen — schließen wir deine Einrichtung ab",
      intro1: "Du bist dabei! Dein Dynopay-Konto ist bereit. Nur ein paar schnelle Schritte und du kannst Krypto annehmen.",
      intro2: "Dynopay macht das Annehmen von Krypto einfach und sicher — die Gelder gehen direkt an ein Wallet, das du kontrollierst.",
      promo: "Und deine erste Zahlung geht auf uns — wir erlassen die gesamte Plattformgebühr bei deiner ersten abgeschlossenen Zahlung, egal in welcher Höhe.",
      nextTitle: "Schließe die Einrichtung ab, um live zu gehen:",
      next1: "1. Erstelle dein Markenprofil",
      next2: "2. Füge deine Auszahlungsadresse hinzu",
      next3: "3. Teile einen Zahlungslink oder verbinde die API — und werde bezahlt",
      questions: "Fragen unterwegs? Antworte einfach auf diese E-Mail oder öffne den Chat auf unserer Website — wir helfen gerne.",
      cta: "Einrichtung abschließen",
      preheader: "Du bist dabei — schließe ein paar schnelle Schritte ab, um Krypto anzunehmen.",
    },
    onboardingComplete: {
      subject: "Alles bereit — nimm jetzt Krypto an",
      heading: "Alles bereit",
      intro: "Einrichtung abgeschlossen! <strong>{{companyName}}</strong> ist verifiziert, deine Auszahlungsadresse ist hinterlegt und du kannst jetzt Krypto-Zahlungen annehmen.",
      nextTitle: "So wirst du bezahlt:",
      next1: "Erstelle einen Zahlungslink und teile ihn überall",
      next2: "Binde ein Checkout auf deiner Website ein oder verbinde die API",
      next3: "Füge Produkte zu deinem Shop hinzu",
      promo: "Und denk daran — deine erste Zahlung ist gebührenfrei. Wir erlassen die gesamte Plattformgebühr bei deiner ersten abgeschlossenen Zahlung.",
      cta: "Zum Dashboard",
      preheader: "Einrichtung abgeschlossen — so nimmst du deine erste Zahlung entgegen.",
    },
    firstPayment: {
      subject: "Du hast deine erste Zahlung erhalten",
      heading: "Deine erste Zahlung ist da",
      heroPill: "Erste Zahlung",
      heroSub: "Deine erste Zahlung bei Dynopay",
      intro: "Glückwunsch — <strong>{{companyName}}</strong> hat gerade seine <strong>erste Zahlung</strong> bei Dynopay erhalten. Die geht auf uns: Wir haben die gesamte Plattformgebühr erlassen.",
      amountLabel: "Erhaltener Betrag",
      outro: "Die Gelder wurden direkt an dein Auszahlungs-Wallet überwiesen. Auf viele weitere — teile weiter deine Links und dein Checkout.",
      cta: "Zahlungen ansehen",
      preheader: "Deine erste Zahlung ist da — und sie war gebührenfrei.",
    },
  },
  es: {
    welcome: {
      subject: "Bienvenido a Dynopay — terminemos la configuración",
      heading: "Bienvenido — terminemos tu configuración",
      intro1: "¡Ya estás dentro! Tu cuenta de Dynopay está lista. Un par de pasos rápidos y estarás aceptando cripto.",
      intro2: "Dynopay hace que aceptar cripto sea simple y seguro — los fondos se liquidan directamente en una billetera que tú controlas.",
      promo: "Y tu primer pago corre por nuestra cuenta — eximimos toda la comisión de plataforma en tu primer pago liquidado, sin importar el importe.",
      nextTitle: "Termina la configuración para ponerte en marcha:",
      next1: "1. Crea el perfil de tu marca",
      next2: "2. Añade tu dirección de cobro",
      next3: "3. Comparte un enlace de pago o conecta la API — y cobra",
      questions: "¿Dudas por el camino? Responde a este correo o abre el chat en nuestro sitio — estaremos encantados de ayudarte.",
      cta: "Terminar configuración",
      preheader: "Ya estás dentro — termina un par de pasos rápidos para empezar a aceptar cripto.",
    },
    onboardingComplete: {
      subject: "Todo listo — empieza a aceptar cripto",
      heading: "Todo listo",
      intro: "¡Configuración completa! <strong>{{companyName}}</strong> está verificada, tu dirección de cobro está puesta y ya puedes aceptar pagos en cripto.",
      nextTitle: "Formas de cobrar:",
      next1: "Crea un enlace de pago y compártelo donde quieras",
      next2: "Añade un checkout a tu sitio o conecta la API",
      next3: "Añade productos a tu tienda",
      promo: "Y recuerda — tu primer pago es sin comisión. Eximimos toda la comisión de plataforma en tu primer pago liquidado.",
      cta: "Ir al panel",
      preheader: "Configuración completa — así recibes tu primer pago.",
    },
    firstPayment: {
      subject: "Recibiste tu primer pago",
      heading: "Tu primer pago ha llegado",
      heroPill: "Primer pago",
      heroSub: "Tu primer pago en Dynopay",
      intro: "¡Enhorabuena! <strong>{{companyName}}</strong> acaba de recibir su <strong>primer pago</strong> en Dynopay. Este corre por nuestra cuenta: eximimos toda la comisión de plataforma.",
      amountLabel: "Importe recibido",
      outro: "Los fondos se liquidaron directamente en tu billetera de cobro. ¡Por muchos más! Sigue compartiendo tus enlaces y tu checkout.",
      cta: "Ver tus pagos",
      preheader: "Tu primer pago ha llegado — y fue sin comisión.",
    },
  },
  fr: {
    welcome: {
      subject: "Bienvenue sur Dynopay — terminons la configuration",
      heading: "Bienvenue — terminons votre configuration",
      intro1: "Vous y êtes ! Votre compte Dynopay est prêt. Quelques étapes rapides et vous accepterez la crypto.",
      intro2: "Dynopay rend l'acceptation de la crypto simple et sûre — les fonds sont versés directement sur un portefeuille que vous contrôlez.",
      promo: "Et votre premier paiement est offert — nous supprimons la totalité des frais de plateforme sur votre premier paiement réglé, quel que soit le montant.",
      nextTitle: "Terminez la configuration pour vous lancer :",
      next1: "1. Créez le profil de votre marque",
      next2: "2. Ajoutez votre adresse de versement",
      next3: "3. Partagez un lien de paiement ou connectez l'API — et encaissez",
      questions: "Des questions en chemin ? Répondez simplement à cet e-mail ou ouvrez le chat sur notre site — nous sommes ravis de vous aider.",
      cta: "Terminer la configuration",
      preheader: "Vous y êtes — terminez quelques étapes rapides pour accepter la crypto.",
    },
    onboardingComplete: {
      subject: "Tout est prêt — commencez à accepter la crypto",
      heading: "Tout est prêt",
      intro: "Configuration terminée ! <strong>{{companyName}}</strong> est vérifiée, votre adresse de versement est enregistrée et vous êtes prêt à accepter des paiements en crypto.",
      nextTitle: "Comment encaisser :",
      next1: "Créez un lien de paiement et partagez-le partout",
      next2: "Ajoutez un checkout à votre site ou connectez l'API",
      next3: "Ajoutez des produits à votre boutique",
      promo: "Et n'oubliez pas — votre premier paiement est sans frais. Nous supprimons la totalité des frais de plateforme sur votre premier paiement réglé.",
      cta: "Aller au tableau de bord",
      preheader: "Configuration terminée — voici comment recevoir votre premier paiement.",
    },
    firstPayment: {
      subject: "Vous avez reçu votre premier paiement",
      heading: "Votre premier paiement est arrivé",
      heroPill: "Premier paiement",
      heroSub: "Votre premier paiement sur Dynopay",
      intro: "Félicitations — <strong>{{companyName}}</strong> vient de recevoir son <strong>premier paiement</strong> sur Dynopay. Celui-ci est offert : nous avons supprimé la totalité des frais de plateforme.",
      amountLabel: "Montant reçu",
      outro: "Les fonds ont été versés directement sur votre portefeuille de versement. À bien d'autres — continuez à partager vos liens et votre checkout.",
      cta: "Voir vos paiements",
      preheader: "Votre premier paiement est arrivé — et il était sans frais.",
    },
  },
  nl: {
    welcome: {
      subject: "Welkom bij Dynopay — laten we de setup afronden",
      heading: "Welkom — laten we je setup afronden",
      intro1: "Je bent binnen! Je Dynopay-account is klaar. Een paar snelle stappen en je accepteert crypto.",
      intro2: "Dynopay maakt het accepteren van crypto simpel en veilig — het geld komt rechtstreeks binnen op een wallet die jij beheert.",
      promo: "En je eerste betaling is van ons — we schelden de volledige platformkosten kwijt op je eerste afgewikkelde betaling, ongeacht het bedrag.",
      nextTitle: "Rond de setup af om live te gaan:",
      next1: "1. Maak je merkprofiel aan",
      next2: "2. Voeg je uitbetaaladres toe",
      next3: "3. Deel een betaallink of koppel de API — en word betaald",
      questions: "Vragen onderweg? Beantwoord gewoon deze e-mail of open de chat op onze site — we helpen je graag.",
      cta: "Setup afronden",
      preheader: "Je bent binnen — rond een paar snelle stappen af om crypto te accepteren.",
    },
    onboardingComplete: {
      subject: "Alles klaar — begin met crypto accepteren",
      heading: "Alles klaar",
      intro: "Setup voltooid! <strong>{{companyName}}</strong> is geverifieerd, je uitbetaaladres staat erin en je kunt nu crypto-betalingen accepteren.",
      nextTitle: "Manieren om betaald te worden:",
      next1: "Maak een betaallink en deel hem overal",
      next2: "Zet een checkout op je site of koppel de API",
      next3: "Voeg producten toe aan je storefront",
      promo: "En vergeet niet — je eerste betaling is kosteloos. We schelden de volledige platformkosten kwijt op je eerste afgewikkelde betaling.",
      cta: "Naar dashboard",
      preheader: "Setup voltooid — zo ontvang je je eerste betaling.",
    },
    firstPayment: {
      subject: "Je hebt je eerste betaling ontvangen",
      heading: "Je eerste betaling is binnen",
      heroPill: "Eerste betaling",
      heroSub: "Je eerste betaling op Dynopay",
      intro: "Gefeliciteerd — <strong>{{companyName}}</strong> heeft zojuist zijn <strong>eerste betaling</strong> op Dynopay ontvangen. Deze is van ons: we hebben de volledige platformkosten kwijtgescholden.",
      amountLabel: "Ontvangen bedrag",
      outro: "Het geld is rechtstreeks op je uitbetaalwallet binnengekomen. Op nog veel meer — blijf je links en checkout delen.",
      cta: "Bekijk je betalingen",
      preheader: "Je eerste betaling is binnen — en het was kosteloos.",
    },
  },
  pt: {
    welcome: {
      subject: "Bem-vindo à Dynopay — vamos terminar a configuração",
      heading: "Bem-vindo — vamos terminar a sua configuração",
      intro1: "Já está! A sua conta Dynopay está pronta. Uns passos rápidos e estará a aceitar cripto.",
      intro2: "A Dynopay torna aceitar cripto simples e seguro — os fundos são liquidados diretamente numa carteira que você controla.",
      promo: "E o seu primeiro pagamento é por nossa conta — dispensamos toda a comissão da plataforma no seu primeiro pagamento liquidado, seja qual for o valor.",
      nextTitle: "Termine a configuração para entrar em atividade:",
      next1: "1. Crie o perfil da sua marca",
      next2: "2. Adicione o seu endereço de pagamento",
      next3: "3. Partilhe um link de pagamento ou ligue a API — e receba",
      questions: "Dúvidas pelo caminho? Responda a este e-mail ou abra o chat no nosso site — teremos todo o gosto em ajudar.",
      cta: "Terminar configuração",
      preheader: "Já está — termine uns passos rápidos para começar a aceitar cripto.",
    },
    onboardingComplete: {
      subject: "Tudo pronto — comece a aceitar cripto",
      heading: "Tudo pronto",
      intro: "Configuração concluída! A <strong>{{companyName}}</strong> está verificada, o seu endereço de pagamento está definido e já pode aceitar pagamentos em cripto.",
      nextTitle: "Formas de receber:",
      next1: "Crie um link de pagamento e partilhe-o em qualquer lugar",
      next2: "Coloque um checkout no seu site ou ligue a API",
      next3: "Adicione produtos à sua loja",
      promo: "E lembre-se — o seu primeiro pagamento é sem comissão. Dispensamos toda a comissão da plataforma no seu primeiro pagamento liquidado.",
      cta: "Ir para o painel",
      preheader: "Configuração concluída — veja como receber o seu primeiro pagamento.",
    },
    firstPayment: {
      subject: "Recebeu o seu primeiro pagamento",
      heading: "O seu primeiro pagamento chegou",
      heroPill: "Primeiro pagamento",
      heroSub: "O seu primeiro pagamento na Dynopay",
      intro: "Parabéns — a <strong>{{companyName}}</strong> acabou de receber o seu <strong>primeiro pagamento</strong> na Dynopay. Este é por nossa conta: dispensámos toda a comissão da plataforma.",
      amountLabel: "Valor recebido",
      outro: "Os fundos foram liquidados diretamente na sua carteira de pagamento. A muitos mais — continue a partilhar os seus links e o checkout.",
      cta: "Ver os seus pagamentos",
      preheader: "O seu primeiro pagamento chegou — e foi sem comissão.",
    },
  },
};

for (const [L, obj] of Object.entries(T)) {
  const file = path.join(__dirname, "..", "locales", L, "emails.json");
  let txt = fs.readFileSync(file, "utf8");

  // (1) reword welcome (idempotent: skip if already reworded)
  if (!txt.includes(obj.welcome.subject)) {
    txt = replaceWelcome(txt, obj.welcome);
  }

  // (2) insert the two new merchant namespaces right after `"merchant": {`
  const mAnchor = ' "merchant": {\n';
  if (txt.split(mAnchor).length - 1 !== 1) throw new Error(`${L}: merchant anchor not unique`);
  if (!/"onboardingComplete":/.test(txt.slice(txt.indexOf(mAnchor), txt.indexOf(mAnchor) + 400))) {
    const block = '  "onboardingComplete": ' + ser(obj.onboardingComplete) + ",\n" +
                  '  "firstPayment": ' + ser(obj.firstPayment) + ",\n";
    txt = txt.replace(mAnchor, mAnchor + block);
  }

  JSON.parse(txt); // validate
  fs.writeFileSync(file, txt);
  console.log(`✅ ${L} updated`);
}
console.log("DONE");
