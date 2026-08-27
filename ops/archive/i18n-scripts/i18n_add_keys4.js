/* Fourth i18n merge: onboarding/setup cluster.
 *  - dashboardLayout: OnboardingFlow + OnboardingChecklist (shared)
 *  - createPaymentLinkScreen: /create-pay-link setup guard
 *  - walletScreen: "create a company first" empty state
 * Idempotent.
 */
const fs = require("fs");
const path = require("path");
const LOCALES = path.join(__dirname, "..", "langs", "locales");
const LANGS = ["en", "pt", "fr", "es", "de", "nl"];

const dashboardLayout = {
  en: {
    obCompanyLabel: "Create your company",
    obCompanyDesc: "Add your business details",
    obWalletLabel: "Add a payout wallet",
    obWalletDesc: "Required — funds are forwarded here",
    obLinkLabel: "Create your first payment link",
    obLinkDesc: "Start getting paid in seconds",
    obAllSet: "You're all set!",
    obFinishSetup: "Finish setting up",
    obProgress: "{{completed}} of {{total}} done — a few quick steps to start accepting crypto",
    obLockedStep: "Complete the step above first",
    obExpandChecklist: "Expand setup checklist",
    obCollapseChecklist: "Collapse setup checklist",
  },
  pt: {
    obCompanyLabel: "Crie a sua empresa",
    obCompanyDesc: "Adicione os dados da sua empresa",
    obWalletLabel: "Adicione uma carteira de pagamento",
    obWalletDesc: "Obrigatório — os fundos são enviados para aqui",
    obLinkLabel: "Crie o seu primeiro link de pagamento",
    obLinkDesc: "Comece a receber em segundos",
    obAllSet: "Está tudo pronto!",
    obFinishSetup: "Conclua a configuração",
    obProgress: "{{completed}} de {{total}} concluídos — alguns passos rápidos para começar a aceitar cripto",
    obLockedStep: "Conclua primeiro o passo acima",
    obExpandChecklist: "Expandir lista de configuração",
    obCollapseChecklist: "Recolher lista de configuração",
  },
  fr: {
    obCompanyLabel: "Créez votre entreprise",
    obCompanyDesc: "Ajoutez les informations de votre entreprise",
    obWalletLabel: "Ajoutez un portefeuille de versement",
    obWalletDesc: "Requis — les fonds y sont transférés",
    obLinkLabel: "Créez votre premier lien de paiement",
    obLinkDesc: "Commencez à être payé en quelques secondes",
    obAllSet: "Tout est prêt !",
    obFinishSetup: "Terminez la configuration",
    obProgress: "{{completed}} sur {{total}} terminés — quelques étapes rapides pour commencer à accepter la crypto",
    obLockedStep: "Terminez d'abord l'étape ci-dessus",
    obExpandChecklist: "Développer la liste de configuration",
    obCollapseChecklist: "Réduire la liste de configuration",
  },
  es: {
    obCompanyLabel: "Crea tu empresa",
    obCompanyDesc: "Añade los datos de tu empresa",
    obWalletLabel: "Añade un monedero de pagos",
    obWalletDesc: "Obligatorio: los fondos se envían aquí",
    obLinkLabel: "Crea tu primer enlace de pago",
    obLinkDesc: "Empieza a cobrar en segundos",
    obAllSet: "¡Todo listo!",
    obFinishSetup: "Termina la configuración",
    obProgress: "{{completed}} de {{total}} completados: unos pasos rápidos para empezar a aceptar cripto",
    obLockedStep: "Completa primero el paso anterior",
    obExpandChecklist: "Expandir lista de configuración",
    obCollapseChecklist: "Contraer lista de configuración",
  },
  de: {
    obCompanyLabel: "Erstellen Sie Ihr Unternehmen",
    obCompanyDesc: "Fügen Sie Ihre Unternehmensdaten hinzu",
    obWalletLabel: "Fügen Sie ein Auszahlungs-Wallet hinzu",
    obWalletDesc: "Erforderlich — Gelder werden hierhin weitergeleitet",
    obLinkLabel: "Erstellen Sie Ihren ersten Zahlungslink",
    obLinkDesc: "Erhalten Sie in Sekunden Zahlungen",
    obAllSet: "Alles erledigt!",
    obFinishSetup: "Einrichtung abschließen",
    obProgress: "{{completed}} von {{total}} erledigt — ein paar schnelle Schritte, um Krypto zu akzeptieren",
    obLockedStep: "Schließen Sie zuerst den obigen Schritt ab",
    obExpandChecklist: "Einrichtungs-Checkliste erweitern",
    obCollapseChecklist: "Einrichtungs-Checkliste einklappen",
  },
  nl: {
    obCompanyLabel: "Maak je bedrijf aan",
    obCompanyDesc: "Voeg je bedrijfsgegevens toe",
    obWalletLabel: "Voeg een uitbetalingswallet toe",
    obWalletDesc: "Vereist — geld wordt hierheen doorgestuurd",
    obLinkLabel: "Maak je eerste betaallink",
    obLinkDesc: "Word binnen enkele seconden betaald",
    obAllSet: "Alles is klaar!",
    obFinishSetup: "Voltooi het instellen",
    obProgress: "{{completed}} van {{total}} klaar — een paar snelle stappen om crypto te accepteren",
    obLockedStep: "Voltooi eerst de bovenstaande stap",
    obExpandChecklist: "Configuratielijst uitvouwen",
    obCollapseChecklist: "Configuratielijst inklappen",
  },
};

