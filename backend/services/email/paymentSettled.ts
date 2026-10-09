import { t } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { infoBox, dataRow, feeRow, feeTotalRow, feeTable, mono, p } from "../../utils/emailTemplate";
import { escapeHtml } from "./emailShared";
import { getCoinSymbol, assetNetworkLabel } from "../../utils/networkLabels";
import { formatEmailDateTime } from "../../utils/emailI18n";

/** Full money path of one settled payment — rendered in the merchant "Payment settled" email. */
export interface PaymentMoneyPath {
  grossCrypto: string;
  asset: string;
  fiatAtDetection?: { amount: string; currency: string } | null;
  feePercent?: number | null;
  feeCrypto?: string | null;
  feePayer?: "company" | "customer" | string | null;
  belowMinimum?: boolean;
  /** Network fee actually deducted from the merchant payout, in `asset` units (null/0 = unknown or not deducted). */
  networkFeeCrypto?: string | null;
  /** Human label of the real on-chain gas, e.g. "13.03 TRX" — shown next to the deducted amount. */
  networkFeeNative?: string | null;
  /** True ONLY when Dynopay genuinely paid the network fee (nothing deducted from the merchant). */
  networkFeeCovered?: boolean;
  /**
   * Admin wallet === merchant payout wallet (first-party brands). The platform fee travelled
   * in the SAME forward transfer, so it must not be presented as a separate deduction.
   */
  sameWallet?: boolean;
  netCrypto?: string | null;
  destinationAddress?: string | null;
  destinationTag?: string | number | null;
  forwardTxHash?: string | null;
  explorerUrl?: string | null;
  autoConvertTarget?: string | null;
  paidFor?: string | null;
  customerEmail?: string | null;
  reference?: string | null;
  txRowId?: string | number | null;
  detectedAt?: Date | null;
  /** ≥ $1,000 equivalent — shown as a badge (replaces the old separate alert email). */
  largePayment?: boolean;
  /** Referral credit (USD) applied to the Dynopay fee on this payment — shown as a benefit row. */
  referralCreditUsd?: number | null;
  /** How the payment was made: api | paymentLink | productOrder | donation | tip — shown as a "Received via" row. */
  sourceKey?: string | null;
  /** Buyer overpaid — the excess is included in this payout. Folds the old standalone "a buyer overpaid" email into this settled email. */
  overpayment?: { excessCrypto: string; excessFiat: string } | null;
}

export const maskAddress = (a?: string | null): string =>
  a && a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a || "";

export const maskEmailAddr = (e?: string | null): string => {
  const s = String(e || "").trim();
  const at = s.indexOf("@");
  if (at <= 0) return "";
  return `${s.slice(0, at <= 2 ? 1 : 2)}***${s.slice(at)}`;
};

const num = (v?: string | number | null): number => (v == null ? 0 : Number(v)) || 0;
const fmt = (v: string | number | null | undefined, asset: string) => `${formatCryptoAmount(String(v ?? "0"), getCoinSymbol(asset))} ${getCoinSymbol(asset)}`;


