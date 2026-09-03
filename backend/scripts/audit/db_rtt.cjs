const {Client}=require("pg");
const env=require("dotenv").config({path:"/app/backend/.env"}).parsed;
(async()=>{
  const c=new Client({connectionString:env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  const t0=Date.now(); await c.connect(); const tc=Date.now()-t0;
  const times=[]; for(let i=0;i<5;i++){const s=Date.now(); await c.query("SELECT 1"); times.push(Date.now()-s);}
  console.log("connect_ms="+tc, "select1_ms="+JSON.stringify(times));
  const r=await c.query("SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 12");
  console.log(r.rows.map(x=>x.relname+":"+x.n_live_tup).join(", "));
  const idx=await c.query(`SELECT s.relname, s.seq_scan, s.seq_tup_read, s.idx_scan FROM pg_stat_user_tables s WHERE s.seq_scan > 1000 ORDER BY seq_tup_read DESC LIMIT 12`);
  console.log("HIGH SEQ SCANS:", idx.rows.map(x=>`${x.relname} seq=${x.seq_scan} tup=${x.seq_tup_read} idx=${x.idx_scan}`).join(" | "));
  await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
