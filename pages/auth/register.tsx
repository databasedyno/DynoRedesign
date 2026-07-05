import Logo from "@/assets/Images/auth/dynopay-logo.png";
import WhiteLogo from "@/assets/Images/auth/dynopay-white-logo.png";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import AuthBrandPanel from "@/Components/UI/AuthLayout/AuthBrandPanel";
import { AuthPageBackground, SplitLayoutWrapper, FormPanel } from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import GoogleIcon from "@/assets/Images/googleIcon.svg";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import { signIn } from "next-auth/react";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_LOGIN } from "@/Redux/Actions/UserAction";
import axiosBaseApi from "@/axiosConfig";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import {
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
  Divider,
  Link,
} from "@mui/material";
import { ArrowBack, CheckCircleOutline } from "@mui/icons-material";
import Head from "next/head";

type RegisterMethod = "email" | "phone";
type Step = "input" | "otp" | "success";

const LoadingSpinner = ({ size = 20 }: { size?: number }) => (
  <Box
    sx={{
      width: size, height: size,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
    }}
  />
);

const Register = () => {
  const { t, i18n } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const dispatch = useDispatch();

  // State
  const [step, setStep] = useState<Step>("input");
  const [method, setMethod] = useState<RegisterMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [phoneTypeChecking, setPhoneTypeChecking] = useState(false);
  // When the entered email/phone already belongs to an account, the backend
  // sends a login OTP and we switch the UI into "log in" mode instead of "create account".
  const [accountExists, setAccountExists] = useState(false);
  // Bumped each time we send a new OTP — tells OtpInputPanel to clear its boxes
  // and re-focus the first input.
  const [otpResetKey, setOtpResetKey] = useState(0);

  // Check for referral code in URL
  useEffect(() => {
    if (router.query.ref && typeof router.query.ref === "string") {
      setReferralCode(router.query.ref);
      setShowReferralInput(true);
    }
  }, [router.query]);

  // ─── SEO-attribution capture ─────────────────────────────────────
  // When users arrive from /accept-crypto-payments-in/{country} or /for/{vertical}
  // the SEO pages append `?src=seo&page={slug}&kind={country|vertical}` to the
  // signup link. Capture it (7-day localStorage window) so we can measure
  // per-SEO-page conversion downstream. We also SEND it on registerEmail /
  // registerPhone so the backend can log it against the new-user creation.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const src =
        typeof router.query.src === "string" ? router.query.src : null;
      const pageSlug =
        typeof router.query.page === "string" ? router.query.page : null;
      const kind =
        typeof router.query.kind === "string" &&
        (router.query.kind === "country" || router.query.kind === "vertical")
          ? router.query.kind
          : null;
      if (src === "seo" && pageSlug && kind) {
        const payload = { src, page: pageSlug, kind, ts: Date.now() };
        localStorage.setItem("dyno_seo_attr", JSON.stringify(payload));
      }
    } catch {
      /* attribution capture must never break the app */
    }
  }, [router.query]);

  // Load stored SEO attribution (fresh <= 7d) so it survives a browser refresh
  // between landing on the SEO page and finishing signup.
  const getSeoAttribution = useCallback((): {
    src: string;
    page: string;
    kind: "country" | "vertical";
  } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("dyno_seo_attr");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      if (
        parsed?.src === "seo" &&
        typeof parsed?.page === "string" &&
        (parsed?.kind === "country" || parsed?.kind === "vertical") &&
        typeof parsed?.ts === "number" &&
        Date.now() - parsed.ts <= MAX_AGE_MS
      ) {
        return { src: parsed.src, page: parsed.page, kind: parsed.kind };
      }
    } catch {
      /* ignore */
    }
    return null;
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // ─── Google Sign Up ───
  const handleGoogleLogin = useCallback(async () => {
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (err) {
      console.error("Google sign-in error:", err);
    }
  }, []);

  // ─── Phone Type Check ───
  const checkPhoneType = useCallback(async (phoneDigits: string): Promise<boolean> => {
    setPhoneTypeChecking(true);
    try {
      const res = await axiosBaseApi.post("/user/phone-type-check", { mobile: phoneDigits });
      const data = res?.data?.data;
      if (data && !data.is_mobile && data.phone_type !== "unknown") {
        setPhoneError("Only mobile numbers are accepted. Please use a mobile phone number.");
        return false;
      }
      return true;
    } catch {
      // If check fails, allow through
      return true;
    } finally {
      setPhoneTypeChecking(false);
    }
  }, []);

  // ─── Step 1: Send OTP ───
  const handleContinue = useCallback(async () => {
    setEmailError("");
    setPhoneError("");
    setLoading(true);

    try {
      let exists = false;
      const attribution = getSeoAttribution();
      if (method === "email") {
        if (!email || !email.includes("@")) {
          setEmailError("Please enter a valid email address");
          setLoading(false);
          return;
        }
        const res = await axiosBaseApi.post("/user/registerEmail", {
          email: email.toLowerCase().trim(),
          referral_code: referralCode || undefined,
          attribution: attribution || undefined,
        });
        exists = res?.data?.data?.account_exists === true;
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        if (digits.length < 10) {
          setPhoneError("Please enter a valid mobile number");
          setLoading(false);
          return;
        }

        // Check phone type first
        const isMobileNumber = await checkPhoneType(digits);
        if (!isMobileNumber) {
          setLoading(false);
          return;
        }

        const res = await axiosBaseApi.post("/user/registerPhone", {
          mobile: digits,
          referral_code: referralCode || undefined,
          attribution: attribution || undefined,
        });
        exists = res?.data?.data?.account_exists === true;
      }

      setAccountExists(exists);
      setStep("otp");
      setOtpResetKey((k) => k + 1);
      setCountdown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong. Please try again.";
      if (method === "email") setEmailError(msg);
      else setPhoneError(msg);
    } finally {
      setLoading(false);
    }
  }, [method, email, phone, referralCode, checkPhoneType, getSeoAttribution]);

  // ─── Step 2: Verify OTP & Create Account ───
  const handleVerifyOtp = useCallback(async (otpCode: string) => {
    if (otpCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit code");
      return;
    }

    setOtpError("");
    setLoading(true);

    try {
      let response;
      const attribution = getSeoAttribution();
      if (method === "email") {
        response = await axiosBaseApi.post("/user/registerEmail/verify-otp", {
          email: email.toLowerCase().trim(),
          otp: otpCode,
          language: i18n.language,
          attribution: attribution || undefined,
        });
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        response = await axiosBaseApi.post("/user/registerPhone/verify", {
          mobile: digits,
          otp: otpCode,
          language: i18n.language,
          attribution: attribution || undefined,
        });
      }

      const data = response?.data?.data;
      if (data?.accessToken) {
        const isLogin = accountExists || data?.account_exists === true;
        // Store token and redirect
        dispatch({
          type: USER_LOGIN,
          payload: data,
        });
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: isLogin ? "Welcome back! Logged in successfully." : "Account created successfully!",
            severity: "success",
          },
        });
        setStep("success");
        // Auto redirect after brief success display
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        setOtpError("Account creation failed. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Invalid verification code. Please try again.";
      setOtpError(msg);
    } finally {
      setLoading(false);
    }
  }, [method, email, phone, accountExists, dispatch, router, i18n.language, getSeoAttribution]);

  // ─── Resend OTP ───
  const handleResendOtp = useCallback(async () => {
    if (countdown > 0) return;
    setOtpError("");
    setLoading(true);

    try {
      if (method === "email") {
        await axiosBaseApi.post("/user/registerEmail", {
          email: email.toLowerCase().trim(),
          referral_code: referralCode || undefined,
        });
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        await axiosBaseApi.post("/user/registerPhone", { mobile: digits });
      }
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch {
      setOtpError("Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [countdown, method, email, phone, referralCode]);

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════

  return (
    <>
      <Head>
        <title>Create Account | DynoPay</title>
      </Head>
      <AuthPageBackground>
        {/* Top bar: Language + Theme */}
        {!isMobile && (
          <Box
            sx={{
              position: "absolute", top: "24px", right: "32px",
              display: "flex", gap: "12px", zIndex: 10,
            }}
          >
            <LanguageSwitcher />
            <ThemeToggle />
          </Box>
        )}

        <SplitLayoutWrapper>
          {/* Left Panel: Brand */}
          {!isMobile && <AuthBrandPanel />}

          {/* Right Panel: Form */}
          <FormPanel>
            <Box
              sx={{
                maxWidth: "420px",
                width: "100%",
                py: isMobile ? 2 : 0,
              }}
            >
              {/* Mobile Logo */}
              {isMobile && (
                <Box
                  sx={{ display: "flex", justifyContent: "center", mb: 2, cursor: "pointer" }}
                  onClick={() => router.push("/")}
                >
                  <Image
                    src={theme.palette.mode === "dark" ? WhiteLogo : Logo}
                    alt="logo"
                    width={110}
                    height={38}
                    draggable={false}
                  />
                </Box>
              )}

              {/* ─── STEP 1: Input ─── */}
              {step === "input" && (
                <>
                  <TitleDescription
                    title={t("register")}
                    description={t("registerDescription")}
                    descriptionFontSize="14px"
                    descriptionColor={theme.palette.text.secondary}
                  />

                  {/* Google Sign Up */}
                  <CustomButton
                    data-testid="google-signup-btn"
                    label="Continue with Google"
                    variant="outlined"
                    fullWidth
                    onClick={handleGoogleLogin}
                    startIcon={
                      <Image src={GoogleIcon} alt="google" width={20} height={20} draggable={false} />
                    }
                    sx={{ mt: 1.5 }}
                  />

                  {/* Divider */}
                  <Box sx={{ mt: 1.5, mb: 1.5 }}>
                    <Divider
                      sx={{
                        "&::before, &::after": {
                          borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                        },
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "12px",
                          color: "text.secondary",
                          fontFamily: "UrbanistMedium",
                          textTransform: "lowercase",
                          px: 1,
                        }}
                      >
                        or sign up with
                      </Typography>
                    </Divider>
                  </Box>

                  {/* Method Toggle */}
                  <Box sx={{ mb: 1.5 }}>
                    <ToggleButtonGroup
                      value={method}
                      exclusive
                      onChange={(_, val) => {
                        if (val) {
                          setMethod(val);
                          setEmailError("");
                          setPhoneError("");
                        }
                      }}
                      sx={{
                        width: "100%",
                        background: theme.palette.mode === "dark" ? "#1a1d2e" : "#f3f4f6",
                        borderRadius: "12px",
                        padding: "3px",
                        "& .MuiToggleButton-root": {
                          flex: 1,
                          border: "none",
                          borderRadius: "10px !important",
                          textTransform: "none",
                          fontFamily: "UrbanistSemiBold",
                          fontSize: "14px",
                          color: "text.secondary",
                          padding: "8px 0",
                          transition: "all 0.25s",
                          "&.Mui-selected": {
                            background: theme.palette.mode === "dark" ? "#2a2d45" : "#fff",
                            color: "text.primary",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                            "&:hover": { background: theme.palette.mode === "dark" ? "#2a2d45" : "#fff" },
                          },
                          "&:hover": { background: "transparent" },
                        },
                      }}
                    >
                      <ToggleButton value="email">E-mail</ToggleButton>
                      <ToggleButton value="phone">Mobile Number</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  {/* Input Field */}
                  {method === "email" ? (
                    <Box sx={{ mb: 1 }}>
                      <InputField
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                        onKeyDown={(e) => { if (e.key === "Enter") handleContinue(); }}
                        placeholder="Enter your email address"
                        label="E-mail"
                        error={!!emailError}
                        helperText={emailError}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ mb: 1 }}>
                      <CountryPhoneInput
                        value={phone}
                        onChange={(value) => { setPhone(value); setPhoneError(""); }}
                        label="Mobile Number"
                        error={!!phoneError}
                        helperText={phoneError}
                        placeholder="Enter mobile number"
                      />
                      {phoneTypeChecking && (
                        <Typography sx={{ fontSize: "12px", color: "text.secondary", fontFamily: "UrbanistMedium", mt: 0.5, ml: 0.5 }}>
                          Checking number type...
                        </Typography>
                      )}
                    </Box>
                  )}

                  {/* Referral Code */}
                  {!showReferralInput ? (
                    <Typography
                      sx={{
                        fontSize: "13px",
                        color: theme.palette.primary.main,
                        fontFamily: "UrbanistMedium",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        mb: 1.5,
                      }}
                      onClick={() => setShowReferralInput(true)}
                    >
                      Have a referral code?
                    </Typography>
                  ) : (
                    <Box sx={{ mb: 1.5 }}>
                      <InputField
                        type="text"
                        value={referralCode}
                        onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                        placeholder="Enter referral code (optional)"
                        label="Referral Code"
                      />
                    </Box>
                  )}

                  {/* Continue Button */}
                  <CustomButton
                    variant="primary"
                    size="medium"
                    label="Continue"
                    onClick={handleContinue}
                    disabled={loading || phoneTypeChecking}
                    fullWidth
                    sx={{ fontWeight: 700, padding: "13px 24px", borderRadius: "12px", fontSize: "15px" }}
                    endIcon={loading ? <LoadingSpinner size={18} /> : undefined}
                    hideLabelWhenLoading={true}
                  />

                  {/* Already have account */}
                  <Box sx={{ display: "flex", gap: "7px", justifyContent: "center", mt: 2 }}>
                    <Typography sx={{ fontSize: "13px", color: "text.secondary", fontFamily: "UrbanistMedium" }}>
                      Do you already have an account?
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "13px", color: theme.palette.primary.main, fontWeight: 500,
                        cursor: "pointer", textDecoration: "underline", fontFamily: "UrbanistMedium",
                      }}
                      onClick={() => router.push("/auth/login")}
                    >
                      Log in
                    </Typography>
                  </Box>
                </>
              )}

              {/* ─── STEP 2: OTP ─── */}
              {step === "otp" && (
                <>
                  <Box sx={{ textAlign: "center", mb: 2.5 }}>
                    <Box
                      sx={{
                        width: 56, height: 56, borderRadius: "16px",
                        background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 12px",
                      }}
                    >
                      <Typography sx={{ fontSize: "28px" }}>✉️</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "22px", color: "text.primary", fontFamily: "UrbanistBold" }}>
                      {accountExists ? "Welcome Back!" : `Verify Your ${method === "email" ? "Email" : "Phone"}`}
                    </Typography>
                    <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "UrbanistMedium", mt: 0.5, lineHeight: 1.5 }}>
                      Enter the 6-digit code sent to{" "}
                      <Typography component="span" sx={{ fontWeight: 600, color: "text.primary", fontSize: "14px" }}>
                        {method === "email"
                          ? email.replace(/(.{2}).*(@.*)/, "$1***$2")
                          : phone.replace(/(\d{3})\d+(\d{2})/, "$1****$2")}
                      </Typography>
                    </Typography>
                    {accountExists && (
                      <Box
                        data-testid="account-exists-banner"
                        sx={{
                          mt: 1.5,
                          mx: "auto",
                          maxWidth: "360px",
                          px: 1.5,
                          py: 1,
                          borderRadius: "10px",
                          background: theme.palette.mode === "dark" ? "rgba(79,70,229,0.18)" : "rgba(79,70,229,0.08)",
                          border: `1px solid ${theme.palette.mode === "dark" ? "rgba(124,58,237,0.4)" : "rgba(79,70,229,0.2)"}`,
                        }}
                      >
                        <Typography sx={{ fontSize: "13px", color: "text.primary", fontFamily: "UrbanistSemiBold", lineHeight: 1.5 }}>
                          This {method === "email" ? "email" : "phone number"} already has an account — enter the code to log in.
                        </Typography>
                      </Box>
                    )}
                  </Box>

                  {/* Shared OTP block — auto-submits the moment 6 digits are entered */}
                  <OtpInputPanel
                    contactType={method === "email" ? "email" : "phone"}
                    otpLength={6}
                    onVerify={handleVerifyOtp}
                    onResendCode={handleResendOtp}
                    onClearError={() => setOtpError("")}
                    countdown={countdown}
                    loading={loading}
                    error={otpError}
                    primaryButtonLabel={accountExists ? "Verify & log in" : "Verify & create account"}
                    showInfoChip={false}
                    showLabel={false}
                    actionsLayout="stacked"
                    resetKey={otpResetKey}
                  />

                  {/* Back */}
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
                    <Link
                      component="button"
                      onClick={() => { setStep("input"); setOtpError(""); setAccountExists(false); setOtpResetKey((k) => k + 1); }}
                      sx={{
                        fontSize: "13px", color: "text.secondary", fontFamily: "UrbanistMedium",
                        textDecoration: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                        background: "transparent", border: "none", padding: 0,
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      <ArrowBack sx={{ fontSize: "16px" }} />
                      Change {method === "email" ? "email" : "phone number"}
                    </Link>
                  </Box>
                </>
              )}

              {/* ─── STEP 3: Success ─── */}
              {step === "success" && (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <Box
                    sx={{
                      width: 72, height: 72, borderRadius: "50%",
                      background: "linear-gradient(135deg, #10B981, #059669)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      margin: "0 auto 20px",
                      boxShadow: "0 8px 32px rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <CheckCircleOutline sx={{ fontSize: 40, color: "#fff" }} />
                  </Box>
                  <Typography sx={{ fontWeight: 700, fontSize: "24px", color: "text.primary", fontFamily: "UrbanistBold", mb: 1 }}>
                    {accountExists ? "Welcome back to DynoPay!" : "Welcome to DynoPay!"}
                  </Typography>
                  <Typography sx={{ fontSize: "15px", color: "text.secondary", fontFamily: "UrbanistMedium", lineHeight: 1.6, mb: 1 }}>
                    {accountExists
                      ? "You're logged in. Redirecting to your dashboard..."
                      : "Your account has been created. Redirecting to your dashboard..."}
                  </Typography>
                  <LoadingSpinner size={24} />
                </Box>
              )}
            </Box>
          </FormPanel>
        </SplitLayoutWrapper>
      </AuthPageBackground>
    </>
  );
};

export default Register;
