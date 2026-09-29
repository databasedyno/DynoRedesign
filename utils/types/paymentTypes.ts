export interface currencyData {
  currency: string;
  amount: string | number;
  transferRate: string;
  // Runtime fields set by cryptoTransfer + friends after fee calc / conversion.
  // Optional because they're populated post-hoc, not part of the initial ticker fetch.
  total_amount?: number;
  total_amount_usd?: number;
  total_amount_source?: number;
  processing_fee?: number;
}

/**
 * Backward-compat shape — the payment layer (cryptoTransfer.tsx +
 * pages/pay/index.tsx) imports a `walletState` type here. Kept narrow
 * enough that `.currency` / `.amount` type as `string | undefined` /
 * `number | undefined` rather than the more permissive `unknown`, so
 * downstream props that expect `string` don't silently accept `unknown`.
 */
export interface walletState {
  currency?: string;
  amount?: number | string;
  [key: string]: unknown;
}
