import { t } from "../utils/emailI18n";
import { generatePaymentReceipt } from "../services/pdfReceiptService";

(async () => {
  const langs = ["en", "pt", "es", "fr", "de", "nl"];
  console.log("=== t() rendering checks ===");
  const samples: Array<[string, Record<string, unknown>]> = [
    ["paymentReceived.subject", { amount: "100.00", currency: "USDT" }],
    ["paymentReceived.intro", { companyName: "Acme" }],
    ["paymentConfirming.confirmationsOf", { current: 1, required: 3 }],
    ["customerPaymentConfirmation.subject", { companyName: "Acme" }],
    ["paymentFailed.reasonUnderpaid", { paidAmount: "5", currency: "BTC", amount: "10" }],
    ["receipt.title", {}],
  ];
  let bad = 0;
  for (const l of langs) {
    for (const [key, vars] of samples) {
      const out = t(key, l, vars);
      if (out === key || out.includes("{{")) { console.log(`  BAD [${l}] ${key} -> ${out}`); bad++; }
    }
  }
  console.log(bad === 0 ? "  ALL KEYS RENDER OK" : `  ${bad} ISSUES`);
  console.log("  fr subject:", t("paymentReceived.subject", "fr", { amount: "100.00", currency: "USDT" }));
  console.log("  de intro:", t("paymentReceived.intro", "de", { companyName: "Acme" }));

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
