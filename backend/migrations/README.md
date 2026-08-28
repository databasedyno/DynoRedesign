# Database migrations — ONE versioned pipeline

There is a **single canonical schema pipeline**. Do not introduce new ad-hoc mechanisms.

## The pipeline
- **`bootMigrations.ts`** exports `buildBootMigrations()` → an ordered array of versioned
  `Migration` objects (`0001…`, `0002…`, …).
- **`utils/migrationRunner.ts`** (`runMigrations`) applies any not-yet-applied versions **once**
  and records each in the `schema_migrations` table. Idempotent: safe to run on every boot.
- Wired in `server.ts`:
  - **Production** (`NODE_ENV=production`): runs `runMigrations(sequelize, buildBootMigrations())`.
  - **Development**: fast-iteration `getBootModels()` + `sync({ alter: true })` auto-sync.

## How to add a schema change
1. Add a new entry to the array returned by `buildBootMigrations()` in `bootMigrations.ts`:
   ```ts
   { version: "0007_short_description", up: async () => { /* idempotent DDL */ } }
   ```
2. Keep `up()` **idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`,
   `INSERT … ON CONFLICT …`) — it may run against databases where the change already exists.
3. Prefer additive, metadata-only changes (no table rewrites) so it is safe on the live prod DB.
4. Never bump/reuse an existing version number; versions are recorded in `schema_migrations`.

## `legacy/` — FROZEN, historical, do NOT extend
`legacy/` holds the pre-pipeline one-off artifacts, kept only for provenance:
- `add*.ts` — standalone CLI scripts (each self-runs + `process.exit`), run manually in the past
  via `ts-node`. They are **already applied** to prod/staging and are **not** imported at boot.
- `0xx_*.sql` — manual SQL applied by hand historically (no code loads them).

These are **not** part of the automated pipeline. Do not add new files here — add a versioned
`up()` to `bootMigrations.ts` instead.
