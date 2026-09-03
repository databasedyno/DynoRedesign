const {Client}=require("pg");
const env=require("dotenv").config({path:"/app/backend/.env"}).parsed;
(async()=>{
  const c=new Client({connectionString:env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await c.connect();
  const tables=["tbl_user_transaction","tbl_customer_transaction","tbl_merchant_temp_address","tbl_notification","tbl_company","tbl_user","tbl_user_wallet","tbl_payment_link","tbl_api","tbl_user_addresses","tbl_product_order","tbl_kyc","tbl_webhook_delivery_log","tbl_login_history","tbl_user_session","tbl_service_health"];
  for (const t of tables) {
    const cnt=await c.query(`SELECT count(*)::int AS n FROM ${t}`).catch(()=>({rows:[{n:"ERR"}]}));
    const idx=await c.query(`SELECT indexdef FROM pg_indexes WHERE tablename=$1`,[t]);
    const cols=idx.rows.map(r=>r.indexdef.replace(/.*USING \w+ /,"")).join(" ");
    console.log(`${t} rows=${cnt.rows[0].n} idx=${cols}`);
  }
  const stat=await c.query(`SELECT relname, seq_scan, idx_scan, n_live_tup FROM pg_stat_user_tables WHERE relname = ANY($1)`,[tables]);
  console.log("STATS:", stat.rows.map(r=>`${r.relname}(seq=${r.seq_scan},idx=${r.idx_scan},live=${r.n_live_tup})`).join(" "));
  const reset=await c.query("SELECT stats_reset FROM pg_stat_database WHERE datname=current_database()");
  console.log("stats_reset:", reset.rows[0].stats_reset);
  await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
