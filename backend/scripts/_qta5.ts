import 'dotenv/config';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

const PAYMENT_ID = '0a5bd34d-6443-4d3b-8442-7cd5f86fe7a2';
const ADDR = '0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc';

async function main() {
  try {
    await sequelize.authenticate();
    // Get all columns of type uuid or varchar/text where payment_id might live
    const cols: any[] = await sequelize.query(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema='public'
         AND (column_name ILIKE '%payment%id%' OR column_name = 'id' OR column_name ILIKE '%current_payment%' OR column_name = 'reference' OR column_name = 'external_id')
       ORDER BY table_name, column_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('Candidate columns:');
    cols.forEach(c => console.log(`  ${c.table_name}.${c.column_name} [${c.data_type}]`));

    console.log(`\n=== Searching for '${PAYMENT_ID}' ===`);
    for (const c of cols) {
      try {
        const rows: any[] = await sequelize.query(
          `SELECT * FROM public."${c.table_name}" WHERE "${c.column_name}"::text = $1 LIMIT 3`,
          { bind: [PAYMENT_ID], type: QueryTypes.SELECT }
        );
        if (rows.length > 0) {
          console.log(`\n>>> ${rows.length} rows in ${c.table_name}.${c.column_name} <<<`);
          console.log(JSON.stringify(rows.map((r: any) => {
            const clean: any = {};
            for (const [k, v] of Object.entries(r)) {
              if (k === 'private_key' || k === 'cached_qr_code' || k === 'password') clean[k] = '<redacted>';
              else clean[k] = v;
            }
            return clean;
          }), null, 2));
        }
      } catch (e) { }
    }

    // Look at merchant_pool_transaction/sweep for this address (temp_address_id=7)
    for (const t of ['tbl_merchant_pool_sweep', 'tbl_merchant_pool_transaction']) {
      try {
        const cols2: any[] = await sequelize.query(
          `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,
          { bind: [t], type: QueryTypes.SELECT }
        );
        console.log(`\n${t} columns:`, cols2.map((c: any) => c.column_name).join(', '));
        const rows: any[] = await sequelize.query(
          `SELECT * FROM public."${t}" WHERE temp_address_id = 7 ORDER BY 1 DESC LIMIT 5`,
          { type: QueryTypes.SELECT }
        );
        console.log(`Last 5 rows in ${t} for temp_address_id=7:`);
        console.log(JSON.stringify(rows, null, 2));
      } catch (e: any) { console.log(`${t}:`, e.message); }
    }
  } catch (e: any) {
    console.error('ERROR:', e.message, e.stack);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}
main();
