import crypto from "crypto";

/**
 * Merchant API-key tokens (Stripe/Coinbase model).
 *
 * The merchant receives an opaque random token exactly once. We persist only
 * sha256(token) in tbl_api.key_hash plus a display hint (prefix + first/last 4).
 * A database read can therefore never recover a usable key.
 *
 * key_version 1 = legacy: the AES ciphertext itself was the credential (hashed
 * in place by migration 0025, plaintext wiped by the prod rollout job).
 * key_version 2 = opaque token generated here.
 */
export type ApiKeyEnvironment = "production" | "development";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BODY_LENGTH = 43; // 43 base62 chars ≈ 256 bits of entropy

export const API_KEY_VERSION_LEGACY = 1;
export const API_KEY_VERSION_TOKEN = 2;

export const apiKeyPrefix = (environment?: string | null): "dpk_live_" | "dpk_test_" =>
  environment === "development" ? "dpk_test_" : "dpk_live_";

export function generateApiKeyToken(environment: ApiKeyEnvironment | string): string {
  let body = "";
  while (body.length < BODY_LENGTH) {
    for (const b of crypto.randomBytes(64)) {
      if (b >= 248) continue; // 248 = 4*62 → rejection sampling removes modulo bias
      body += ALPHABET[b % 62];
      if (body.length === BODY_LENGTH) break;
    }
  }
  return apiKeyPrefix(environment) + body;
}

export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(String(key), "utf8").digest("hex");
}

/** Display-only hint, e.g. "dpk_live_Ab3k…9xQz". Legacy ciphertext keys → "dpk_live_…9xQz". */
export function apiKeyHint(key: string, environment?: string | null): string {
  const prefix = apiKeyPrefix(environment);
  const k = String(key || "");
  if (k.length < 8) return `${prefix}••••`;
  if (k.startsWith(prefix)) {
    const body = k.slice(prefix.length);
    return `${prefix}${body.slice(0, 4)}…${body.slice(-4)}`;
  }
  return `${prefix}…${k.replace(/=+$/, "").slice(-4)}`;
}

/** Cheap shape check before hitting the DB — rejects junk without a query. */
export function looksLikeApiKey(value: unknown): value is string {
  return typeof value === "string" && value.length >= 16 && value.length <= 512;
}
