import mailTransporter from "../../utils/mailTransporter";
import { captureError } from "../errorMonitoringService";
import { apiLogger } from "../../utils/loggers";
import { p, getCurrencySymbol } from "../../utils/emailTemplate";
import { EMAIL_TOKENS as T } from "../../utils/brandTokens";
import { t, normalizeLang, intlLocaleFor } from "../../utils/emailI18n";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate, brandSubject, escapeHtml, greetingLine } from "./emailShared";

export type TipGoalMilestone = 50 | 100;

export interface TipGoalMilestoneData {
  milestone: TipGoalMilestone;
  goal: number;
  raised: number;
  currency: string;
  supporters: number;
  /** First day of the month the goal belongs to (UTC). */
  monthStart: Date;
  /** Public creator page URL (CTA target). */
  pageUrl: string;
}

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

const money = (n: number, currency: string) =>
  `${getCurrencySymbol(currency)}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Filled progress bar + "raised of goal" caption — table-based so it survives every client. */
const goalBar = (pct: number, raisedStr: string, goalStr: string, pctLabel: string, L: string): string => {
  const width = Math.max(4, Math.min(100, pct));
  const fill = pct >= 100 ? T.green : T.brand;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="hl-box" style="background: #f8f9ff; border-radius: 12px; border-left: 4px solid ${fill}; margin: 24px 0;">
    <tr><td style="padding: 20px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-family: ${FONT}; font-size: 28px; font-weight: 800; color: #0a0a0a; letter-spacing: -0.02em;">${raisedStr}</td>
          <td align="right" style="font-family: ${FONT}; font-size: 14px; font-weight: 700; color: ${fill};">${pctLabel}</td>
        </tr>
        <tr><td colspan="2" style="font-family: ${FONT}; font-size: 13px; color: #6b7280; padding-top: 2px;">${t("tipGoal.ofGoal", L, { goal: goalStr })}</td></tr>
        <tr><td colspan="2" style="padding: 14px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="track" style="background: #e5e7eb; border-radius: 6px; height: 12px;">
            <tr><td style="width: ${width}%; background: ${fill}; border-radius: 6px; height: 12px;">&nbsp;</td>${width < 100 ? '<td style="height: 12px;">&nbsp;</td>' : ""}</tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>`;
};

/**
 * "You're halfway there" (50%) / "Goal reached" (100%) — sent to the creator
 * once per month per milestone when a confirmed tip pushes the month's total
 * over the line. Celebratory, no action required.
 */
export const sendTipGoalMilestoneEmail = async (
  email: string,
  name: string,
  companyName: string,
  data: TipGoalMilestoneData,
  lang?: string | null,
) => {
  try {
    const L = normalizeLang(lang);
    const K = data.milestone >= 100 ? "tipGoal.reached" : "tipGoal.halfway";
    const cur = (data.currency || "USD").toUpperCase();
    const raisedStr = money(data.raised, cur);
    const goalStr = money(data.goal, cur);
    const pct = data.goal > 0 ? Math.floor((data.raised / data.goal) * 100) : 0;
    const monthLabel = new Intl.DateTimeFormat(intlLocaleFor(L), { month: "long", year: "numeric", timeZone: "UTC" }).format(data.monthStart);
    const supportersLine = data.supporters === 1 ? t("tipGoal.supportersOne", L) : t("tipGoal.supportersOther", L, { count: data.supporters });
    const brand = `<strong>${escapeHtml(companyName)}</strong>`;

    const content = `${greetingLine(L, name)}
      ${p(t(`${K}.intro`, L, { brand, month: escapeHtml(monthLabel), raised: `<strong>${raisedStr}</strong>`, goal: `<strong>${goalStr}</strong>` }))}
      ${goalBar(pct, raisedStr, goalStr, t("tipGoal.percentFunded", L, { pct }), L)}
      ${p(`${supportersLine} ${t(`${K}.next`, L)}`)}
      ${p(t("tipGoal.footnote", L), "font-size:13px;color:#6b7280;")}`;

    const subject = brandSubject(companyName, t(`${K}.subject`, L, { pct }));
    const html = dynoPayEmailTemplate(
      t(`${K}.heading`, L), content, true, t("tipGoal.cta", L), data.pageUrl,
      t(`${K}.preheader`, L, { raised: raisedStr, goal: goalStr }), L, data.milestone >= 100 ? "trophy" : "chart",
    );
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`[email] tip goal ${data.milestone}% milestone sent to ${email} (${raisedStr} / ${goalStr})`);
  } catch (e) {
    captureError(e, "email", { extraContext: "sendTipGoalMilestoneEmail" });
  }
};
