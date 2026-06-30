import { t } from "../utils/emailI18n";
import { generatePaymentReceipt } from "../services/pdfReceiptService";

const fs = require("fs");

(async () => {
  const langs = ["en", "pt", "es", "fr", "de", "nl"];
  const vars = {
    name: "Alex", companyName: "Acme", amount: "100.00", currency: "USDT",
    count: 3, oldEmail: "a@x.com", email: "b@x.com", accountHolderName: "Alex",
    network: "Tron", otherParty: "Bob", symbol: "$", volume: "5,000", threshold: "5,000",
    payoutAmount: "98.00", targetCurrency: "USDT", sourceAmount: "0.0025", sourceCurrency: "BTC",
    planName: "Pro", effectiveDate: "01 Jul 2026", transactionId: "TX123", number: "INV-1",
    periodStart: "01 Jun", periodEnd: "07 Jun", completed: 4, pending: 2, keyType: "production",
  } as Record<string, unknown>;

  const flat = (o: any, p = ""): string[] =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, p + k + ".") : [p + k]));
  const en = JSON.parse(fs.readFileSync("locales/en/emails.json", "utf8"));
  const keys = flat(en.merchant, "merchant.");

  console.log("=== merchant catalog render checks ===");
  let bad = 0;
  for (const l of langs) {
    for (const key of keys) {
      const out = t(key, l, vars);
      if (out === key || out.includes("{{") || out.includes("}}")) {
        console.log(`  BAD [${l}] ${key} -> ${out}`);
        bad++;
      }
    }
  }
  console.log(bad === 0 ? `  ALL ${keys.length} KEYS × ${langs.length} LANGS RENDER OK` : `  ${bad} ISSUES`);

  // Spot-check a few subjects/bodies
  console.log("  de welcome.subject:", t("merchant.welcome.subject", "de"));
  console.log("  fr withdrawalOtp.intro:", t("merchant.withdrawalOtp.intro", "fr", vars));
  console.log("  es kycRequired.subject:", t("merchant.kycRequired.subject", "es", vars));

  console.log("=== PDF generation with lang ===");
  for (const l of ["en", "de", "fr"]) {
    const buf = await generatePaymentReceipt({
      transactionId: "abc12345deadbeef", transactionReference: "REF-001",
      amount: "100.00", currency: "USD", cryptoAmount: "0.0025", cryptoCurrency: "BTC",
      companyName: "Acme Corp", customerEmail: "buyer@example.com", customerName: "Buyer",
      paymentDate: new Date(), description: "Test order",
      paymentMethod: t("receipt.cryptocurrency", l) + " (BTC)", status: t("receipt.completed", l), lang: l,
    });
    console.log(`  [${l}] PDF bytes:`, buf.length, buf.length > 1000 ? "OK" : "TOO SMALL");
  }
  process.exit(0);
})().catch((e) => { console.error("ERR", e); process.exit(1); });
