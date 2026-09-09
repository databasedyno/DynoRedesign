import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { t, resolveEmailLang } from "../../utils/emailI18n";
import { p } from "../../utils/emailTemplate";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate, escapeHtml } from "./emailShared";

export type ActivationStep = "d1" | "d3" | "d7";
export type ActivationSegment = "madeLink" | "noLink" | "fundraiser";

/** Primary CTA target per segment (all confirmed-existing app routes). */
const SEGMENT_CTA_PATH: Record<ActivationSegment, string> = {
  madeLink: "/wallet",           // made a link, no payment → add a payout wallet so funds land safely
  noLink: "/create-pay-link",    // never made a link → create the first one
  fundraiser: "/create-pay-link",// fundraiser vertical → launch a donation link
};

export interface ActivationEmailArgs {
  userId: number;
  email: string;
  name?: string | null;
  companyName?: string | null;
  step: ActivationStep;
  segment: ActivationSegment;
  unsubToken: string;
  lang?: string | null;
}

/**
 * Merchant-facing activation nudge (day 1 / 3 / 7 drip). Guidance/how-to only —
 * no monetary offer. Localized, segment-aware, with a how-to video CTA and a
 * working unsubscribe link. Never throws.
 */
export const sendActivationEmail = async (a: ActivationEmailArgs): Promise<boolean> => {
  try {
    const L = await resolveEmailLang(a.lang, a.email);
    const name = a.name || "";
    const subject = t(`activation.step.${a.step}.subject`, L);
    const heading = t(`activation.step.${a.step}.heading`, L);
    const intro = t(`activation.step.${a.step}.intro`, L);
    const segLine = t(`activation.seg.${a.segment}.line`, L, { companyName: escapeHtml(a.companyName || "") });
    const ctaLabel = t(`activation.seg.${a.segment}.cta`, L);
    const ctaUrl = `${FRONTEND_BASE_URL}${SEGMENT_CTA_PATH[a.segment]}`;

    const videoUrl = config.str("ONBOARDING_VIDEO_URL") || `${FRONTEND_BASE_URL}/how-to`;
    const videoLabel = t("activation.common.videoCta", L);
    const unsubUrl = `${FRONTEND_BASE_URL}/api/track/activation-unsubscribe?u=${a.userId}&t=${a.unsubToken}`;

    const videoBlock = `<p style="margin:20px 0 4px;font-size:15px;">
      <a href="${videoUrl}" target="_blank" rel="noopener"
         style="display:inline-block;padding:11px 18px;border-radius:999px;background:#EEF2FF;color:#4338CA;text-decoration:none;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        ${escapeHtml(videoLabel)}
      </a></p>`;

    const footer = `<p style="margin:26px 0 0;font-size:12px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      ${escapeHtml(t("activation.common.unsubscribe", L))}
      <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">${escapeHtml(t("activation.common.unsubscribeAction", L))}</a>.
    </p>`;

    const content = `${p(name ? t("common.greeting", L, { name }) : t("common.greetingDefault", L))}
      ${p(intro)}
      ${p(segLine)}
      ${videoBlock}
      ${footer}`;

    const html = dynoPayEmailTemplate(heading, content, true, ctaLabel, ctaUrl, "", L, 'rocket');
    await mailTransporter({ to: a.email, name, subject, body: html });
    apiLogger.info(`[Activation] ${a.step}/${a.segment} email sent to ${a.email}`);
    return true;
  } catch (e) {
    captureError(e, "email", { extraContext: "sendActivationEmail" });
    apiLogger.error("Activation email error:", e);
    return false;
  }
};
