const CHAIN_MAP: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  LTC: "litecoin",
  DOGE: "dogecoin",
  BCH: "bitcoin-cash",
  SOL: "solana",
  XRP: "ripple",
  POLYGON: "polygon",
  BNB: "bnb",
};

/** Public block-explorer URL for a tx hash on the given asset/network code. */
export const explorerTxUrl = (crypto: string, txHash: string): string => {
  const upper = String(crypto || "").toUpperCase();
  if (upper.includes("TRC20") || upper === "TRX") return `https://tronscan.org/#/transaction/${txHash}`;
  if (upper.includes("ERC20")) return `https://blockchair.com/ethereum/transaction/${txHash}`;
  if (upper.includes("POLYGON")) return `https://blockchair.com/polygon/transaction/${txHash}`;
  return `https://blockchair.com/${CHAIN_MAP[upper] || "bitcoin"}/transaction/${txHash}`;
};

export const shortHash = (hash?: string | null, head = 8, tail = 6): string => {
  const h = String(hash || "");
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
};
