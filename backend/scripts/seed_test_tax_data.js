/**
 * seed_test_tax_data.js
 *
 * Seeds synthetic tax-bearing data so the Phase B.4 + Phase C tax UI
 * (which correctly renders CONDITIONALLY on `tax > 0 || reverse_charge`) can be
 * visually verified end-to-end against LIVE Railway PG WITHOUT running actual
 * EU B2C crypto checkouts.
 *
 * Usage:
 *   node scripts/seed_test_tax_data.js seed        # insert 2 orders + 2 txs + set merchant VAT ID
 *   node scripts/seed_test_tax_data.js cleanup     # delete all seed rows + restore merchant VAT ID
 *
 * SAFETY:
 *   - Only touches merchant_user_id=1 (hostbay). Records the ORIGINAL
 *     merchant_vat_id / merchant_country_code before overwriting; cleanup
 *     restores exact original values.
 *   - Test identifiers: public_ref='testtax<hex>', buyer_email='testing-agent-tax@dynopay.test',
 *     tbl_user_transaction.id starts with 'testtax-' + reference contains 'TESTTAX'.
 *     All cleanup queries filter on these markers.
 *   - Idempotent: `cleanup` first, then `seed` gives a fresh state every run.
 *   - Backup metadata is stashed in /tmp/tax_seed_backup.json.
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL missing'); process.exit(1); }

const s = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

const MERCHANT_USER_ID = 1;   // hostbay
const COMPANY_ID = 1;
const BUYER_EMAIL = 'testing-agent-tax@dynopay.test';
const PREF_PREFIX = 'testtax';
const TX_ID_PREFIX = 'testtax-';
const TX_REF_PREFIX = 'TESTTAX-';
const BACKUP_FILE = '/tmp/tax_seed_backup.json';
const NOW_ISO = new Date().toISOString();
const NOW_MINUS_1D = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
const NOW_MINUS_2D = new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString();

async function seed() {
  // 1) Backup original merchant tax settings, then set live values so the
  //    receipt page can render "Merchant VAT ID: DE999888777".
  const [origRows] = await s.query(
    'SELECT merchant_vat_id, merchant_country_code, default_apply_tax, default_tax_inclusive FROM tbl_user WHERE user_id = :uid',
    { replacements: { uid: MERCHANT_USER_ID } }
  );
  const origMerchant = origRows[0] || {};
  fs.writeFileSync(BACKUP_FILE, JSON.stringify({ origMerchant, seededAt: NOW_ISO }, null, 2));

  await s.query(
    `UPDATE tbl_user
     SET merchant_vat_id = 'DE999888777',
         merchant_country_code = 'DE',
         default_apply_tax = true,
         "updatedAt" = NOW()
     WHERE user_id = :uid`,
    { replacements: { uid: MERCHANT_USER_ID } }
  );

  // 2) Seed Order #1: DE B2C — 19% VAT on top (exclusive)
  const orderARef = `${PREF_PREFIX}A${crypto.randomBytes(6).toString('hex')}`;
  const [orderARows] = await s.query(
    `INSERT INTO tbl_product_order
       (public_ref, merchant_user_id, buyer_email, buyer_name,
        subtotal_cents, tax_cents, total_cents, currency,
        payment_status, fulfillment_status, paid_at,
        tax_rate, tax_label, tax_country_code, customer_vat_id,
        reverse_charge, tax_inclusive, shipping_cents,
        "createdAt", "updatedAt")
     VALUES
       (:pref, :muid, :buyer, 'DE B2C Test Buyer',
        10000, 1900, 11900, 'EUR',
        'paid', 'fulfilled', :now,
        19.00, 'VAT', 'DE', NULL,
        false, false, 0,
        :now, :now)
     RETURNING order_id`,
    { replacements: { pref: orderARef, muid: MERCHANT_USER_ID, buyer: BUYER_EMAIL, now: NOW_ISO } }
  );
  const orderAId = Number(orderARows[0].order_id);

  const snapA = {
    product_id: 998,
    product_type: 'digital',
    digital_delivery_type: 'url',
    title: 'Test — DE B2C VAT product (auto-seed, safe to delete)',
    subtitle: 'Verification: DE B2C 19% VAT',
    cover_image_url: null,
    currency: 'EUR',
    _test_seed: true,
  };
  await s.query(
    `INSERT INTO tbl_product_order_item
       (order_id, product_id, variant_id, quantity,
        unit_price_cents, line_total_cents,
        product_snapshot, variant_snapshot,
        fulfillment_status, delivered_payload,
        "createdAt", "updatedAt")
     VALUES
       (:oid, 998, NULL, 1,
        10000, 10000,
        :psnap, NULL,
        'fulfilled', :dp,
        :now, :now)`,
    {
      replacements: {
        oid: orderAId,
        psnap: JSON.stringify(snapA),
        dp: JSON.stringify({ access_url: 'https://example.com/de-b2c-test-access' }),
        now: NOW_ISO,
      },
    }
  );

  // 3) Seed Order #2: PT merchant + DE VAT ID buyer — cross-border EU B2B reverse-charge
  const orderBRef = `${PREF_PREFIX}B${crypto.randomBytes(6).toString('hex')}`;
  const [orderBRows] = await s.query(
    `INSERT INTO tbl_product_order
       (public_ref, merchant_user_id, buyer_email, buyer_name,
        subtotal_cents, tax_cents, total_cents, currency,
        payment_status, fulfillment_status, paid_at,
        tax_rate, tax_label, tax_country_code, customer_vat_id,
        reverse_charge, tax_inclusive, shipping_cents,
        "createdAt", "updatedAt")
     VALUES
       (:pref, :muid, :buyer, 'EU B2B Reverse-Charge Test Buyer',
        20000, 0, 20000, 'EUR',
        'paid', 'fulfilled', :now,
        0, 'VAT', 'DE', 'DE123456789',
        true, false, 0,
        :now, :now)
     RETURNING order_id`,
    { replacements: { pref: orderBRef, muid: MERCHANT_USER_ID, buyer: BUYER_EMAIL, now: NOW_ISO } }
  );
  const orderBId = Number(orderBRows[0].order_id);

  const snapB = {
    product_id: 997,
    product_type: 'digital',
    digital_delivery_type: 'url',
    title: 'Test — EU B2B Reverse-Charge product (auto-seed)',
    subtitle: 'Verification: PT→DE cross-border, VAT reverse-charged',
    cover_image_url: null,
    currency: 'EUR',
    _test_seed: true,
  };
  await s.query(
    `INSERT INTO tbl_product_order_item
       (order_id, product_id, variant_id, quantity,
        unit_price_cents, line_total_cents,
        product_snapshot, variant_snapshot,
        fulfillment_status, delivered_payload,
        "createdAt", "updatedAt")
     VALUES
       (:oid, 997, NULL, 1,
        20000, 20000,
        :psnap, NULL,
        'fulfilled', :dp,
        :now, :now)`,
    {
      replacements: {
        oid: orderBId,
        psnap: JSON.stringify(snapB),
        dp: JSON.stringify({ access_url: 'https://example.com/eu-b2b-test-access' }),
        now: NOW_ISO,
      },
    }
  );

  // 4) Seed 2 rows in tbl_user_transaction so Dashboard chip + Transactions list + Tx-details modal
  //    show non-zero tax data. company_id=1 so hostbay's dashboard picks them up.
  const txAId = `${TX_ID_PREFIX}${crypto.randomUUID()}`;
  const txARef = `${TX_REF_PREFIX}A${crypto.randomBytes(4).toString('hex')}`;
  await s.query(
    `INSERT INTO tbl_user_transaction
       (id, wallet_id, user_id, payment_mode,
        base_amount, base_currency,
        crypto_amount, crypto_currency,
        usd_value, transaction_fee, fixed_fee, blockchain_buffer_fee,
        confirmations, required_confirmations,
        transaction_reference, transaction_details,
        transaction_type, status,
        company_id, customer_id,
        tax_amount, tax_rate, tax_label, tax_country_code,
        customer_vat_id, reverse_charge,
        "createdAt", "updatedAt")
     VALUES
       (:tid, 4, :uid, 'CRYPTO',
        119, 'EUR',
        119, 'USDT-TRC20',
        119, 0, 0, 0,
        6, 6,
        :ref, 'Test tax-bearing tx (DE B2C 19% VAT)',
        'CREDIT', 'successful',
        :cid, NULL,
        19.00, 19.00, 'VAT', 'DE',
        NULL, false,
        :now, :now)`,
    { replacements: { tid: txAId, uid: MERCHANT_USER_ID, ref: txARef, cid: COMPANY_ID, now: NOW_MINUS_1D } }
  );

  const txBId = `${TX_ID_PREFIX}${crypto.randomUUID()}`;
  const txBRef = `${TX_REF_PREFIX}B${crypto.randomBytes(4).toString('hex')}`;
  await s.query(
    `INSERT INTO tbl_user_transaction
       (id, wallet_id, user_id, payment_mode,
        base_amount, base_currency,
        crypto_amount, crypto_currency,
        usd_value, transaction_fee, fixed_fee, blockchain_buffer_fee,
        confirmations, required_confirmations,
        transaction_reference, transaction_details,
        transaction_type, status,
        company_id, customer_id,
        tax_amount, tax_rate, tax_label, tax_country_code,
        customer_vat_id, reverse_charge,
        "createdAt", "updatedAt")
     VALUES
       (:tid, 4, :uid, 'CRYPTO',
        200, 'EUR',
        200, 'USDT-TRC20',
        200, 0, 0, 0,
        6, 6,
        :ref, 'Test tax-bearing tx (EU B2B reverse-charge)',
        'CREDIT', 'successful',
        :cid, NULL,
        0, 0, 'VAT', 'DE',
        'DE123456789', true,
        :now, :now)`,
    { replacements: { tid: txBId, uid: MERCHANT_USER_ID, ref: txBRef, cid: COMPANY_ID, now: NOW_MINUS_2D } }
  );

  // 5) Bust the dashboard cache (120s Redis) — best effort, non-fatal.
  try {
    const { redisInstance } = require('../utils/redisInstance');
    // Redis instance may not be exportable this way in TS build; skip if fails.
    if (redisInstance && redisInstance.del) {
      await redisInstance.del(`dashboard-stats-${MERCHANT_USER_ID}`);
    }
  } catch { /* ignore */ }

  console.log(JSON.stringify({
    ok: true,
    orders: [
      { order_id: orderAId, public_ref: orderARef, scenario: 'DE B2C 19% VAT', total: '€119.00' },
      { order_id: orderBId, public_ref: orderBRef, scenario: 'EU B2B Reverse-Charge', total: '€200.00' },
    ],
    transactions: [
      { id: txAId, reference: txARef, scenario: 'DE B2C 19% VAT', tax_amount: 19.00 },
      { id: txBId, reference: txBRef, scenario: 'EU B2B Reverse-Charge', tax_amount: 0, reverse_charge: true },
    ],
    merchant_vat_set: 'DE999888777',
    merchant_country_set: 'DE',
    receipt_urls: {
      de_b2c: `/order/${orderARef}`,
      reverse_charge: `/order/${orderBRef}`,
    },
    backup_file: BACKUP_FILE,
    note: 'Dashboard chip has 120s Redis cache — may take up to 2 min to reflect if cache was warm.',
  }, null, 2));
}

