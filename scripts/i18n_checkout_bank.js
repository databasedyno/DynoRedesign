/* eslint-disable */
// Checkout /pay i18n: add bank-transfer + back keys into common.checkout (all 6 locales).
// MERGES into the existing `checkout` object — never overwrites existing keys.
const fs = require("fs");
const path = require("path");

const BASE = path.join(__dirname, "..", "langs", "locales");
const LOCALES = ["en", "pt", "fr", "es", "de", "nl"];

// New keys to add under common.checkout (existing keys like toPay / invoiceExpiresIn / copied are reused, not touched)
const checkout = {
  en: {
    back: "Back",
    ngnBankTransfer: "NGN Bank Transfer",
    bankName: "Bank Name:",
    accountNumber: "Account Number:",
    copy: "Copy",
    accountUnique: "This account number is unique for each transaction.",
    recipient: "Recipient:",
    secureTransfer: "Secure bank transfer with automatic confirmation. No need to notify us!",
    madePayment: "I've made the payment",
    noAccountToCopy: "No account number to copy.",
    paymentNotVerified: "Payment not verified.",
  },
  pt: {
    back: "Voltar",
    ngnBankTransfer: "Transferência bancária NGN",
    bankName: "Nome do banco:",
    accountNumber: "Número da conta:",
    copy: "Copiar",
    accountUnique: "Este número de conta é exclusivo para cada transação.",
    recipient: "Destinatário:",
    secureTransfer: "Transferência bancária segura com confirmação automática. Não precisa nos avisar!",
    madePayment: "Efetuei o pagamento",
    noAccountToCopy: "Nenhum número de conta para copiar.",
    paymentNotVerified: "Pagamento não verificado.",
  },
  fr: {
    back: "Retour",
    ngnBankTransfer: "Virement bancaire NGN",
    bankName: "Nom de la banque :",
    accountNumber: "Numéro de compte :",
    copy: "Copier",
    accountUnique: "Ce numéro de compte est unique pour chaque transaction.",
    recipient: "Bénéficiaire :",
    secureTransfer: "Virement bancaire sécurisé avec confirmation automatique. Pas besoin de nous prévenir !",
    madePayment: "J'ai effectué le paiement",
    noAccountToCopy: "Aucun numéro de compte à copier.",
    paymentNotVerified: "Paiement non vérifié.",
  },
  es: {
    back: "Atrás",
    ngnBankTransfer: "Transferencia bancaria NGN",
    bankName: "Nombre del banco:",
    accountNumber: "Número de cuenta:",
    copy: "Copiar",
    accountUnique: "Este número de cuenta es único para cada transacción.",
    recipient: "Destinatario:",
    secureTransfer: "Transferencia bancaria segura con confirmación automática. ¡No necesitas avisarnos!",
    madePayment: "He realizado el pago",
    noAccountToCopy: "No hay número de cuenta para copiar.",
    paymentNotVerified: "Pago no verificado.",
  },
  de: {
    back: "Zurück",
    ngnBankTransfer: "NGN-Banküberweisung",
    bankName: "Bankname:",
    accountNumber: "Kontonummer:",
    copy: "Kopieren",
    accountUnique: "Diese Kontonummer ist für jede Transaktion einzigartig.",
    recipient: "Empfänger:",
    secureTransfer: "Sichere Banküberweisung mit automatischer Bestätigung. Keine Benachrichtigung nötig!",
    madePayment: "Ich habe die Zahlung getätigt",
    noAccountToCopy: "Keine Kontonummer zum Kopieren.",
    paymentNotVerified: "Zahlung nicht verifiziert.",
  },
  nl: {
    back: "Terug",
    ngnBankTransfer: "NGN-bankoverschrijving",
    bankName: "Banknaam:",
    accountNumber: "Rekeningnummer:",
    copy: "Kopiëren",
    accountUnique: "Dit rekeningnummer is uniek voor elke transactie.",
    recipient: "Ontvanger:",
    secureTransfer: "Veilige bankoverschrijving met automatische bevestiging. U hoeft ons niet te informeren!",
    madePayment: "Ik heb de betaling gedaan",
    noAccountToCopy: "Geen rekeningnummer om te kopiëren.",
    paymentNotVerified: "Betaling niet geverifieerd.",
  },
};

let added = 0;
for (const lang of LOCALES) {
  const file = path.join(BASE, lang, "common.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.checkout = data.checkout || {};
  for (const [k, v] of Object.entries(checkout[lang])) {
    if (data.checkout[k] === undefined) {
      data.checkout[k] = v;
      added++;
    }
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`✓ ${lang}/common.json updated`);
}
console.log(`Done. ${added} keys added across ${LOCALES.length} locales.`);
