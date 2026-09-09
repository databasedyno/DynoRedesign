import express from "express";
import jwt from "jsonwebtoken";
import { raw as envRaw } from "../../utils/config";
import { IUserType } from "../../utils/types";
import { errorResponseHelper, successResponseHelper } from "../../helper";
import { handleControllerError } from "../../helper/controllerErrorHandler";
import { companyModel, userModel } from "../../models";
import { companyLogger } from "../../utils/loggers";
import { deleteRedisItem, getRedisItem, setRedisItemWithTTL } from "../../utils/redisInstance";
import { generateOtpCode, recordOtpFailure, otpLockedMessage, OTP_TTL_SECONDS } from "../../helper/otpGuard";
import { sendCompanyDeleteOTPEmail } from "../../services/email/companyEmails";

const otpKey = (userId: number | string, companyId: number | string) =>
  `company_delete_otp_${userId}_${companyId}`;

const maskEmail = (email: string) => email.replace(/(.{2})(.*)(@.*)/, "$1***$3");

export const ONLY_BRAND_MESSAGE =
  "Cannot delete your only brand. Add another brand first, then delete this one.";

/**
 * POST /api/company/deleteCompany/:id/send-otp
 * Step 1 of brand deletion: email a one-time code to the account owner.
 */
export const sendDeleteCompanyOtp = async (req: express.Request, res: express.Response) => {
  const userData = jwt.decode(res.locals.token) as IUserType;
  try {
    const company_id = req.params.id;
    const company = await companyModel.findOne({ where: { user_id: userData.user_id, company_id } });
    if (!company) return errorResponseHelper(res, 404, "Brand not found");

    const total = await companyModel.count({ where: { user_id: userData.user_id } });
    if (total <= 1) return errorResponseHelper(res, 400, ONLY_BRAND_MESSAGE);

    const user = await userModel.findOne({
      where: { user_id: userData.user_id },
      attributes: ["name", "email"],
    });
    const email: string | null = user?.dataValues.email || userData.email || null;
    if (!email) {
      return errorResponseHelper(res, 400, "Your account has no email address to receive the verification code.");
    }

    const otp = generateOtpCode();
    await setRedisItemWithTTL(
      otpKey(userData.user_id, company_id),
      { otp, createdAt: new Date().toISOString(), attempts: 0 },
      OTP_TTL_SECONDS
    );

    const companyName = company.dataValues.company_name || "your brand";
    await sendCompanyDeleteOTPEmail(email, user?.dataValues.name || userData.name || "", otp, companyName);

    companyLogger.info(`Brand delete OTP sent for company ${company_id}`, {
      user_id: userData.user_id,
      email,
    });

    return successResponseHelper(res, 200, "Verification code sent to your email", {
      company_id: Number(company_id),
      company_name: companyName,
      email: maskEmail(email),
      expires_in: OTP_TTL_SECONDS,
      // Preview pods suppress outbound email, so surface the code for QA there only.
      ...(envRaw("DISABLE_OUTBOUND_EMAIL") === "true" ? { preview_otp: otp } : {}),
    });
  } catch (e) {
    handleControllerError(res, e, companyLogger, { user_id: userData.user_id, email: userData.email });
  }
};

export type DeleteOtpCheck = { ok: boolean; status?: number; message?: string };

/** Step 2 helper: consume the code issued by sendDeleteCompanyOtp (5-strike lockout). */
export const verifyDeleteCompanyOtp = async (
  userId: number | string,
  companyId: number | string,
  otp: unknown
): Promise<DeleteOtpCheck> => {
  const code = String(otp ?? "").trim();
  if (!code) {
    return { ok: false, status: 400, message: "Verification code is required. Request a code to your email first." };
  }
  const key = otpKey(userId, companyId);
  const item = (await getRedisItem(key)) as Record<string, unknown> | null;
  if (!item || !item.otp) {
    return { ok: false, status: 400, message: "Verification code expired or not found. Please request a new one." };
  }
  if (String(item.otp) !== code) {
    const locked = await recordOtpFailure(key, item);
    return { ok: false, status: 400, message: locked ? otpLockedMessage : "Invalid verification code." };
  }
  await deleteRedisItem(key);
  return { ok: true };
};
