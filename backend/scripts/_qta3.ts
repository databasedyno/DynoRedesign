import 'dotenv/config';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

const PAYMENT_ID = '0a5bd34d-6443-4d3b-8442-7cd5f86fe7a2';
const ADDR = '0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc';
const HOSTBAY_EMAIL = 'hostbay@moxx.co';

async function main() {
  try {
    await sequelize.authenticate();

    // 1) Find users table
    const userTables: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE 'tbl_user%' ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('User-related tables:', userTables.map(t => t.table_name).join(', '));

    // 2) Look up hostbay
    for (const t of ['tbl_user', 'tbl_users', 'tbl_user_data', 'tbl_user_details']) {
      try {
        const rows: any[] = await sequelize.query(
          `SELECT * FROM public."${t}" WHERE LOWER(email) = LOWER($1) LIMIT 1`,
          { bind: [HOSTBAY_EMAIL], type: QueryTypes.SELECT }
        );
        if (rows.length > 0) {
          console.log(`\n=== ${t} row for hostbay ===`);
          const r = rows[0];
          console.log(JSON.stringify({ ...r, password: r.password ? '<redacted>' : null }, null, 2));
          break;
        }
      } catch (e) { /* skip */ }
    }

    // 3) Find payment table
    const paymentTables: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%payment%' OR table_name ILIKE '%transaction%') ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('\nPayment/transaction tables:', paymentTables.map(t => t.table_name).join(', '));

    // 4) Try to find payment 0a5bd34d in every payment-related table with payment_id column
    for (const t of paymentTables) {
      try {
        const cols: any[] = await sequelize.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
          { bind: [t.table_name], type: QueryTypes.SELECT }
        );
        const hasPid = cols.some(c => ['payment_id', 'id', 'external_payment_id'].includes(c.column_name));
        if (!hasPid) continue;
        const colName = cols.some(c => c.column_name === 'payment_id') ? 'payment_id' : (cols.some(c => c.column_name === 'external_payment_id') ? 'external_payment_id' : 'id');
        const rows: any[] = await sequelize.query(
          `SELECT * FROM public."${t.table_name}" WHERE "${colName}"::text = $1 LIMIT 5`,
          { bind: [PAYMENT_ID], type: QueryTypes.SELECT }
        );
        if (rows.length > 0) {
          console.log(`\n=== ${t.table_name}.${colName} matches ===`);
          console.log(JSON.stringify(rows, null, 2));
        }
      } catch (e) { /* skip */ }
    }

    // 5) Merchant temp address full state
    const mta: any[] = await sequelize.query(
      `SELECT * FROM tbl_merchant_temp_address WHERE temp_address_id = 7`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n=== tbl_merchant_temp_address temp_id=7 full ===');
    const cleaned = mta.map((r: any) => ({ ...r, private_key: r.private_key ? '<redacted>' : null, cached_qr_code: r.cached_qr_code ? '<qr...>' : null }));
    console.log(JSON.stringify(cleaned, null, 2));

    // 6) Check journal for this specific new payment
    const journal: any[] = await sequelize.query(
      `SELECT * FROM tbl_payment_journal WHERE payment_id = $1 ORDER BY created_at ASC`,
      { bind: [PAYMENT_ID], type: QueryTypes.SELECT }
    );
    console.log(`\n=== journal for payment ${PAYMENT_ID} (${journal.length} entries) ===`);
    console.log(JSON.stringify(journal, null, 2));

    // 7) Check if a webhook_event or notification table exists
    const wh: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%webhook%' OR table_name ILIKE '%notif%') ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('\nWebhook/notification tables:', wh.map(t => t.table_name).join(', '));

    for (const t of wh) {
      try {
        const cols: any[] = await sequelize.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1`,
          { bind: [t.table_name], type: QueryTypes.SELECT }
        );
        console.log(`${t.table_name}:`, cols.map(c => c.column_name).join(', '));
        // Search for this payment_id
        for (const cn of ['payment_id', 'external_payment_id', 'reference', 'ref_id']) {
          if (cols.some(c => c.column_name === cn)) {
            const rows: any[] = await sequelize.query(
              `SELECT * FROM public."${t.table_name}" WHERE "${cn}"::text = $1 ORDER BY 1 DESC LIMIT 5`,
              { bind: [PAYMENT_ID], type: QueryTypes.SELECT }
            );
            if (rows.length > 0) {
              console.log(`  >>> ${rows.length} rows in ${t.table_name} for ${cn}=${PAYMENT_ID}`);
              console.log(JSON.stringify(rows, null, 2));
            }
          }
        }
      } catch (e) { /* skip */ }
    }

    // 8) Look for company 1
    const company: any[] = await sequelize.query(
      `SELECT company_id, company_name, user_id, settlement_wallet_address, "createdAt" FROM tbl_company WHERE company_id = 1`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n=== company_id=1 ===');
    console.log(JSON.stringify(company, null, 2));

  } catch (e: any) {
    console.error('ERROR:', e.message, e.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}
main();
