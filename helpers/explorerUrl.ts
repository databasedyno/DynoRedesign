// Public block-explorer URLs, per asset/network. Each chain needs its own
// explorer — routing everything through blockchair (the old behaviour) 400s for
// XRP/SOL/RLUSD and silently mislabels tokens, which is what QA hit on
// "View on Explorer". Order matters: check token suffixes before base assets.

const BLOCKCHAIR_UTXO: Record<string, string> = {
  BTC: "bitcoin",
  LTC: "litecoin",
  DOGE: "dogecoin",
  BCH: "bitcoin-cash",
};

/** Public block-explorer URL for a tx hash on the given asset/network code. */
export const explorerTxUrl = (crypto: string, txHash: string): string => {
  const upper = String(crypto || "").toUpperCase();
  const hash = String(txHash || "").trim();
  if (!hash) return "";

  // Tron (TRX + TRC-20 tokens)
  if (upper === "TRX" || upper.includes("TRC20") || upper.includes("TRON")) return `https://tronscan.org/#/transaction/${hash}`;
  // XRP Ledger (native XRP + RLUSD issued on XRPL — NOT the ERC-20 variant)
  if (upper === "XRP" || upper === "RLUSD") return `https://xrpscan.com/tx/${hash}`;
  // Solana
  if (upper === "SOL" || upper.includes("SPL")) return `https://solscan.io/tx/${hash}`;
  // Polygon PoS (MATIC + Polygon tokens)
  if (upper === "POLYGON" || upper === "MATIC" || upper.includes("POLYGON")) return `https://polygonscan.com/tx/${hash}`;
  // BNB Smart Chain
  if (upper === "BNB" || upper.includes("BEP20") || upper.includes("BSC")) return `https://bscscan.com/tx/${hash}`;
  // Ethereum + all ERC-20 tokens (USDT-ERC20, USDC-ERC20, RLUSD-ERC20, ETH)
  if (upper === "ETH" || upper.includes("ERC20") || upper.includes("ETH")) return `https://etherscan.io/tx/${hash}`;
  // UTXO chains via blockchair
  if (BLOCKCHAIR_UTXO[upper]) return `https://blockchair.com/${BLOCKCHAIR_UTXO[upper]}/transaction/${hash}`;
  // Fallback (unknown/new asset): blockchair search resolves most hashes.
  return `https://blockchair.com/search?q=${hash}`;
};

export const shortHash = (hash?: string | null, head = 8, tail = 6): string => {
  const h = String(hash || "");
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
};
