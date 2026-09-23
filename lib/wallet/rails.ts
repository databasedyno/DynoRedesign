/**
 * Chain catalogue for "Pay with wallet" / "Verify with wallet" (Reown AppKit).
 * Maps Dynopay display codes (CRYPTO_INFO keys, SafeDeal payout keys) to what a
 * wallet needs: chain family, EVM chainId, token contract + decimals.
 * Coins not listed here keep the QR / copy-address flow (BTC, LTC, DOGE, BCH, XRP…).
 */
export type ChainFamily = "evm" | "tron" | "solana";

export interface WalletRail {
  code: string;
  family: ChainFamily;
  /** EVM only */
  chainId?: number;
  /** Token contract (undefined = native coin) */
  token?: string;
  decimals: number;
  symbol: string;
  networkLabel: string;
  explorerTx: (hash: string) => string;
}

const ETHERSCAN = (h: string) => `https://etherscan.io/tx/${h}`;
const POLYGONSCAN = (h: string) => `https://polygonscan.com/tx/${h}`;
const TRONSCAN = (h: string) => `https://tronscan.org/#/transaction/${h}`;
const SOLSCAN = (h: string) => `https://solscan.io/tx/${h}`;

export const WALLET_RAILS: Record<string, WalletRail> = {
  ETH: { code: "ETH", family: "evm", chainId: 1, decimals: 18, symbol: "ETH", networkLabel: "Ethereum", explorerTx: ETHERSCAN },
  POLYGON: { code: "POLYGON", family: "evm", chainId: 137, decimals: 18, symbol: "POL", networkLabel: "Polygon", explorerTx: POLYGONSCAN },
  "USDT-ERC20": { code: "USDT-ERC20", family: "evm", chainId: 1, token: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, symbol: "USDT", networkLabel: "Ethereum", explorerTx: ETHERSCAN },
  "USDC-ERC20": { code: "USDC-ERC20", family: "evm", chainId: 1, token: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, symbol: "USDC", networkLabel: "Ethereum", explorerTx: ETHERSCAN },
  "RLUSD-ERC20": { code: "RLUSD-ERC20", family: "evm", chainId: 1, token: "0x8292Bb45bf1Ee4d140127049757C2E0fF06317eD", decimals: 18, symbol: "RLUSD", networkLabel: "Ethereum", explorerTx: ETHERSCAN },
  "USDT-POLYGON": { code: "USDT-POLYGON", family: "evm", chainId: 137, token: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, symbol: "USDT", networkLabel: "Polygon", explorerTx: POLYGONSCAN },
  "USDC-POLYGON": { code: "USDC-POLYGON", family: "evm", chainId: 137, token: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, symbol: "USDC", networkLabel: "Polygon", explorerTx: POLYGONSCAN },
  TRX: { code: "TRX", family: "tron", decimals: 6, symbol: "TRX", networkLabel: "Tron", explorerTx: TRONSCAN },
  "USDT-TRC20": { code: "USDT-TRC20", family: "tron", token: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, symbol: "USDT", networkLabel: "Tron", explorerTx: TRONSCAN },
  "USDT-TRON": { code: "USDT-TRON", family: "tron", token: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", decimals: 6, symbol: "USDT", networkLabel: "Tron", explorerTx: TRONSCAN },
  SOL: { code: "SOL", family: "solana", decimals: 9, symbol: "SOL", networkLabel: "Solana", explorerTx: SOLSCAN },
};

export const walletRailFor = (code?: string | null): WalletRail | null => WALLET_RAILS[String(code || "").toUpperCase()] || null;
export const isWalletPayable = (code?: string | null): boolean => !!walletRailFor(code);

/** Decimal string → integer base units as BigInt (no float math). */
export function toBaseUnits(amount: string | number, decimals: number): bigint {
  const s = String(amount).trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") throw new Error("Invalid amount");
  const [whole = "0", frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * BigInt(`1${"0".repeat(decimals)}`) + BigInt(fracPadded || "0");
}

export const CAIP_NAMESPACE: Record<ChainFamily, "eip155" | "solana" | "tron"> = { evm: "eip155", solana: "solana", tron: "tron" };
