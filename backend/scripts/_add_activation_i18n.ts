import fs from "fs";
import path from "path";

/** Idempotently injects the `activation` email catalog into all 6 locale files. */
const T: Record<string, any> = {
  en: {
    step: {
      d1: { subject: "You're set up — here's how to get your first payment", heading: "Let's get you paid", intro: "Your Dynopay account is ready. Getting your first crypto payment takes about 2 minutes — here's the one thing to do next." },
      d3: { subject: "Still here to help you get paid", heading: "One step from your first payment", intro: "Quick nudge: just a few small steps stand between you and accepting crypto. Let's knock out the next one." },
      d7: { subject: "Your Dynopay account is ready when you are", heading: "Pick up where you left off", intro: "You set up Dynopay a week ago. Whenever you're ready, here's the fastest path to your first payment." },
    },
    seg: {
      madeLink: { line: "You've already created a payment link — nice. Add a payout wallet so the moment someone pays, we settle it straight to a wallet you control.", cta: "Add your payout wallet" },
      noLink: { line: "Create your first payment link — share it anywhere and start accepting Bitcoin, Ethereum or stablecoins, with no chargebacks.", cta: "Create your first link" },
      fundraiser: { line: "Launch your fundraiser page in minutes — share one link and start receiving crypto donations from anywhere in the world.", cta: "Create your fundraiser page" },
    },
    common: { videoCta: "Watch the 2-minute setup video →", unsubscribe: "Don't want these setup tips?", unsubscribeAction: "Unsubscribe" },
  },
  pt: {
    step: {
      d1: { subject: "Tudo pronto — veja como receber o seu primeiro pagamento", heading: "Vamos receber o seu primeiro pagamento", intro: "A sua conta Dynopay está pronta. Receber o seu primeiro pagamento em cripto leva cerca de 2 minutos — veja o próximo passo." },
      d3: { subject: "Continuamos aqui para o ajudar a receber", heading: "A um passo do seu primeiro pagamento", intro: "Um lembrete rápido: faltam poucos passos para começar a aceitar cripto. Vamos tratar do próximo." },
      d7: { subject: "A sua conta Dynopay está pronta quando você estiver", heading: "Continue de onde parou", intro: "Você configurou a Dynopay há uma semana. Quando quiser, este é o caminho mais rápido para o seu primeiro pagamento." },
    },
    seg: {
      madeLink: { line: "Você já criou um link de pagamento — ótimo. Adicione uma carteira de saque para que, assim que alguém pagar, liquidemos direto numa carteira que você controla.", cta: "Adicionar carteira de saque" },
      noLink: { line: "Crie o seu primeiro link de pagamento — partilhe em qualquer lugar e comece a aceitar Bitcoin, Ethereum ou stablecoins, sem estornos.", cta: "Criar o meu primeiro link" },
      fundraiser: { line: "Lance a sua página de arrecadação em minutos — partilhe um único link e comece a receber doações em cripto de qualquer lugar do mundo.", cta: "Criar página de arrecadação" },
    },
    common: { videoCta: "Assista ao vídeo de configuração de 2 minutos →", unsubscribe: "Não quer estas dicas de configuração?", unsubscribeAction: "Cancelar inscrição" },
  },
  es: {
    step: {
      d1: { subject: "Todo listo: así recibes tu primer pago", heading: "Vamos a cobrar tu primer pago", intro: "Tu cuenta de Dynopay está lista. Recibir tu primer pago en cripto toma unos 2 minutos: este es el siguiente paso." },
      d3: { subject: "Seguimos aquí para ayudarte a cobrar", heading: "A un paso de tu primer pago", intro: "Un recordatorio rápido: faltan unos pocos pasos para empezar a aceptar cripto. Hagamos el siguiente." },
      d7: { subject: "Tu cuenta de Dynopay está lista cuando tú lo estés", heading: "Continúa donde lo dejaste", intro: "Configuraste Dynopay hace una semana. Cuando quieras, este es el camino más rápido a tu primer pago." },
    },
    seg: {
      madeLink: { line: "Ya creaste un enlace de pago, ¡genial! Agrega una billetera de retiro para que, en cuanto alguien pague, liquidemos directo en una billetera que tú controlas.", cta: "Agregar billetera de retiro" },
      noLink: { line: "Crea tu primer enlace de pago: compártelo donde quieras y empieza a aceptar Bitcoin, Ethereum o stablecoins, sin contracargos.", cta: "Crear mi primer enlace" },
      fundraiser: { line: "Lanza tu página de recaudación en minutos: comparte un solo enlace y empieza a recibir donaciones en cripto desde cualquier parte del mundo.", cta: "Crear página de recaudación" },
    },
    common: { videoCta: "Mira el video de configuración de 2 minutos →", unsubscribe: "¿No quieres estos consejos de configuración?", unsubscribeAction: "Cancelar suscripción" },
  },
  fr: {
    step: {
      d1: { subject: "Tout est prêt — voici comment recevoir votre premier paiement", heading: "Recevons votre premier paiement", intro: "Votre compte Dynopay est prêt. Recevoir votre premier paiement en crypto prend environ 2 minutes — voici la prochaine étape." },
      d3: { subject: "Toujours là pour vous aider à être payé", heading: "À une étape de votre premier paiement", intro: "Petit rappel : il ne reste que quelques étapes avant d'accepter la crypto. Passons à la suivante." },
      d7: { subject: "Votre compte Dynopay est prêt quand vous l'êtes", heading: "Reprenez là où vous en étiez", intro: "Vous avez configuré Dynopay il y a une semaine. Quand vous voulez, voici le chemin le plus rapide vers votre premier paiement." },
    },
    seg: {
      madeLink: { line: "Vous avez déjà créé un lien de paiement — parfait. Ajoutez un portefeuille de retrait pour qu'au moment où quelqu'un paie, nous versions directement sur un portefeuille que vous contrôlez.", cta: "Ajouter un portefeuille de retrait" },
      noLink: { line: "Créez votre premier lien de paiement — partagez-le partout et commencez à accepter Bitcoin, Ethereum ou stablecoins, sans rétrofacturation.", cta: "Créer mon premier lien" },
      fundraiser: { line: "Lancez votre page de collecte en quelques minutes — partagez un seul lien et recevez des dons en crypto du monde entier.", cta: "Créer ma page de collecte" },
    },
    common: { videoCta: "Regardez la vidéo de configuration de 2 minutes →", unsubscribe: "Vous ne voulez plus ces conseils de configuration ?", unsubscribeAction: "Se désabonner" },
  },
  de: {
    step: {
      d1: { subject: "Alles bereit – so erhalten Sie Ihre erste Zahlung", heading: "Lassen Sie uns Ihre erste Zahlung erhalten", intro: "Ihr Dynopay-Konto ist bereit. Ihre erste Krypto-Zahlung zu erhalten dauert etwa 2 Minuten – hier ist der nächste Schritt." },
      d3: { subject: "Wir helfen Ihnen weiterhin, bezahlt zu werden", heading: "Nur einen Schritt von Ihrer ersten Zahlung entfernt", intro: "Kurze Erinnerung: Nur wenige Schritte trennen Sie davon, Krypto zu akzeptieren. Erledigen wir den nächsten." },
      d7: { subject: "Ihr Dynopay-Konto ist bereit, wenn Sie es sind", heading: "Machen Sie dort weiter, wo Sie aufgehört haben", intro: "Sie haben Dynopay vor einer Woche eingerichtet. Wann immer Sie bereit sind – hier ist der schnellste Weg zu Ihrer ersten Zahlung." },
    },
    seg: {
      madeLink: { line: "Sie haben bereits einen Zahlungslink erstellt – super. Fügen Sie eine Auszahlungs-Wallet hinzu, damit wir, sobald jemand zahlt, direkt an eine Wallet auszahlen, die Sie kontrollieren.", cta: "Auszahlungs-Wallet hinzufügen" },
      noLink: { line: "Erstellen Sie Ihren ersten Zahlungslink – teilen Sie ihn überall und akzeptieren Sie Bitcoin, Ethereum oder Stablecoins, ohne Rückbuchungen.", cta: "Ersten Link erstellen" },
      fundraiser: { line: "Starten Sie Ihre Spendenseite in wenigen Minuten – teilen Sie einen Link und erhalten Sie Krypto-Spenden aus aller Welt.", cta: "Spendenseite erstellen" },
    },
    common: { videoCta: "Sehen Sie sich das 2-minütige Einrichtungsvideo an →", unsubscribe: "Möchten Sie diese Einrichtungstipps nicht?", unsubscribeAction: "Abmelden" },
  },
  nl: {
    step: {
      d1: { subject: "Alles klaar — zo ontvang je je eerste betaling", heading: "Laten we je eerste betaling binnenhalen", intro: "Je Dynopay-account is klaar. Je eerste cryptobetaling ontvangen duurt ongeveer 2 minuten — dit is de volgende stap." },
      d3: { subject: "We helpen je nog steeds om betaald te worden", heading: "Eén stap van je eerste betaling", intro: "Kleine herinnering: nog een paar stappen en je accepteert crypto. Laten we de volgende doen." },
      d7: { subject: "Je Dynopay-account is klaar wanneer jij dat bent", heading: "Ga verder waar je gebleven was", intro: "Je hebt Dynopay een week geleden ingesteld. Wanneer je maar wilt: dit is de snelste weg naar je eerste betaling." },
    },
    seg: {
      madeLink: { line: "Je hebt al een betaallink gemaakt — mooi. Voeg een uitbetalingswallet toe zodat we, zodra iemand betaalt, direct uitbetalen naar een wallet die jij beheert.", cta: "Uitbetalingswallet toevoegen" },
      noLink: { line: "Maak je eerste betaallink — deel hem overal en accepteer Bitcoin, Ethereum of stablecoins, zonder terugboekingen.", cta: "Maak je eerste link" },
      fundraiser: { line: "Lanceer je inzamelingspagina in enkele minuten — deel één link en ontvang cryptodonaties van over de hele wereld.", cta: "Inzamelingspagina maken" },
    },
    common: { videoCta: "Bekijk de video van 2 minuten →", unsubscribe: "Wil je deze installatietips niet?", unsubscribeAction: "Uitschrijven" },
  },
};

const LOCALES_DIR = path.join(__dirname, "..", "locales");
for (const lang of Object.keys(T)) {
  const file = path.join(LOCALES_DIR, lang, "emails.json");
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.activation = T[lang];
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`patched ${file}`);
}
console.log("done");
