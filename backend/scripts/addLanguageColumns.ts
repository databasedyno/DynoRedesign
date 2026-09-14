/**
 * Phase 1 migration: add a nullable `language` column (default 'en') to:
 *   - tbl_user                 (merchant preferred language)
 *   - tbl_customer_transaction (customer language captured at checkout)
 *
 * Idempotent (ADD COLUMN IF NOT EXISTS) and additive only — safe to run against
 * the live database. Uses a standalone pg client (NOT the app's Sequelize instance)
 * to avoid any server-startup side effects.
 *
 * Run once with:
 *   node_modules/.bin/ts-node --transpile-only scripts/addLanguageColumns.ts
 */
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

const run = async () => {
  const useSSL = process.env.NODE_ENV === "production" || !!process.env.DATABASE_URL;
  const client = process.env.DATABASE_URL
    ? new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: useSSL ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
      })
    : new Client({
        host: process.env.HOST,
        port: Number(process.env.DB_PORT),
        database: process.env.DB_NAME,
        user: process.env.USER_NAME,
        password: process.env.PASSWORD,
        ssl: useSSL ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" } : undefined,
      });

  try {
    await client.connect();
    console.log("DB connection OK. Adding language columns…");

    await client.query("ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';");
    console.log("✅ tbl_user.language ready");

    await client.query("ALTER TABLE tbl_customer_transaction ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';");
    console.log("✅ tbl_customer_transaction.language ready");

    // Verify
    const { rows } = await client.query(
      `SELECT table_name, column_name, data_type, column_default
       FROM information_schema.columns
       WHERE column_name = 'language'
         AND table_name IN ('tbl_user', 'tbl_customer_transaction')
       ORDER BY table_name;`
    );
    console.table(rows);

    console.log("Migration completed successfully.");
    await client.end();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    try { await client.end(); } catch {}
    process.exit(1);
  }
};

run();
