/**
 * Key Custody Service — the ONLY sanctioned boundary for turning an encrypted
 * wallet key into usable plaintext (Tier-2 Item #8).
 *
 * Rules:
 *   - All private-key decryption goes through here (do NOT call
 *     tatumApi.decryptSymmetric elsewhere).
 *   - Every access writes an append-only tbl_key_access_audit row.
 *   - We never log / persist the plaintext key or the raw ciphertext — only
 *     sha256(ciphertext) for correlation.
 *
 * Prefer `withPrivateKey(...)` (scopes the key to a callback) over
 * `decryptPrivateKey(...)` (returns the raw key) — see KEY_CUSTODY_THREAT_MODEL.md.
 */

import crypto from "crypto";
import tatumApi from "../../apis/tatumApi";
import KeyAccessAudit from "../../models/keyAccessAuditModel";
import { cronLogger } from "../../utils/loggers";

export interface KeyAccessContext {
  purpose: string;                 // 'gas_funding' | 'pool_sweep' | 'settlement' | ...
  actor?: string;                  // default 'system'
  walletType?: string | null;
  walletAddress?: string | null;
  paymentId?: string | null;
  correlationId?: string | null;
}

function hashRef(ciphertext: string): string {
  try {
    return crypto.createHash("sha256").update(String(ciphertext)).digest("hex");
  } catch {
    return "unhashable";
  }
}

async function audit(
  ciphertext: string,
  keyId: string | undefined,
  ctx: KeyAccessContext,
  success: boolean,
  error?: string
): Promise<void> {
  // Never let an audit-write failure break a live sweep — best-effort only.
  try {
    await KeyAccessAudit.create({
      key_ref_hash: hashRef(ciphertext),
      key_id: keyId ?? null,
      purpose: ctx.purpose,
      actor: ctx.actor ?? "system",
      wallet_type: ctx.walletType ?? null,
      wallet_address: ctx.walletAddress ?? null,
      payment_id: ctx.paymentId ?? null,
      correlation_id: ctx.correlationId ?? null,
      success,
      error: error ? String(error).slice(0, 2000) : null,
    });
  } catch (e) {
    cronLogger.warn(`[KeyCustody] audit write failed (non-fatal): ${(e as Error).message}`);
  }
}

/**
 * Drop-in replacement for `tatumApi.decryptSymmetric(ciphertext, keyId)` that
 * additionally records an audit trail. Returns the plaintext key.
 */
export async function decryptPrivateKey(
  ciphertext: string,
  keyId: string | undefined,
  ctx: KeyAccessContext
): Promise<string> {
  try {
    const plaintext = await tatumApi.decryptSymmetric(ciphertext, keyId);
    await audit(ciphertext, keyId, ctx, true);
    return plaintext;
  } catch (err) {
    await audit(ciphertext, keyId, ctx, false, (err as Error).message);
    throw err;
  }
}

/**
 * Preferred form: decrypt, run `fn` with the key, then best-effort scrub the
 * local reference. Narrows the window the plaintext key is reachable.
 */
export async function withPrivateKey<T>(
  ciphertext: string,
  keyId: string | undefined,
  ctx: KeyAccessContext,
  fn: (privateKey: string) => Promise<T>
): Promise<T> {
  let key: string | null = await decryptPrivateKey(ciphertext, keyId, ctx);
  try {
    return await fn(key);
  } finally {
    // JS strings are immutable/GC'd — we cannot zero memory, but we drop the
    // only reference we hold so it becomes collectable ASAP.
    key = null;
    void key;
  }
}

export default { decryptPrivateKey, withPrivateKey };