const createPaymentLinkScreen = {
  en: {
    setupTitle: "A couple of quick steps first",
    setupSubtitle: "Finish these to start accepting crypto payments — no need to leave this page.",
    setupStepCompanyLabel: "Create a Company",
    setupStepCompanyHelper: "Used on invoices and receipts. Takes ~30 seconds.",
    setupStepWalletLabel: "Add a Payout Wallet",
    setupStepWalletHelper: "Where customer payments are sent. Required to receive crypto.",
    setupDone: "Done",
  },
  pt: {
    setupTitle: "Primeiro, alguns passos rápidos",
    setupSubtitle: "Conclua estes passos para começar a aceitar pagamentos em cripto — sem sair desta página.",
    setupStepCompanyLabel: "Crie uma empresa",
    setupStepCompanyHelper: "Usado em faturas e recibos. Demora ~30 segundos.",
    setupStepWalletLabel: "Adicione uma carteira de pagamento",
    setupStepWalletHelper: "Para onde os pagamentos dos clientes são enviados. Necessário para receber cripto.",
    setupDone: "Concluído",
  },
  fr: {
    setupTitle: "D'abord, quelques étapes rapides",
    setupSubtitle: "Terminez ces étapes pour commencer à accepter les paiements en crypto — sans quitter cette page.",
    setupStepCompanyLabel: "Créez une entreprise",
    setupStepCompanyHelper: "Utilisé sur les factures et les reçus. Prend ~30 secondes.",
    setupStepWalletLabel: "Ajoutez un portefeuille de versement",
    setupStepWalletHelper: "Où sont envoyés les paiements des clients. Requis pour recevoir de la crypto.",
    setupDone: "Terminé",
  },
  es: {
    setupTitle: "Primero, unos pasos rápidos",
    setupSubtitle: "Completa estos pasos para empezar a aceptar pagos en cripto, sin salir de esta página.",
    setupStepCompanyLabel: "Crea una empresa",
    setupStepCompanyHelper: "Se usa en facturas y recibos. Tarda ~30 segundos.",
    setupStepWalletLabel: "Añade un monedero de pagos",
    setupStepWalletHelper: "Adonde se envían los pagos de los clientes. Necesario para recibir cripto.",
    setupDone: "Hecho",
  },
  de: {
    setupTitle: "Zuerst ein paar schnelle Schritte",
    setupSubtitle: "Schließen Sie diese ab, um Krypto-Zahlungen zu akzeptieren — ohne diese Seite zu verlassen.",
    setupStepCompanyLabel: "Unternehmen erstellen",
    setupStepCompanyHelper: "Wird auf Rechnungen und Belegen verwendet. Dauert ~30 Sekunden.",
    setupStepWalletLabel: "Auszahlungs-Wallet hinzufügen",
    setupStepWalletHelper: "Wohin Kundenzahlungen gesendet werden. Erforderlich, um Krypto zu empfangen.",
    setupDone: "Erledigt",
  },
  nl: {
    setupTitle: "Eerst een paar snelle stappen",
    setupSubtitle: "Voltooi deze om cryptobetalingen te accepteren — zonder deze pagina te verlaten.",
    setupStepCompanyLabel: "Maak een bedrijf aan",
    setupStepCompanyHelper: "Gebruikt op facturen en bonnen. Duurt ~30 seconden.",
    setupStepWalletLabel: "Voeg een uitbetalingswallet toe",
    setupStepWalletHelper: "Waar klantbetalingen naartoe gaan. Vereist om crypto te ontvangen.",
    setupDone: "Klaar",
  },
};

const walletScreen = {
  en: {
    walletCompanyFirstTitle: "Create a company first",
    walletCompanyFirstBody: "You need to create a company profile before adding wallet addresses. Tap here to get started.",
  },
  pt: {
    walletCompanyFirstTitle: "Crie primeiro uma empresa",
    walletCompanyFirstBody: "Precisa de criar um perfil de empresa antes de adicionar endereços de carteira. Toque aqui para começar.",
  },
  fr: {
    walletCompanyFirstTitle: "Créez d'abord une entreprise",
    walletCompanyFirstBody: "Vous devez créer un profil d'entreprise avant d'ajouter des adresses de portefeuille. Appuyez ici pour commencer.",
  },
  es: {
    walletCompanyFirstTitle: "Primero crea una empresa",
    walletCompanyFirstBody: "Debes crear un perfil de empresa antes de añadir direcciones de monedero. Toca aquí para empezar.",
  },
  de: {
    walletCompanyFirstTitle: "Erstellen Sie zuerst ein Unternehmen",
    walletCompanyFirstBody: "Sie müssen ein Unternehmensprofil erstellen, bevor Sie Wallet-Adressen hinzufügen. Tippen Sie hier, um zu beginnen.",
  },
  nl: {
    walletCompanyFirstTitle: "Maak eerst een bedrijf aan",
    walletCompanyFirstBody: "Je moet een bedrijfsprofiel aanmaken voordat je walletadressen toevoegt. Tik hier om te beginnen.",
  },
};

function merge(file, data) {
  for (const lang of LANGS) {
    const p = path.join(LOCALES, lang, file);
    const json = JSON.parse(fs.readFileSync(p, "utf8"));
    Object.assign(json, data[lang]);
    fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n", "utf8");
    console.log(`  ✓ ${lang}/${file}`);
  }
}

merge("dashboardLayout.json", dashboardLayout);
merge("createPaymentLinkScreen.json", createPaymentLinkScreen);
merge("walletScreen.json", walletScreen);
console.log("Done.");
