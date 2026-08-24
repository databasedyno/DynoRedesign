/**
 * Single source of truth for Tatum HTTP auth + base URLs (refactor item 2).
 *
 * Consolidates the scattered `process.env.TATUM_KEY` reads, hardcoded
 * `https://api.tatum.io/...` base URLs and per-file `x-api-key` header building
 * that were duplicated across ~8 service/helper files. Pairs with the shared
 * resilient transport in `utils/tatumHttp.ts` (retry + keep-alive).
 *
 * NOTE: the high-level wrapper `apis/tatumApi.ts` keeps its own richer
 * `getTatumKey()` (which ALSO has a Google Secret Manager fallback when no env
 * key is set). This module mirrors the ENV + testnet resolution the offenders
 * already used (they never had the SM fallback), so behaviour is unchanged
 * wherever an env key is present — always true in prod/staging.
 */

export const TATUM_V3_URL = "https://api.tatum.io/v3";
export const TATUM_V4_URL = "https://api.tatum.io/v4";

export const isTatumTestnet = (): boolean => process.env.TATUM_TESTNET === "true";
export const getTatumTestnetType = (): string =>
  process.env.TATUM_TESTNET_TYPE || "ethereum-sepolia";

/**
 * Resolve the Tatum API key (testnet-aware) from env.
 * Mirrors the env path of `apis/tatumApi.ts::getTatumKey()`:
 *   testnet key (when TATUM_TESTNET=true) → TATUM_KEY → TATUM_SECRET_KEY.
 */
export const getTatumApiKey = (): string => {
  if (isTatumTestnet() && process.env.TATUM_TESTNET_KEY) {
    return process.env.TATUM_TESTNET_KEY;
  }
  return process.env.TATUM_KEY || process.env.TATUM_SECRET_KEY || "";
};

/**
 * Standard Tatum auth headers: `x-api-key` plus `x-testnet-type` in testnet
 * mode. Optional `extra` headers are merged in (e.g. Content-Type/Accept).
 */
export const getTatumHeaders = (
  extra: Record<string, string> = {},
): Record<string, string> => {
  const headers: Record<string, string> = { "x-api-key": getTatumApiKey(), ...extra };
  if (isTatumTestnet()) headers["x-testnet-type"] = getTatumTestnetType();
  return headers;
};

/**
 * Tatum EVM JSON-RPC gateway URL — for this endpoint the key is embedded in
 * the PATH (not a header). Returns null when no key is configured.
 */
export const getTatumWeb3Url = (
  chain: "ethereum" | "polygon",
): string | null => {
  const key = getTatumApiKey();
  return key ? `${TATUM_V3_URL}/${chain}/web3/${key}` : null;
};
