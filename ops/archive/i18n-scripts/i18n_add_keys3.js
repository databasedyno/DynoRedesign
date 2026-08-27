/* Third i18n merge: extra companyDialog.createModal keys used by the
 * "Add company" / pay-link callers of CreateCompanyModal. Idempotent.
 */
const fs = require("fs");
const path = require("path");
const LOCALES = path.join(__dirname, "..", "langs", "locales");

const extra = {
  en: {
    addTitle: "Add a New Company",
    addSubtitle: "Set up another business profile under your account",
    payLinkSubtitle: "Used on invoices and receipts. Takes about 30 seconds.",
    cancel: "Cancel",
  },
  pt: {
    addTitle: "Adicionar uma nova empresa",
    addSubtitle: "Configure outro perfil de empresa na sua conta",
    payLinkSubtitle: "Usado em faturas e recibos. Demora cerca de 30 segundos.",
    cancel: "Cancelar",
  },
  fr: {
    addTitle: "Ajouter une nouvelle entreprise",
    addSubtitle: "Configurez un autre profil d'entreprise sous votre compte",
    payLinkSubtitle: "Utilisé sur les factures et les reçus. Prend environ 30 secondes.",
    cancel: "Annuler",
  },
  es: {
    addTitle: "Añadir una nueva empresa",
    addSubtitle: "Configura otro perfil de empresa en tu cuenta",
    payLinkSubtitle: "Se usa en facturas y recibos. Tarda unos 30 segundos.",
    cancel: "Cancelar",
  },
  de: {
    addTitle: "Neues Unternehmen hinzufügen",
    addSubtitle: "Richten Sie ein weiteres Unternehmensprofil unter Ihrem Konto ein",
    payLinkSubtitle: "Wird auf Rechnungen und Belegen verwendet. Dauert etwa 30 Sekunden.",
    cancel: "Abbrechen",
  },
  nl: {
    addTitle: "Nieuw bedrijf toevoegen",
    addSubtitle: "Stel nog een bedrijfsprofiel in onder je account",
    payLinkSubtitle: "Gebruikt op facturen en bonnen. Duurt ongeveer 30 seconden.",
    cancel: "Annuleren",
  },
};

const LANGS = ["en", "pt", "fr", "es", "de", "nl"];
for (const lang of LANGS) {
  const p = path.join(LOCALES, lang, "companyDialog.json");
  const json = JSON.parse(fs.readFileSync(p, "utf8"));
  json.createModal = Object.assign(json.createModal || {}, extra[lang]);
  fs.writeFileSync(p, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`  ✓ ${lang}/companyDialog.json`);
}
console.log("Done.");
