import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import { FieldRow } from "@/Components/UI/SingleQuestionForm";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import TrustStrip from "@/Components/UI/AuthLayout/TrustStrip";
import AuthBrandPanel from "@/Components/UI/AuthLayout/AuthBrandPanel";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import CustomButton from "@/Components/UI/Buttons";
import { AuthHeaderControls } from "@/Components/UI/AuthLayout/AuthShell";
import { AuthPageBackground, SplitScreenWrapper, SplitFormColumn, FormPanel } from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import SocialAuthButtons from "@/Components/Common/SocialAuthButtons";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_LOGIN, USER_LOGIN_2FA_REQUIRED } from "@/Redux/Actions/UserAction";
import axiosBaseApi from "@/axiosConfig";
import confetti from "canvas-confetti";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Box, Typography, useTheme, Divider } from "@mui/material";
import { ArrowBack, CheckCircleOutline, InfoOutlined, MailOutline, SmartphoneOutlined } from "@mui/icons-material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Head from "next/head";
import Script from "next/script";
import { BRAND_ACCENT, brandFg, BRAND_ON_ACCENT } from "@/constants/theme";
import { API_ENDPOINTS } from "@/api/endpoints";
import Spinner from "@/Components/UI/Spinner";

type RegisterMethod = "email" | "phone";
type Step = "email" | "verify" | "setup" | "success";

// Password rule (OWASP — matches the backend validatePasswordStrength):
// upper + lower + digit + special, 8–20 chars.
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=_+{}\[\]:;<>,.?/~]).{8,20}$/;

const LoadingSpinner = ({ size = 20 }: { size?: number }) => (
  <Spinner size={size} thickness={2} trackColor="rgba(255,255,255,0.3)" color="#fff" speed="0.8s" />
);

