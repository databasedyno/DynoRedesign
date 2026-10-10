// Read-only query helper: node ro_query.cjs "<SELECT ...>" [params-json]
require("/app/backend/node_modules/dotenv").config({ path: "/app/backend/.env" });
const { Client } = require("/app/backend/node_modules/pg");
(async () => {
  const sql = process.argv[2];
  if (!/^\s*select/i.test(sql)) throw new Error("read-only: SELECT only");
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === "true" } });
  await c.connect();
  await c.query("BEGIN READ ONLY");
  const r = await c.query(sql, JSON.parse(process.argv[3] || "[]"));
  console.log(JSON.stringify(r.rows, null, 0));
  await c.query("ROLLBACK");
  await c.end();
})().catch((e) => { console.error("ERR", e.message); process.exit(1); });
