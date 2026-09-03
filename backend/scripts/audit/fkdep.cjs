const {Client}=require("pg");
const env=require("dotenv").config({path:"/app/backend/.env"}).parsed;
(async()=>{
  const c=new Client({connectionString:env.DATABASE_URL, ssl:{rejectUnauthorized:false}});
  await c.connect();
  const r=await c.query(`SELECT con.conname fk, con.conrelid::regclass tbl, dep.refobjid::regclass idx
    FROM pg_constraint con JOIN pg_depend dep ON dep.objid=con.oid AND dep.classid='pg_constraint'::regclass AND dep.refclassid='pg_class'::regclass
    WHERE con.contype='f'`);
  console.log("FK->index dependencies:", r.rows.length); for (const x of r.rows) console.log(" ", x.fk, x.tbl, "->", x.idx);
  await c.end();
})().catch(e=>{console.error("ERR",e.message);process.exit(1)});
