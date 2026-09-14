import ReferralPayout from "../models/referralModels/referralPayoutModel";
import { toFixedStr } from "../utils/money";

/** Referral payout history + CSV export (read-only). Split from referralPayoutService (R2 file-size). */

const maskAddress = (a: string): string => (a && a.length > 14 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a);
const txUrl = (h: string | null): string | null => (h ? `https://tronscan.org/#/transaction/${h}` : null);

export interface PayoutHistoryItem {
  payout_id: number;
  amount_usd: number;
  status: string;
  trc20_address_masked: string;
  tx_hash: string | null;
  tx_url: string | null;
  withdrawal_fee_usdt: number | null;
  requested_at: Date | null;
  completed_at: Date | null;
  error_message: string | null;
}

export const getPayoutHistory = async (userId: number): Promise<PayoutHistoryItem[]> => {
  const rows = await ReferralPayout.findAll({
    where: { user_id: userId },
    order: [["payout_id", "DESC"]],
    limit: 100,
  });
  return rows.map((p) => ({
    payout_id: p.payout_id,
    amount_usd: Number(p.amount_usd),
    status: p.status,
    trc20_address_masked: maskAddress(p.trc20_address),
    tx_hash: p.tx_hash || null,
    tx_url: txUrl(p.tx_hash || null),
    withdrawal_fee_usdt: p.withdrawal_fee_usdt != null ? Number(p.withdrawal_fee_usdt) : null,
    requested_at: p.requested_at || null,
    completed_at: p.completed_at || null,
    error_message: p.error_message || null,
  }));
};

export const getPayoutHistoryCsv = async (userId: number): Promise<string> => {
  const rows = await ReferralPayout.findAll({
    where: { user_id: userId },
    order: [["payout_id", "DESC"]],
    limit: 1000,
  });
  const esc = (v: unknown): string => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = [
    "Payout ID",
    "Amount (USD)",
    "Status",
    "USDT-TRC20 Address",
    "Tx Hash",
    "Network Fee (USDT)",
    "Requested (UTC)",
    "Completed (UTC)",
    "Note",
  ];
  const lines = [header.join(",")];
  for (const p of rows) {
    lines.push(
      [
        p.payout_id,
        toFixedStr(p.amount_usd, 2),
        p.status,
        p.trc20_address,
        p.tx_hash || "",
        p.withdrawal_fee_usdt != null ? toFixedStr(p.withdrawal_fee_usdt, 6) : "",
        p.requested_at ? new Date(p.requested_at).toISOString() : "",
        p.completed_at ? new Date(p.completed_at).toISOString() : "",
        p.error_message || "",
      ]
        .map(esc)
        .join(",")
    );
  }
  return lines.join("\n");
};

export default { getPayoutHistory, getPayoutHistoryCsv };
