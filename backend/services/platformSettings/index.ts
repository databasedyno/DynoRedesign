/**
 * Platform Settings — resolution service (Deliverable 2, Phase 1).
 *
 * Resolution order for every key:  DB override → process.env[envKey] → default.
 *
 * Reads are SYNCHRONOUS and served from a warm in-memory cache of the DB
 * overrides, so existing synchronous read-sites (fees, order minimums, SafeDeal
 * limits) can adopt it without turning async. The cache is:
 *   - warmed at import (fire-and-forget) and refreshed every 30s;
 *   - invalidated instantly on a write (local) and across instances via a Redis
 *     pub/sub message, so an admin change applies platform-wide in <1s with no
 *     redeploy.
 *
 * Writes are audited (append-only history) and go through validateAndCoerce().
 */
import { QueryTypes } from "sequelize";
import sequelize from "../../utils/dbInstance";
import { redis } from "../../utils/redisInstance";
import { cronLogger } from "../../utils/loggers";
import {
  REGISTRY,
  GROUPS,
  getDef,
  coerceEnv,
  coerceValue,
  SettingDef,
} from "./registry";

const INVALIDATE_CHANNEL = "platform_settings:invalidate";
const REFRESH_INTERVAL_MS = 30_000;

export type SettingSource = "override" | "env" | "default";

export class SettingError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** key -> raw DB override value (jsonb, already parsed by the pg driver). */
let overrides = new Map<string, unknown>();
let loaded = false;
let loadingPromise: Promise<void> | null = null;

async function loadOverrides(): Promise<void> {
  try {
    const rows = (await sequelize.query(
      `SELECT key, value FROM tbl_platform_setting`,
      { type: QueryTypes.SELECT }
    )) as Array<{ key: string; value: unknown }>;
    const m = new Map<string, unknown>();
    for (const r of rows) m.set(r.key, r.value);
    overrides = m;
    loaded = true;
  } catch (e) {
    // Table may not exist yet (pre-migration) — env/default fallback stays correct.
    cronLogger.warn(`[platformSettings] cache load skipped: ${(e as Error).message}`);
  }
}

/** Await the first cache load (call once at boot if you need a guaranteed-warm read). */
export async function ready(): Promise<void> {
  if (loaded) return;
  if (!loadingPromise) loadingPromise = loadOverrides();
  await loadingPromise;
}

// Warm the cache + keep it fresh. Guarded so a cold DB/Redis never breaks boot.
void ready();
const refreshTimer = setInterval(() => void loadOverrides(), REFRESH_INTERVAL_MS);
refreshTimer.unref?.();

(async () => {
  try {
    const sub = redis.duplicate();
    sub.on("error", () => {});
    await sub.connect();
    await sub.subscribe(INVALIDATE_CHANNEL, () => void loadOverrides());
  } catch {
    // Single instance / Redis unavailable — the 30s refresh covers invalidation.
  }
})();

function resolveRaw(key: string): { value: unknown; source: SettingSource } {
  const d = getDef(key);
  if (!d) return { value: undefined, source: "default" };
  if (overrides.has(key)) return { value: coerceValue(d, overrides.get(key)), source: "override" };
  if (d.envKey) {
    const envVal = process.env[d.envKey];
    if (envVal != null && String(envVal).trim() !== "") return { value: coerceEnv(d, envVal), source: "env" };
  }
  return { value: d.default, source: "default" };
}

// ── Synchronous typed getters (hot path) ────────────────────────────────────
export function getNumber(key: string): number {
  const { value } = resolveRaw(key);
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const fallback = Number(getDef(key)?.default);
  return Number.isFinite(fallback) ? fallback : 0;
}
export function getBool(key: string): boolean {
  const { value } = resolveRaw(key);
  return value === true || value === "true" || value === 1 || value === "1";
}
export function getString(key: string): string {
  const { value } = resolveRaw(key);
  return value == null ? "" : String(value);
}
export function getCsv(key: string): string[] {
  return getString(key).split(",").map((s) => s.trim()).filter(Boolean);
}
export function sourceOf(key: string): SettingSource {
  return resolveRaw(key).source;
}

