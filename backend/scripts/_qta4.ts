import 'dotenv/config';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

const PAYMENT_ID = '0a5bd34d-6443-4d3b-8442-7cd5f86fe7a2';
const ADDR = '0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc';

async function main() {
  try {
    await sequelize.authenticate();

    // List ALL tables clearly
    const tables: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('ALL TABLES (' + tables.length + '):');
    tables.forEach(t => console.log('  ' + t.table_name));

    // For each table with payment_id column, list schema + search
    const paymentIdTables: any[] = await sequelize.query(
      `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='payment_id' ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('\nTables with payment_id column:', paymentIdTables.map(t => t.table_name).join(', '));

    for (const t of paymentIdTables) {
      const rows: any[] = await sequelize.query(
        `SELECT * FROM public."${t.table_name}" WHERE payment_id::text = $1 ORDER BY 1 DESC LIMIT 3`,
        { bind: [PAYMENT_ID], type: QueryTypes.SELECT }
      ).catch(e => { console.log(`  ${t.table_name} err:`, e.message); return []; });
      console.log(`\n=== ${t.table_name}: ${rows.length} rows for payment ${PAYMENT_ID} ===`);
      if (rows.length > 0) console.log(JSON.stringify(rows.map((r: any) => ({ ...r, private_key: r.private_key ? '<r>' : null, cached_qr_code: r.cached_qr_code ? '<qr>' : null })), null, 2));
    }

    // Also search by id in case payment table uses "id" as PK
    const idTables: any[] = await sequelize.query(
      `SELECT DISTINCT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='id' AND table_name ILIKE '%payment%' ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    for (const t of idTables) {
      try {
        const rows: any[] = await sequelize.query(
          `SELECT * FROM public."${t.table_name}" WHERE id::text = $1 LIMIT 3`,
          { bind: [PAYMENT_ID], type: QueryTypes.SELECT }
        );
        if (rows.length > 0) {
          console.log(`\n=== ${t.table_name}.id matches ===`);
          console.log(JSON.stringify(rows, null, 2));
        }
      } catch (e) { }
    }

    // Look at recent tbl_payment (whatever it's named) for user_id 1
    // Discover tbl_payment column
    const paymentTable: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = 'tbl_payment' LIMIT 1`,
      { type: QueryTypes.SELECT }
    );
    console.log('\ntbl_payment exists:', paymentTable.length > 0);
    if (paymentTable.length > 0) {
      const cols: any[] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='tbl_payment' ORDER BY ordinal_position`,
        { type: QueryTypes.SELECT }
      );
      console.log('tbl_payment cols:', cols.map(c => c.column_name).join(', '));

      // Recent payments for user 1
      const recent: any[] = await sequelize.query(
        `SELECT * FROM tbl_payment WHERE user_id = 1 ORDER BY "createdAt" DESC LIMIT 5`,
        { type: QueryTypes.SELECT }
      );
      console.log(`\n=== Recent 5 tbl_payment rows for user_id=1 ===`);
      console.log(JSON.stringify(recent.map((r: any) => {
        const keep: any = {};
        ['id','payment_id','user_id','company_id','status','amount','received_amount','currency','crypto_currency','settlement_status','deposit_address','temp_address_id','tx_hash','settlement_tx_hash','createdAt','updatedAt'].forEach(k => { if (k in r) keep[k] = r[k]; });
        return keep;
      }), null, 2));
    }
  } catch (e: any) {
    console.error('ERROR:', e.message, e.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}
main();
