/**
 * redactSecrets — return a deep copy of a value with any secret-bearing keys
 * masked, for safe logging. NEVER mutates the input (some callers log the very
 * object they then pass to the signing SDK, so mutating would break the call).
 *
 * WHY: chain "payload" debug logs in apis/tatumApi.ts printed `privateKey` /
 * `fromPrivateKey` in cleartext, so wallet key material landed in production
 * logs. Wrapping the logged object in redactSecrets() keeps the debug shape
 * while masking the sensitive fields.
 */

const SECRET_KEY_RE = /(privatekey|fromprivatekey|privkey|mnemonic|secretkey|xpub|seed)/i;
const MASK = "***REDACTED***";

export function redactSecrets<T>(value: T): T {
  const seen = new WeakSet<object>();

  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return "[Circular]";
    seen.add(v as object);

    if (Array.isArray(v)) {
      return v.map((item) => walk(item));
    }
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (SECRET_KEY_RE.test(k)) {
        out[k] = typeof val === "string" && val.length > 0 ? MASK : val;
      } else {
        out[k] = walk(val);
      }
    }
    return out;
  };

  return walk(value) as T;
}

export default redactSecrets;