// ── Validation ───────────────────────────────────────────────────────────────
function validateAndCoerce(d: SettingDef, input: unknown): unknown {
  switch (d.type) {
    case "number": {
      const n = Number(input);
      if (!Number.isFinite(n)) throw new SettingError(400, `${d.label} must be a number.`);
      if (d.min != null && n < d.min) throw new SettingError(400, `${d.label} must be at least ${d.min}.`);
      if (d.max != null && n > d.max) throw new SettingError(400, `${d.label} must be at most ${d.max}.`);
      return n;
    }
    case "boolean": {
      if (typeof input === "boolean") return input;
      if (input === "true" || input === 1 || input === "1") return true;
      if (input === "false" || input === 0 || input === "0") return false;
      throw new SettingError(400, `${d.label} must be true or false.`);
    }
    case "enum": {
      const s = String(input);
      if (!d.enumValues?.includes(s)) throw new SettingError(400, `${d.label} must be one of: ${d.enumValues?.join(", ")}.`);
      return s;
    }
    case "csv": {
      const s = String(input ?? "");
      return s.split(",").map((x) => x.trim()).filter(Boolean).join(",");
    }
    case "string":
    default: {
      const s = String(input ?? "");
      if (d.max != null && s.length > d.max) throw new SettingError(400, `${d.label} must be ${d.max} characters or fewer.`);
      return s;
    }
  }
}

async function publishInvalidate(key: string): Promise<void> {
  try {
    await redis.publish(INVALIDATE_CHANNEL, key);
  } catch {
    /* best-effort; local cache already updated, peers refresh within 30s */
  }
}

/** Change a setting (DB override). Validated, audited and invalidated live. */
export async function setSetting(
  key: string,
  value: unknown,
  changedBy: string,
  reason?: string | null
): Promise<{ key: string; value: unknown; source: SettingSource }> {
  const d = getDef(key);
  if (!d) throw new SettingError(404, "Unknown setting.");
  if (!d.editable) throw new SettingError(400, "This setting is managed in the environment and can't be changed here.");
  const coerced = validateAndCoerce(d, value);
  await ready();
  const before = overrides.has(key) ? overrides.get(key) : null;

  await sequelize.transaction(async (t) => {
    await sequelize.query(
      `INSERT INTO tbl_platform_setting (key, value, updated_by, updated_at, version)
         VALUES (:key, :value::jsonb, :by, NOW(), 1)
       ON CONFLICT (key) DO UPDATE
         SET value = :value::jsonb, updated_by = :by, updated_at = NOW(),
             version = tbl_platform_setting.version + 1`,
      { replacements: { key, value: JSON.stringify(coerced), by: changedBy }, type: QueryTypes.INSERT, transaction: t }
    );
    await sequelize.query(
      `INSERT INTO tbl_platform_setting_history (key, old_value, new_value, changed_by, reason)
         VALUES (:key, :old::jsonb, :new::jsonb, :by, :reason)`,
      {
        replacements: { key, old: before == null ? null : JSON.stringify(before), new: JSON.stringify(coerced), by: changedBy, reason: reason || null },
        type: QueryTypes.INSERT,
        transaction: t,
      }
    );
  });

  overrides.set(key, coerced);
  await publishInvalidate(key);
  cronLogger.info(`[platformSettings] ${key} changed by ${changedBy} → ${JSON.stringify(coerced)}`);
  const r = resolveRaw(key);
  return { key, value: r.value, source: r.source };
}

