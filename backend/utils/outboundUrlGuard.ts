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

export const isPrivateIp = (ip: string): boolean => {
  const kind = net.isIP(ip);
  if (kind === 4) return v4Private(ip);
  if (kind !== 6) return true;
  const lower = ip.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return v4Private(mapped[1]);
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
