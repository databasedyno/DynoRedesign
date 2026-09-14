/**
 * Centralized INBOUND webhook signature verification (refactor item 3).
 *
 * Single source of truth for verifying signatures on webhooks we RECEIVE from
 * third-party providers. Before this module the verification crypto was
 * hand-rolled and duplicated across:
 *   • Tatum       — `routes/index.ts`            (HMAC-SHA512 → `x-payload-hash`)
 *   • Veriff      — `services/veriffService.ts`  (HMAC-SHA256 of RAW body → `x-hmac-signature`)
 *   • Flutterwave — `webhooks/index.ts`          (plain shared-secret → `verif-hash`)
 *
 * Design goals:
 *   1. ONE tested place for every inbound verifier.
 *   2. Every comparison is CONSTANT-TIME (via `timingSafeCompare`) and NEVER
 *      throws — a missing / malformed / short / wrong-length signature is
 *      rejected (returns `false`), it never crashes the request handler.
 *   3. Behaviour matches each original call site's accept/reject decision. The
 *      only intentional hardening is that comparisons that used a plain `!==`
 *      (Tatum, Flutterwave) are now timing-safe.
 *
 * NOTE: OUTBOUND signing (the signatures WE attach to merchant webhooks and
 * download tokens) already lives in `utils/hmac.ts` — this module builds on the
 * same primitives (`timingSafeCompare`) and is the inbound counterpart.
 */

import { raw as envRaw } from "./config";
import crypto from "crypto";
import { timingSafeCompare } from "./hmac";

export type HmacAlgorithm = "sha256" | "sha512";

/**
 * Generic HMAC → lowercase hex.
 * - strings / Buffers are hashed as-is (a string is treated as utf8 by Node,
 *   identical to `Buffer.from(str, "utf8")`).
 * - objects/arrays are canonicalised with `JSON.stringify` (the DynoPay
 *   convention shared with `utils/hmac.ts`).
 */
export function hmacHex(
  algorithm: HmacAlgorithm,
  data: string | Buffer | object,
  secret: string,
): string {
  const message =
    typeof data === "string" || Buffer.isBuffer(data) ? data : JSON.stringify(data);
  return crypto.createHmac(algorithm, secret).update(message as string | Buffer).digest("hex");
}

/** Normalise a header value that Express may hand us as `string | string[]`. */
const firstHeaderValue = (
  value: string | string[] | null | undefined,
): string | undefined => (Array.isArray(value) ? value[0] : value ?? undefined);

/**
 * Generic hex-HMAC verify (constant-time, never throws).
 * Returns `false` when the secret or provided signature is missing, so callers
 * can branch safely without a try/catch.
 */
export function verifyHmacHex(params: {
  algorithm: HmacAlgorithm;
  payload: string | Buffer;
  secret?: string | null;
  providedSignature?: string | string[] | null;
}): boolean {
  const { algorithm, payload, secret } = params;
  const provided = firstHeaderValue(params.providedSignature);
  if (!secret || !provided) return false;
  const expected = hmacHex(algorithm, payload, secret);
  // hex encoding => the compare is case-insensitive (matches the existing
  // `utils/hmac.ts` convention and every provider that sends lowercase hex).
  return timingSafeCompare(String(provided).trim(), expected, "hex");
}

/**
 * Tatum: HMAC-SHA512 of the request body vs the `x-payload-hash` header.
 * Mirrors `routes/index.ts` (which passes `JSON.stringify(req.body)` as the
 * payload). Reads `TATUM_WEBHOOK_SECRET` unless a secret is supplied.
 */
export function verifyTatumSignature(
  payload: string | Buffer,
  providedSignature?: string | string[] | null,
  secret: string | undefined = envRaw("TATUM_WEBHOOK_SECRET"),
): boolean {
  return verifyHmacHex({ algorithm: "sha512", payload, secret, providedSignature });
}

/**
 * Veriff: HMAC-SHA256 of the RAW request bytes vs the `x-hmac-signature`
 * header. Preserves the strict 64-hex-char format guard from the original
 * `veriffService.verifyWebhookRaw`, then verifies constant-time.
 */
export function verifyVeriffSignature(
  raw: Buffer | string,
  providedSignature?: string | null,
  secret?: string,
): boolean {
  const supplied = String(providedSignature || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(supplied)) return false;
  if (!secret) return false;
  return verifyHmacHex({
    algorithm: "sha256",
    payload: raw,
    secret,
    providedSignature: supplied,
  });
}

/**
 * Flutterwave: a plain shared-secret equality — the `verif-hash` header must
 * equal `FLW_SECRET_HASH` (this provider does NOT HMAC-sign). Compared
 * constant-time over the raw utf8 bytes. Reads `FLW_SECRET_HASH` unless a
 * secret is supplied.
 */
export function verifyFlutterwaveHash(
  providedHash?: string | string[] | null,
  secret: string | undefined = envRaw("FLW_SECRET_HASH"),
): boolean {
  const provided = firstHeaderValue(providedHash);
  if (!secret || !provided) return false;
  return timingSafeCompare(String(provided), secret, "utf8");
}
