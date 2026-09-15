import express, { RequestHandler } from "express";
import { userController } from "../controller";
import { authMiddleware, uploadImage, userMiddleware } from "../middleware";
import { 
  strictRateLimiter, 
  moderateRateLimiter, 
  loginRateLimiter,
  otpRateLimiter 
} from "../middleware/rateLimitMiddleware";
import { validate, loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, twoFAValidateSchema } from "../middleware/validateRequest";
import sessionController from "../controller/sessionController";
import twoFactorController from "../controller/twoFactorController";
import twoFactorEnrollController from "../controller/twoFactorEnrollController";
import twoFactorResetController from "../controller/twoFactorResetController";
import trustedDeviceController from "../controller/trustedDeviceController";
import { requireStepUp } from "../middleware/requireStepUp";
const userRouter = express.Router();

// Step-up (scope `security`): password / email / 2FA changes need a fresh factor.
const securityStepUp = requireStepUp("security");
// Adding a FIRST email is onboarding; changing an existing one is a sensitive action.
const emailChangeStepUp = requireStepUp("security", { when: (_req, res) => !!res.locals.authUser?.email });

// Registration endpoints - moderate rate limiting (10 per 15 min per IP)
userRouter.post("/registerUser", moderateRateLimiter, validate(registerSchema), userMiddleware, userController.registerUser);
userRouter.post("/registerPhone", moderateRateLimiter, userController.registerPhoneStep1);
userRouter.post("/registerPhone/verify", moderateRateLimiter, userController.registerPhoneStep2);

// Simplified registration (email/phone + OTP only, no password)
userRouter.post("/registerEmail", otpRateLimiter, userController.registerEmailStep1);
userRouter.post("/registerEmail/verify-otp", moderateRateLimiter, userController.registerEmailVerifyOtp);
userRouter.post("/phone-type-check", moderateRateLimiter, userController.phoneTypeCheck);

// Login endpoint - strict rate limiting (5 per 15 min per IP+email combo) to prevent brute force
userRouter.post("/login", loginRateLimiter, validate(loginSchema), userMiddleware, userController.login);

// Login OTP verification - rate limited to prevent brute force
userRouter.post("/verifyLoginOTP", otpRateLimiter, userController.verifyLoginOTP);
userRouter.post("/resendLoginOTP", otpRateLimiter, userController.resendLoginOTP);
// Kebab-case aliases (some frontends/proxies may normalize to kebab-case)
userRouter.post("/verify-login-otp", otpRateLimiter, userController.verifyLoginOTP);
userRouter.post("/resend-login-otp", otpRateLimiter, userController.resendLoginOTP);

// Email/Phone check - moderate rate limiting
userRouter.get("/checkEmail", moderateRateLimiter, userController.checkEmail);
userRouter.get("/checkPhone", moderateRateLimiter, userController.checkPhone);

// OTP endpoints - strict rate limiting (3 per 15 min per contact) to prevent OTP spam
userRouter.post("/generateOTP", otpRateLimiter, userController.generateOTP);
userRouter.post("/confirmOTP", otpRateLimiter, userController.confirmOTP);

// Social connect - moderate rate limiting
// RETIRED (security): /connectSocial trusted a client-supplied email with no
// verification (account-takeover vector). Google now uses the verified GIS flow
// (/google-signin). Route removed; the handler returns 410 if reached elsewhere.

// Password reset endpoints - strict rate limiting (5 per 15 min per IP) to prevent abuse
userRouter.post("/forgot-password", strictRateLimiter, validate(forgotPasswordSchema), userController.forgotPassword);
userRouter.post("/forgot-password-phone", strictRateLimiter, userController.forgotPasswordPhone);
userRouter.post("/forgot-password/verify-otp", otpRateLimiter, userController.forgotPasswordVerifyOtp);
userRouter.post("/forgot-password-phone/verify-otp", otpRateLimiter, userController.forgotPasswordPhoneVerifyOtp);
userRouter.post("/reset-password", strictRateLimiter, userController.resetPassword);

