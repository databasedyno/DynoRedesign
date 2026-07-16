/**
 * Read-only inspection of hostbay (user_id=1 / company_id=1) transactions.
 * Identifies TEST/synthetic rows and shows the source.type each tx would map to.
 */
require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL missing'); process.exit(1); }

const s = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

const COMPANY_ID = 1;

(async () => {
  try {
    // All transactions "owned" by hostbay (coalesce customer company, else ut.company_id)
    const rows = await s.query(
      `SELECT ut.id, ut.transaction_id, ut.transaction_reference, ut.base_amount, ut.base_currency,
              ut.status, ut."createdAt", ut.customer_id, ut.company_id,
              pl.link_id AS source_link_id, pl.link_type AS source_link_type, pl.title AS source_link_title,
              pl.parent_link_id AS source_parent_link_id, pl.is_tip_jar AS source_is_tip_jar,
              po.order_id AS source_order_id
       FROM tbl_user_transaction ut
       LEFT JOIN tbl_customer c ON c.customer_id = ut.customer_id
       LEFT JOIN (
         SELECT DISTINCT ON (transaction_reference)
           transaction_reference, link_id, link_type, title, parent_link_id, is_tip_jar
         FROM tbl_payment_link
         WHERE transaction_reference IS NOT NULL AND transaction_reference <> ''
         ORDER BY transaction_reference, link_id DESC
       ) pl ON pl.transaction_reference = ut.transaction_reference
         AND ut.transaction_reference IS NOT NULL AND ut.transaction_reference <> ''
       LEFT JOIN tbl_product_order po ON po.payment_link_id = pl.link_id
       WHERE COALESCE(c.company_id, ut.company_id) = :cid
       ORDER BY ut."createdAt" DESC`,
      { type: QueryTypes.SELECT, replacements: { cid: COMPANY_ID } }
    );

    const srcType = (r) => {
      if (r.source_order_id) return 'product';
      if (r.source_link_type === 'contribution') return r.source_is_tip_jar ? 'tip(?)' : 'contribution';
      if (r.source_link_id) return 'payment_link';
      return 'direct';
    };
    const isTest = (r) =>
      (r.id && String(r.id).toLowerCase().startsWith('testtax-')) ||
      (r.transaction_reference && String(r.transaction_reference).toUpperCase().startsWith('TESTTAX-')) ||
      (r.transaction_reference && String(r.transaction_reference).toLowerCase().startsWith('testfiledlv'));

    console.log(`\n=== hostbay (company_id=${COMPANY_ID}) transactions: ${rows.length} total ===`);
    const bySource = {};
    let testCount = 0;
    rows.forEach((r) => {
      const st = srcType(r);
      bySource[st] = (bySource[st] || 0) + 1;
      const test = isTest(r);
      if (test) testCount++;
      console.log(
        `${test ? '[TEST] ' : '       '}id=${r.id} ref=${r.transaction_reference || '-'} ` +
        `amt=${r.base_amount} ${r.base_currency} status=${r.status} source=${st} ` +
        `link_id=${r.source_link_id || '-'} order_id=${r.source_order_id || '-'} createdAt=${r.createdAt}`
      );
    });
    console.log(`\n=== source breakdown ===`, bySource);
    console.log(`=== rows matching TEST markers (testtax-/TESTTAX-/testfiledlv): ${testCount} ===`);

    // Product orders tied to hostbay test markers
    const orders = await s.query(
      `SELECT order_id, public_ref, buyer_email, total_cents, currency, merchant_user_id, "createdAt"
       FROM tbl_product_order
       WHERE public_ref LIKE 'testtax%' OR public_ref LIKE 'testfiledlv%'
          OR buyer_email IN ('testing-agent-tax@dynopay.test','testing-agent@dynopay.test')
       ORDER BY "createdAt" DESC`,
      { type: QueryTypes.SELECT }
    );
    console.log(`\n=== test product_orders: ${orders.length} ===`);
    orders.forEach((o) => console.log(`  order_id=${o.order_id} ref=${o.public_ref} buyer=${o.buyer_email} total=${o.total_cents} ${o.currency} merchant_user_id=${o.merchant_user_id}`));

    // Current merchant tax settings on hostbay (seed set fake VAT ID)
    const u = await s.query(
      `SELECT user_id, merchant_vat_id, merchant_country_code, default_apply_tax, default_tax_inclusive FROM tbl_user WHERE user_id = 1`,
      { type: QueryTypes.SELECT }
    );
    console.log(`\n=== hostbay merchant tax settings ===`, u[0]);

    await s.close();
  } catch (e) {
    console.error('INSPECT ERROR:', e.message);
    process.exit(1);
  }
})();
