/**
 * User Controller — FACADE
 *
 * R2 refactor (2026-08): the former 4.9K-line god file was extracted verbatim into
 * domain modules under controller/user/ (strangler pattern — zero behavior change).
 * The default-export object shape is identical to pre-refactor, so controller/index.ts
 * and every router keep working unchanged.
 *
 * Modules:
 *   userShared        — parseUserAgent, finalizeLogin, getAccessToken, OTP senders,
 *                       createUserWallets, generateReferralCode, PROFILE_CACHE_TTL
 *   registrationEmail — registerUser + email registration steps
 *   registrationPhone — phone registration steps + phone checks
 *   authLogin         — login, login OTP, checkEmail, generate/confirm OTP
 *   socialAuth        — googleSignIn, githubSignIn
 *   socialConnect     — connectSocial, facebookSignIn
 *   passwordReset     — forgot-password flows + resetPassword
 *   profileSecurity   — changePassword, setPassword (step-up gated), login activity, flagLogin
 *   profile           — getProfile/updateProfile/updateUser, quick actions, last company
 *   contactEmail      — change/remove/add/verify email
 *   contactPhone      — change/remove/add/verify phone
 *   accountLifecycle  — deleteAccount, unsubscribe flows
 *   onboarding        — onboarding status, verifyEmail, resendVerification
 *   creatorHandle     — handle validation/reservation/checks
 *   creatorProfile    — creator profile, cover image, stats, analytics
 *   preferences       — display currency + merchant tax settings
 */

export * from "./user/userShared";
export * from "./user/registrationEmail";
export * from "./user/registrationPhone";
export * from "./user/authLogin";
export * from "./user/socialAuth";
export * from "./user/socialConnect";
export * from "./user/passwordReset";
export * from "./user/profileSecurity";
export * from "./user/profile";
export * from "./user/contactEmail";
export * from "./user/contactPhone";
export * from "./user/accountLifecycle";
export * from "./user/onboarding";
export * from "./user/activationNudge";
export * from "./user/creatorHandle";
export * from "./user/creatorProfile";
export * from "./user/preferences";

import { registerUser, registerEmailStep1, registerEmailVerifyOtp } from "./user/registrationEmail";
import { phoneTypeCheck, registerPhoneStep1, registerPhoneStep2, checkPhone } from "./user/registrationPhone";
import { login, verifyLoginOTP, resendLoginOTP, checkEmail, generateOTP, confirmOTP } from "./user/authLogin";
import { connectSocial, facebookSignIn } from "./user/socialConnect";
import { googleSignIn, githubSignIn } from "./user/socialAuth";
import { forgotPassword, forgotPasswordPhone, forgotPasswordVerifyOtp, forgotPasswordPhoneVerifyOtp, resetPassword } from "./user/passwordReset";
import { changePassword, setPassword, getLoginActivity, flagLogin } from "./user/profileSecurity";
import { signOutEverywhereConfirmPage, signOutEverywhereAction } from "./user/signoutEverywhere";
import { updateUser, getProfile, updateProfile, updateDashboardQuickActions, updateLastCompany } from "./user/profile";
import { changeEmail, removeEmail, addEmail, verifyAddEmail } from "./user/contactEmail";
import { changePhone, removePhone, addPhone, verifyAddPhone } from "./user/contactPhone";
import { deleteAccount, sendDeleteAccountOtp, unsubscribeFromReminders, unsubscribeFromPaymentReminders } from "./user/accountLifecycle";
import { getOnboardingStatus, verifyEmail, resendVerification } from "./user/onboarding";
import { sendActivationNudge } from "./user/activationNudge";
import { checkHandle, checkHandlePublic, reserveHandle } from "./user/creatorHandle";
import { updateCreatorProfile, uploadCoverImage, getCreatorProfileSettings } from "./user/creatorProfile";
import { getCreatorStats, getCreatorAnalytics, getCreatorAnalyticsSplit } from "./user/creatorAnalytics";
import { getUserDisplayCurrency, updateUserDisplayCurrency, getMerchantTaxSettings, updateMerchantTaxSettings } from "./user/preferences";

export default {
  registerUser,
  registerEmailStep1,
  registerEmailVerifyOtp,
  phoneTypeCheck,
  registerPhoneStep1,
  registerPhoneStep2,
  login,
  verifyLoginOTP,
  resendLoginOTP,
  checkEmail,
  checkPhone,
  generateOTP,
  confirmOTP,
  connectSocial,
  facebookSignIn,
  updateUser,
  changePassword,
  forgotPassword,
  forgotPasswordPhone,
  forgotPasswordVerifyOtp,
  forgotPasswordPhoneVerifyOtp,
  resetPassword,
  googleSignIn,
  githubSignIn,
  getProfile,
  updateProfile,
  updateDashboardQuickActions,
  changeEmail,
  changePhone,
  removeEmail,
  removePhone,
  deleteAccount,
  sendDeleteAccountOtp,
  unsubscribeFromReminders,
  unsubscribeFromPaymentReminders,
  getOnboardingStatus,
  sendActivationNudge,
  verifyEmail,
  resendVerification,
  updateLastCompany,
  addEmail,
  verifyAddEmail,
  addPhone,
  verifyAddPhone,
  setPassword,
  getLoginActivity,
  flagLogin,
  signOutEverywhereConfirmPage,
  signOutEverywhereAction,
  checkHandle,
  checkHandlePublic,
  reserveHandle,
  updateCreatorProfile,
  getCreatorProfileSettings,
  uploadCoverImage,
  getCreatorStats,
  getCreatorAnalytics,
  getCreatorAnalyticsSplit,
  getUserDisplayCurrency,
  updateUserDisplayCurrency,
  getMerchantTaxSettings,
  updateMerchantTaxSettings,
};