// Social Sign-In endpoints - moderate rate limiting (10 per 15 min per IP)
userRouter.post("/google-signin", moderateRateLimiter, userController.googleSignIn);
userRouter.post("/github-signin", moderateRateLimiter, userController.githubSignIn);
userRouter.post("/facebook-signin", moderateRateLimiter, userController.facebookSignIn);

// Profile endpoints (requires auth)
userRouter.get("/profile", authMiddleware, userController.getProfile);
userRouter.put("/profile", authMiddleware, userController.updateProfile);
userRouter.put("/dashboard-quick-actions", authMiddleware, userController.updateDashboardQuickActions);
userRouter.put("/email", authMiddleware, securityStepUp, userController.changeEmail);
userRouter.put("/phone", authMiddleware, userController.changePhone);
userRouter.delete("/email", authMiddleware, securityStepUp, userController.removeEmail);
userRouter.delete("/phone", authMiddleware, userController.removePhone);

// Add email/phone with OTP verification (requires auth)
userRouter.post("/addEmail", authMiddleware, emailChangeStepUp, otpRateLimiter, userController.addEmail);
userRouter.post("/verifyAddEmail", authMiddleware, emailChangeStepUp, otpRateLimiter, userController.verifyAddEmail);
userRouter.post("/addPhone", authMiddleware, otpRateLimiter, userController.addPhone);
userRouter.post("/verifyAddPhone", authMiddleware, otpRateLimiter, userController.verifyAddPhone);

// Profile password management — identity is proven by the `security` step-up session.
userRouter.post("/profile/set-password", authMiddleware, securityStepUp, userController.setPassword);

// Creator vanity page (dynopay.com/{handle})
userRouter.get("/creator/check-handle", authMiddleware, userController.checkHandle);
userRouter.get("/creator/check-handle-public", moderateRateLimiter, userController.checkHandlePublic);
userRouter.post("/creator/reserve-handle", strictRateLimiter, userController.reserveHandle);
userRouter.get("/creator/profile", authMiddleware, userController.getCreatorProfileSettings);
userRouter.put("/creator/profile", authMiddleware, userController.updateCreatorProfile);
userRouter.post(
  "/creator/upload-cover",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  userController.uploadCoverImage
);
userRouter.get("/creator/stats", authMiddleware, userController.getCreatorStats);
userRouter.get("/creator/funnel", authMiddleware, userController.getCreatorFunnel);
userRouter.get("/creator/analytics", authMiddleware, userController.getCreatorAnalytics);
userRouter.get("/creator/analytics/split", authMiddleware, userController.getCreatorAnalyticsSplit);

// Per-user display-currency (Doc-3 workstream E)
userRouter.get("/display-currency", authMiddleware, userController.getUserDisplayCurrency);
userRouter.patch("/display-currency", authMiddleware, userController.updateUserDisplayCurrency);

// Merchant tax settings (Session 57)
userRouter.get("/tax-settings", authMiddleware, userController.getMerchantTaxSettings);
userRouter.patch("/tax-settings", authMiddleware, userController.updateMerchantTaxSettings);

// Login activity (requires auth)
userRouter.get("/login-activity", authMiddleware, userController.getLoginActivity);

// Security: Flag suspicious login (public — uses security token from email)
userRouter.post("/security/flag-login", userController.flagLogin);

// Security: One-tap "sign out everywhere" from the new-device alert email.
// GET renders a confirm page (prefetch-safe); POST performs the revocation.
userRouter.get("/security/signout-everywhere", userController.signOutEverywhereConfirmPage);
userRouter.post("/security/signout-everywhere", express.urlencoded({ extended: false, limit: "4kb" }) as unknown as RequestHandler, userController.signOutEverywhereAction);

// Last company persistence (requires auth)
userRouter.put("/last-company", authMiddleware, userController.updateLastCompany);

userRouter.put(
  "/updateUser",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  userMiddleware,
  userController.updateUser
);

