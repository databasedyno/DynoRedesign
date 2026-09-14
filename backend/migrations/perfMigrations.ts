import type { Migration } from "../utils/migrationRunner";

/**
 * Migration 0021: drop duplicate indexes.
 *
 * Historic dev-mode `sequelize.sync({ alter: true })` boots against this DB kept
 * re-adding `unique: true` constraints under fresh names (Sequelize issue
 * #12889) — audit found tbl_publishable_key x790, tbl_user/tbl_referee_code/
 * tbl_kb_* x76 identical unique indexes on referral_code / key_hash / slug.
 * Every INSERT/UPDATE had to maintain all of them. We keep exactly ONE index per
 * (table, definition) — the shortest-named — and drop the rest. Constraint-backed
 * indexes are dropped through ALTER TABLE ... DROP CONSTRAINT. Idempotent.
 */
const dropDuplicateIndexes = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  await sequelize.query(`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN
        WITH defs AS (
          SELECT schemaname, tablename, indexname,
                 regexp_replace(indexdef, 'INDEX \\S+ ON', 'INDEX ON') AS def
          FROM pg_indexes
          WHERE schemaname = 'public'
        ),
        ranked AS (
          SELECT *, row_number() OVER (
                   PARTITION BY tablename, def
                   ORDER BY length(indexname), indexname
                 ) AS rn
          FROM defs
        )
        SELECT tablename, indexname FROM ranked WHERE rn > 1
      LOOP
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = r.indexname AND conrelid = format('%I', r.tablename)::regclass) THEN
            EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', r.tablename, r.indexname);
          ELSE
            EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
          END IF;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'skip duplicate index %.%: %', r.tablename, r.indexname, SQLERRM;
        END;
      END LOOP;
    END $$;
  `);
};

/**
 * Migration 0022: indexes for the hot read paths that were doing sequential
 * scans (pg_stat: tbl_user_transaction / tbl_customer_transaction / tbl_kyc /
 * tbl_user_addresses had idx_scan = 0). All additive, IF NOT EXISTS, on small
 * tables (metadata-cheap today, protects dashboards/settlement as volume grows).
 */
const addHotPathIndexes = async (): Promise<void> => {
  const { default: sequelize } = await import("../utils/dbInstance");
  const statements = [
    `CREATE INDEX IF NOT EXISTS tbl_user_transaction_user_created_idx ON tbl_user_transaction (user_id, "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_transaction_company_created_idx ON tbl_user_transaction (company_id, "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_transaction_wallet_idx ON tbl_user_transaction (wallet_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_transaction_status_idx ON tbl_user_transaction (status)`,
    `CREATE INDEX IF NOT EXISTS tbl_customer_transaction_company_created_idx ON tbl_customer_transaction (company_id, "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS tbl_customer_transaction_customer_idx ON tbl_customer_transaction (customer_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_notification_user_created_idx ON tbl_notification (user_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_wallet_company_idx ON tbl_user_wallet (company_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_wallet_user_idx ON tbl_user_wallet (user_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_payment_link_company_created_idx ON tbl_payment_link (company_id, "createdAt" DESC)`,
    `CREATE INDEX IF NOT EXISTS tbl_payment_link_user_idx ON tbl_payment_link (user_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_payment_link_transaction_idx ON tbl_payment_link (transaction_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_company_user_idx ON tbl_company (user_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_addresses_user_idx ON tbl_user_addresses (user_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_kyc_user_idx ON tbl_kyc (user_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_kyc_company_idx ON tbl_kyc (company_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_api_user_idx ON tbl_api (user_id)`,
    `CREATE INDEX IF NOT EXISTS tbl_user_email_idx ON tbl_user (email)`,
  ];
  for (const sql of statements) await sequelize.query(sql);
};

export const perfMigrations: Migration[] = [
  { version: "0021_drop_duplicate_indexes", up: dropDuplicateIndexes },
  { version: "0022_hot_path_indexes", up: addHotPathIndexes },
];
