import mailTransporter from "../../utils/mailTransporter";
import config from "../../utils/config";
import { apiLogger } from "../../utils/loggers";
import { captureError } from "../errorMonitoringService";
import { t, resolveEmailLang } from "../../utils/emailI18n";
import { p } from "../../utils/emailTemplate";
import { FRONTEND_BASE_URL, dynoPayEmailTemplate, escapeHtml } from "./emailShared";
import { makeUnsubToken } from "../../utils/attributionSource";
import { getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { userModel, companyModel, userWalletModel, signupAttributionModel } from "../../models";
import { checkKycEnforcement } from "../../helper/kycEnforcement";

/** The three things that stop a merchant from getting paid on /create-pay-link. */
export type ActivationGate = "brand" | "wallet" | "kyc";
export const ACTIVATION_GATES: readonly ActivationGate[] = ["brand", "wallet", "kyc"];

export type GateNudgeReason = "sent" | "already_sent" | "opted_out" | "gate_not_open" | "no_user" | "error";
export interface GateNudgeResult {
  sent: boolean;
  reason: GateNudgeReason;
}

/** At most one email per gate per merchant per week. */
const DEDUP_TTL_SEC = 7 * 86400;

async function ownsCompany(userId: number, companyId: number): Promise<boolean> {
  return (await companyModel.count({ where: { company_id: companyId, user_id: userId } })) > 0;
}

/** Server-side truth check so a client cannot trigger mail for a gate that isn't actually open. */
async function gateIsOpen(userId: number, gate: ActivationGate, companyId: number | null): Promise<boolean> {
  if (gate === "brand") {
    return (await companyModel.count({ where: { user_id: userId } })) === 0;
  }
  if (gate === "wallet") {
    const where: Record<string, unknown> = { user_id: userId };
    if (companyId) where.company_id = companyId;
    return (await userWalletModel.count({ where })) === 0;
  }
  const kyc = await checkKycEnforcement(userId, companyId, "[KYC - GateNudge]");
  return kyc.blocked;
}

/**
 * Event-triggered "finish setting up to get paid" email, fired the moment a
 * merchant hits the brand / wallet / KYC gate (unlike the day-1/3/7 drip).
 * Redis-deduped per gate, honours marketing_opt_out, never throws.
 */
export async function sendActivationGateEmail(
  userId: number,
  gate: ActivationGate,
  requestedCompanyId?: number | null,
): Promise<GateNudgeResult> {
  try {
    const dedupKey = `activation-gate:${userId}:${gate}`;
    const seen = await getRedisItem(dedupKey);
    if (seen && Object.keys(seen).length > 0) return { sent: false, reason: "already_sent" };

    const user = await userModel.findOne({
      where: { user_id: userId },
      attributes: ["user_id", "name", "email", "language", "email_verified"],
    });
    const email = user ? String(user.get("email") || "") : "";
    if (!user || !email) return { sent: false, reason: "no_user" };

    const attribution = await signupAttributionModel.findOne({ where: { user_id: userId } });
    if (attribution && attribution.get("marketing_opt_out")) return { sent: false, reason: "opted_out" };

    const companyId =
      requestedCompanyId && (await ownsCompany(userId, requestedCompanyId)) ? requestedCompanyId : null;
    if (!(await gateIsOpen(userId, gate, companyId))) return { sent: false, reason: "gate_not_open" };

    const name = String(user.get("name") || "");
    const L = await resolveEmailLang(user.get("language") as string | null, email);

    const subject = t("activation.gate.subject", L);
    const heading = t("activation.gate.heading", L);
    const intro = t(`activation.gate.${gate}.intro`, L);
    const ctaLabel = t(`activation.gate.${gate}.cta`, L);
    const ctaUrl = `${FRONTEND_BASE_URL}/create-pay-link`;

    const videoUrl = config.str("ONBOARDING_VIDEO_URL") || `${FRONTEND_BASE_URL}/how-to`;
    const videoBlock =
      gate === "kyc"
        ? ""
        : `<p style="margin:20px 0 4px;font-size:15px;">
      <a href="${videoUrl}" target="_blank" rel="noopener" class="pill"
         style="display:inline-block;padding:11px 18px;border-radius:999px;background:#EEF2FF;color:#4338CA;text-decoration:none;font-weight:700;font-size:14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        ${escapeHtml(t("activation.common.videoCta", L))}
      </a></p>`;

    const unsubUrl = `${FRONTEND_BASE_URL}/api/track/activation-unsubscribe?u=${userId}&t=${makeUnsubToken(userId)}`;
    const footer = `<p style="margin:26px 0 0;font-size:12px;color:#9ca3af;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
      ${escapeHtml(t("activation.common.unsubscribe", L))}
      <a href="${unsubUrl}" style="color:#9ca3af;text-decoration:underline;">${escapeHtml(t("activation.common.unsubscribeAction", L))}</a>.
    </p>`;

    const content = `${p(name ? t("common.greeting", L, { name: escapeHtml(name) }) : t("common.greetingDefault", L))}
      ${p(intro)}
      ${p(t("activation.gate.outro", L))}
      ${videoBlock}
      ${footer}`;

    const html = dynoPayEmailTemplate(heading, content, true, ctaLabel, ctaUrl, "", L, "rocket");
    await mailTransporter({ to: email, name, subject, body: html });
    await setRedisItemWithTTL(dedupKey, { sent: true, at: Date.now() }, DEDUP_TTL_SEC);
    apiLogger.info(`[ActivationGate] ${gate} email sent to ${email}`);
    return { sent: true, reason: "sent" };
  } catch (e) {
    captureError(e, "email", { extraContext: `sendActivationGateEmail gate=${gate}` });
    apiLogger.error("Activation gate email error:", e);
    return { sent: false, reason: "error" };
  }
}
