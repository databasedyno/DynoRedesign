import mailTransporter from "../../utils/mailTransporter";
import { captureError } from "../errorMonitoringService";
import { apiLogger } from "../../utils/loggers";
import { infoBox, dataRow, statusBadge, p, mono } from "../../utils/emailTemplate";
import { t, normalizeLang, formatEmailDateTime } from "../../utils/emailI18n";
import { formatCryptoAmount } from "../../utils/currencyUtils";
import { getCoinSymbol, assetNetworkLabel } from "../../utils/networkLabels";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate, brandSubject, escapeHtml } from "./emailShared";

export type PayoutDelayStage = "delayed" | "failed";

export interface PayoutDelayedData {
  /** Crypto that was received from the buyer and is waiting to be paid out. */
  amount: string | number;
  asset: string;
  fiat?: { amount: string; currency: string } | null;
  /** Auto-convert target when the payout is a conversion (e.g. USDT · TRC-20). */
  targetLabel?: string | null;
  stage: PayoutDelayStage;
  /** Plain-words reason key: network | exchange | review | unknown. */
  reasonKey?: "network" | "exchange" | "review" | "unknown";
  since?: Date | null;
  reference?: string | null;
  conversionId?: string | number | null;
}

/**
 * "Payout delayed" — sent once when a settlement/auto-convert payout has not
 * completed after the stall threshold, and again (stage=failed) when ops has
 * to finish it by hand. Plain words, no action needed by the merchant.
 */
export const sendPayoutDelayedEmail = async (
  email: string,
  name: string,
  companyName: string,
  data: PayoutDelayedData,
  lang?: string | null,
) => {
  try {
    const L = normalizeLang(lang);
    const sym = getCoinSymbol(data.asset);
    const amountStr = `${formatCryptoAmount(String(data.amount), sym)} ${sym}`;
    const fiatStr = data.fiat && Number(data.fiat.amount) > 0 ? ` (≈ ${escapeHtml(data.fiat.amount)} ${escapeHtml(data.fiat.currency)})` : "";
    const failed = data.stage === "failed";
    const K = failed ? "payoutDelayed.failed" : "payoutDelayed.delayed";
    const subject = brandSubject(companyName, t(`${K}.subject`, L, { amount: amountStr }));
    const reason = t(`payoutDelayed.reason.${data.reasonKey || "unknown"}`, L);

    const rows = [
      dataRow(t("payoutDelayed.amountWaiting", L), `<strong>${amountStr}</strong>${fiatStr}`),
      dataRow(t("labels.network", L), escapeHtml(assetNetworkLabel(data.asset))),
      data.targetLabel ? dataRow(t("payoutDelayed.payoutAs", L), escapeHtml(data.targetLabel)) : "",
      dataRow(t("labels.status", L), statusBadge(t(failed ? "payoutDelayed.statusManual" : "payoutDelayed.statusDelayed", L), "pending")),
      data.since ? dataRow(t("payoutDelayed.since", L), formatEmailDateTime(data.since, L)) : "",
      data.reference ? dataRow(t("labels.reference", L), mono(escapeHtml(String(data.reference))), !data.conversionId) : "",
      data.conversionId ? dataRow(t("payoutDelayed.conversionId", L), mono(`#${escapeHtml(String(data.conversionId))}`), true) : "",
    ].filter(Boolean).join("");

    const content = `${p(name ? t("common.greeting", L, { name }) : t("common.greetingDefault", L))}
      ${p(t(`${K}.intro`, L, { companyName: `<strong>${escapeHtml(companyName)}</strong>`, amount: `<strong>${amountStr}</strong>` }))}
      ${infoBox(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`, "#f59e0b")}
      ${p(`<strong>${t("payoutDelayed.whyLabel", L)}</strong> ${reason}`)}
      ${p(t(`${K}.next`, L))}
      ${p(t("payoutDelayed.nothingToDo", L), "font-size:13px;color:#6b7280;")}`;

    const html = dynoPayEmailTemplate(
      t(`${K}.heading`, L), content, true, t("payoutDelayed.cta", L), `${FRONTEND_BASE_URL}/payouts`,
      t(`${K}.preheader`, L, { amount: amountStr }), L, "hourglass",
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[email] payout ${data.stage} sent to ${email} (${amountStr})`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendPayoutDelayedEmail" });
  }
};

/**
 * Direct-forward settlement stuck in recovery → one "running late" email per
 * deposit address (Redis guard). Resolves the brand owner from the company.
 */
export const notifyMerchantSettlementDelayed = async (a: {
  address: string; companyId: number | string | null | undefined; txId?: string | null;
  amount: number | string; asset: string; since?: Date | null;
}): Promise<void> => {
  if (!a.companyId) return;
  const { redis } = await import("../../utils/redisInstance");
  const first = await redis.set(`settlement-delayed-notified:${a.address}`, "1", { NX: true, EX: 60 * 60 * 24 * 30 }).catch(() => "OK");
  if (!first) return;
  const { companyModel, userModel } = await import("../../models");
  const { dispatchCompanyEmail } = await import("./companyDispatch");
  const company: any = await companyModel.findOne({ where: { company_id: a.companyId }, raw: true });
  const user: any = company?.user_id ? await userModel.findOne({ where: { user_id: company.user_id }, raw: true }) : null;
  if (!user?.email) return;
  await dispatchCompanyEmail(
    Number(a.companyId),
    "payouts",
    { email: user.email, name: user.name || "" },
    (email, name) => sendPayoutDelayedEmail(email, name, company?.company_name || "Your brand", {
      amount: a.amount, asset: a.asset, stage: "delayed", reasonKey: "review", since: a.since ?? null, reference: a.txId ?? null,
    }, normalizeLang(user.language)),
  );
};
