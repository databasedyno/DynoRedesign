import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import TrustStrip from "@/Components/UI/AuthLayout/TrustStrip";
import PurposePicker from "@/Components/UI/AuthLayout/PurposePicker";
import type { Vertical } from "@/Components/UI/_shared";
import CustomButton from "@/Components/UI/Buttons";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import AuthBrandPanel from "@/Components/UI/AuthLayout/AuthBrandPanel";
import { AuthPageBackground, SplitLayoutWrapper, FormPanel } from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import SocialAuthButtons from "@/Components/Common/SocialAuthButtons";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import { signIn } from "next-auth/react";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_LOGIN } from "@/Redux/Actions/UserAction";
import axiosBaseApi from "@/axiosConfig";
import confetti from "canvas-confetti";
import Image from "next/image";
import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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
type Step = "purpose" | "input" | "otp" | "success";

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
  const [step, setStep] = useState<Step>("purpose");
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
  // Handle the visitor claimed on the landing hero ("dynopay.me/@<handle>"),
  // carried here via ?handle= (with a localStorage fallback) so we can show it
  // is being reserved while they finish signing up.
  const [claimedHandle, setClaimedHandle] = useState("");
  // Purpose vertical — captured from the new PurposePicker step OR
  // auto-detected from SEO attribution / URL query / prior localStorage pick.
  // Feeds the useVerticalAccent() override so post-signup UI is tinted for
  // the user's stated intent (creators → volt, fundraisers → violet, etc.).
  // Persisted client-side only in Phase 2; backend column lands in Phase 3.
  const [vertical, setVertical] = useState<Vertical | null>(null);

  // Fire a small confetti burst the moment the user lands on step="success" —
  // only for NEW account creation (not for existing-account log-in), and only once.
  // Emergent-style delight moment: light celebration → user proceeds to onboarding.
  const confettiFiredRef = useRef(false);
  useEffect(() => {
    if (step !== "success") {
      confettiFiredRef.current = false;
      return;
    }
    if (confettiFiredRef.current) return;
    if (accountExists) return; // no need to celebrate a re-login
    confettiFiredRef.current = true;
    // Small, tasteful burst — 2 sides, brand colors, 90ms total.
    try {
      confetti({
        particleCount: 60,
        spread: 60,
        startVelocity: 35,
        origin: { x: 0.3, y: 0.5 },
        colors: ["#CCFF00", "#B4E600", "#10B981", "#F59E0B"],
        scalar: 0.9,
        ticks: 200,
      });
      confetti({
        particleCount: 60,
        spread: 60,
        startVelocity: 35,
        origin: { x: 0.7, y: 0.5 },
        colors: ["#CCFF00", "#B4E600", "#10B981", "#F59E0B"],
        scalar: 0.9,
        ticks: 200,
      });
    } catch {
      /* canvas-confetti is client-only and safe to ignore on unusual envs */
    }
  }, [step, accountExists]);

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

  // ─── Claimed-handle capture (from the landing hero) ───────────────
  // The landing hero sends ?handle=<h> and stores it in localStorage. Capture it
  // so we can (a) reassure the visitor their page is reserved and (b) let the
  // /creator claim step pre-fill it after signup.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const fromQuery =
        typeof router.query.handle === "string" ? router.query.handle : "";
      const raw = fromQuery || localStorage.getItem("dynopay.claimedHandle") || "";
      const clean = raw.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 30);
      if (clean.length >= 3) {
        setClaimedHandle(clean);
        localStorage.setItem("dynopay.claimedHandle", clean);
        // Renew the server-side reservation so the handle stays HARD-held while
        // the visitor finishes signing up (TTL refreshed on each renew).
        const token = localStorage.getItem("dynopay.claimedHandleToken") || undefined;
        fetch("/api/user/creator/reserve-handle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: clean, token }),
        })
          .then((r) => r.json())
          .then((j) => {
            const d = j?.data ?? j;
            if (d?.token) {
              try {
                localStorage.setItem("dynopay.claimedHandleToken", d.token);
              } catch {
                /* ignore */
              }
            }
          })
          .catch(() => {
            /* renewal is best-effort */
          });
      }
    } catch {
      /* never break signup over a nice-to-have banner */
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
  // Uses client-side Google Identity Services (same flow as login page) so it
  // works behind the K8s ingress; falls back to NextAuth if GIS isn't loaded.
  const handleGoogleLogin = useCallback(async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      signIn("google", { callbackUrl: "/dashboard" });
      return;
    }
    try {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
        const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: "openid email profile",
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              try {
                const res = await axiosBaseApi.post("user/google-signin", {
                  accessToken: tokenResponse.access_token,
                });
                const { data, message } = res?.data || {};
                if (data?.userData && data?.accessToken) {
                  dispatch({ type: TOAST_SHOW, payload: { message: message || "Login successful" } });
                  dispatch({
                    type: USER_LOGIN,
                    payload: { ...data.userData, accessToken: data.accessToken, refreshToken: data.refreshToken },
                  });
                } else {
                  throw new Error("Invalid response");
                }
              } catch (e: any) {
                const msg = e.response?.data?.message ?? e.message ?? "Google sign-up failed";
                dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
              }
            }
          },
        });
        tokenClient.requestAccessToken();
      } else {
        signIn("google", { callbackUrl: "/dashboard" });
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      signIn("google", { callbackUrl: "/dashboard" });
    }
  }, [dispatch]);

  // ─── GitHub Sign Up — OAuth authorization-code redirect flow ───
  const handleGithubLogin = useCallback(() => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId || typeof window === "undefined") return;
    const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem("gh_oauth_state", state);
    } catch {
      /* ignore */
    }
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
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
          purpose_vertical: vertical || undefined,
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
          purpose_vertical: vertical || undefined,
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
  }, [method, email, phone, referralCode, checkPhoneType, getSeoAttribution, vertical]);

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
        <title>Create your free account · Dynopay</title>
      </Head>
      <AuthPageBackground>
        <SplitLayoutWrapper>
          {/* Form Panel (centered — brand panel dropped in 2025-07 pass) */}
          <FormPanel>
            <Box
              sx={{
                maxWidth: "420px",
                width: "100%",
                py: isMobile ? 2 : 0,
              }}
            >
              {/* Top row: logo + controls, on every breakpoint */}
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  mb: 3,
                }}
              >
                <Image
                  src={theme.palette.mode === "dark" ? WhiteLogo : Logo}
                  alt="logo"
                  width={130}
                  height={44}
                  draggable={false}
                  onClick={() => router.push("/")}
                  style={{ cursor: "pointer" }}
                />
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <ThemeToggle size="small" />
                </Box>
              </Box>

              {/* ─── STEP 0: Purpose ─── */}
              {step === "purpose" && (
                <>
                  <TitleDescription
                    title={t("register", { defaultValue: "Create your account" })}
                    description={t("registerPurposeDescription", {
                      defaultValue: "Tell us why you're here so we set the app up for you.",
                    })}
                    descriptionFontSize="14px"
                    descriptionColor={theme.palette.text.secondary}
                  />
                  <Box sx={{ mt: 2.5 }}>
                    <PurposePicker
                      routerQuery={router.query as Record<string, unknown>}
                      onDetected={(v) => {
                        setVertical(v);
                        setStep("input");
                      }}
                      onSelect={(v) => {
                        setVertical(v);
                        setStep("input");
                      }}
                    />
                    <Typography
                      onClick={() => setStep("input")}
                      data-testid="purpose-skip"
                      sx={{
                        display: "block",
                        mt: 1.5,
                        textAlign: "center",
                        cursor: "pointer",
                        fontFamily: "var(--font-body)",
                        fontSize: 13,
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                        textDecoration: "underline",
                        textUnderlineOffset: 3,
                        "&:hover": { color: theme.palette.text.primary },
                      }}
                    >
                      {t("purposeSkip", { defaultValue: "Skip — I'll pick later" })}
                    </Typography>
                  </Box>
                </>
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

                  {claimedHandle && (
                    <Box
                      data-testid="reserved-handle-banner"
                      sx={{
                        mt: 1.5,
                        px: 1.75,
                        py: 1.25,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        borderRadius: "12px",
                        border: `1px solid ${
                          theme.palette.mode === "dark"
                            ? "rgba(79,70,229,0.4)"
                            : "rgba(79,70,229,0.25)"
                        }`,
                        background:
                          theme.palette.mode === "dark"
                            ? "rgba(79,70,229,0.14)"
                            : "rgba(79,70,229,0.06)",
                      }}
                    >
                      <CheckCircleOutline
                        sx={{ fontSize: 20, color: "#4F46E5", flexShrink: 0 }}
                      />
                      <Typography
                        component="div"
                        sx={{
                          fontSize: "13px",
                          lineHeight: 1.35,
                          color: theme.palette.text.primary,
                        }}
                      >
                        {t("reservedHandlePrefix", {
                          defaultValue: "You're reserving",
                        })}{" "}
                        <b style={{ fontWeight: 700 }}>
                          dynopay.me/@{claimedHandle}
                        </b>{" "}
                        —{" "}
                        {t("reservedHandleSuffix", {
                          defaultValue: "finish signing up to claim it.",
                        })}
                      </Typography>
                    </Box>
                  )}

                  {/* Social Sign Up — hidden when both social flags are off */}
                  {(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" ||
                    process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true") && (
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
                              fontFamily: "var(--font-sans)",
                              textTransform: "lowercase",
                              px: 1,
                            }}
                          >
                            {t("orSignUpWith")}
                          </Typography>
                        </Divider>
                      </Box>
                    </>
                  )}

                  {/* Method Toggle was a big segmented pill — replaced in
                      the 2025-07 Coinbase-clean pass with a subtle text
                      link below the input (see "Use mobile number instead"
                      further down). Default lands on email; one click
                      switches to phone. */}

                  {/* Input Field */}
                  {method === "email" ? (
                    <Box sx={{ mb: 1 }}>
                      <InputField
                        type="email"
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

                  {/* Referral Code */}
                  {!showReferralInput ? (
                    <Typography
                      sx={{
                        fontSize: "13px",
                        color: theme.palette.primary.main,
                        fontFamily: "var(--font-sans)",
                        cursor: "pointer",
                        textDecoration: "underline",
                        textUnderlineOffset: "2px",
                        mb: 1.5,
                      }}
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
                    </Box>
                  )}

                  {/* Continue Button */}
                  <CustomButton
                    variant="primary"
                    size="medium"
                    label={t("continue")}
                    onClick={handleContinue}
                    disabled={loading || phoneTypeChecking}
                    fullWidth
                    sx={{ fontWeight: 700, padding: "13px 24px", borderRadius: "12px", fontSize: "15px" }}
                    endIcon={loading ? <LoadingSpinner size={18} /> : undefined}
                    hideLabelWhenLoading={true}
                  />

                  {/* Subtle method switch — mirrors login.tsx pattern. */}
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "center",
                      mt: 1.75,
                    }}
                  >
                    <Typography
                      data-testid={method === "email" ? "switch-to-phone-signup" : "switch-to-email-signup"}
                      onClick={() => {
                        setMethod(method === "email" ? "phone" : "email");
                        setEmailError("");
                        setPhoneError("");
                      }}
                      sx={{
                        fontSize: "13px",
                        fontWeight: 500,
                        color: theme.palette.text.secondary,
                        fontFamily: "var(--font-sans)",
                        cursor: "pointer",
                        "&:hover": { color: theme.palette.primary.main },
                      }}
                    >
                      {method === "email"
                        ? t("useMobileNumberInstead", { defaultValue: "Use mobile number instead" })
                        : t("useEmailInstead", { defaultValue: "Use email instead" })}
                    </Typography>
                  </Box>

                  {/* Already have account */}
                  <Box sx={{ display: "flex", gap: "7px", justifyContent: "center", mt: 2 }}>
                    <Typography sx={{ fontSize: "13px", color: "text.secondary", fontFamily: "var(--font-sans)" }}>
                      {t("alreadyHaveAccountLink")}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "13px", color: theme.palette.primary.main, fontWeight: 500,
                        cursor: "pointer", textDecoration: "underline", fontFamily: "var(--font-sans)",
                      }}
                      onClick={() => router.push("/auth/login")}
                    >
                      {t("login")}
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
                    <Typography sx={{ fontWeight: 700, fontSize: "22px", color: "text.primary", fontFamily: "var(--font-sans)" }}>
                      {accountExists ? t("welcomeBack") : method === "email" ? t("verifyYourEmail") : t("verifyYourPhone")}
                    </Typography>
                    <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "var(--font-sans)", mt: 0.5, lineHeight: 1.5 }}>
                      {t("enterSixDigitCodeSentTo")}{" "}
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
                        <Typography sx={{ fontSize: "13px", color: "text.primary", fontFamily: "var(--font-sans)", lineHeight: 1.5 }}>
                          {method === "email" ? t("emailAlreadyHasAccount") : t("phoneAlreadyHasAccount")}
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
                    primaryButtonLabel={accountExists ? t("verifyAndLogin") : t("verifyAndCreateAccount")}
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
                        fontSize: "13px", color: "text.secondary", fontFamily: "var(--font-sans)",
                        textDecoration: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                        background: "transparent", border: "none", padding: 0,
                        "&:hover": { textDecoration: "underline" },
                      }}
                    >
                      <ArrowBack sx={{ fontSize: "16px" }} />
                      {method === "email" ? t("changeEmail") : t("changePhone")}
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

                  {/* Explicit "Email/Phone verified" confirmation chip — Emergent-style */}
                  <Box
                    data-testid="verified-confirmation-chip"
                    sx={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      px: 1.5,
                      py: 0.75,
                      mb: 1.5,
                      borderRadius: "999px",
                      backgroundColor:
                        theme.palette.mode === "dark"
                          ? "rgba(16,185,129,0.16)"
                          : "rgba(16,185,129,0.10)",
                      border: `1px solid ${
                        theme.palette.mode === "dark"
                          ? "rgba(16,185,129,0.45)"
                          : "rgba(16,185,129,0.35)"
                      }`,
                    }}
                  >
                    <CheckCircleOutline sx={{ fontSize: 16, color: "#10B981" }} />
                    <Typography
                      sx={{
                        fontSize: "13px",
                        color: theme.palette.mode === "dark" ? "#6EE7B7" : "#047857",
                        fontFamily: "var(--font-sans)",
                        fontWeight: 600,
                        lineHeight: 1,
                      }}
                    >
                      {method === "email" ? t("emailVerified") : t("phoneVerified")}
                    </Typography>
                  </Box>

                  <Typography sx={{ fontWeight: 700, fontSize: "24px", color: "text.primary", fontFamily: "var(--font-sans)", mb: 1 }}>
                    {accountExists ? t("welcomeBackToDynopay") : t("accountReadyTitle")}
                  </Typography>
                  <Typography sx={{ fontSize: "15px", color: "text.secondary", fontFamily: "var(--font-sans)", lineHeight: 1.6, mb: 1 }}>
                    {accountExists
                      ? t("redirectingToDashboard")
                      : t("accountReadyDesc")}
                  </Typography>
                  <LoadingSpinner size={24} />
                </Box>
              )}
            </Box>
          </FormPanel>
          {/* Slim social-proof strip below the card (Coinbase-clean substitute
              for the removed side marketing panel). */}
          <TrustStrip />
        </SplitLayoutWrapper>
      </AuthPageBackground>
    </>
  );
};

export default Register;