async function cleanup() {
  // 1) Delete synthetic product orders + items (safety: 3 match filters)
  const [orderRows] = await s.query(
    `SELECT order_id, public_ref FROM tbl_product_order
     WHERE (public_ref LIKE :pref OR buyer_email = :buyer)
       AND buyer_email = :buyer`,
    { replacements: { pref: `${PREF_PREFIX}%`, buyer: BUYER_EMAIL } }
  );
  const orderIds = orderRows.map((r) => Number(r.order_id));
  if (orderIds.length > 0) {
    await s.query(`DELETE FROM tbl_product_order_item WHERE order_id IN (${orderIds.join(',')})`);
    await s.query(`DELETE FROM tbl_product_order WHERE order_id IN (${orderIds.join(',')})`);
  }

  // 2) Delete synthetic tbl_user_transaction rows
  const [txDel] = await s.query(
    `DELETE FROM tbl_user_transaction
     WHERE id LIKE :idpref OR transaction_reference LIKE :refpref
     RETURNING transaction_id, id`,
    { replacements: { idpref: `${TX_ID_PREFIX}%`, refpref: `${TX_REF_PREFIX}%` } }
  );

  // 3) Restore original merchant tax settings (only if backup exists AND we set them)
  let restored = null;
  if (fs.existsSync(BACKUP_FILE)) {
    try {
      const backup = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf-8'));
      const orig = backup.origMerchant || {};
      await s.query(
        `UPDATE tbl_user
         SET merchant_vat_id = :vat,
             merchant_country_code = :cc,
             default_apply_tax = :dat,
             default_tax_inclusive = :dti,
             "updatedAt" = NOW()
         WHERE user_id = :uid`,
        {
          replacements: {
            vat: orig.merchant_vat_id === undefined ? null : orig.merchant_vat_id,
            cc: orig.merchant_country_code === undefined ? null : orig.merchant_country_code,
            dat: orig.default_apply_tax === undefined ? false : orig.default_apply_tax,
            dti: orig.default_tax_inclusive === undefined ? false : orig.default_tax_inclusive,
            uid: MERCHANT_USER_ID,
          },
        }
      );
      restored = orig;
      try { fs.unlinkSync(BACKUP_FILE); } catch { /* ignore */ }
    } catch (e) {
      console.error('WARNING: backup restore failed:', e.message);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    deleted_orders: orderIds.length,
    order_refs: orderRows.map((r) => r.public_ref),
    deleted_txs: (txDel || []).length,
    tx_ids: (txDel || []).map((r) => r.id),
    merchant_settings_restored: restored,
  }, null, 2));
}

(async () => {
  try {
    const cmd = (process.argv[2] || '').toLowerCase();
    if (cmd === 'seed') await seed();
    else if (cmd === 'cleanup') await cleanup();
    else { console.error('Usage: node seed_test_tax_data.js [seed|cleanup]'); process.exit(2); }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await s.close();
  }
})();
