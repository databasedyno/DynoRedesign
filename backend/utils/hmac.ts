/**
 * Shared HMAC signature primitives (Phase 4 — webhook/signature dedupe).
 *
 * These two functions replace the hand-rolled `crypto.createHmac('sha256', …)`
 * boilerplate that was duplicated across the webhook sender/verifier
 * (`webhooks/index.ts`), the test-webhook signer (`companyController.ts`), and
 * the product download-token mint/verify (`orderFulfillmentService.ts`,
 * `orderController.ts`). Behaviour is byte-identical to those call sites.
 *
 * NOT used for:
 *   • Veriff webhooks — those sign with `crypto-js` HmacSHA256 (kept as-is to
 *     avoid touching the live KYC verification path; see `veriffService.ts`).
 *   • Flutterwave webhooks — a plain shared-secret (`verif-hash`) equality check,
 *     a different scheme entirely (see `webhooks/index.ts`).
 */

import crypto from "crypto";

/**
 * HMAC-SHA256 of `data` keyed by `secret`, hex-encoded (lowercase).
 * Objects/arrays are canonicalised with `JSON.stringify` (matching every
 * existing DynoPay signer); strings are hashed exactly as-is.
 */
export function hmacSha256Hex(data: string | object, secret: string): string {
  const message = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/**
 * Constant-time comparison of two signatures. Returns `false` (never throws)
 * when either input is empty or they differ in byte-length, so malformed or
 * short signatures are rejected instead of crashing the request.
 *
 * @param encoding how to decode the strings into bytes — "hex" for hex-encoded
 *        signatures, "utf8" for opaque token strings.
 */
export function timingSafeCompare(
  a: string,
  b: string,
  encoding: BufferEncoding = "hex",
): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, encoding);
  const bufB = Buffer.from(b, encoding);
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