const Register = () => {
  const { t, i18n } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const router = useRouter();
  const dispatch = useDispatch();

  // ── Flow state ─────────────────────────────────────────────────
  const [step, setStep] = useState<Step>("email");
  const [method, setMethod] = useState<RegisterMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [loading, setLoading] = useState(false);

  // Set-up screen (new signups only).
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPwRules, setShowPwRules] = useState(false);
  const [setupError, setSetupError] = useState("");
  const pwFieldRef = useRef<HTMLDivElement | null>(null);

  const [countdown, setCountdown] = useState(0);
  const [showReferralInput, setShowReferralInput] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [phoneTypeChecking, setPhoneTypeChecking] = useState(false);

  // When the entered email/phone already belongs to an account, verify logs them in.
  const [accountExists, setAccountExists] = useState(false);
  // Proof-of-ownership token issued by verify-otp; consumed by the complete step.
  const [signupToken, setSignupToken] = useState("");
  const [otpResetKey, setOtpResetKey] = useState(0);
  const [claimedHandle, setClaimedHandle] = useState("");

  // Guard so the hero's auto-send / auto-google only fires once.
  const autoRanRef = useRef(false);

  // ── Confetti on new-account success ─────────────────────────────
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (step !== "success") { confettiFiredRef.current = false; return; }
    if (confettiFiredRef.current || accountExists) return;
    confettiFiredRef.current = true;
    try {
      const shared = { disableForReducedMotion: true, particleCount: 60, spread: 60, startVelocity: 35, colors: ["#FFD100", "#FFD100", "#10B981", "#FFB300"], scalar: 0.9, ticks: 200 };
      confetti({ ...shared, origin: { x: 0.3, y: 0.5 } });
      confetti({ ...shared, origin: { x: 0.7, y: 0.5 } });
    } catch { /* client-only */ }
  }, [step, accountExists]);

  // ── Referral code from the URL (genuine codes only) ─────────────
  useEffect(() => {
    const raw = router.query.ref;
    if (!raw || typeof raw !== "string") return;
    const code = raw.trim().toUpperCase();
    if (/^(DYNO|REF)[A-Z0-9-]{3,}$/.test(code)) {
      setReferralCode(code);
      setShowReferralInput(true);
    }
  }, [router.query]);

  // ── SEO-attribution capture (7-day window) ──────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const src = typeof router.query.src === "string" ? router.query.src : null;
      const pageSlug = typeof router.query.page === "string" ? router.query.page : null;
      const kind =
        typeof router.query.kind === "string" && (router.query.kind === "country" || router.query.kind === "vertical")
          ? router.query.kind : null;
      if (src === "seo" && pageSlug && kind) {
        localStorage.setItem("dyno_seo_attr", JSON.stringify({ src, page: pageSlug, kind, ts: Date.now() }));
      }
    } catch { /* never break signup */ }
  }, [router.query]);

  // ── Claimed-handle capture (from the landing hero) ──────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const fromQuery = typeof router.query.handle === "string" ? router.query.handle : "";
      const raw = fromQuery || localStorage.getItem("dynopay.claimedHandle") || "";
      const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
      if (clean.length >= 3) {
        setClaimedHandle(clean);
        localStorage.setItem("dynopay.claimedHandle", clean);
        const token = localStorage.getItem("dynopay.claimedHandleToken") || undefined;
        fetch(`/api${API_ENDPOINTS.creator.reserveHandle}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: clean, token }),
        })
          .then((r) => r.json())
          .then((j) => {
            const d = j?.data ?? j;
            if (d?.token) { try { localStorage.setItem("dynopay.claimedHandleToken", d.token); } catch { /* ignore */ } }
          })
          .catch(() => { /* best-effort */ });
      }
    } catch { /* ignore */ }
  }, [router.query]);

  const getSeoAttribution = useCallback((): { src: string; page: string; kind: "country" | "vertical" } | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem("dyno_seo_attr");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
      if (parsed?.src === "seo" && typeof parsed?.page === "string" &&
        (parsed?.kind === "country" || parsed?.kind === "vertical") &&
        typeof parsed?.ts === "number" && Date.now() - parsed.ts <= MAX_AGE_MS) {
        return { src: parsed.src, page: parsed.page, kind: parsed.kind };
      }
    } catch { /* ignore */ }
    return null;
  }, []);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // ── Google / GitHub sign up (verified GIS flow) ─────────────────
  const handleGoogleLogin = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      dispatch({ type: TOAST_SHOW, payload: { message: "Google sign-in is not configured", severity: "error" } });
      return;
    }
    const runGoogleTokenFlow = () => {
      const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "openid email profile",
        callback: async (tokenResponse: any) => {
          if (!tokenResponse?.access_token) return;
          try {
            const res = await axiosBaseApi.post("user/google-signin", { accessToken: tokenResponse.access_token });
            const { data, message } = res?.data || {};
            if (data?.requires_2fa) {
              dispatch({ type: USER_LOGIN_2FA_REQUIRED, payload: { challenge_token: data.challenge_token, method: data.method, masked_email: data.masked_email } });
              router.push("/auth/login");
              return;
            }
            if (data?.userData && data?.accessToken) {
              dispatch({ type: TOAST_SHOW, payload: { message: message || "Login successful" } });
              dispatch({ type: USER_LOGIN, payload: { ...data.userData, accessToken: data.accessToken, refreshToken: data.refreshToken } });
              setAccountExists(true); // social accounts skip the set-up screen
              setStep("success");
              setTimeout(() => router.push("/dashboard"), 1200);
            } else {
              throw new Error("Invalid response");
            }
          } catch (e: any) {
            const msg = e.response?.data?.message ?? e.message ?? "Google sign-up failed";
            dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
          }
        },
      });
      tokenClient.requestAccessToken();
    };
    const isGisReady = () => typeof window !== "undefined" && !!(window as any).google?.accounts?.oauth2;
    if (isGisReady()) { runGoogleTokenFlow(); return; }
    let waited = 0;
    const interval = setInterval(() => {
      waited += 250;
      if (isGisReady()) { clearInterval(interval); runGoogleTokenFlow(); }
      else if (waited >= 2500) {
        clearInterval(interval);
        dispatch({ type: TOAST_SHOW, payload: { message: "Google sign-in is still loading — please try again in a moment.", severity: "error" } });
      }
    }, 250);
  }, [dispatch, router]);

  const handleGithubLogin = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId || typeof window === "undefined") return;
    const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    try { sessionStorage.setItem("gh_oauth_state", state); } catch { /* ignore */ }
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, scope: "read:user user:email", state });
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  }, []);

  // ── Phone type check ────────────────────────────────────────────
  const checkPhoneType = useCallback(async (phoneDigits: string): Promise<boolean> => {
    setPhoneTypeChecking(true);
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.user.phoneTypeCheck, { mobile: phoneDigits });
      const data = res?.data?.data;
      if (data && !data.is_mobile && data.phone_type !== "unknown") {
        setPhoneError("Only mobile numbers are accepted. Please use a mobile phone number.");
        return false;
      }
      return true;
    } catch {
      return true;
    } finally {
      setPhoneTypeChecking(false);
    }
  }, []);

  // ── Step 1: send the verification code ──────────────────────────
  const handleContinue = useCallback(async (emailOverride?: string) => {
    setEmailError("");
    setPhoneError("");
    setLoading(true);
    try {
      let exists = false;
      const attribution = getSeoAttribution();
      if (method === "email") {
        const value = (emailOverride ?? email).toLowerCase().trim();
        if (!value || !value.includes("@")) {
          setEmailError("Please enter a valid email address");
          setLoading(false);
          return;
        }
        const res = await axiosBaseApi.post(API_ENDPOINTS.user.registerEmail, {
          email: value,
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
        const isMobileNumber = await checkPhoneType(digits);
        if (!isMobileNumber) { setLoading(false); return; }
        const res = await axiosBaseApi.post(API_ENDPOINTS.user.registerPhone, {
          mobile: digits,
          referral_code: referralCode || undefined,
          attribution: attribution || undefined,
        });
        exists = res?.data?.data?.account_exists === true;
      }

      setAccountExists(exists);
      setStep("verify");
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

  // ── Hero deep-link: auto-send OTP and/or trigger Google once ────
  useEffect(() => {
    if (autoRanRef.current || !router.isReady) return;
    const q = router.query;
    const qEmail = typeof q.email === "string" ? q.email : "";
    const autoSend = q.autoSend === "1" || q.autoSend === "true";
    const provider = typeof q.provider === "string" ? q.provider : "";
    if (qEmail) setEmail(qEmail.toLowerCase());
    if (provider === "google") {
      autoRanRef.current = true;
      setTimeout(() => handleGoogleLogin(), 300);
      return;
    }
    if (qEmail && autoSend && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(qEmail)) {
      autoRanRef.current = true;
      setTimeout(() => handleContinue(qEmail), 150);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query]);

  // ── Step 2: verify the code ─────────────────────────────────────
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
        response = await axiosBaseApi.post(API_ENDPOINTS.user.registerEmailVerifyOtp, {
          email: email.toLowerCase().trim(),
          otp: otpCode,
          attribution: attribution || undefined,
        });
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        response = await axiosBaseApi.post(API_ENDPOINTS.user.registerPhoneVerify, {
          mobile: digits,
          otp: otpCode,
          attribution: attribution || undefined,
        });
      }

      const data = response?.data?.data;

      // Existing account with 2FA → finish on the login page's 2FA prompt.
      if (data?.requires_2fa) {
        dispatch({ type: USER_LOGIN_2FA_REQUIRED, payload: { challenge_token: data.challenge_token, method: data.method, masked_email: data.masked_email } });
        router.push("/auth/login");
        return;
      }

      // Existing account → logged in.
      if (accountExists || data?.account_exists === true) {
        if (data?.accessToken) {
          dispatch({ type: USER_LOGIN, payload: data });
          dispatch({ type: TOAST_SHOW, payload: { message: "Welcome back! Logged in successfully.", severity: "success" } });
          setStep("success");
          setTimeout(() => router.push("/dashboard"), 1200);
        } else {
          setOtpError("Login failed. Please try again.");
        }
        return;
      }

      // New account → email verified; move to the set-up screen.
      if (data?.signup_token) {
        setSignupToken(data.signup_token);
        setStep("setup");
      } else {
        setOtpError("Verification failed. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Invalid verification code. Please try again.";
      setOtpError(msg);
    } finally {
      setLoading(false);
    }
  }, [method, email, phone, accountExists, dispatch, router, getSeoAttribution]);

  // ── Step 3: set up account (name + password) ────────────────────
  const handleComplete = useCallback(async () => {
    setSetupError("");
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first) { setSetupError(t("nameFirstRequired", { defaultValue: "First name is required" })); return; }
    if (!last) { setSetupError(t("nameLastRequired", { defaultValue: "Last name is required" })); return; }
    if (!PASSWORD_RE.test(password)) {
      setSetupError(t("passwordRequirementsNotMet", { defaultValue: "Please meet all the password requirements." }));
      setShowPwRules(true);
      return;
    }

    setLoading(true);
    try {
      const attribution = getSeoAttribution();
      const base = {
        signup_token: signupToken,
        first_name: first,
        last_name: last,
        name: `${first} ${last}`,
        password,
        language: i18n.language,
        attribution: attribution || undefined,
      };
      let response;
      if (method === "email") {
        response = await axiosBaseApi.post(API_ENDPOINTS.user.registerEmailComplete, {
          email: email.toLowerCase().trim(),
          ...base,
        });
      } else {
        response = await axiosBaseApi.post(API_ENDPOINTS.user.registerPhoneComplete, {
          mobile: phone.replace(/[^\d]/g, ""),
          ...base,
        });
      }
      const data = response?.data?.data;
      if (data?.accessToken) {
        dispatch({ type: USER_LOGIN, payload: data });
        dispatch({ type: TOAST_SHOW, payload: { message: "Account created successfully!", severity: "success" } });
        setStep("success");
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setSetupError("Account creation failed. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong. Please try again.";
      setSetupError(msg);
      // Session expired → send them back to re-verify.
      if (/session expired|verify your (email|number) again/i.test(msg)) {
        setStep("verify");
        setOtpResetKey((k) => k + 1);
      }
    } finally {
      setLoading(false);
    }
  }, [firstName, lastName, password, signupToken, method, email, phone, i18n.language, dispatch, router, getSeoAttribution, t]);

  // ── Resend OTP ──────────────────────────────────────────────────
  const handleResendOtp = useCallback(async () => {
    if (countdown > 0) return;
    setOtpError("");
    setLoading(true);
    try {
      if (method === "email") {
        await axiosBaseApi.post(API_ENDPOINTS.user.registerEmail, { email: email.toLowerCase().trim(), referral_code: referralCode || undefined });
      } else {
        await axiosBaseApi.post(API_ENDPOINTS.user.registerPhone, { mobile: phone.replace(/[^\d]/g, "") });
      }
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch {
      setOtpError("Failed to resend code. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [countdown, method, email, phone, referralCode]);

  // ── Progress indicator helpers ──────────────────────────────────
  const totalSteps = accountExists ? 2 : 3;
  const currentStep = step === "email" ? 1 : step === "verify" ? 2 : 3;

  const socialEnabled =
    process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true";

  return (
    <>
      <Head>
        <title>{t("authRegister_title", { ns: "pageTitles", defaultValue: "Create your free account · Dynopay" })}</title>
      </Head>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
      <AuthPageBackground>
        <SplitScreenWrapper>
          <SplitFormColumn>
            <FormPanel>
              <Box sx={{ maxWidth: "420px", width: "100%", py: isMobile ? 2 : 0 }}>
                {/* Top row: logo + controls */}
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
                  <Image
                    src={theme.palette.mode === "dark" ? WhiteLogo : Logo}
                    alt="logo"
                    width={130}
                    height={44}
                    draggable={false}
                    onClick={() => router.push("/")}
                    style={{ cursor: "pointer" }}
                    data-testid="auth-shell-logo"
                  />
                  <AuthHeaderControls />
                </Box>

                {/* Progress */}
                {step !== "success" && (
                  <Box data-testid="register-progress" sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
                    <Typography sx={{ fontFamily: "var(--font-tech), var(--font-mono, monospace)", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.palette.text.secondary }}>
                      {t("stepOf", { defaultValue: "Step {{current}} of {{total}}", current: currentStep, total: totalSteps })}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.625, flex: 1, maxWidth: 120 }}>
                      {Array.from({ length: totalSteps }).map((_, idx) => {
                        const i = idx + 1;
                        const reached = i <= currentStep;
                        return (
                          <Box
                            key={i}
                            data-testid={`register-progress-seg-${i}`}
                            data-reached={reached}
                            sx={{
                              flex: 1, height: 5, borderRadius: 999,
                              background: reached
                                ? `linear-gradient(90deg, ${BRAND_ACCENT} 0%, #FFE566 100%)`
                                : theme.palette.mode === "dark" ? "rgba(255,255,255,0.10)" : "rgba(18,18,20,0.10)",
                              boxShadow: i === currentStep ? `0 0 12px ${BRAND_ACCENT}99` : "none",
                              transition: "background-color 300ms ease, box-shadow 300ms ease",
                            }}
                          />
                        );
                      })}
                    </Box>
                  </Box>
                )}

                {/* ─── STEP 1: Create account ─── */}
                {step === "email" && (
                  <>
                    <TitleDescription
                      title={t("register", { defaultValue: "Create your account" })}
                      description={t("registerDescription", { defaultValue: "Start accepting crypto in minutes — no credit card required." })}
                      descriptionFontSize="14px"
                      descriptionColor={theme.palette.text.secondary}
                    />

                    {claimedHandle && (
                      <Box
                        data-testid="reserved-handle-banner"
                        sx={{
                          mt: 1.5, px: 1.75, py: 1.25, display: "flex", alignItems: "center", gap: 1, borderRadius: "12px",
                          border: `1px solid ${theme.palette.mode === "dark" ? "rgba(139,94,0,0.4)" : "rgba(139,94,0,0.25)"}`,
                          background: theme.palette.mode === "dark" ? "rgba(139,94,0,0.14)" : "rgba(139,94,0,0.06)",
                        }}
                      >
                        <CheckCircleOutline sx={{ fontSize: 20, color: BRAND_ACCENT, flexShrink: 0 }} />
                        <Typography component="div" sx={{ fontSize: "13px", lineHeight: 1.35, color: theme.palette.text.primary }}>
                          {t("reservedHandlePrefix", { defaultValue: "You're reserving" })}{" "}
                          <b style={{ fontWeight: 700 }}>dynopay.com/@{claimedHandle}</b>{" "}
                          — {t("reservedHandleSuffix", { defaultValue: "finish signing up to claim it." })}
                        </Typography>
                      </Box>
                    )}

                    {socialEnabled && (
                      <>
                        <Box sx={{ mt: 1.5 }}>
                          <SocialAuthButtons
                            googleLabel={t("continueWithGoogle")}
                            onGoogle={handleGoogleLogin}
                            showGoogle={process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true"}
                            showGithub={process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true"}
                            onGithub={handleGithubLogin}
                            githubLabel={t("continueWithGithub")}
                            githubAriaLabel={t("continueWithGithub")}
                            googleTestId="google-signup-btn"
                            githubTestId="github-signup-btn"
                          />
                        </Box>
                        <Box sx={{ mt: 1.5, mb: 1.5 }}>
                          <Divider sx={{ "&::before, &::after": { borderColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" } }}>
                            <Typography sx={{ fontSize: "12px", color: "text.secondary", fontFamily: "var(--font-sans)", textTransform: "lowercase", px: 1 }}>
                              {t("orSignUpWith")}
                            </Typography>
                          </Divider>
                        </Box>
                      </>
                    )}

                    {method === "email" ? (
                      <Box sx={{ mb: 1 }}>
                        <InputField
                          data-testid="register-email-input"
                          type="email"
                          required
                          accentFocus
                          value={email}
                          onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleContinue(); }}
                          placeholder={t("emailPlaceholder")}
                          label={t("email")}
                          error={!!emailError}
                          helperText={emailError}
                        />
                      </Box>
                    ) : (
                      <Box sx={{ mb: 1 }}>
                        <CountryPhoneInput
                          value={phone}
                          onChange={(value) => { setPhone(value); setPhoneError(""); }}
                          label={t("phone")}
                          error={!!phoneError}
                          helperText={phoneError}
                          placeholder={t("enterMobilePlaceholder")}
                        />
                        {phoneTypeChecking && (
                          <Typography sx={{ fontSize: "12px", color: "text.secondary", fontFamily: "var(--font-sans)", mt: 0.5, ml: 0.5 }}>
                            {t("checkingNumberType")}
                          </Typography>
                        )}
                      </Box>
                    )}

                    {!showReferralInput ? (
                      <Typography
                        sx={{ fontSize: "13px", color: brandFg(theme.palette.mode === "dark"), fontFamily: "var(--font-sans)", cursor: "pointer", textDecoration: "underline", textUnderlineOffset: "2px", mb: 1.5 }}
                        onClick={() => setShowReferralInput(true)}
                      >
                        {t("haveReferralCode")}
                      </Typography>
                    ) : (
                      <Box sx={{ mb: 1.5 }}>
                        <InputField
                          type="text"
                          value={referralCode}
                          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                          placeholder={t("referralCodePlaceholder")}
                          label={t("referralCode")}
                        />
                        <Typography
                          data-testid="referral-benefit-hint"
                          sx={{ mt: 0.75, fontSize: "12px", fontWeight: 600, color: theme.palette.border?.success || "#12B76A", fontFamily: "var(--font-sans)", display: "flex", alignItems: "center", gap: 0.5 }}
                        >
                          {t("referralBenefitHint")}
                        </Typography>
                      </Box>
                    )}

                    <CustomButton
                      variant="primary"
                      pill
                      size="medium"
                      label={t("continue")}
                      onClick={() => handleContinue()}
                      disabled={loading || phoneTypeChecking}
                      fullWidth
                      sx={{ fontWeight: 700, fontSize: "15px" }}
                      endIcon={loading ? <LoadingSpinner size={18} /> : undefined}
                      hideLabelWhenLoading={true}
                      data-testid="register-continue-btn"
                    />

                    <Box sx={{ display: "flex", justifyContent: "center", mt: 1.75 }}>
                      <Typography
                        data-testid={method === "email" ? "switch-to-phone-signup" : "switch-to-email-signup"}
                        onClick={() => { setMethod(method === "email" ? "phone" : "email"); setEmailError(""); setPhoneError(""); }}
                        sx={{ fontSize: "13px", fontWeight: 500, color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", cursor: "pointer", "&:hover": { color: brandFg(theme.palette.mode === "dark") } }}
                      >
                        {method === "email"
                          ? t("useMobileNumberInstead", { defaultValue: "Use mobile number instead" })
                          : t("useEmailInstead", { defaultValue: "Use email instead" })}
                      </Typography>
                    </Box>

                    <Box sx={{ display: "flex", gap: "7px", justifyContent: "center", mt: 2 }}>
                      <Typography sx={{ fontSize: "13px", color: "text.secondary", fontFamily: "var(--font-sans)" }}>
                        {t("alreadyHaveAccountLink")}
                      </Typography>
                      <Typography
                        data-testid="go-to-login-link"
                        sx={{ fontSize: "13px", color: brandFg(theme.palette.mode === "dark"), fontWeight: 500, cursor: "pointer", textDecoration: "underline", fontFamily: "var(--font-sans)" }}
                        onClick={() => router.push("/auth/login")}
                      >
                        {t("login")}
                      </Typography>
                    </Box>
                  </>
                )}

                {/* ─── STEP 2: Verify ─── */}
                {step === "verify" && (
                  <>
                    <Box sx={{ textAlign: "center", mb: 2.5 }}>
                      <Box sx={{ width: 56, height: 56, borderRadius: "12px", background: `linear-gradient(135deg, ${BRAND_ACCENT}, #FFB300)`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                        {method === "email" ? <MailOutline sx={{ fontSize: 28, color: BRAND_ON_ACCENT }} /> : <SmartphoneOutlined sx={{ fontSize: 28, color: BRAND_ON_ACCENT }} />}
                      </Box>
                      <Typography sx={{ fontWeight: 700, fontSize: "22px", color: "text.primary", fontFamily: "var(--font-sans)" }} data-testid="register-otp-title">
                        {accountExists ? t("alreadyHaveAccountTitle", { defaultValue: "You already have an account" }) : method === "email" ? t("verifyYourEmail") : t("verifyYourPhone")}
                      </Typography>
                      <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "var(--font-sans)", mt: 0.5, lineHeight: 1.5 }}>
                        {t("enterSixDigitCodeSentTo")}{" "}
                        <Typography component="span" sx={{ fontWeight: 600, color: "text.primary", fontSize: "14px" }}>
                          {method === "email" ? email.replace(/(.{2}).*(@.*)/, "$1***$2") : phone.replace(/(\d{3})\d+(\d{2})/, "$1****$2")}
                        </Typography>
                      </Typography>
                      {accountExists && (
                        <Box
                          data-testid="account-exists-banner"
                          role="status"
                          sx={{
                            mt: 1.5, mx: "auto", maxWidth: "380px", px: 1.5, py: 1.25, borderRadius: "10px", display: "flex", gap: 1, alignItems: "flex-start", textAlign: "left",
                            background: theme.palette.mode === "dark" ? "rgba(245,158,11,0.14)" : "rgba(245,158,11,0.10)",
                            border: `1px solid ${theme.palette.mode === "dark" ? "rgba(245,158,11,0.45)" : "rgba(180,83,9,0.3)"}`,
                          }}
                        >
                          <InfoOutlined sx={{ fontSize: 18, mt: "1px", flexShrink: 0, color: theme.palette.mode === "dark" ? "#FBBF24" : "#B45309" }} />
                          <Typography sx={{ fontSize: "13px", color: "text.primary", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>
                            {method === "email" ? t("emailAlreadyHasAccount") : t("phoneAlreadyHasAccount")}
                          </Typography>
                        </Box>
                      )}
                    </Box>

                    <OtpInputPanel
                      contactType={method === "email" ? "email" : "phone"}
                      otpLength={6}
                      onVerify={handleVerifyOtp}
                      onResendCode={handleResendOtp}
                      onClearError={() => setOtpError("")}
                      countdown={countdown}
                      loading={loading}
                      error={otpError}
                      primaryButtonLabel={accountExists ? t("verifyAndLogin") : t("verify", { defaultValue: "Verify" })}
                      showInfoChip={false}
                      showLabel={false}
                      actionsLayout="stacked"
                      resetKey={otpResetKey}
                    />

                    <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
                      <Typography
                        component="button"
                        data-testid="register-change-contact"
                        onClick={() => { setStep("email"); setOtpError(""); setAccountExists(false); setSignupToken(""); setOtpResetKey((k) => k + 1); }}
                        sx={{ fontSize: "13px", color: "text.secondary", fontFamily: "var(--font-sans)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", padding: 0, "&:hover": { textDecoration: "underline" } }}
                      >
                        <ArrowBack sx={{ fontSize: "16px" }} />
                        {method === "email" ? t("changeEmail") : t("changePhone")}
                      </Typography>
                    </Box>
                  </>
                )}

                {/* ─── STEP 3: Set up account ─── */}
                {step === "setup" && (
                  <>
                    <TitleDescription
                      title={t("setupAccountTitle", { defaultValue: "Set up your account" })}
                      description={t("setupAccountDescription", { defaultValue: "Add your name and a password to finish." })}
                      descriptionFontSize="14px"
                      descriptionColor={theme.palette.text.secondary}
                    />

                    <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1.75 }}>
                      <FieldRow>
                        <InputField
                          data-testid="register-first-name-input"
                          type="text"
                          required
                          accentFocus
                          value={firstName}
                          onChange={(e) => { setFirstName(e.target.value); if (setupError) setSetupError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleComplete(); }}
                          label={t("nameFirstLabel", { defaultValue: "First name" })}
                          placeholder={t("nameFirstLabel", { defaultValue: "First name" })}
                        />
                        <InputField
                          data-testid="register-last-name-input"
                          type="text"
                          required
                          accentFocus
                          value={lastName}
                          onChange={(e) => { setLastName(e.target.value); if (setupError) setSetupError(""); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleComplete(); }}
                          label={t("nameLastLabel", { defaultValue: "Last name" })}
                          placeholder={t("nameLastLabel", { defaultValue: "Last name" })}
                        />
                      </FieldRow>

                      <Box ref={pwFieldRef} sx={{ position: "relative", width: "100%" }}>
                        <InputField
                          data-testid="register-password-input"
                          type={showPassword ? "text" : "password"}
                          required
                          accentFocus
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\s/g, "");
                            setPassword(val);
                            if (setupError) setSetupError("");
                            setShowPwRules(!PASSWORD_RE.test(val));
                          }}
                          onFocus={() => { if (!PASSWORD_RE.test(password)) setShowPwRules(true); }}
                          onBlur={() => { setTimeout(() => setShowPwRules(false), 200); }}
                          onKeyDown={(e) => { if (e.key === "Enter") handleComplete(); }}
                          label={t("password")}
                          placeholder={t("passwordPlaceHolder", { defaultValue: "Create a password" })}
                          sideButton={true}
                          sideButtonType="primary"
                          sideButtonIcon={showPassword ? <VisibilityOffIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} />}
                          sideButtonIconWidth="18px"
                          sideButtonIconHeight="18px"
                          onSideButtonClick={() => setShowPassword(!showPassword)}
                          showPasswordToggle={true}
                        />
                        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", position: "absolute", zIndex: 5 }}>
                          <PasswordValidation
                            password={password}
                            anchorEl={pwFieldRef.current}
                            open={showPwRules}
                            onClose={() => setShowPwRules(false)}
                            showOnMobile={showPwRules}
                          />
                        </Box>
                      </Box>

                      {setupError && (
                        <Typography data-testid="register-setup-error" sx={{ fontSize: "13px", color: "error.main", fontFamily: "var(--font-sans)" }}>
                          {setupError}
                        </Typography>
                      )}

                      <CustomButton
                        variant="primary"
                        pill
                        size="medium"
                        label={t("createAccount", { defaultValue: "Create account" })}
                        onClick={handleComplete}
                        disabled={loading}
                        fullWidth
                        sx={{ fontWeight: 700, fontSize: "15px" }}
                        endIcon={loading ? <LoadingSpinner size={18} /> : undefined}
                        hideLabelWhenLoading={true}
                        data-testid="register-complete-btn"
                      />
                    </Box>
                  </>
                )}

                {/* ─── STEP 4: Success ─── */}
                {step === "success" && (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Box sx={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #10B981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", boxShadow: "0 8px 32px rgba(16, 185, 129, 0.3)" }}>
                      <CheckCircleOutline sx={{ fontSize: 40, color: "#fff" }} />
                    </Box>
                    <Box
                      data-testid="verified-confirmation-chip"
                      sx={{
                        display: "inline-flex", alignItems: "center", gap: "6px", px: 1.5, py: 0.75, mb: 1.5, borderRadius: "999px",
                        backgroundColor: theme.palette.mode === "dark" ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)",
                        border: `1px solid ${theme.palette.mode === "dark" ? "rgba(16,185,129,0.45)" : "rgba(16,185,129,0.35)"}`,
                      }}
                    >
                      <CheckCircleOutline sx={{ fontSize: 16, color: "#10B981" }} />
                      <Typography sx={{ fontSize: "13px", color: theme.palette.mode === "dark" ? "#6EE7B7" : "#047857", fontFamily: "var(--font-sans)", fontWeight: 600, lineHeight: 1 }}>
                        {method === "email" ? t("emailVerified") : t("phoneVerified")}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: "24px", color: "text.primary", fontFamily: "var(--font-sans)", mb: 1 }}>
                      {accountExists ? t("welcomeBackToDynopay") : t("accountReadyTitle")}
                    </Typography>
                    <Typography sx={{ fontSize: "15px", color: "text.secondary", fontFamily: "var(--font-sans)", lineHeight: 1.6, mb: 1 }}>
                      {t("redirectingToDashboard")}
                    </Typography>
                    <LoadingSpinner size={24} />
                  </Box>
                )}
              </Box>
            </FormPanel>
            <Box sx={{ display: { xs: "block", lg: "none" }, width: "100%" }}>
              <TrustStrip />
            </Box>
          </SplitFormColumn>
          <AuthBrandPanel />
        </SplitScreenWrapper>
      </AuthPageBackground>
    </>
  );
};

export default Register;
