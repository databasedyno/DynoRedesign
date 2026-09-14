import "dotenv/config";
import sequelize from "../utils/dbInstance";
import { QueryTypes } from "sequelize";

/**
 * Additive, idempotent migration — "Split Name Fields".
 *
 * Adds `first_name` + `last_name` to `tbl_user` and backfills them from the
 * existing combined `name` (first whitespace token → first_name, the rest →
 * last_name). The original `name` column is NEVER modified — it stays the
 * canonical display string; the split columns power greetings ("Hi John") and
 * sorting merchants by last name.
 *
 * Fully backwards compatible: both columns are nullable, backfill only touches
 * rows whose first_name is still empty, and nothing reads them as required.
 *
 *   run once:  npx ts-node --transpile-only migrations/addFirstLastName.ts
 */
async function addFirstLastName() {
  try {
    await sequelize.query(
      `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS first_name VARCHAR(255)`,
    );
    await sequelize.query(
      `ALTER TABLE tbl_user ADD COLUMN IF NOT EXISTS last_name VARCHAR(255)`,
    );
    console.log("✅ first_name + last_name columns present on tbl_user");

    // Backfill from the combined name. Normalize whitespace first, split on the
    // FIRST space: token 1 → first_name, remainder → last_name (single-word
    // names get first_name only). Only fills rows not already populated so
    // re-running is safe and never clobbers a value set at signup / by NameGate.
    const [, meta] = await sequelize.query(
      `
      WITH normalized AS (
        SELECT user_id,
               btrim(regexp_replace(name, '\\s+', ' ', 'g')) AS n
          FROM tbl_user
         WHERE (first_name IS NULL OR first_name = '')
           AND name IS NOT NULL
           AND btrim(name) <> ''
      )
      UPDATE tbl_user u
         SET first_name = split_part(nm.n, ' ', 1),
             last_name  = CASE
                            WHEN position(' ' in nm.n) > 0
                            THEN NULLIF(btrim(substr(nm.n, position(' ' in nm.n) + 1)), '')
                            ELSE NULL
                          END
        FROM normalized nm
       WHERE u.user_id = nm.user_id
      `,
      { type: QueryTypes.UPDATE },
    );
    const affected = typeof meta === "number" ? meta : "?";
    console.log(`✅ backfilled first/last name for ${affected} existing user(s)`);

    // Quick sanity read.
    const rows = (await sequelize.query(
      `SELECT count(*)::int AS total,
              count(first_name)::int AS with_first,
              count(last_name)::int AS with_last
         FROM tbl_user`,
      { type: QueryTypes.SELECT },
    )) as Array<{ total: number; with_first: number; with_last: number }>;
    console.log(
      `ℹ️  tbl_user: total=${rows[0]?.total} with_first_name=${rows[0]?.with_first} with_last_name=${rows[0]?.with_last}`,
    );
  } catch (error: unknown) {
    const err = error as { message?: string };
    if (err.message?.includes("already exists") || err.message?.includes("duplicate")) {
      console.log("✅ first/last name columns already exist");
    } else {
      console.error("❌ Error:", err.message);
      process.exit(1);
    }
  }
  process.exit(0);
}

addFirstLastName();