/** Remove a DB override so the key falls back to .env / default. */
export async function revertSetting(
  key: string,
  changedBy: string,
  reason?: string | null
): Promise<{ key: string; value: unknown; source: SettingSource }> {
  const d = getDef(key);
  if (!d) throw new SettingError(404, "Unknown setting.");
  await ready();
  if (!overrides.has(key)) {
    const r = resolveRaw(key);
    return { key, value: r.value, source: r.source };
  }
  const before = overrides.get(key);
  await sequelize.transaction(async (t) => {
    await sequelize.query(`DELETE FROM tbl_platform_setting WHERE key = :key`, { replacements: { key }, type: QueryTypes.DELETE, transaction: t });
    await sequelize.query(
      `INSERT INTO tbl_platform_setting_history (key, old_value, new_value, changed_by, reason)
         VALUES (:key, :old::jsonb, NULL, :by, :reason)`,
      { replacements: { key, old: JSON.stringify(before), by: changedBy, reason: reason || "revert to environment default" }, type: QueryTypes.INSERT, transaction: t }
    );
  });
  overrides.delete(key);
  await publishInvalidate(key);
  cronLogger.info(`[platformSettings] ${key} reverted to env/default by ${changedBy}`);
  const r = resolveRaw(key);
  return { key, value: r.value, source: r.source };
}

export interface ResolvedSetting {
  key: string;
  group: string;
  label: string;
  description?: string;
  type: string;
  unit?: string;
  enumValues?: string[];
  min?: number;
  max?: number;
  editable: boolean;
  requiresStepUp: boolean;
  danger: boolean;
  secret: boolean;
  value: unknown;
  source: SettingSource;
  env_key: string | null;
  default: unknown;
  updated_by: string | null;
  updated_at: string | null;
  version: number | null;
}

const maskSecret = (value: unknown): string => {
  const s = String(value ?? "");
  if (!s) return "";
  return s.length <= 4 ? "••••" : `••••${s.slice(-4)}`;
};

/** All settings, grouped, with effective value + source + override metadata. */
export async function listGrouped(): Promise<{
  groups: Array<{ id: string; label: string; description?: string; settings: ResolvedSetting[] }>;
}> {
  // Fresh read so the admin UI always sees committed values (not a stale 30s cache).
  await loadOverrides();
  const metaRows = (await sequelize
    .query(`SELECT key, updated_by, updated_at, version FROM tbl_platform_setting`, { type: QueryTypes.SELECT })
    .catch(() => [])) as Array<{ key: string; updated_by: string | null; updated_at: string | null; version: number | null }>;
  const meta = new Map(metaRows.map((r) => [r.key, r]));

  const resolve = (d: SettingDef): ResolvedSetting => {
    const r = resolveRaw(d.key);
    const m = meta.get(d.key);
    return {
      key: d.key,
      group: d.group,
      label: d.label,
      description: d.description,
      type: d.type,
      unit: d.unit,
      enumValues: d.enumValues,
      min: d.min,
      max: d.max,
      editable: d.editable,
      requiresStepUp: !!d.requiresStepUp,
      danger: !!d.danger,
      secret: !!d.secret,
      value: d.secret ? maskSecret(r.value) : r.value,
      source: r.source,
      env_key: d.envKey,
      default: d.secret ? maskSecret(d.default) : d.default,
      updated_by: m?.updated_by ?? null,
      updated_at: m?.updated_at ?? null,
      version: m?.version ?? null,
    };
  };

  return {
    groups: GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      description: g.description,
      settings: REGISTRY.filter((d) => d.group === g.id).map(resolve),
    })),
  };
}

export async function getHistory(key?: string | null, limit = 100): Promise<unknown[]> {
  const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const where = key ? `WHERE key = :key` : ``;
  return (await sequelize
    .query(
      `SELECT history_id, key, old_value, new_value, changed_by, reason, changed_at
         FROM tbl_platform_setting_history ${where}
        ORDER BY changed_at DESC LIMIT :lim`,
      { replacements: { key: key || null, lim }, type: QueryTypes.SELECT }
    )
    .catch(() => [])) as unknown[];
}

export default {
  ready,
  getNumber,
  getBool,
  getString,
  getCsv,
  sourceOf,
  setSetting,
  revertSetting,
  listGrouped,
  getHistory,
  SettingError,
};