userRouter.put(
  "/changePassword",
  authMiddleware,
  securityStepUp,
  validate(changePasswordSchema),
  userMiddleware,
  userController.changePassword
);

// Account deletion (requires auth)
userRouter.post("/account/send-otp", authMiddleware, userController.sendDeleteAccountOtp);
userRouter.delete("/account", authMiddleware, userController.deleteAccount);

// Onboarding status (requires auth) - check wallet, KYC, API key, company setup status
userRouter.get("/onboarding-status", authMiddleware, userController.getOnboardingStatus);

// Event-triggered "finish setting up to get paid" email when the create-pay-link gate blocks a merchant
userRouter.post("/activation-nudge", authMiddleware, moderateRateLimiter, userController.sendActivationNudge);

// Email verification endpoints (requires auth)
userRouter.post("/verify-email", authMiddleware, userController.verifyEmail);
userRouter.post("/resend-verification", authMiddleware, otpRateLimiter, userController.resendVerification);

// Referee code unsubscribe (no auth required - uses token)
userRouter.post("/unsubscribe-reminders", userController.unsubscribeFromReminders);
userRouter.get("/unsubscribe-reminders/:token", userController.unsubscribeFromReminders);

// Payment link unsubscribe (no auth required - uses token)
userRouter.post("/unsubscribe-payment-reminders", userController.unsubscribeFromPaymentReminders);
userRouter.get("/unsubscribe-payment-reminders/:token", userController.unsubscribeFromPaymentReminders);

// ── Session Management ──────────────────────────────────────────────────────
userRouter.post("/refresh-token", moderateRateLimiter, sessionController.refreshToken);
userRouter.get("/sessions", authMiddleware, sessionController.listSessions);
userRouter.delete("/sessions/:id", authMiddleware, sessionController.revokeSessionEndpoint);
userRouter.delete("/sessions", authMiddleware, sessionController.revokeAllOtherSessionsEndpoint);
userRouter.get("/session-check", authMiddleware, sessionController.sessionCheck);
userRouter.get("/login-history", authMiddleware, sessionController.loginHistory);

// ── Two-Factor Authentication ────────────────────────────────────────────────
userRouter.post("/2fa/setup", authMiddleware, twoFactorController.setupEndpoint);
userRouter.post("/2fa/verify-setup", authMiddleware, twoFactorController.verifySetupEndpoint);
userRouter.post("/2fa/validate", strictRateLimiter, validate(twoFAValidateSchema), twoFactorController.validateEndpoint);
userRouter.post("/2fa/resend", otpRateLimiter, twoFactorEnrollController.resendChallenge);
// Lost authenticator → email-verified reset (public, rate-limited)
userRouter.post("/2fa/reset/request", strictRateLimiter, twoFactorResetController.request);
userRouter.post("/2fa/reset/confirm", strictRateLimiter, twoFactorResetController.confirm);
userRouter.post("/2fa/disable", authMiddleware, securityStepUp, twoFactorController.disableEndpoint);
userRouter.post("/2fa/regenerate-backup-codes", authMiddleware, securityStepUp, twoFactorController.regenerateBackupCodesEndpoint);
userRouter.get("/2fa/status", authMiddleware, twoFactorController.statusEndpoint);
userRouter.get("/2fa/enforcement", authMiddleware, twoFactorEnrollController.enforcement);
// Email-code baseline enrolment (mandatory-2FA rollout)
userRouter.post("/2fa/email/start", authMiddleware, otpRateLimiter, twoFactorEnrollController.emailStart);
userRouter.post("/2fa/email/verify", authMiddleware, otpRateLimiter, twoFactorEnrollController.emailVerify);
// Trusted devices (skip the 2FA challenge for 90 rolling days)
userRouter.get("/trusted-devices", authMiddleware, trustedDeviceController.list);
userRouter.delete("/trusted-devices/:id", authMiddleware, trustedDeviceController.revokeOne);
userRouter.delete("/trusted-devices", authMiddleware, trustedDeviceController.revokeAll);

export default userRouter;
