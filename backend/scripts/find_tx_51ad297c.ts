/** READ-ONLY: locate the $26 payment across tables + find its attached webhook/callback URL. */
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

const REF = "51ad297c-8932-4f07-821c-7ce8e62cb77e";

const cols = async (table: string) => {
  const r = await sequelize.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = :t ORDER BY ordinal_position`,
    { replacements: { t: table }, type: QueryTypes.SELECT }
  );
  return (r as Array<{ column_name: string }>).map((x) => x.column_name);
};

(async () => {
  try {
    for (const t of ["tbl_customer_transaction", "tbl_customer", "tbl_api_payment"]) {
      try {
        const c = await cols(t);
        if (!c.length) { console.log(`\n[${t}] — no such table`); continue; }
        const urlCols = c.filter((x) => /webhook|callback|url|reference|payment|order/i.test(x));
        console.log(`\n[${t}] url/ref-ish cols: ${urlCols.join(", ")}`);
        // Try to find the row by any reference-like column
        for (const rc of c.filter((x) => /reference|payment_id|order_id|txn|uuid|id/i.test(x))) {
          try {
            const sel = urlCols.length ? urlCols.map((x) => `"${x}"`).join(", ") : "*";
            const rows = await sequelize.query(
              `SELECT ${sel} FROM ${t} WHERE "${rc}"::text = :ref LIMIT 2`,
              { replacements: { ref: REF }, type: QueryTypes.SELECT }
            );
            if ((rows as unknown[]).length) {
              console.log(`  MATCH on ${t}.${rc}:`);
              console.log("  " + JSON.stringify(rows, null, 2).replace(/\n/g, "\n  "));
            }
          } catch { /* type mismatch etc */ }
        }
      } catch (e) { console.log(`[${t}] err: ${(e as Error).message}`); }
    }
  } catch (e) {
    console.error("ERR:", e);
  } finally {
    await sequelize.close();
    process.exit(0);
  }
})();
