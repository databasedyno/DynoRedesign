/**
 * Iteration 66 — Tax Receipts Label
 *
 * Renders 4 fixture orders (GB, DE reverse-charge, SG, ES) through
 * sendOrderReceiptEmail while stubbing mailTransporter to capture the
 * rendered HTML. Asserts:
 *   - per-country tax label appears (VAT/GST/IVA/TVA/Tax)
 *   - tax rate percentage is inline with the label (e.g. "VAT (20%)")
 *   - reverse-charge note appears iff order.reverse_charge=true
 *   - "Merchant <VAT> ID: <id>" row appears iff merchantVatId is provided
 *
 * READ-ONLY vs DB — no rows are created, no live emails are sent.
 * Run:  npx ts-node --transpile-only backend/tests/test_iter66_tax_receipt_render.ts
 */

// Stub mailTransporter BEFORE importing the module under test so that the
// email send never leaves the process. captureError is also silenced to keep
// output clean.
const captured: Array<{ subject: string; html: string; to: string }> = [];
require.cache[require.resolve("../utils/mailTransporter")] = {
  id: require.resolve("../utils/mailTransporter"),
  filename: require.resolve("../utils/mailTransporter"),
  loaded: true,
  exports: {
    __esModule: true,
    default: async (opts: any) => {
      captured.push({ subject: opts.subject, html: opts.body, to: opts.to });
    },
  },
} as any;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { sendOrderReceiptEmail } = require("../services/email/orderEmails");

type Fixture = {
  name: string;
  order: any;
  items: any[];
  merchantVatId: string | null;
  expect: {
    labelInline: RegExp;        // e.g. /VAT.*\(20%\)/
    reverseChargeRow: boolean;
    merchantIdRow: boolean;
  };
};

const items = [
  {
    quantity: 1,
    line_total_cents: 10000,
    product_snapshot: { title: "Test Product", product_type: "digital" },
    delivered_payload: null,
  },
];

const fixtures: Fixture[] = [
  {
    name: "GB / VAT 20%",
    order: {
      public_ref: "GB123456",
      order_id: 1,
      currency: "GBP",
      subtotal_cents: 10000,
      shipping_cents: 0,
      tax_cents: 2000,
      total_cents: 12000,
      tax_rate: 20,
      tax_label: "VAT",
      tax_inclusive: false,
      reverse_charge: false,
      buyer_name: "Alice",
      buyer_email: "alice@example.com",
    },
    items,
    merchantVatId: "GB123456789",
    expect: { labelInline: /VAT[\s\S]*?\(20%\)/, reverseChargeRow: false, merchantIdRow: true },
  },
  {
    name: "DE reverse-charge / VAT 19%",
    order: {
      public_ref: "DE987654",
      order_id: 2,
      currency: "EUR",
      subtotal_cents: 20000,
      shipping_cents: 0,
      tax_cents: 0,
      total_cents: 20000,
      tax_rate: 0,
      tax_label: "VAT",
      tax_inclusive: false,
      reverse_charge: true,
      buyer_name: "Bruno",
      buyer_email: "bruno@example.com",
    },
    items,
    merchantVatId: "DE111111125",
    expect: { labelInline: /VAT/, reverseChargeRow: true, merchantIdRow: true },
  },
  {
    name: "SG / GST 9%",
    order: {
      public_ref: "SG555555",
      order_id: 3,
      currency: "SGD",
      subtotal_cents: 5000,
      shipping_cents: 0,
      tax_cents: 450,
      total_cents: 5450,
      tax_rate: 9,
      tax_label: "GST",
      tax_inclusive: true,
      reverse_charge: false,
      buyer_name: "Chen",
      buyer_email: "chen@example.com",
    },
    items,
    merchantVatId: null, // no merchant VAT ID configured
    expect: { labelInline: /GST[\s\S]*?\(9%\)/, reverseChargeRow: false, merchantIdRow: false },
  },
  {
    name: "ES / IVA 21%",
    order: {
      public_ref: "ES222222",
      order_id: 4,
      currency: "EUR",
      subtotal_cents: 15000,
      shipping_cents: 0,
      tax_cents: 3150,
      total_cents: 18150,
      tax_rate: 21,
      tax_label: "IVA",
      tax_inclusive: false,
      reverse_charge: false,
      buyer_name: "Diego",
      buyer_email: "diego@example.com",
    },
    items,
    merchantVatId: "ESA12345678",
    expect: { labelInline: /IVA[\s\S]*?\(21%\)/, reverseChargeRow: false, merchantIdRow: true },
  },
];

let passed = 0;
let failed = 0;
const failures: string[] = [];

(async () => {
  for (const fx of fixtures) {
    captured.length = 0;
    await sendOrderReceiptEmail(
      fx.order.buyer_email,
      fx.order.buyer_name,
      fx.order,
      fx.items,
      "https://example.com/order/x",
      fx.merchantVatId,
    );
    if (captured.length !== 1) {
      failed++;
      failures.push(`[${fx.name}] mailTransporter not called exactly once (got ${captured.length})`);
      continue;
    }
    const html = captured[0].html;

    const labelOk = fx.expect.labelInline.test(html);
    const rcRow = /Reverse-charge \(EU B2B\)/i.test(html);
    const merchIdRow = fx.merchantVatId
      ? new RegExp(`Merchant [^<]*ID:[\\s\\S]*?${fx.merchantVatId}`).test(html)
      : !/Merchant .*ID:/i.test(html);

    const problems: string[] = [];
    if (!labelOk) problems.push(`label+rate mismatch (want ${fx.expect.labelInline})`);
    if (rcRow !== fx.expect.reverseChargeRow) problems.push(`reverse-charge row expected=${fx.expect.reverseChargeRow} got=${rcRow}`);
    if (fx.expect.merchantIdRow !== (fx.merchantVatId ? merchIdRow : true) && !merchIdRow)
      problems.push(`merchant VAT ID row expected=${fx.expect.merchantIdRow} got=${merchIdRow}`);

    if (problems.length === 0) {
      passed++;
      console.log(`PASS  ${fx.name}`);
    } else {
      failed++;
      failures.push(`[${fx.name}] ${problems.join("; ")}`);
      console.log(`FAIL  ${fx.name}: ${problems.join("; ")}`);
    }
  }

  console.log(`\n===== ${passed} passed, ${failed} failed =====`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach(f => console.log(" - " + f));
  }
  process.exit(failed === 0 ? 0 : 1);
})().catch(err => {
  console.error("Unhandled error:", err);
  process.exit(2);
});
