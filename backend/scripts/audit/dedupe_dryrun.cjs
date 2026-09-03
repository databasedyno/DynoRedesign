const {Client}=require("pg");
const env=require("dotenv").config({path:"/app/backend/.env"}).parsed;
(async()=>{
  const c=new Client({connectionString:env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`
    WITH defs AS (
      SELECT schemaname, tablename, indexname, regexp_replace(indexdef, 'INDEX \\S+ ON', 'INDEX ON') AS def
      FROM pg_indexes WHERE schemaname='public'),
    ranked AS (SELECT *, row_number() OVER (PARTITION BY tablename, def ORDER BY length(indexname), indexname) rn FROM defs)
    SELECT tablename, def, count(*) FILTER (WHERE rn>1)::int drop_n, min(indexname) FILTER (WHERE rn=1) keep,
           bool_or(EXISTS(SELECT 1 FROM pg_constraint pc WHERE pc.conname=ranked.indexname AND pc.conrelid=format('%I',ranked.tablename)::regclass)) has_constraint
    FROM ranked GROUP BY tablename, def HAVING count(*)>1 ORDER BY drop_n DESC`);
  let total=0; for (const row of r.rows){ total+=row.drop_n; console.log(`${row.tablename} drop=${row.drop_n} keep=${row.keep} constraint=${row.has_constraint} :: ${row.def.slice(0,90)}`);} 
  console.log("TOTAL to drop:", total);
  const sz=await c.query(`SELECT pg_size_pretty(sum(pg_relation_size(indexrelid))) s FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid WHERE c.relname LIKE '%_key%' AND c.relname ~ '\\d+$'`);
  console.log("approx size of numbered dup indexes:", sz.rows[0].s);
  await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
