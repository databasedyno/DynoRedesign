/* eslint-disable */
// Onboarding "first payment" milestone: add obPaymentLabel/obPaymentDesc to dashboardLayout (6 locales).
const fs = require("fs");
const path = require("path");
const BASE = path.join(__dirname, "..", "langs", "locales");
const LOCALES = ["en", "pt", "fr", "es", "de", "nl"];

const keys = {
  en: { obPaymentLabel: "Receive your first payment", obPaymentDesc: "Share your payment link and get paid" },
  pt: { obPaymentLabel: "Receba seu primeiro pagamento", obPaymentDesc: "Compartilhe seu link de pagamento e receba" },
  fr: { obPaymentLabel: "Recevez votre premier paiement", obPaymentDesc: "Partagez votre lien de paiement et soyez payé" },
  es: { obPaymentLabel: "Recibe tu primer pago", obPaymentDesc: "Comparte tu enlace de pago y cobra" },
  de: { obPaymentLabel: "Erhalten Sie Ihre erste Zahlung", obPaymentDesc: "Teilen Sie Ihren Zahlungslink und werden Sie bezahlt" },
  nl: { obPaymentLabel: "Ontvang je eerste betaling", obPaymentDesc: "Deel je betaallink en word betaald" },
};

let added = 0;
for (const lang of LOCALES) {
  const file = path.join(BASE, lang, "dashboardLayout.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  for (const [k, v] of Object.entries(keys[lang])) {
    if (data[k] === undefined) { data[k] = v; added++; }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✓ ${lang}/dashboardLayout.json updated`);
}
console.log(`Done. ${added} keys added.`);
