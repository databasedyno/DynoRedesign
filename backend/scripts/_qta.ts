import 'dotenv/config';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

const ADDR = '0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc';

async function main() {
  try {
    await sequelize.authenticate();
    // Discover schema first
    const cols: any[] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='tbl_user_temp_address' ORDER BY ordinal_position`,
      { type: QueryTypes.SELECT }
    );
    console.log('tbl_user_temp_address columns:', cols.map(c => c.column_name).join(', '));

    const tempRows: any[] = await sequelize.query(
      `SELECT * FROM tbl_user_temp_address WHERE LOWER(wallet_address) = LOWER(:addr) ORDER BY "createdAt" DESC LIMIT 5`,
      { replacements: { addr: ADDR }, type: QueryTypes.SELECT }
    );
    console.log('\n=== tbl_user_temp_address matches ===');
    console.log(JSON.stringify(tempRows, null, 2));

    // Payment table schema
    const pcols: any[] = await sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='tbl_payments' ORDER BY ordinal_position`,
      { type: QueryTypes.SELECT }
    );
    console.log('\ntbl_payments columns:', pcols.map(c => c.column_name).join(', '));

    // Try multiple address columns on payments
    const addressCols = pcols.map(c => c.column_name).filter(n => /addr/i.test(n));
    console.log('address-like columns in tbl_payments:', addressCols);

    for (const c of addressCols) {
      const rows: any[] = await sequelize.query(
        `SELECT * FROM tbl_payments WHERE LOWER("${c}") = LOWER(:addr) ORDER BY "createdAt" DESC LIMIT 5`,
        { replacements: { addr: ADDR }, type: QueryTypes.SELECT }
      ).catch(e => { console.log(`  ${c} lookup failed:`, e.message); return []; });
      if (rows.length > 0) {
        console.log(`\n=== tbl_payments matches on ${c} (${rows.length}) ===`);
        console.log(JSON.stringify(rows, null, 2));
      }
    }

    // Find hostbay user id
    const users: any[] = await sequelize.query(
      `SELECT user_id, name, email, email_verified, "createdAt" FROM tbl_users WHERE LOWER(email) = 'hostbay@moxx.co' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    console.log('\n=== hostbay@moxx.co user ===');
    console.log(JSON.stringify(users, null, 2));

    if (users.length > 0) {
      const uid = users[0].user_id;
      // Recent temp addresses for this user
      const userTemp: any[] = await sequelize.query(
        `SELECT temp_id, user_id, wallet_type, wallet_address, status, admin_status, amount, merchant_amount, txId, adminTxId, "createdAt" FROM tbl_user_temp_address WHERE user_id = :uid ORDER BY "createdAt" DESC LIMIT 30`,
        { replacements: { uid }, type: QueryTypes.SELECT }
      );
      console.log(`\n=== hostbay temp addresses (${userTemp.length}) ===`);
      console.log(JSON.stringify(userTemp, null, 2));
    }

    // Recent webhook events / logs (any tables?)
    const tables: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND (table_name ILIKE '%webhook%' OR table_name ILIKE '%tatum%' OR table_name ILIKE '%deposit%') ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('\nRelated tables:', tables.map(t => t.table_name).join(', '));

  } catch (e: any) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}
main();
