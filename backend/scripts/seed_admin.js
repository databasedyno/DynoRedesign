/* Idempotent super-admin seed. Creates tbl_admin if missing and upserts the
 * single super-admin with a bcrypt password. Safe to re-run. */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const { Client } = require("pg");
const bcrypt = require("bcryptjs");

const EMAIL = "moxxcompany@gmail.com";
const PASSWORD = "Katiekendra123@";
const NAME = "Dynopay Admin";

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { require: true, rejectUnauthorized: false } });
  await c.connect();

  await c.query(`
    CREATE TABLE IF NOT EXISTS tbl_admin (
      admin_id   SERIAL PRIMARY KEY,
      name       VARCHAR(255),
      email      VARCHAR(255) NOT NULL UNIQUE,
      password   VARCHAR(255) NOT NULL,
      role       VARCHAR(32) NOT NULL DEFAULT 'ADMIN',
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const hash = bcrypt.hashSync(PASSWORD, 12);
  const existing = await c.query(`SELECT admin_id, email FROM tbl_admin WHERE lower(email)=lower($1)`, [EMAIL]);
  if (existing.rows.length) {
    await c.query(`UPDATE tbl_admin SET password=$1, name=COALESCE(name,$2), role='ADMIN', "updatedAt"=now() WHERE lower(email)=lower($3)`, [hash, NAME, EMAIL]);
    console.log(`✅ Updated password for existing admin ${EMAIL} (admin_id=${existing.rows[0].admin_id})`);
  } else {
    const r = await c.query(`INSERT INTO tbl_admin (name,email,password,role) VALUES ($1,$2,$3,'ADMIN') RETURNING admin_id`, [NAME, EMAIL, hash]);
    console.log(`✅ Created super-admin ${EMAIL} (admin_id=${r.rows[0].admin_id})`);
  }

  // Verify the hash matches
  const check = await c.query(`SELECT password FROM tbl_admin WHERE lower(email)=lower($1)`, [EMAIL]);
  console.log("   bcrypt verify:", bcrypt.compareSync(PASSWORD, check.rows[0].password) ? "OK" : "FAILED");
  const total = await c.query(`SELECT count(*)::int AS n FROM tbl_admin`);
  console.log("   tbl_admin row count:", total.rows[0].n);
  await c.end();
})().catch(e => { console.error("ERR", e.message); process.exit(1); });
