const {Client}=require("pg");
const env=require("dotenv").config({path:"/app/backend/.env"}).parsed;
(async()=>{
  const c=new Client({connectionString:env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await c.connect();
  const dup=await c.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename='tbl_user' AND indexdef LIKE '%referral_code%' ORDER BY indexname LIMIT 5`);
  const dupn=await c.query(`SELECT count(*)::int n FROM pg_indexes WHERE tablename='tbl_user' AND indexdef LIKE '%referral_code%'`);
  console.log("DUP referral_code idx count:", dupn.rows[0].n, dup.rows.map(r=>r.indexname+" :: "+r.indexdef).join("\n  "));
  const alldup=await c.query(`SELECT tablename, regexp_replace(indexdef,'INDEX \\S+ ON','INDEX ON') AS def, count(*)::int n FROM pg_indexes GROUP BY 1,2 HAVING count(*)>1 ORDER BY n DESC`);
  console.log("ALL DUP GROUPS:", alldup.rows.map(r=>`${r.tablename} x${r.n}`).join(", "));
  for (const t of ["tbl_user_transaction","tbl_customer_transaction","tbl_notification","tbl_user_wallet","tbl_payment_link","tbl_company","tbl_user_addresses","tbl_kyc","tbl_api"]) {
    const cols=await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`,[t]);
    console.log(t+": "+cols.rows.map(r=>r.column_name).join(","));
  }
  await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
