/**
 * Seed (or remove) ONE test receipt snapshot so the public /receipt/<token>
 * page + API can be exercised without creating a real payment.
 *
 *   npx ts-node --transpile-only scripts/seed_test_receipt.ts            -> prints token + URLs
 *   npx ts-node --transpile-only scripts/seed_test_receipt.ts --cleanup  -> deletes the test rows
 *
 * The row is keyed by dedupe_key "id:TEST-RECEIPT-SEED" (fixed) so re-running is
 * idempotent and cleanup is exact. Touches ONLY tbl_payment_receipt.
 */
import { paymentReceiptModel } from "../models";
import { ensureReceiptLink, buildReceiptPdfUrl } from "../services/receiptLinkService";

const DEDUPE_ID = "TEST-RECEIPT-SEED";

(async () => {
  if (process.argv.includes("--cleanup")) {
    const n = await paymentReceiptModel.destroy({ where: { dedupe_key: `id:${DEDUPE_ID}` } });
    console.log(`removed ${n} test receipt row(s)`);
    process.exit(0);
  }
  const link = await ensureReceiptLink(
    {
      transactionId: DEDUPE_ID,
      transactionReference: undefined, // no on-chain hash -> dedupe falls back to id:
      amount: "250.00",
      currency: "USD",
      cryptoAmount: "0.00312450",
      cryptoCurrency: "BTC",
      companyName: "Dynopay Test Merchant",
      merchantVerified: true,
      customerEmail: "sam.buyer@example.com",
      customerName: "Sam Buyer",
      paymentDate: new Date("2026-09-06T10:15:00Z"),
      description: "Pro plan — annual licence (1 seat)",
      lang: "en",
      breakdown: { merchantReceives: "0.00307766 BTC", platformFee: "0.00004684 BTC", feePayer: "customer" },
    },
    null
  );
  if (!link) {
    console.log("FAILED to create test receipt");
    process.exit(1);
  }
  console.log(JSON.stringify({ token: link.token, url: link.url, pdf: buildReceiptPdfUrl(link.token) }, null, 2));
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
