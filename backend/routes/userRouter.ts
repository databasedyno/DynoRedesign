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
const userRouter = express.Router();

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
userRouter.post("/connectSocial", moderateRateLimiter, userController.connectSocial);

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
userRouter.put("/email", authMiddleware, userController.changeEmail);
userRouter.put("/phone", authMiddleware, userController.changePhone);
userRouter.delete("/email", authMiddleware, userController.removeEmail);
userRouter.delete("/phone", authMiddleware, userController.removePhone);

// Add email/phone with OTP verification (requires auth)
userRouter.post("/addEmail", authMiddleware, otpRateLimiter, userController.addEmail);
userRouter.post("/verifyAddEmail", authMiddleware, otpRateLimiter, userController.verifyAddEmail);
userRouter.post("/addPhone", authMiddleware, otpRateLimiter, userController.addPhone);
userRouter.post("/verifyAddPhone", authMiddleware, otpRateLimiter, userController.verifyAddPhone);

// Profile password management with OTP verification (requires auth)
userRouter.post("/profile/request-password-otp", authMiddleware, otpRateLimiter, userController.requestPasswordOtp);
userRouter.post("/profile/set-password", authMiddleware, otpRateLimiter, userController.setPasswordWithOtp);

// Creator vanity page (dynopay.com/{handle})
userRouter.get("/creator/check-handle", authMiddleware, userController.checkHandle);
userRouter.put("/creator/profile", authMiddleware, userController.updateCreatorProfile);
userRouter.post(
  "/creator/upload-cover",
  authMiddleware,
  uploadImage.single("image") as unknown as RequestHandler,
  userController.uploadCoverImage
);
userRouter.get("/creator/stats", authMiddleware, userController.getCreatorStats);

// Login activity (requires auth)
userRouter.get("/login-activity", authMiddleware, userController.getLoginActivity);

// Security: Flag suspicious login (public — uses security token from email)
userRouter.post("/security/flag-login", userController.flagLogin);

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
  validate(changePasswordSchema),
  userMiddleware,
  userController.changePassword
);

// Account deletion (requires auth)
userRouter.delete("/account", authMiddleware, userController.deleteAccount);

// Onboarding status (requires auth) - check wallet, KYC, API key, company setup status
userRouter.get("/onboarding-status", authMiddleware, userController.getOnboardingStatus);

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
userRouter.get("/login-history", authMiddleware, sessionController.loginHistory);

// ── Two-Factor Authentication ────────────────────────────────────────────────
userRouter.post("/2fa/setup", authMiddleware, twoFactorController.setupEndpoint);
userRouter.post("/2fa/verify-setup", authMiddleware, twoFactorController.verifySetupEndpoint);
userRouter.post("/2fa/validate", strictRateLimiter, validate(twoFAValidateSchema), twoFactorController.validateEndpoint);
userRouter.post("/2fa/disable", authMiddleware, twoFactorController.disableEndpoint);
userRouter.post("/2fa/regenerate-backup-codes", authMiddleware, twoFactorController.regenerateBackupCodesEndpoint);
userRouter.get("/2fa/status", authMiddleware, twoFactorController.statusEndpoint);

export default userRouter;
