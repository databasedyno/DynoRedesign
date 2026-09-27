import dns from "dns/promises";
import net from "net";

/**
 * SSRF guard for merchant-supplied outbound URLs (webhooks, callbacks).
 * Blocks non-http(s) schemes, link-local/metadata, loopback, RFC1918/CGNAT,
 * multicast and private-network hostnames — both as literals and after DNS
 * resolution — so a merchant can't point us at cloud metadata or peers.
 */

const BLOCKED_HOST_RE = /(^|\.)(localhost|localdomain|local|internal|railway\.internal|home\.arpa)$/i;

const v4Private = (ip: string): boolean => {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

/** Expand any textual IPv6 into its 8 16-bit groups; null if unparseable. */
const parseV6Groups = (ip: string): number[] | null => {
  let s = ip;
  const pct = s.indexOf("%");
  if (pct >= 0) s = s.slice(0, pct); // drop zone id
  // Convert a trailing embedded IPv4 (e.g. ::ffff:1.2.3.4) into two hextets.
  const v4 = s.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (v4 && v4.index !== undefined) {
    const p = v4[1].split(".").map(Number);
    if (p.some((n) => n > 255)) return null;
    const hex =
      (((p[0] << 8) | p[1]) >>> 0).toString(16) + ":" + (((p[2] << 8) | p[3]) >>> 0).toString(16);
    s = s.slice(0, v4.index) + hex;
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const toGroups = (part: string): number[] =>
    part === "" ? [] : part.split(":").map((h) => parseInt(h, 16));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  let groups: number[];
  if (halves.length === 1) {
    groups = head;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    groups = [...head, ...Array(missing).fill(0), ...tail];
  }
  if (groups.length !== 8 || groups.some((g) => Number.isNaN(g) || g < 0 || g > 0xffff)) return null;
  return groups;
};

/** Embedded IPv4 (dotted) if `ip` is an IPv4-mapped/compatible IPv6, else null. */
const mappedV4FromV6 = (ip: string): string | null => {
  const g = parseV6Groups(ip);
  if (!g) return null;
  const firstFourZero = g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0;
  // ::ffff:a.b.c.d (mapped, g5=0xffff) and ::a.b.c.d (compat, g5=0).
  if (firstFourZero && (g[5] === 0xffff || g[5] === 0)) {
    const hi = g[6], lo = g[7];
    if (g[5] === 0 && hi === 0 && (lo === 0 || lo === 1)) return null; // :: / ::1 → caller handles
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
  }
  return null;
};

export const isPrivateIp = (ip: string): boolean => {
  const kind = net.isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind !== 6) return true;
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // IPv4-mapped/compatible IPv6 in ANY textual form (::ffff:7f00:1,
  // 0:0:0:0:0:ffff:7f00:1, ::ffff:127.0.0.1, …) → judge by embedded IPv4.
  const mapped = mappedV4FromV6(lower);
  if (mapped) return v4Private(mapped);
  return /^(fc|fd|fe[89ab]|ff)/.test(lower);
};

export class UnsafeWebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeWebhookUrlError";
  }
}

/** Throws UnsafeWebhookUrlError when the URL must not be contacted. */
export const assertSafeOutboundUrl = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeWebhookUrlError(`Webhook URL "${raw}" is not a valid URL.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeWebhookUrlError(`Webhook URL "${raw}" must use http or https.`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST_RE.test(host) || (net.isIP(host) && isPrivateIp(host))) {
    throw new UnsafeWebhookUrlError(`Webhook URL "${raw}" points to a private or local address which is unreachable from Dynopay servers. Please use a public URL.`);
  }
  if (!net.isIP(host)) {
    let addresses: { address: string }[] = [];
    try {
      addresses = await dns.lookup(host, { all: true });
    } catch {
      throw new UnsafeWebhookUrlError(`Webhook URL host "${host}" could not be resolved.`);
    }
    if (addresses.length === 0 || addresses.some((a) => isPrivateIp(a.address))) {
      throw new UnsafeWebhookUrlError(`Webhook URL host "${host}" resolves to a private address which is unreachable from Dynopay servers.`);
    }
  }
  return url;
};
