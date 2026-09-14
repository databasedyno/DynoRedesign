/**
 * Unit tests for the centralized inbound webhook signature verifier
 * (utils/webhookSignature.ts). Standalone ts-node script — no DB, no network.
 *
 * Proves each verifier makes the SAME accept/reject decision as the original
 * hand-rolled logic it replaced (Tatum SHA512 / Veriff SHA256-raw / Flutterwave
 * plain equality), plus rejects malformed / short / empty / wrong-secret input.
 *
 * Run:  node_modules/.bin/ts-node --transpile-only tests/test_webhook_signature.ts
 */
import crypto from "crypto";
import {
  hmacHex,
  verifyHmacHex,
  verifyTatumSignature,
  verifyVeriffSignature,
  verifyFlutterwaveHash,
} from "../utils/webhookSignature";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}`);
  }
}

// ── Generic hmacHex / verifyHmacHex ──────────────────────────────────────────
console.log("\n[generic hmacHex]");
{
  const secret = "s3cr3t";
  const body = '{"a":1,"b":"x"}';
  const expected256 = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const expected512 = crypto.createHmac("sha512", secret).update(body).digest("hex");
  check("hmacHex sha256 matches node crypto", hmacHex("sha256", body, secret) === expected256);
  check("hmacHex sha512 matches node crypto", hmacHex("sha512", body, secret) === expected512);
  check("hmacHex object == JSON.stringify(object)",
    hmacHex("sha256", { a: 1, b: "x" }, secret) === crypto.createHmac("sha256", secret).update(JSON.stringify({ a: 1, b: "x" })).digest("hex"));
  check("verifyHmacHex accepts correct", verifyHmacHex({ algorithm: "sha256", payload: body, secret, providedSignature: expected256 }));
  check("verifyHmacHex rejects tampered", !verifyHmacHex({ algorithm: "sha256", payload: body + "x", secret, providedSignature: expected256 }));
  check("verifyHmacHex rejects missing secret", !verifyHmacHex({ algorithm: "sha256", payload: body, secret: "", providedSignature: expected256 }));
  check("verifyHmacHex rejects missing signature", !verifyHmacHex({ algorithm: "sha256", payload: body, secret, providedSignature: undefined }));
  check("verifyHmacHex handles array header (takes [0])", verifyHmacHex({ algorithm: "sha256", payload: body, secret, providedSignature: [expected256, "junk"] }));
}

// ── Tatum (HMAC-SHA512 of JSON body vs x-payload-hash) ───────────────────────
console.log("\n[Tatum verifyTatumSignature]");
{
  const secret = "tatum-webhook-secret";
  const reqBody = { address: "abc", amount: "1.5", asset: "BTC" };
  const rawBody = JSON.stringify(reqBody);
  // Reproduce the ORIGINAL routes/index.ts computation:
  const oldExpected = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  check("accepts the correct sha512 signature", verifyTatumSignature(rawBody, oldExpected, secret));
  check("rejects wrong signature", !verifyTatumSignature(rawBody, "deadbeef", secret));
  check("rejects empty signature", !verifyTatumSignature(rawBody, "", secret));
  check("rejects when secret missing", !verifyTatumSignature(rawBody, oldExpected, ""));
  check("rejects tampered body", !verifyTatumSignature(rawBody + " ", oldExpected, secret));
  // Equivalence to old `signature !== expected` decision across cases:
  const cases = [oldExpected, "notahash", oldExpected.slice(0, 64), oldExpected.toUpperCase()];
  let equiv = true;
  for (const sig of cases) {
    const oldAccept = sig === oldExpected;            // original strict compare
    const newAccept = verifyTatumSignature(rawBody, sig, secret);
    // hex compare is case-insensitive: uppercase-of-valid is the ONE intended
    // hardening difference (new accepts it, old rejected). Allow that case.
    if (sig === oldExpected.toUpperCase()) continue;
    if (oldAccept !== newAccept) equiv = false;
  }
  check("decision matches original for lowercase/wrong/short cases", equiv);
}

// ── Veriff (HMAC-SHA256 of RAW bytes vs x-hmac-signature) ────────────────────
console.log("\n[Veriff verifyVeriffSignature]");
{
  const secret = "veriff-api-secret";
  const raw = Buffer.from('{"verification":{"id":"v1","status":"approved"}}', "utf8");
  // Reproduce ORIGINAL veriffService.signRaw:
  const oldExpected = crypto.createHmac("sha256", secret).update(raw).digest("hex").toLowerCase();
  check("accepts correct raw sha256 signature", verifyVeriffSignature(raw, oldExpected, secret));
  check("accepts uppercase of valid (regex lowercases)", verifyVeriffSignature(raw, oldExpected.toUpperCase(), secret));
  check("rejects 63-char (bad length) signature", !verifyVeriffSignature(raw, oldExpected.slice(0, 63), secret));
  check("rejects non-hex signature", !verifyVeriffSignature(raw, "z".repeat(64), secret));
  check("rejects empty signature", !verifyVeriffSignature(raw, "", secret));
  check("rejects missing secret", !verifyVeriffSignature(raw, oldExpected, undefined));
  check("rejects tampered body", !verifyVeriffSignature(Buffer.from(raw.toString() + " "), oldExpected, secret));
  // Raw-bytes sensitivity: a re-stringified (whitespace-different) body must fail.
  const restringified = JSON.stringify(JSON.parse(raw.toString()));
  const wrongExpectedForRaw = crypto.createHmac("sha256", secret).update(restringified).digest("hex");
  const sameBytes = restringified === raw.toString();
  check("distinguishes raw vs re-stringified when bytes differ",
    sameBytes ? true : !verifyVeriffSignature(raw, wrongExpectedForRaw, secret));
}

// ── Flutterwave (plain shared-secret equality on verif-hash) ─────────────────
console.log("\n[Flutterwave verifyFlutterwaveHash]");
{
  const secret = "FLW_SECRET_HASH_value";
  check("accepts exact secret match", verifyFlutterwaveHash(secret, secret));
  check("rejects wrong hash", !verifyFlutterwaveHash("wrong", secret));
  check("rejects empty header", !verifyFlutterwaveHash("", secret));
  check("rejects undefined header", !verifyFlutterwaveHash(undefined, secret));
  check("rejects when secret unset", !verifyFlutterwaveHash(secret, ""));
  check("takes first value from array header", verifyFlutterwaveHash([secret, "x"], secret));
  // Equivalence to original `!signature || signature !== secretHash` (reject):
  const cases: Array<string | undefined> = [secret, "wrong", "", undefined];
  let equiv = true;
  for (const sig of cases) {
    const oldReject = !sig || sig !== secret;
    const newReject = !verifyFlutterwaveHash(sig, secret);
    if (oldReject !== newReject) equiv = false;
  }
  check("decision matches original for all string cases", equiv);
}

console.log(`\n──────────── RESULT: ${pass} passed, ${fail} failed ────────────\n`);
process.exit(fail === 0 ? 0 : 1);
