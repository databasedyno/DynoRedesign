// Seeds TWO checkout sessions into the PREVIEW Redis only (not prod), mirroring
// Emmanuel's live campaign (link 682) + an existing child contribution (link 693)
// so the donor hand-off bug can be reproduced/verified without writing to the
// prod DB. getData only SELECTs the referenced rows. Run from /app/backend:
//   node ../memory/tmp/qa/seed_preview_donation_sessions.js
require('/app/backend/node_modules/dotenv').config({ path: '/app/backend/.env' });
const { createClient } = require('/app/backend/node_modules/redis');
(async () => {
  const c = createClient({ url: process.env.REDIS_PUBLIC_URL || process.env.REDIS_URL });
  await c.connect();
  const base = {
    email: null, allowedModes: 'CRYPTO', base_currency: 'USD', user_id: 359, adm_id: 359, company_id: 366,
    callback_url: null, redirect_url: null, webhook_url: null, fee_payer: 'company', apply_tax: false, tax_inclusive: false,
    accepted_currencies: 'USDT-TRC20,TRX', customer_name: null, pathType: 'createLink',
    available_currencies: ['USDT-TRC20', 'TRX'], all_configured_currencies: ['USDT-TRC20', 'TRX'],
    createdAt: new Date().toISOString(),
  };
  const parent = {
    ...base, transaction_id: 'qa-parent-682', base_amount: 0, link_type: 'donation', link_id: 682,
    title: 'HELP SAVE KEZA DIVIN — $7,000 FOR CANCER TREATMENT', goal_amount: 7000, min_amount: 10,
    allow_custom_amount: true, show_progress: true, show_supporters: true, auto_close_at_goal: false,
    payment_link: 'https://checkout.dynopay.com/pay?d=QAPAR1', description: null, expires_at: null,
  };
  const child = {
    ...base, transaction_id: 'qa-child-693', base_amount: 50, link_type: 'contribution', link_id: 693, parent_link_id: 682,
    payment_link: 'https://checkout.dynopay.com/pay?d=QACHD1', description: parent.title,
    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(), donor_name: null, donor_message: null, is_anonymous: true,
  };
  await c.set('customer-QAPAR1:json', JSON.stringify(parent), { EX: 6 * 3600 });
  await c.set('customer-QACHD1:json', JSON.stringify(child), { EX: 6 * 3600 });
  console.log('seeded customer-QAPAR1 (campaign parent, amount 0) + customer-QACHD1 (child, $50) in preview Redis, TTL 6h');
  await c.quit();
})().catch((e) => { console.error(e.message); process.exit(1); });
