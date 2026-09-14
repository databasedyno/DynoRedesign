import mailTransporter from "../../utils/mailTransporter";
import { apiLogger } from "../../utils/loggers";
import { t, resolveEmailLang } from "../../utils/emailI18n";
import { p, otpBlock } from "../../utils/emailTemplate";
import { dynoPayEmailTemplate } from "./emailShared";

/**
 * Unified purpose-aware OTP email. One canonical OTP shape (branded template +
 * otpBlock + expiry line), localized per recipient. Routes each auth flow to
 * its own copy so a password-reset / email-change / set-password code no longer
 * reuses the generic "login code" body (email audit finding I.1).
 */
export type OtpPurpose =
  | 'login'
  | 'signup'
  | 'emailVerify'
  | 'passwordReset'
  | 'emailChange'
  | 'setPassword';

const OTP_PURPOSE_META: Record<OtpPurpose, { keyBase: string; hero: string }> = {
  login: { keyBase: 'merchant.loginOtp', hero: 'key' },
  signup: { keyBase: 'merchant.signupOtp', hero: 'mail' },
  emailVerify: { keyBase: 'merchant.emailVerifyOtp', hero: 'mail' },
  passwordReset: { keyBase: 'merchant.forgotPasswordOtp', hero: 'lock-reset' },
  emailChange: { keyBase: 'merchant.changeEmailOtp', hero: 'mail' },
  setPassword: { keyBase: 'merchant.setPasswordOtp', hero: 'lock' },
};

export const sendPurposeOTPEmail = async (
  email: string,
  name: string,
  otpCode: string,
  purpose: OtpPurpose = 'login',
  lang?: string
) => {
  try {
    const L = await resolveEmailLang(lang, email);
    const { keyBase, hero } = OTP_PURPOSE_META[purpose] ?? OTP_PURPOSE_META.login;
    const subject = t(`${keyBase}.subject`, L, { code: otpCode });
    const content = `${p(name ? t('common.greeting', L, { name }) : t('common.greetingDefault', L))}
    ${p(t(`${keyBase}.intro`, L))}
    ${otpBlock(otpCode)}
    ${p(t(`${keyBase}.expiry`, L))}`;

    const html = dynoPayEmailTemplate(t(`${keyBase}.heading`, L), content, false, "", "", t(`${keyBase}.preheader`, L), L, hero);
    await mailTransporter({ to: email, name, subject, body: html });
    apiLogger.info(`OTP email (${purpose}) sent to ${email}`);
  } catch (e) {
    apiLogger.error(`OTP email (${purpose}) error:`, e);
  }
};
