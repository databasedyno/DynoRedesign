/**
 * seed_test_file_order.js
 *
 * Seeds a synthetic PAID order with `digital_delivery_type='file'` and a
 * populated `delivered_payload.asset_deliveries[]` payload so the frontend
 * receipt page's download UI can be verified end-to-end WITHOUT running the
 * real crypto-settlement webhook (which is gated by WORKER_ROLE=secondary
 * on this preview pod).
 *
 * Usage:
 *   node scripts/seed_test_file_order.js seed        # insert & print public_ref
 *   node scripts/seed_test_file_order.js cleanup     # delete any TEST-* orders
 *
 * Idempotent — safe to run repeatedly. The seeded order has:
 *   - buyer_email = 'testing-agent@dynopay.test'
 *   - public_ref starting with 'testfiledlv' (predictable prefix)
 *   - product_snapshot marking it as a synthetic test order
 *
 * IMPORTANT: this script writes to the LIVE Railway PG shared with prod,
 * so we always cleanup on request. The order has NO payment_link_id (avoids
 * any accidental webhook fan-out re-run).
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL missing');
  process.exit(1);
}

const s = new Sequelize(DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: { ssl: { require: true, rejectUnauthorized: false } },
});

const TEST_PREFIX = 'testfiledlv';
const MERCHANT_USER_ID = 1;   // hostbay
const NOW_ISO = new Date().toISOString();

async function seed() {
  const publicRef = `${TEST_PREFIX}${crypto.randomBytes(8).toString('hex')}`;
  const expEpoch = Math.floor(Date.now() / 1000) + 24 * 3600;
  const expiresAtIso = new Date(expEpoch * 1000).toISOString();

  // Deterministic fake signed URL (matches the format the fulfillment service
  // mints — even though we're not passing a real signature, the RECEIPT PAGE
  // just needs to render the Download button. Actual download endpoint is
  // covered by backend tests separately.)
  const fakeToken = `${expEpoch}.deadbeefdeadbeefdeadbeefdeadbeef`;
  const serverBase = (
    process.env.SERVER_URL ||
    process.env.FRONTEND_URL ||
    'https://example.com'
  ).replace(/\/+$/, '');

  const assetDeliveries = [
    {
      asset_id: 999001,
      filename: 'sample-ebook-chapter-1.pdf',
      size_bytes: 812345,
      mime_type: 'application/pdf',
      download_token: fakeToken,
      expires_at: expiresAtIso,
      download_url: `${serverBase}/api/order/${publicRef}/download/999001?t=${fakeToken}`,
    },
    {
      asset_id: 999002,
      filename: 'bonus-worksheet.pdf',
      size_bytes: 214980,
      mime_type: 'application/pdf',
      download_token: fakeToken,
      expires_at: expiresAtIso,
      download_url: `${serverBase}/api/order/${publicRef}/download/999002?t=${fakeToken}`,
    },
  ];

  const orderInsert = `
    INSERT INTO tbl_product_order
      (public_ref, merchant_user_id, buyer_email, buyer_name,
       subtotal_cents, total_cents, currency,
       payment_status, fulfillment_status, paid_at,
       tax_cents, shipping_cents, "createdAt", "updatedAt")
    VALUES
      (:pref, :muid, 'testing-agent@dynopay.test', 'Test Buyer',
       1999, 1999, 'USD',
       'paid', 'fulfilled', :now,
       0, 0, :now, :now)
    RETURNING order_id
  `;
  const [orderRows] = await s.query(orderInsert, {
    replacements: { pref: publicRef, muid: MERCHANT_USER_ID, now: NOW_ISO },
  });
  const orderId = Number(orderRows[0].order_id);

  const productSnapshot = {
    product_id: 999,
    product_type: 'digital',
    digital_delivery_type: 'file',
    title: 'Test — File Digital Delivery (auto-seeded, safe to delete)',
    subtitle: 'Verification seed — 2 file downloads',
    cover_image_url: null,
    currency: 'USD',
    _test_seed: true,
  };

  const itemInsert = `
    INSERT INTO tbl_product_order_item
      (order_id, product_id, variant_id, quantity,
       unit_price_cents, line_total_cents,
       product_snapshot, variant_snapshot,
       fulfillment_status, delivered_payload,
       "createdAt", "updatedAt")
    VALUES
      (:oid, 999, NULL, 1,
       1999, 1999,
       :psnap, NULL,
       'fulfilled', :dp,
       :now, :now)
    RETURNING order_item_id
  `;
  const [itemRows] = await s.query(itemInsert, {
    replacements: {
      oid: orderId,
      psnap: JSON.stringify(productSnapshot),
      dp: JSON.stringify({ asset_deliveries: assetDeliveries }),
      now: NOW_ISO,
    },
  });

  console.log(JSON.stringify({
    ok: true,
    order_id: orderId,
    order_item_id: Number(itemRows[0].order_item_id),
    public_ref: publicRef,
    receipt_url_relative: `/order/${publicRef}`,
    api_url_relative: `/api/order/${publicRef}`,
    asset_deliveries_count: assetDeliveries.length,
    expires_at: expiresAtIso,
  }, null, 2));
}

async function cleanup() {
  // Find all test orders (safety: only those matching TEST_PREFIX AND our synthetic buyer email)
  const [orders] = await s.query(
    `SELECT order_id, public_ref FROM tbl_product_order
     WHERE public_ref LIKE :pref AND buyer_email = 'testing-agent@dynopay.test'`,
    { replacements: { pref: `${TEST_PREFIX}%` } }
  );
  if (orders.length === 0) {
    console.log(JSON.stringify({ ok: true, deleted: 0, note: 'no test orders found' }));
    return;
  }
  const ids = orders.map((r) => Number(r.order_id));
  await s.query(
    `DELETE FROM tbl_product_order_item WHERE order_id IN (${ids.join(',')})`
  );
  await s.query(
    `DELETE FROM tbl_product_order WHERE order_id IN (${ids.join(',')})`
  );
  console.log(JSON.stringify({
    ok: true,
    deleted: orders.length,
    order_ids: ids,
    public_refs: orders.map((r) => r.public_ref),
  }));
}

(async () => {
  try {
    const cmd = (process.argv[2] || '').toLowerCase();
    if (cmd === 'seed') await seed();
    else if (cmd === 'cleanup') await cleanup();
    else {
      console.error('Usage: node seed_test_file_order.js [seed|cleanup]');
      process.exit(2);
    }
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  } finally {
    await s.close();
  }
})();
