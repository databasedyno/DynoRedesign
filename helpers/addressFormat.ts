/**
 * Client-side per-chain address format check (instant feedback only —
 * the backend re-validates authoritatively).
 */
const ADDR_PATTERNS: Record<string, RegExp> = {
  btc: /^(bc1[a-z0-9]{11,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  ltc: /^(ltc1[a-z0-9]{11,87}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,39})$/,
  doge: /^D[1-9A-HJ-NP-Za-km-z]{25,39}$/,
  bch: /^((bitcoincash:)?[qp][a-z0-9]{38,}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/i,
  evm: /^0x[0-9a-fA-F]{40}$/,
  tron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  sol: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  xrp: /^r[1-9A-HJ-NP-Za-km-z]{23,34}$/,
};

export const addressFamilyFor = (chain: string): string => {
  const c = String(chain || "").toUpperCase();
  if (c === "ETH" || c === "POLYGON" || c === "BNB" || c.includes("ERC20") || c.includes("POLYGON")) return "evm";
  if (c === "TRX" || c.includes("TRC20")) return "tron";
  if (c === "BTC") return "btc";
  if (c === "LTC") return "ltc";
  if (c === "DOGE") return "doge";
  if (c === "BCH") return "bch";
  if (c === "SOL") return "sol";
  if (c === "XRP" || c === "RLUSD") return "xrp";
  return "unknown";
};

/** True when the address matches the expected shape for the chain (unknown chains: length sanity only). */
export const isValidAddressFor = (chain: string, addr: string): boolean => {
  const a = String(addr || "").trim();
  if (!a) return false;
  const re = ADDR_PATTERNS[addressFamilyFor(chain)];
  return re ? re.test(a) : a.length >= 12 && a.length <= 255;
};

/** "ok" = shape matches · "unusual" = doesn't match the chain's format · "unknown" = no pattern for this chain. */
export const addressFormatStatus = (chain: string, addr: string): "ok" | "unusual" | "unknown" => {
  const fam = addressFamilyFor(chain);
  if (!ADDR_PATTERNS[fam]) return "unknown";
  return isValidAddressFor(chain, addr) ? "ok" : "unusual";
};
