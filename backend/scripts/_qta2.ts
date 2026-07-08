import 'dotenv/config';
import sequelize from '../utils/dbInstance';
import { QueryTypes } from 'sequelize';

const ADDR = '0x84aae5037ee0ea99c78a2f46a4d27ef1e64ba2cc';

async function main() {
  try {
    await sequelize.authenticate();
    const tables: any[] = await sequelize.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('ALL TABLES:', tables.map(t => t.table_name).join(', '));

    // Any table with address-like column
    const cols: any[] = await sequelize.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema='public' AND (column_name ILIKE '%address%' OR column_name ILIKE '%deposit%')
       ORDER BY table_name, column_name`,
      { type: QueryTypes.SELECT }
    );
    console.log('\nAddress-like columns:');
    cols.forEach(c => console.log(`  ${c.table_name}.${c.column_name}`));

    // Search every one for this specific address
    console.log('\n=== Searching for address ' + ADDR + ' ===');
    for (const c of cols) {
      try {
        const rows: any[] = await sequelize.query(
          `SELECT * FROM public."${c.table_name}" WHERE LOWER("${c.column_name}") = LOWER($1) LIMIT 5`,
          { bind: [ADDR], type: QueryTypes.SELECT }
        );
        if (rows.length > 0) {
          console.log(`\n>>> MATCH in ${c.table_name}.${c.column_name} (${rows.length}) <<<`);
          console.log(JSON.stringify(rows, null, 2));
        }
      } catch (e: any) {
        // skip
      }
    }
  } catch (e: any) {
    console.error('ERROR:', e.message);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}
main();
