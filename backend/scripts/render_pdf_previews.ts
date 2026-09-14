/**
 * Render sample PDF receipt + fee invoice (EN + DE) for visual review — no DB, no email.
 * Run from backend/:  npx ts-node --transpile-only scripts/render_pdf_previews.ts <outDir>
 * Then rasterize:     python3 scripts/pdf_to_png.py <outDir>
 */
import * as fs from "fs";
import * as path from "path";
import { generatePaymentReceipt } from "../services/pdfReceiptService";
import { generateInvoicePDF } from "../services/pdfService";

const OUT = process.argv[2] || "/app/memory/pdf_previews/current";
fs.mkdirSync(OUT, { recursive: true });

const streamToBuffer = (doc: PDFKit.PDFDocument): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

(async () => {
  const when = new Date("2026-09-06T10:15:00Z");

  for (const L of ["en", "de"]) {
    // --- Receipt: realistic settled crypto payment with breakdown + description ---
    const receipt = await generatePaymentReceipt({
      transactionId: "a3f9c2e1-7b4d-4e8a-9c21-5d6f7e8a9b0c",
      transactionReference: "0x9f8e7d6c5b4a39281706f5e4d3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a",
      amount: "250.00",
      currency: "USD",
      cryptoAmount: "0.00312450",
      cryptoCurrency: "BTC",
      companyName: "The Dev Store",
      merchantVerified: true,
      customerEmail: "sam.buyer@example.com",
      customerName: "Sam Buyer",
      paymentDate: when,
      description: "Pro plan — annual licence (1 seat)",
      lang: L,
      breakdown: { merchantReceives: "0.00307766 BTC", platformFee: "0.00004684 BTC", feePayer: "customer" },
    });
    fs.writeFileSync(path.join(OUT, `receipt.${L}.pdf`), receipt);

    // --- Receipt: minimal (no name, no description, no breakdown, unverified) ---
    if (L === "en") {
      const minimal = await generatePaymentReceipt({
        transactionId: "b7d1e0f2-3c4a-4b5d-8e9f-0a1b2c3d4e5f",
        amount: "49.99",
        currency: "EUR",
        cryptoAmount: "52.130000",
        cryptoCurrency: "USDT-TRC20",
        companyName: "Hostbay",
        customerEmail: "buyer@example.com",
        paymentDate: when,
        lang: L,
      });
      fs.writeFileSync(path.join(OUT, `receipt.minimal.${L}.pdf`), minimal);
    }

    // --- Fee invoice (v2, merchant display currency EUR, VAT 20%) ---
    const inv = generateInvoicePDF({
      invoice_number: "DP-2026-000214",
      invoice_date: when,
      provider_name: "Dynopay Innovations, LTD",
      provider_address: "",
      provider_vat_id: "",
      customer_name: "The Dev Store Ltd",
      customer_address: "12 Market Street\nDublin\nD02 X285\nIreland",
      customer_tax_id: "IE1234567T",
      description: "Payment processing service – Transaction 0x9f8e7d6c5b4a3928",
      unit_price: 3.75,
      quantity: 1,
      vat_rate: 20,
      vat_amount: 0.75,
      fixed_fee: 0.25,
      transaction_fee_percent: 1.4,
      blockchain_buffer_percent: 0,
      total_usd: 4.5,
      transaction_amount: 250,
      invoice_version: "v2",
      total_crypto: 0.00005625,
      crypto_currency: "BTC",
      payment_terms: "Settled automatically from the transaction proceeds – no payment due",
      transaction_id: 4821,
      display_currency: "EUR",
      usd_to_display_rate: 0.92,
      lang: L,
    } as any);
    fs.writeFileSync(path.join(OUT, `invoice.${L}.pdf`), await streamToBuffer(inv));
  }
  console.log(`PDFs written -> ${OUT}`);
  console.log(fs.readdirSync(OUT).filter((f) => f.endsWith(".pdf")).join(", "));

  // Hard guard: every receipt/invoice must be exactly ONE page (pdfkit used to
  // auto-paginate the receipt across up to 6 pages when the footer crossed the margin).
  let bad = 0;
  for (const f of fs.readdirSync(OUT).filter((n) => n.endsWith(".pdf"))) {
    const pages = (fs.readFileSync(path.join(OUT, f)).toString("latin1").match(/\/Type\s*\/Page(?!s)/g) || []).length;
    if (pages !== 1) {
      bad++;
      console.log(`  PAGE-COUNT FAIL: ${f} has ${pages} pages`);
    }
  }
  console.log(bad === 0 ? "ALL PDFs are single-page" : `${bad} PDF(s) are NOT single-page`);
  process.exit(bad === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
