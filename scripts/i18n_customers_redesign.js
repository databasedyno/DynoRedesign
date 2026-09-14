/* Adds session-15 customers-redesign keys to all 6 locale common.json files */
const fs = require("fs");
const path = require("path");

const KEYS = {
  en: {
    apiCustomerName: "API payments",
    recoveredCustomerName: "Recovered payment",
    noCustomerDetails: "No customer details provided",
    sourceApi: "API",
    apiRecordHint:
      "This record groups payments received through your API integration that didn't include customer information. Pass customer details in your API calls to see real customer profiles here.",
    countLabel: "{{count}} customers",
  },
  de: {
    apiCustomerName: "API-Zahlungen",
    recoveredCustomerName: "Wiederhergestellte Zahlung",
    noCustomerDetails: "Keine Kundendaten übermittelt",
    sourceApi: "API",
    apiRecordHint:
      "Dieser Eintrag bündelt Zahlungen über Ihre API-Integration, die keine Kundendaten enthielten. Übermitteln Sie Kundendaten in Ihren API-Aufrufen, um hier echte Kundenprofile zu sehen.",
    countLabel: "{{count}} Kunden",
  },
  es: {
    apiCustomerName: "Pagos por API",
    recoveredCustomerName: "Pago recuperado",
    noCustomerDetails: "Sin datos del cliente",
    sourceApi: "API",
    apiRecordHint:
      "Este registro agrupa los pagos recibidos a través de su integración API que no incluían información del cliente. Envíe los datos del cliente en sus llamadas API para ver perfiles reales aquí.",
    countLabel: "{{count}} clientes",
  },
  fr: {
    apiCustomerName: "Paiements API",
    recoveredCustomerName: "Paiement récupéré",
    noCustomerDetails: "Aucune donnée client fournie",
    sourceApi: "API",
    apiRecordHint:
      "Cet enregistrement regroupe les paiements reçus via votre intégration API sans informations client. Transmettez les données client dans vos appels API pour voir de vrais profils ici.",
    countLabel: "{{count}} clients",
  },
  nl: {
    apiCustomerName: "API-betalingen",
    recoveredCustomerName: "Herstelde betaling",
    noCustomerDetails: "Geen klantgegevens opgegeven",
    sourceApi: "API",
    apiRecordHint:
      "Dit record groepeert betalingen die via uw API-integratie zijn ontvangen zonder klantgegevens. Geef klantgegevens mee in uw API-aanroepen om hier echte klantprofielen te zien.",
    countLabel: "{{count}} klanten",
  },
  pt: {
    apiCustomerName: "Pagamentos via API",
    recoveredCustomerName: "Pagamento recuperado",
    noCustomerDetails: "Sem dados do cliente",
    sourceApi: "API",
    apiRecordHint:
      "Este registro agrupa pagamentos recebidos pela sua integração de API sem informações do cliente. Envie os dados do cliente nas chamadas de API para ver perfis reais aqui.",
    countLabel: "{{count}} clientes",
  },
};

for (const [lang, additions] of Object.entries(KEYS)) {
  const file = path.join(__dirname, "..", "langs", "locales", lang, "common.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.customers = { ...(data.customers || {}), ...additions };
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`${lang}: customers keys now ${Object.keys(data.customers).length}`);
}
console.log("Done.");
