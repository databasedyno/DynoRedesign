/* eslint-disable */
/**
 * add_onboarding_i18n.cjs — idempotent deep-merge of the Get-Started / Onboarding
 * reward-share hero + setup-complete strip + handle/payouts copy into the
 * `dashboardLayout` namespace for all 6 locales.
 *
 * WHY: 31 keys were used in Components/Page/GetStarted/* + Components/UI/OnboardingFlow/*
 * (namespace dashboardLayout) with inline `defaultValue` English only, so de/es/fr/nl/pt
 * showed English. This writes professional translations (EN = the source defaultValue).
 *
 * Run: node scripts/i18n/add_onboarding_i18n.cjs   (then rebuild the frontend)
 * Idempotent: only sets the keys below; re-running overwrites them with the same values.
 */
const fs = require("fs");
const path = require("path");

const LOCALES_DIR = path.join(__dirname, "..", "..", "langs", "locales");
const NS = "dashboardLayout";

// flat dotted-key -> value, per locale. Interpolation placeholders {{what}} / {{lands}} preserved.
const DATA = {
  en: {
    "gs.heroShareWhatPage": "share your page",
    "gs.heroShareWhatCampaign": "share your campaign",
    "gs.heroShareWhatLink": "share your link",
    "gs.heroLandsTip": "first tip",
    "gs.heroLandsContribution": "first contribution",
    "gs.heroLandsPayment": "first payment",
    "gs.heroTitleAlmostShare": "Almost there — {{what}}",
    "gs.heroSubtitleAlmostShare": "Everything is set. Just {{what}} and your dashboard fills in the moment the {{lands}} lands.",
    "gs.ctaSharePage": "Share your page",
    "gs.ctaShareCampaign": "Share your campaign",
    "gs.heroFeeFree": "Your first payment is fee-free",
    "gs.stripTitleDev": "Setup complete — your integration works in sandbox",
    "gs.stripTitleCreator": "Setup complete — your page is live",
    "gs.stripTitleFundraiser": "Setup complete — your campaign is live",
    "gs.stripTitle": "Setup complete — waiting for your first payment",
    "gs.stripSubtitleDev": "Your dashboard is live. It fills with real numbers the moment your first live payment settles.",
    "gs.stripSubtitle": "Your dashboard is ready. The moment your first payment lands, the numbers below come alive.",
    "gs.stripOpenDevelopers": "Open Developers",
    "gs.stripOpenPage": "Open your page",
    "gs.stripShareAgain": "Share again",
    "gs.stripOpenCampaigns": "Open campaigns",
    "gs.stripFeeFree": "First payment is fee-free",
    "gs.handleOpenEditorFull": "Open the full editor →",
    "gs.handleNoWalletNote": "Claim your @handle now — tips go live the moment you add the payout address they should land in. We'll ask for it when you claim.",
    "gs.claimHandleAddWallet": "Claim & add payout address",
    "gs.payoutsSubtitleCreator": "Tips are forwarded straight to a wallet you control. Add at least one address so your page can go live.",
    "gs.payoutsSubtitleFundraiser": "Contributions are forwarded straight to a wallet you control. Add at least one address so your campaign can go live.",
    "gs.payoutsSubtitleDev": "Payments are forwarded straight to a wallet you control. Add at least one address so you can accept real payments.",
    "gs.trackDeveloper": "Developer",
    "gs.trackCreator": "Creator",
    "gs.trackFundraiser": "Fundraiser",
  },
  es: {
    "gs.heroShareWhatPage": "comparte tu página",
    "gs.heroShareWhatCampaign": "comparte tu campaña",
    "gs.heroShareWhatLink": "comparte tu enlace",
    "gs.heroLandsTip": "primera propina",
    "gs.heroLandsContribution": "primera contribución",
    "gs.heroLandsPayment": "primer pago",
    "gs.heroTitleAlmostShare": "Ya casi — {{what}}",
    "gs.heroSubtitleAlmostShare": "Todo está listo. {{what}} y tu panel se completará en cuanto llegue tu {{lands}}.",
    "gs.ctaSharePage": "Comparte tu página",
    "gs.ctaShareCampaign": "Comparte tu campaña",
    "gs.heroFeeFree": "Tu primer pago es sin comisión",
    "gs.stripTitleDev": "Configuración completa — tu integración funciona en el entorno de pruebas",
    "gs.stripTitleCreator": "Configuración completa — tu página está activa",
    "gs.stripTitleFundraiser": "Configuración completa — tu campaña está activa",
    "gs.stripTitle": "Configuración completa — esperando tu primer pago",
    "gs.stripSubtitleDev": "Tu panel está activo. Se llenará con números reales en cuanto se liquide tu primer pago real.",
    "gs.stripSubtitle": "Tu panel está listo. En cuanto llegue tu primer pago, los números de abajo cobrarán vida.",
    "gs.stripOpenDevelopers": "Abrir Desarrolladores",
    "gs.stripOpenPage": "Abrir tu página",
    "gs.stripShareAgain": "Compartir de nuevo",
    "gs.stripOpenCampaigns": "Abrir campañas",
    "gs.stripFeeFree": "El primer pago es sin comisión",
    "gs.handleOpenEditorFull": "Abrir el editor completo →",
    "gs.handleNoWalletNote": "Reclama tu @handle ahora: las propinas se activan en cuanto añadas la dirección de pago donde deben llegar. Te la pediremos al reclamarlo.",
    "gs.claimHandleAddWallet": "Reclamar y añadir dirección de pago",
    "gs.payoutsSubtitleCreator": "Las propinas se envían directamente a una cartera que tú controlas. Añade al menos una dirección para que tu página pueda activarse.",
    "gs.payoutsSubtitleFundraiser": "Las contribuciones se envían directamente a una cartera que tú controlas. Añade al menos una dirección para que tu campaña pueda activarse.",
    "gs.payoutsSubtitleDev": "Los pagos se envían directamente a una cartera que tú controlas. Añade al menos una dirección para poder aceptar pagos reales.",
    "gs.trackDeveloper": "Desarrollador",
    "gs.trackCreator": "Creador",
    "gs.trackFundraiser": "Recaudación",
  },
  fr: {
    "gs.heroShareWhatPage": "partagez votre page",
    "gs.heroShareWhatCampaign": "partagez votre campagne",
    "gs.heroShareWhatLink": "partagez votre lien",
    "gs.heroLandsTip": "premier pourboire",
    "gs.heroLandsContribution": "première contribution",
    "gs.heroLandsPayment": "premier paiement",
    "gs.heroTitleAlmostShare": "Presque fini — {{what}}",
    "gs.heroSubtitleAlmostShare": "Tout est prêt : {{what}} et votre tableau de bord se remplira dès que votre {{lands}} arrive.",
    "gs.ctaSharePage": "Partager votre page",
    "gs.ctaShareCampaign": "Partager votre campagne",
    "gs.heroFeeFree": "Votre premier paiement est sans frais",
    "gs.stripTitleDev": "Configuration terminée — votre intégration fonctionne en bac à sable",
    "gs.stripTitleCreator": "Configuration terminée — votre page est en ligne",
    "gs.stripTitleFundraiser": "Configuration terminée — votre campagne est en ligne",
    "gs.stripTitle": "Configuration terminée — en attente de votre premier paiement",
    "gs.stripSubtitleDev": "Votre tableau de bord est en ligne. Il se remplira de chiffres réels dès que votre premier paiement réel sera réglé.",
    "gs.stripSubtitle": "Votre tableau de bord est prêt. Dès que votre premier paiement arrive, les chiffres ci-dessous s'animent.",
    "gs.stripOpenDevelopers": "Ouvrir Développeurs",
    "gs.stripOpenPage": "Ouvrir votre page",
    "gs.stripShareAgain": "Partager à nouveau",
    "gs.stripOpenCampaigns": "Ouvrir les campagnes",
    "gs.stripFeeFree": "Le premier paiement est sans frais",
    "gs.handleOpenEditorFull": "Ouvrir l'éditeur complet →",
    "gs.handleNoWalletNote": "Réservez votre @handle maintenant — les pourboires s'activent dès que vous ajoutez l'adresse de versement où ils doivent arriver. Nous vous la demanderons lors de la réservation.",
    "gs.claimHandleAddWallet": "Réserver et ajouter l'adresse de versement",
    "gs.payoutsSubtitleCreator": "Les pourboires sont transférés directement vers un portefeuille que vous contrôlez. Ajoutez au moins une adresse pour que votre page puisse être mise en ligne.",
    "gs.payoutsSubtitleFundraiser": "Les contributions sont transférées directement vers un portefeuille que vous contrôlez. Ajoutez au moins une adresse pour que votre campagne puisse être mise en ligne.",
    "gs.payoutsSubtitleDev": "Les paiements sont transférés directement vers un portefeuille que vous contrôlez. Ajoutez au moins une adresse pour pouvoir accepter de vrais paiements.",
    "gs.trackDeveloper": "Développeur",
    "gs.trackCreator": "Créateur",
    "gs.trackFundraiser": "Collecte de fonds",
  },
  de: {
    "gs.heroShareWhatPage": "teile deine Seite",
    "gs.heroShareWhatCampaign": "teile deine Kampagne",
    "gs.heroShareWhatLink": "teile deinen Link",
    "gs.heroLandsTip": "erstes Trinkgeld",
    "gs.heroLandsContribution": "erster Beitrag",
    "gs.heroLandsPayment": "erste Zahlung",
    "gs.heroTitleAlmostShare": "Fast geschafft — {{what}}",
    "gs.heroSubtitleAlmostShare": "Alles ist bereit. {{what}} – und sobald {{lands}} eingeht, füllt sich dein Dashboard.",
    "gs.ctaSharePage": "Seite teilen",
    "gs.ctaShareCampaign": "Kampagne teilen",
    "gs.heroFeeFree": "Deine erste Zahlung ist gebührenfrei",
    "gs.stripTitleDev": "Einrichtung abgeschlossen — deine Integration funktioniert in der Sandbox",
    "gs.stripTitleCreator": "Einrichtung abgeschlossen — deine Seite ist live",
    "gs.stripTitleFundraiser": "Einrichtung abgeschlossen — deine Kampagne ist live",
    "gs.stripTitle": "Einrichtung abgeschlossen — warte auf deine erste Zahlung",
    "gs.stripSubtitleDev": "Dein Dashboard ist live. Es füllt sich mit echten Zahlen, sobald deine erste echte Zahlung abgewickelt wird.",
    "gs.stripSubtitle": "Dein Dashboard ist bereit. Sobald deine erste Zahlung eingeht, erwachen die Zahlen unten zum Leben.",
    "gs.stripOpenDevelopers": "Entwickler öffnen",
    "gs.stripOpenPage": "Deine Seite öffnen",
    "gs.stripShareAgain": "Erneut teilen",
    "gs.stripOpenCampaigns": "Kampagnen öffnen",
    "gs.stripFeeFree": "Die erste Zahlung ist gebührenfrei",
    "gs.handleOpenEditorFull": "Vollständigen Editor öffnen →",
    "gs.handleNoWalletNote": "Sichere dir jetzt deinen @handle — Trinkgelder werden aktiv, sobald du die Auszahlungsadresse hinzufügst, an die sie gehen sollen. Wir fragen beim Sichern danach.",
    "gs.claimHandleAddWallet": "Sichern und Auszahlungsadresse hinzufügen",
    "gs.payoutsSubtitleCreator": "Trinkgelder werden direkt an eine Wallet weitergeleitet, die du kontrollierst. Füge mindestens eine Adresse hinzu, damit deine Seite live gehen kann.",
    "gs.payoutsSubtitleFundraiser": "Beiträge werden direkt an eine Wallet weitergeleitet, die du kontrollierst. Füge mindestens eine Adresse hinzu, damit deine Kampagne live gehen kann.",
    "gs.payoutsSubtitleDev": "Zahlungen werden direkt an eine Wallet weitergeleitet, die du kontrollierst. Füge mindestens eine Adresse hinzu, um echte Zahlungen annehmen zu können.",
    "gs.trackDeveloper": "Entwickler",
    "gs.trackCreator": "Creator",
    "gs.trackFundraiser": "Spendenaktion",
  },
  pt: {
    "gs.heroShareWhatPage": "compartilhe sua página",
    "gs.heroShareWhatCampaign": "compartilhe sua campanha",
    "gs.heroShareWhatLink": "compartilhe seu link",
    "gs.heroLandsTip": "primeira gorjeta",
    "gs.heroLandsContribution": "primeira contribuição",
    "gs.heroLandsPayment": "primeiro pagamento",
    "gs.heroTitleAlmostShare": "Quase lá — {{what}}",
    "gs.heroSubtitleAlmostShare": "Está tudo pronto. {{what}} e seu painel ganha vida assim que o seu {{lands}} chegar.",
    "gs.ctaSharePage": "Compartilhar sua página",
    "gs.ctaShareCampaign": "Compartilhar sua campanha",
    "gs.heroFeeFree": "Seu primeiro pagamento é sem taxa",
    "gs.stripTitleDev": "Configuração concluída — sua integração funciona no sandbox",
    "gs.stripTitleCreator": "Configuração concluída — sua página está no ar",
    "gs.stripTitleFundraiser": "Configuração concluída — sua campanha está no ar",
    "gs.stripTitle": "Configuração concluída — aguardando seu primeiro pagamento",
    "gs.stripSubtitleDev": "Seu painel está no ar. Ele se preenche com números reais assim que seu primeiro pagamento real for liquidado.",
    "gs.stripSubtitle": "Seu painel está pronto. No momento em que seu primeiro pagamento chegar, os números abaixo ganham vida.",
    "gs.stripOpenDevelopers": "Abrir Desenvolvedores",
    "gs.stripOpenPage": "Abrir sua página",
    "gs.stripShareAgain": "Compartilhar novamente",
    "gs.stripOpenCampaigns": "Abrir campanhas",
    "gs.stripFeeFree": "O primeiro pagamento é sem taxa",
    "gs.handleOpenEditorFull": "Abrir o editor completo →",
    "gs.handleNoWalletNote": "Garanta seu @handle agora — as gorjetas entram no ar assim que você adicionar o endereço de pagamento para onde elas devem ir. Vamos pedi-lo quando você garantir.",
    "gs.claimHandleAddWallet": "Garantir e adicionar endereço de pagamento",
    "gs.payoutsSubtitleCreator": "As gorjetas são encaminhadas diretamente para uma carteira que você controla. Adicione pelo menos um endereço para que sua página possa entrar no ar.",
    "gs.payoutsSubtitleFundraiser": "As contribuições são encaminhadas diretamente para uma carteira que você controla. Adicione pelo menos um endereço para que sua campanha possa entrar no ar.",
    "gs.payoutsSubtitleDev": "Os pagamentos são encaminhados diretamente para uma carteira que você controla. Adicione pelo menos um endereço para poder aceitar pagamentos reais.",
    "gs.trackDeveloper": "Desenvolvedor",
    "gs.trackCreator": "Criador",
    "gs.trackFundraiser": "Arrecadação",
  },
  nl: {
    "gs.heroShareWhatPage": "deel je pagina",
    "gs.heroShareWhatCampaign": "deel je campagne",
    "gs.heroShareWhatLink": "deel je link",
    "gs.heroLandsTip": "eerste fooi",
    "gs.heroLandsContribution": "eerste bijdrage",
    "gs.heroLandsPayment": "eerste betaling",
    "gs.heroTitleAlmostShare": "Bijna klaar — {{what}}",
    "gs.heroSubtitleAlmostShare": "Alles staat klaar. {{what}} en je dashboard vult zich zodra je {{lands}} binnenkomt.",
    "gs.ctaSharePage": "Deel je pagina",
    "gs.ctaShareCampaign": "Deel je campagne",
    "gs.heroFeeFree": "Je eerste betaling is kosteloos",
    "gs.stripTitleDev": "Installatie voltooid — je integratie werkt in de sandbox",
    "gs.stripTitleCreator": "Installatie voltooid — je pagina is live",
    "gs.stripTitleFundraiser": "Installatie voltooid — je campagne is live",
    "gs.stripTitle": "Installatie voltooid — wachten op je eerste betaling",
    "gs.stripSubtitleDev": "Je dashboard is live. Het vult zich met echte cijfers zodra je eerste echte betaling is afgewikkeld.",
    "gs.stripSubtitle": "Je dashboard is klaar. Zodra je eerste betaling binnenkomt, komen de cijfers hieronder tot leven.",
    "gs.stripOpenDevelopers": "Ontwikkelaars openen",
    "gs.stripOpenPage": "Je pagina openen",
    "gs.stripShareAgain": "Opnieuw delen",
    "gs.stripOpenCampaigns": "Campagnes openen",
    "gs.stripFeeFree": "De eerste betaling is kosteloos",
    "gs.handleOpenEditorFull": "Volledige editor openen →",
    "gs.handleNoWalletNote": "Claim nu je @handle — fooien gaan live zodra je het uitbetalingsadres toevoegt waar ze moeten binnenkomen. We vragen erom wanneer je claimt.",
    "gs.claimHandleAddWallet": "Claimen en uitbetalingsadres toevoegen",
    "gs.payoutsSubtitleCreator": "Fooien worden rechtstreeks doorgestuurd naar een wallet die jij beheert. Voeg ten minste één adres toe zodat je pagina live kan gaan.",
    "gs.payoutsSubtitleFundraiser": "Bijdragen worden rechtstreeks doorgestuurd naar een wallet die jij beheert. Voeg ten minste één adres toe zodat je campagne live kan gaan.",
    "gs.payoutsSubtitleDev": "Betalingen worden rechtstreeks doorgestuurd naar een wallet die jij beheert. Voeg ten minste één adres toe zodat je echte betalingen kunt accepteren.",
    "gs.trackDeveloper": "Ontwikkelaar",
    "gs.trackCreator": "Maker",
    "gs.trackFundraiser": "Inzamelingsactie",
  },
};

function setDeep(obj, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {};
    cur = cur[p];
  }
  cur[parts[parts.length - 1]] = value;
}

let totalWrites = 0;
for (const [loc, kv] of Object.entries(DATA)) {
  const file = path.join(LOCALES_DIR, loc, `${NS}.json`);
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  let writes = 0;
  for (const [dottedKey, value] of Object.entries(kv)) {
    setDeep(json, dottedKey, value);
    writes++;
  }
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n", "utf8");
  totalWrites += writes;
  console.log(`✅ ${loc}/${NS}.json: set ${writes} keys`);
}
console.log(`\nDone — ${totalWrites} key writes across ${Object.keys(DATA).length} locales.`);
