/**
 * Smart Paste helpers — detect the family a pasted crypto address belongs to so
 * the wallet manager can offer "apply to all compatible networks".
 *
 * EVM  (0x…40 hex)  -> every EVM/ERC-20 chain shares the same address.
 * Tron (T…base58)   -> TRX + USDT-TRC20 share the same address.
 */
export const EVM_CURRENCIES = [
  "ETH",
  "USDT-ERC20",
  "USDC-ERC20",
  "RLUSD-ERC20",
  "POLYGON",
  "USDT-POLYGON",
] as const;

export const TRON_CURRENCIES = ["TRX", "USDT-TRC20"] as const;

export type AddrKind = "evm" | "tron" | "unknown";

export function detectAddressKind(address: string): AddrKind {
  const a = (address || "").trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return "tron";
  return "unknown";
}

export function compatibleCurrencies(kind: AddrKind): string[] {
  if (kind === "evm") return [...EVM_CURRENCIES];
  if (kind === "tron") return [...TRON_CURRENCIES];
  return [];
}

export function addrKindLabel(kind: AddrKind): string {
  if (kind === "evm") return "Ethereum-style (EVM)";
  if (kind === "tron") return "Tron (TRC-20)";
  return "";
}

const XRPL_CURRENCIES = ["XRP", "RLUSD"];

/** Mirrors the backend format guard so typos surface before a save round-trip. */
export function isPlausibleAddress(address: string, currency: string): boolean {
  const a = (address || "").trim();
  if (!a) return false;
  if ((EVM_CURRENCIES as readonly string[]).includes(currency)) return /^0x[0-9a-fA-F]{40}$/.test(a);
  if ((TRON_CURRENCIES as readonly string[]).includes(currency)) return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a);
  if (XRPL_CURRENCIES.includes(currency)) return /^r[0-9a-zA-Z]{24,34}$/.test(a);
  if (currency === "BTC") return /^(bc1[0-9a-z]{20,80}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  if (currency === "LTC") return /^(ltc1[0-9a-z]{20,80}|[LM3][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  if (currency === "DOGE") return /^D[a-km-zA-HJ-NP-Z1-9]{25,39}$/.test(a);
  if (currency === "BCH") return /^((bitcoincash:)?[qp][a-z0-9]{38,50}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a);
  if (currency === "SOL") return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a);
  return true;
}

export function shortAddress(address: string, head = 8, tail = 6): string {
  const a = (address || "").trim();
  return a.length > head + tail + 3 ? `${a.slice(0, head)}…${a.slice(-tail)}` : a;
}
