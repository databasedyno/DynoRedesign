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
  networkFeeCrypto?: string | null;
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
  const net = mp.netCrypto != null ? num(mp.netCrypto) : Math.max(0, num(mp.grossCrypto) - fee - gas);
  const gross = num(mp.grossCrypto);
  const pctNum = mp.feePercent != null && isFinite(Number(mp.feePercent)) ? Number(mp.feePercent) : gross > 0 && fee > 0 ? (fee / gross) * 100 : null;
  const pct = pctNum != null ? pctNum.toFixed(2).replace(/\.?0+$/, "") : null;
  const feeLabel = mp.belowMinimum
    ? t("paymentSettled.belowMinimum", L)
    : `${pct ? t("paymentSettled.dynopayFee", L, { percent: pct }) : t("paymentSettled.dynopayFeeNoPct", L)}${mp.feePayer === "customer" ? ` <span style="color:#6b7280;font-weight:400;">· ${t("paymentSettled.feePaidByCustomer", L)}</span>` : ""}`;
  const fiat = mp.fiatAtDetection && num(mp.fiatAtDetection.amount) > 0
    ? `<span style="color:#6b7280;font-weight:400;"> ≈ ${escapeHtml(mp.fiatAtDetection.amount)} ${escapeHtml(mp.fiatAtDetection.currency)}</span>`
    : "";
  const netLabel = mp.autoConvertTarget
    ? t("paymentSettled.netConverting", L, { target: escapeHtml(mp.autoConvertTarget) })
    : t("paymentSettled.netForwarded", L);

  const money = feeTable(
    feeRow(t("paymentSettled.received", L), `<strong>${fmt(mp.grossCrypto, mp.asset)}</strong>${fiat}`) +
    feeRow(feeLabel, `−${fmt(fee, mp.asset)}`, true) +
    (gas > 0
      ? feeRow(`${t("paymentSettled.networkFee", L)} <span style="color:#6b7280;font-weight:400;">· ${t("paymentSettled.networkFeeMerchant", L)}</span>`, `−${fmt(gas, mp.asset)}`, true)
      : feeRow(t("paymentSettled.networkFee", L), `<span style="color:#6b7280;font-weight:400;">${t("paymentSettled.networkFeeDynopay", L)}</span>`)) +
    feeTotalRow(netLabel, fmt(net, mp.asset)),
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
          ? `${mono(maskAddress(mp.forwardTxHash))}${mp.explorerUrl ? ` · <a href="${escapeHtml(mp.explorerUrl)}" style="color:#4338CA;font-weight:600;text-decoration:none;">${t("paymentSettled.viewOnExplorer", L)}</a>` : ""}`
          : `<span style="color:#b45309;">${t("paymentSettled.forwarding", L)}</span>`,
      );
  const rows = [
    dest,
    fwd,
    dataRow(t("paymentSettled.assetNetwork", L), escapeHtml(assetNetworkLabel(mp.asset))),
    mp.paidFor ? dataRow(t("paymentSettled.paidFor", L), escapeHtml(mp.paidFor)) : "",
    mp.customerEmail ? dataRow(t("paymentSettled.customer", L), escapeHtml(maskEmailAddr(mp.customerEmail))) : "",
    mp.reference ? dataRow(t("paymentSettled.reference", L), mono(escapeHtml(mp.reference))) : "",
    mp.detectedAt ? dataRow(t("paymentSettled.detected", L), formatEmailDateTime(mp.detectedAt, L), true) : "",
  ].filter(Boolean);
  const details = infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>`, "#12B76A");

  return `${money}${details}${fiat ? p(t("paymentSettled.fiatNote", L), "font-size:13px;color:#6b7280;") : ""}`;
};
