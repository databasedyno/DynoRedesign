import { QueryTypes } from "sequelize";
import type { Sequelize } from "sequelize";
import { log } from "./loggers";

/**
 * Minimal, dependency-free versioned migration runner.
 *
 * Motivation (Refactor Item #1): boot used to issue ~17 ad-hoc `model.sync()`
 * calls on EVERY restart. In production those were create-only (safe) but still
 * ran a DDL introspection round-trip per model each boot and were not auditable.
 * This runner records applied versions in a `schema_migrations` table so each
 * migration runs exactly once; subsequent boots are a single cheap SELECT.
 *
 * Each migration's `up()` MUST be idempotent (safe to re-run) as a defence in
 * depth — the boot migration uses create-only `sync()` which is a no-op when the
 * tables already exist.
 */
export interface Migration {
  /** Stable, ordered identifier, e.g. "0001_boot_model_tables". */
  version: string;
  /** Idempotent forward migration. */
  up: () => Promise<void>;
}

const META_TABLE = "schema_migrations";

async function ensureMetaTable(sequelize: Sequelize): Promise<void> {
  await sequelize.query(
    `CREATE TABLE IF NOT EXISTS "${META_TABLE}" (
       "version" VARCHAR(255) PRIMARY KEY,
       "applied_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`
  );
}

async function getAppliedVersions(sequelize: Sequelize): Promise<Set<string>> {
  const rows = (await sequelize.query(`SELECT "version" FROM "${META_TABLE}"`, {
    type: QueryTypes.SELECT,
  })) as Array<{ version: string }>;
  return new Set(rows.map((r) => r.version));
}

/**
 * Apply any not-yet-recorded migrations in order.
 * Returns counts for logging/verification.
 */
export async function runMigrations(
  sequelize: Sequelize,
  migrations: Migration[]
): Promise<{ applied: number; skipped: number }> {
  await ensureMetaTable(sequelize);
  const done = await getAppliedVersions(sequelize);

  let applied = 0;
  let skipped = 0;
  for (const m of migrations) {
    if (done.has(m.version)) {
      skipped++;
      continue;
    }
    log(`[migrations] applying ${m.version}...`, "info");
    await m.up();
    await sequelize.query(
      `INSERT INTO "${META_TABLE}" ("version") VALUES (:v) ON CONFLICT ("version") DO NOTHING`,
      { replacements: { v: m.version }, type: QueryTypes.INSERT }
    );
    applied++;
    log(`[migrations] applied ${m.version}`, "info");
  }
  log(`[migrations] done — ${applied} applied, ${skipped} already present`, "info");
  return { applied, skipped };
}
