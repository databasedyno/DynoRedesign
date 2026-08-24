/**
 * Typed application config (Phase 5).
 *
 * A single typed surface over `process.env` so call sites stop sprinkling raw
 * `process.env.X` reads (741 across 113 files). This is intentionally
 * non-breaking: `process.env` (populated by dotenv in server.ts before this
 * module is first imported) remains the source of truth, and every value here
 * mirrors the exact fallback the old inline reads used. Migrate incrementally —
 * new or touched code reads from `config`; nothing is forced to change at once.
 */

/** Trimmed string env read with a fallback (default ""). */
export const str = (key: string, fallback = ""): string => {
  const v = process.env[key];
  return v == null ? fallback : v.trim();
};

/** Numeric env read with a fallback; non-numeric/empty → fallback. */
export const num = (key: string, fallback: number): number => {
  const raw = process.env[key];
  if (raw == null || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

/** Boolean env read: "1"/"true"/"yes"/"on" (case-insensitive) → true. */
export const bool = (key: string, fallback = false): boolean => {
  const v = process.env[key];
  if (v == null || v.trim() === "") return fallback;
  return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
};

/** Read a required env var; throws a clear error if missing/empty. */
export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return v;
}

const nodeEnv = str("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

// Database — mirrors the exact reads/fallbacks in utils/dbInstance.ts.
const db = {
  /** Full connection string; when set it is preferred (and enables SSL for railway). */
  url: str("DATABASE_URL"),
  name: str("DB_NAME"),
  user: str("USER_NAME"),
  password: str("PASSWORD"),
  host: str("HOST"),
  port: num("DB_PORT", 5432),
  poolMax: num("DB_POOL_MAX", 20),
  poolMin: num("DB_POOL_MIN", 5),
  poolIdle: num("DB_POOL_IDLE", 10000),
  /** `DB_SSL_REJECT_UNAUTHORIZED !== 'false'` → default true unless explicitly disabled. */
  sslRejectUnauthorized: str("DB_SSL_REJECT_UNAUTHORIZED") !== "false",
} as const;

export const config = {
  // ── Environment ────────────────────────────────────────────
  env: nodeEnv,
  isProduction,

  // ── Public / server URLs ───────────────────────────────────
  serverUrl: str("SERVER_URL"),
  frontendUrl: str("FRONTEND_URL"),
  /** Hosted-checkout base — mirrors `CHECKOUT_URL || 'https://checkout.dynopay.com'`. */
  checkoutUrl: str("CHECKOUT_URL") || "https://checkout.dynopay.com",
  publicBaseUrl: str("NEXT_PUBLIC_BASE_URL"),
  internalBackendUrl: str("INTERNAL_BACKEND_URL", "http://localhost:3300"),

  // ── Secrets ────────────────────────────────────────────────
  accessTokenSecret: str("ACCESS_TOKEN_SECRET"),
  apiSecret: str("API_SECRET"),

  // ── Database / Redis ───────────────────────────────────────
  db,
  redisUrl: str("REDIS_PUBLIC_URL"),

  // ── Worker / jobs ──────────────────────────────────────────
  workerRole: str("WORKER_ROLE", "primary").toLowerCase(),
  enableBackgroundJobs: bool("ENABLE_BACKGROUND_JOBS"),

  // ── Ops / misc ─────────────────────────────────────────────
  adminEmail: str("ADMIN_EMAIL"),

  // Generic typed accessors for anything not curated above.
  str,
  num,
  bool,
  requireEnv,
} as const;

export default config;
