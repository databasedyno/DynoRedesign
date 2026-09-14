/**
 * Describe how an auto-converted payment was paid out to the merchant.
 * Binance withdrawal history returns either a real chain tx id, or a marker such as
 * "Off-chain transfer 123…" / "Internal transfer 123…" when the merchant's payout address is
 * itself Binance-hosted (settled inside Binance, no on-chain hash).
 */
export interface AutoConvertPayout {
  /** On-chain hash of the Binance → merchant withdrawal (null while pending / when off-chain). */
  payout_tx_hash: string | null;
  /** True when Binance settled the payout internally (no blockchain transaction exists). */
  payout_offchain: boolean;
  /** Human-readable reference for off-chain payouts (Binance marker or withdrawal id). */
  payout_ref: string | null;
}

const ON_CHAIN_HASH = /^(0x)?[0-9a-fA-F]{40,}$|^[1-9A-HJ-NP-Za-km-z]{43,}$/;

export const describeAutoConvertPayout = (row: {
  status?: string | null;
  withdrawal_tx_hash?: string | null;
  withdrawal_id?: string | null;
}): AutoConvertPayout => {
  const raw = String(row.withdrawal_tx_hash || "").trim();
  if (row.status !== "COMPLETED" || !raw) return { payout_tx_hash: null, payout_offchain: false, payout_ref: null };
  if (ON_CHAIN_HASH.test(raw)) return { payout_tx_hash: raw, payout_offchain: false, payout_ref: null };
  return { payout_tx_hash: null, payout_offchain: true, payout_ref: raw || row.withdrawal_id || null };
};

/** SELECT fragment shared by the list + detail queries (alias `sc` = tbl_stablecoin_conversion). */
export const AUTO_CONVERT_SELECT_SQL = `
        sc.conversion_id as auto_convert_id,
        sc.status as auto_convert_status,
        sc.source_currency as auto_convert_source_currency,
        sc.source_amount as auto_convert_source_amount,
        sc.source_amount_usd as auto_convert_source_amount_usd,
        sc.target_currency as auto_convert_target_currency,
        sc.target_amount as auto_convert_target_amount,
        sc.settlement_chain as auto_convert_settlement_chain,
        sc.settlement_wallet_address as auto_convert_settlement_wallet,
        sc.conversion_rate as auto_convert_rate,
        sc.completed_at as auto_convert_completed_at,
        sc.deposit_tx_hash as auto_convert_deposit_tx_hash,
        sc.withdrawal_id as auto_convert_withdrawal_id,
        sc.withdrawal_tx_hash as auto_convert_withdrawal_tx_hash,
        sc.withdrawal_fee as auto_convert_withdrawal_fee,
        sc.merchant_payout_usd as auto_convert_merchant_payout_usd,
        sc.error_message as auto_convert_error`;

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

/** Build the `auto_convert` API object from a joined row (null when the payment was not converted). */
export const buildAutoConvertInfo = (x: Record<string, unknown>) => {
  if (!x.auto_convert_id) return null;
  const payout = describeAutoConvertPayout({
    status: x.auto_convert_status as string,
    withdrawal_tx_hash: x.auto_convert_withdrawal_tx_hash as string,
    withdrawal_id: x.auto_convert_withdrawal_id as string,
  });
  return {
    conversion_id: x.auto_convert_id,
    status: x.auto_convert_status,
    source_currency: x.auto_convert_source_currency,
    source_amount: num(x.auto_convert_source_amount),
    source_amount_usd: num(x.auto_convert_source_amount_usd),
    target_currency: x.auto_convert_target_currency,
    target_amount: num(x.auto_convert_target_amount),
    settlement_chain: x.auto_convert_settlement_chain,
    settlement_wallet_address: x.auto_convert_settlement_wallet || null,
    conversion_rate: num(x.auto_convert_rate),
    completed_at: x.auto_convert_completed_at,
    deposit_tx_hash: x.auto_convert_deposit_tx_hash || null,
    withdrawal_id: x.auto_convert_withdrawal_id || null,
    withdrawal_fee: num(x.auto_convert_withdrawal_fee),
    merchant_payout_usd: num(x.auto_convert_merchant_payout_usd),
    error_message: x.auto_convert_error || null,
    ...payout,
  };
};

export const AUTO_CONVERT_ROW_KEYS = [
  "auto_convert_id", "auto_convert_status", "auto_convert_source_currency", "auto_convert_source_amount",
  "auto_convert_source_amount_usd", "auto_convert_target_currency", "auto_convert_target_amount",
  "auto_convert_settlement_chain", "auto_convert_settlement_wallet", "auto_convert_rate", "auto_convert_completed_at",
  "auto_convert_deposit_tx_hash", "auto_convert_withdrawal_id", "auto_convert_withdrawal_tx_hash",
  "auto_convert_withdrawal_fee", "auto_convert_merchant_payout_usd", "auto_convert_error",
] as const;
