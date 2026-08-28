import ipaddr from "ipaddr.js";

/**
 * Small IP allowlist matcher supporting BOTH exact IPs ("1.2.3.4") and CIDR
 * ranges ("34.82.0.0/16"). Replaces the previous exact-only `Set.has()` check,
 * which silently never matched entries that were meant as ranges.
 *
 * IPv4 and IPv6 are both supported; an IPv4-mapped IPv6 client address
 * (`::ffff:1.2.3.4`) is normalized to its IPv4 form before comparison.
 * Invalid list entries and unparseable client IPs are treated as "no match"
 * (never throws).
 */

type ParsedAddr = ipaddr.IPv4 | ipaddr.IPv6;
type ParsedCidr = [ParsedAddr, number];

// ::ffff:1.2.3.4 -> 1.2.3.4 (and trim whitespace / stray port-less noise)
const normalizeIp = (ip: string): string => {
  const s = (ip || "").trim();
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  return m ? m[1] : s;
};

export const createIpMatcher = (entries: string[]): ((ip: string) => boolean) => {
  const exacts = new Set<string>();
  const cidrs: ParsedCidr[] = [];

  for (const raw of entries) {
    const entry = (raw || "").trim();
    if (!entry) continue;
    try {
      if (entry.includes("/")) {
        cidrs.push(ipaddr.parseCIDR(entry));
      } else {
        // Canonicalize so "1.2.3.4" and "::ffff:1.2.3.4" compare equal.
        exacts.add(ipaddr.parse(entry).toNormalizedString());
      }
    } catch {
      // Skip malformed allowlist entries rather than crash on boot.
    }
  }

  return (ip: string): boolean => {
    const norm = normalizeIp(ip);
    if (!norm) return false;
    let parsed: ParsedAddr;
    try {
      parsed = ipaddr.parse(norm);
    } catch {
      return false;
    }
    if (exacts.has(parsed.toNormalizedString())) return true;
    for (const cidr of cidrs) {
      try {
        if (parsed.kind() === cidr[0].kind() && parsed.match(cidr)) return true;
      } catch {
        // Ignore v4/v6 comparison mismatches.
      }
    }
    return false;
  };
};

export default { createIpMatcher };
