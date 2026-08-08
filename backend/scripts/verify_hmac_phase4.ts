/* Phase-4 verification: prove the shared hmac helpers are byte-identical to the
 * old inline crypto logic they replaced. Read-only, no DB, safe to run. */
import crypto from "crypto";
import { hmacSha256Hex, timingSafeCompare } from "../utils/hmac";

let fails = 0;
const check = (name: string, cond: boolean) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
  if (!cond) fails++;
};

const secret = "test-secret-Katie-123";

// 1) Object payload (webhook signer / companyController): JSON.stringify path
const obj = { event: "webhook.test", webhook_id: "abc-123", timestamp: 1737000000, nested: { a: 1, b: [1, 2, 3] } };
const oldObjSig = crypto.createHmac("sha256", secret).update(JSON.stringify(obj)).digest("hex");
check("hmacSha256Hex(object) == inline JSON.stringify hmac", hmacSha256Hex(obj, secret) === oldObjSig);

// 2) String payload (verifyWebhookSignature receives a raw string)
const raw = JSON.stringify(obj);
const oldStrSig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
check("hmacSha256Hex(string) == inline string hmac", hmacSha256Hex(raw, secret) === oldStrSig);

// 3) Webhook verify (hex compare) — valid + tampered
check("verify valid (hex)", timingSafeCompare(oldStrSig, hmacSha256Hex(raw, secret), "hex") === true);
check("verify tampered (hex)", timingSafeCompare(oldStrSig, hmacSha256Hex(raw + "x", secret), "hex") === false);
check("verify malformed short sig -> false (no throw)", timingSafeCompare("abcd", oldStrSig, "hex") === false);

// 4) Download token (orderFulfillment/orderController): hmac hex .slice(0,32) + utf8 compare
const dlSecret = "dl-secret";
const payload = `${42}:${7}:${1737000000}`;
const oldTokenSig = crypto.createHmac("sha256", dlSecret).update(payload).digest("hex").slice(0, 32);
const newTokenSig = hmacSha256Hex(payload, dlSecret).slice(0, 32);
check("download-token sig .slice(0,32) identical", newTokenSig === oldTokenSig);

// old compare: Buffer.from(sig) (utf8) + length guard + timingSafeEqual
const oldCompare = (sig: string, expected: string) => {
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};
check("download-token verify matches old (valid)", timingSafeCompare(newTokenSig, oldTokenSig, "utf8") === oldCompare(newTokenSig, oldTokenSig));
check("download-token verify matches old (tampered)", timingSafeCompare("0000000000000000000000000000000x", oldTokenSig, "utf8") === oldCompare("0000000000000000000000000000000x", oldTokenSig));

console.log(fails === 0 ? "\nALL PASS ✅" : `\n${fails} FAILURES ❌`);
process.exit(fails === 0 ? 0 : 1);