export const renderMoneyPath = (L: string, mp: PaymentMoneyPath): string => {
  const fee = num(mp.feeCrypto);
  const gas = num(mp.networkFeeCrypto);
  const sameWallet = !!mp.sameWallet && fee > 0 && !mp.autoConvertTarget && !mp.belowMinimum;
  const net = mp.netCrypto != null ? num(mp.netCrypto) : Math.max(0, num(mp.grossCrypto) - (sameWallet ? 0 : fee) - gas);
  // The platform fee is priced as "tier% + a flat $1 per payment". Rendering it as
  // a single effective % (fee ÷ amount) made small payments look like 5–6% and made
  // the same merchant appear to have a different rate on every transaction. Show a
  // plain "Dynopay fee" label with the exact deducted amount instead (2026-06).
  const feeLabel = mp.belowMinimum
    ? t("paymentSettled.belowMinimum", L)
    : `${t("paymentSettled.dynopayFeeNoPct", L)}${mp.feePayer === "customer" ? ` <span style="color:#6b7280;font-weight:400;">· ${t("paymentSettled.feePaidByCustomer", L)}</span>` : ""}`;
  const fiat = mp.fiatAtDetection && num(mp.fiatAtDetection.amount) > 0
    ? `<span style="color:#6b7280;font-weight:400;"> ≈ ${escapeHtml(mp.fiatAtDetection.amount)} ${escapeHtml(mp.fiatAtDetection.currency)}</span>`
    : "";
  const netLabel = mp.autoConvertTarget
    ? t("paymentSettled.netConverting", L, { target: escapeHtml(mp.autoConvertTarget) })
    : t("paymentSettled.netForwarded", L);

  const referralUsd = num(mp.referralCreditUsd);
  const referralRow = referralUsd > 0
    ? feeRow(
        `${t("paymentSettled.referralCreditRow", L)} <span style="color:#6b7280;font-weight:400;">· ${t("paymentSettled.referralCreditNote", L)}</span>`,
        `<span style="color:#067647;font-weight:600;">−$${referralUsd.toFixed(2)}</span>`,
      )
    : "";

  // Network fee row — three honest states:
  //   deducted  → "−X USDT · 13.03 TRX on-chain"   (what really left the merchant's payout)
  //   covered   → "covered by Dynopay"              (ONLY when nothing was deducted, flag set by settlement)
  //   unknown   → row omitted                       (never claim Dynopay paid when we simply don't know)
  const nativeNote = mp.networkFeeNative
    ? ` <span style="color:#6b7280;font-weight:400;font-size:12px;">· ${escapeHtml(mp.networkFeeNative)} ${t("paymentSettled.networkFeeOnChain", L)}</span>`
    : "";
  const networkRow = gas > 0
    ? feeRow(`${t("paymentSettled.networkFee", L)} <span style="color:#6b7280;font-weight:400;">· ${t("paymentSettled.networkFeeMerchant", L)}</span>`, `−${fmt(gas, mp.asset)}${nativeNote}`, true)
    : mp.networkFeeCovered
      ? feeRow(t("paymentSettled.networkFee", L), `<span style="color:#6b7280;font-weight:400;">${t("paymentSettled.networkFeeDynopay", L)}</span>`)
      : "";

  // Same-wallet (first-party brand): gross → network fee → forwarded (fee rides along, noted under the total).
  const feeRowHtml = sameWallet ? "" : feeRow(feeLabel, `−${fmt(fee, mp.asset)}`, true);
  const totalRow = sameWallet
    ? feeTotalRow(t("paymentSettled.forwardedSameWallet", L), fmt(net, mp.asset)) +
      `<tr><td colspan="2" style="padding:6px 0 0;font-size:12px;color:#6b7280;line-height:1.5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">${t("paymentSettled.sameWalletNote", L, { fee: fmt(fee, mp.asset) })}</td></tr>`
    : feeTotalRow(netLabel, fmt(net, mp.asset));

  const money = feeTable(
    feeRow(t("paymentSettled.received", L), `<strong>${fmt(mp.grossCrypto, mp.asset)}</strong>${fiat}`) +
    feeRowHtml +
    referralRow +
    networkRow +
    totalRow,
    t("paymentSettled.moneyPath", L),
  );

  const dest = mp.autoConvertTarget
    ? ""
    : dataRow(t("paymentSettled.sentTo", L), `${mono(maskAddress(mp.destinationAddress))}${mp.destinationTag ? ` <span style="color:#6b7280;font-size:12px;">· ${t("paymentSettled.destinationTag", L)} ${escapeHtml(String(mp.destinationTag))}</span>` : ""}`);
  const fwd = mp.autoConvertTarget
    ? ""
    : dataRow(
        t("paymentSettled.forwardTx", L),
        mp.forwardTxHash
          ? `${mono(maskAddress(mp.forwardTxHash))}${mp.explorerUrl ? ` · <a href="${escapeHtml(mp.explorerUrl)}" style="color:#0A0A0D;font-weight:600;text-decoration:none;">${t("paymentSettled.viewOnExplorer", L)}</a>` : ""}`
          : `<span style="color:#b45309;">${t("paymentSettled.forwarding", L)}</span>`,
      );
  const rows = [
    mp.sourceKey ? dataRow(t("labels.paymentSource", L), escapeHtml(t("paymentSource." + mp.sourceKey, L))) : "",
    dest,
    fwd,
    dataRow(t("paymentSettled.assetNetwork", L), escapeHtml(assetNetworkLabel(mp.asset))),
    mp.paidFor ? dataRow(t("paymentSettled.paidFor", L), escapeHtml(mp.paidFor)) : "",
    mp.customerEmail ? dataRow(t("paymentSettled.customer", L), escapeHtml(maskEmailAddr(mp.customerEmail))) : "",
    mp.reference ? dataRow(t("paymentSettled.reference", L), mono(escapeHtml(mp.reference))) : "",
    mp.detectedAt ? dataRow(t("paymentSettled.detected", L), formatEmailDateTime(mp.detectedAt, L), true) : "",
  ].filter(Boolean);
  const details = infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`);

  // Overpayment is folded into this settled email (no separate "a buyer overpaid" email).
  const overpaidNote = mp.overpayment
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;"><tr><td style="background:#FFFAEB;border-left:4px solid #F79009;border-radius:8px;padding:14px 16px;font-size:14px;color:#93370D;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.6;">${t("paymentSettled.overpaidNote", L, { excess: escapeHtml(mp.overpayment.excessCrypto), excessFiat: escapeHtml(mp.overpayment.excessFiat) })}</td></tr></table>`
    : "";

  return `${money}${details}${overpaidNote}${fiat ? p(t("paymentSettled.fiatNote", L), "font-size:13px;color:#6b7280;") : ""}`;
};
