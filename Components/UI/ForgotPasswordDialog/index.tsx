import CloseIcon from "@/assets/Icons/close-icon.svg";
import LockIcon from "@/assets/Icons/lock-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import PopupModal from "@/Components/UI/PopupModal";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import useIsMobile from "@/hooks/useIsMobile";
import { ArrowBack, CheckCircleOutline } from "@mui/icons-material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Box, Link, Typography, useTheme, ToggleButtonGroup, ToggleButton } from "@mui/material";
import Image from "next/image";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";

const LoadingIcon = ({ size = 20 }: { size?: number }) => (
  <Box
    sx={{
      width: size,
      height: size,
      border: "2px solid rgba(255,255,255,0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.8s linear infinite",
      "@keyframes spin": { "0%": { transform: "rotate(0deg)" }, "100%": { transform: "rotate(360deg)" } },
    }}
  />
);

export interface ForgotPasswordDialogProps {
  open: boolean;
  onClose: () => void;
  currentEmail?: string;
}

type ResetMethod = "email" | "phone";
type Step = "method" | "otp" | "newPassword" | "success";

const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=_+{}\[\]:;<>,.?/~]).{8,20}$/;

const ForgotPasswordDialog: React.FC<ForgotPasswordDialogProps> = ({
  open,
  onClose,
  currentEmail,
}) => {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");

  // State
  const [step, setStep] = useState<Step>("method");
  const [method, setMethod] = useState<ResetMethod>("email");
  const [email, setEmail] = useState(currentEmail || "");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [resetToken, setResetToken] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(0);
  // Bumped each time a new OTP is sent — tells <OtpInputPanel/> to clear its
  // boxes and re-focus the first input.
  const [otpResetKey, setOtpResetKey] = useState(0);

  const passwordFieldRef = useRef<HTMLDivElement | null>(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("method");
        setMethod("email");
        setEmail(currentEmail || "");
        setPhone("");
        setNewPassword("");
        setConfirmPassword("");
        setShowNewPassword(false);
        setShowConfirmPassword(false);
        setShowPasswordValidation(false);
        setResetToken("");
        setLoading(false);
        setError("");
        setCountdown(0);
        setOtpResetKey((k) => k + 1);
      }, 300);
    }
  }, [open, currentEmail]);

  // Countdown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleClose = () => {
    onClose();
  };

  // ─── Step 1: Send OTP ───
  const handleSendOtp = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      if (method === "email") {
        if (!email || !email.includes("@")) {
          setError(t("forgotPasswordDialog.errEmailInvalid"));
          setLoading(false);
          return;
        }
        await axiosBaseApi.post("/user/forgot-password", { email: email.toLowerCase() });
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        if (digits.length < 10) {
          setError(t("forgotPasswordDialog.errPhoneInvalid"));
          setLoading(false);
          return;
        }
        await axiosBaseApi.post("/user/forgot-password-phone", { mobile: digits });
      }

      setStep("otp");
      setOtpResetKey((k) => k + 1);
      setCountdown(60);
    } catch (err: any) {
      const msg = err?.response?.data?.message || t("forgotPasswordDialog.errSendFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [method, email, phone]);

  // ─── Step 2: Verify OTP ───
  const handleVerifyOtp = useCallback(async (otpCode: string) => {
    if (otpCode.length !== 6) {
      setError(t("forgotPasswordDialog.errOtpIncomplete"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      let response;
      if (method === "email") {
        response = await axiosBaseApi.post("/user/forgot-password/verify-otp", {
          email: email.toLowerCase(),
          otp: otpCode,
        });
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        response = await axiosBaseApi.post("/user/forgot-password-phone/verify-otp", {
          mobile: digits,
          otp: otpCode,
        });
      }

      const token = response?.data?.data?.resetToken;
      if (token) {
        setResetToken(token);
        setStep("newPassword");
      } else {
        setError(t("forgotPasswordDialog.errVerifyFailed"));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || t("forgotPasswordDialog.errOtpInvalid");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [method, email, phone]);

  // ─── Step 3: Reset Password ───
  const handleResetPassword = useCallback(async () => {
    if (!passwordRegex.test(newPassword)) {
      setError(t("forgotPasswordDialog.errPwReq"));
      setShowPasswordValidation(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("forgotPasswordDialog.errPwMismatch"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      await axiosBaseApi.post("/user/reset-password", {
        token: resetToken,
        newPassword,
      });
      setStep("success");
    } catch (err: any) {
      const msg = err?.response?.data?.message || t("forgotPasswordDialog.errResetFailed");
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [newPassword, confirmPassword, resetToken]);

  // ─── Resend OTP ───
  const handleResendOtp = useCallback(async () => {
    if (countdown > 0) return;
    setError("");
    setLoading(true);

    try {
      if (method === "email") {
        await axiosBaseApi.post("/user/forgot-password", { email: email.toLowerCase() });
      } else {
        const digits = phone.replace(/[^\d]/g, "");
        await axiosBaseApi.post("/user/forgot-password-phone", { mobile: digits });
      }
      setCountdown(60);
      setOtpResetKey((k) => k + 1);
    } catch (err: any) {
      setError(t("forgotPasswordDialog.errResendFailed"));
    } finally {
      setLoading(false);
    }
  }, [countdown, method, email, phone]);

  // ─── Shared Modal Wrapper ───
  const modalSx = {
    "& .MuiDialog-paper": {
      borderRadius: "16px",
      maxWidth: "480px",
      width: "100%",
      background: theme.palette.mode === "dark" ? "#0B0D17" : "#fff",
      boxShadow: theme.palette.mode === "dark"
        ? "0 24px 80px rgba(0,0,0,0.5)"
        : "0 24px 80px rgba(47,47,101,0.12)",
    },
    [theme.breakpoints.down("sm")]: {
      "& .MuiDialog-paper": {
        margin: "16px",
        maxWidth: "calc(100vw - 32px)",
      },
    },
  };

  const panelSx = {
    backgroundColor: theme.palette.background.paper,
    borderRadius: "16px",
    padding: isMobile ? "24px 20px" : "32px 28px",
    boxShadow: "none",
    outline: "none",
  };

  const closeBtn = (
    <Box
      onClick={handleClose}
      sx={{
        position: "absolute",
        top: isMobile ? "-10px" : "-16px",
        right: isMobile ? "-10px" : "-16px",
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: theme.palette.mode === "dark" ? "#1f2237" : "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        transition: "all 0.2s",
        "&:hover": { background: theme.palette.mode === "dark" ? "#2a2d45" : "#e5e7eb" },
      }}
    >
      <Image src={CloseIcon.src} alt="close" width={12} height={12} draggable={false} className="themed-icon" />
    </Box>
  );

  // ════════════════════════════════════════════
  // STEP 1: Choose Method + Enter Email/Phone
  // ════════════════════════════════════════════
  if (step === "method") {
    return (
      <PopupModal open={open} handleClose={handleClose} showHeader={false} transparent sx={modalSx}>
        <PanelCard
          title=""
          showHeaderBorder={false}
          bodyPadding="0"
          headerPadding="0 !important"
          headerAction={closeBtn}
          sx={panelSx}
          bodySx={{ padding: "0" }}
        >
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
            <Box
              sx={{
                width: 40, height: 40, borderRadius: "12px",
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Image src={LockIcon.src} alt="lock" width={20} height={20} draggable={false} style={{ filter: "brightness(10)" }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "20px", color: "text.primary", fontFamily: "UrbanistBold", lineHeight: 1.2 }}>
                {t("forgotPasswordDialog.title")}
              </Typography>
              <Typography sx={{ fontSize: "13px", color: "text.secondary", fontFamily: "UrbanistMedium", mt: 0.25 }}>
                {t("forgotPasswordDialog.methodSubtitle")}
              </Typography>
            </Box>
          </Box>

          {/* Method Toggle */}
          <Box sx={{ mt: 2.5, mb: 2 }}>
            <ToggleButtonGroup
              value={method}
              exclusive
              onChange={(_, val) => { if (val) { setMethod(val); setError(""); } }}
              sx={{
                width: "100%",
                background: theme.palette.mode === "dark" ? "#1a1d2e" : "#f3f4f6",
                borderRadius: "12px",
                padding: "4px",
                "& .MuiToggleButton-root": {
                  flex: 1,
                  border: "none",
                  borderRadius: "10px !important",
                  textTransform: "none",
                  fontFamily: "UrbanistSemiBold",
                  fontSize: "14px",
                  color: "text.secondary",
                  padding: "10px 0",
                  transition: "all 0.25s",
                  "&.Mui-selected": {
                    background: theme.palette.mode === "dark" ? "#2a2d45" : "#fff",
                    color: "text.primary",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    "&:hover": { background: theme.palette.mode === "dark" ? "#2a2d45" : "#fff" },
                  },
                  "&:hover": { background: "transparent" },
                },
              }}
            >
              <ToggleButton value="email">{t("forgotPasswordDialog.emailTab")}</ToggleButton>
              <ToggleButton value="phone">{t("forgotPasswordDialog.phoneTab")}</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Input */}
          {method === "email" ? (
            <Box sx={{ mb: 2 }}>
              <InputField
                label={t("forgotPasswordDialog.emailLabel")}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSendOtp(); }}
                placeholder={t("forgotPasswordDialog.emailPlaceholder")}
                error={!!error}
                helperText=""
              />
            </Box>
          ) : (
            <Box sx={{ mb: 2 }}>
              <CountryPhoneInput
                value={phone}
                onChange={(value) => { setPhone(value); setError(""); }}
                label={t("forgotPasswordDialog.phoneLabel")}
                error={!!error}
                helperText=""
                placeholder={t("forgotPasswordDialog.phonePlaceholder")}
              />
            </Box>
          )}

          {/* Error */}
          {error && (
            <Typography sx={{ fontSize: "13px", color: theme.palette.error.main, fontFamily: "UrbanistMedium", mb: 1.5, textAlign: "center" }}>
              {error}
            </Typography>
          )}

          {/* Send Code Button */}
          <CustomButton
            variant="primary"
            size="medium"
            label={t("forgotPasswordDialog.sendCode")}
            onClick={handleSendOtp}
            disabled={loading}
            fullWidth
            sx={{ fontWeight: 700, padding: "14px 24px", borderRadius: "12px", fontSize: "15px" }}
            endIcon={loading ? <LoadingIcon size={18} /> : undefined}
            hideLabelWhenLoading={true}
          />

          {/* Back to login */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
            <Link
              component="button"
              onClick={handleClose}
              sx={{
                fontSize: "13px", color: "text.secondary", fontFamily: "UrbanistMedium",
                textDecoration: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                background: "transparent", border: "none", padding: 0,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              <ArrowBack sx={{ fontSize: "16px" }} />
              {t("forgotPasswordDialog.backToLogin")}
            </Link>
          </Box>
        </PanelCard>
      </PopupModal>
    );
  }

  // ════════════════════════════════════════════
  // STEP 2: Enter OTP
  // ════════════════════════════════════════════
  if (step === "otp") {
    const maskedTarget = method === "email"
      ? email.replace(/(.{2}).*(@.*)/, "$1***$2")
      : phone.replace(/(\d{3})\d+(\d{2})/, "$1****$2");

    return (
      <PopupModal open={open} handleClose={handleClose} showHeader={false} transparent sx={modalSx}>
        <PanelCard
          title=""
          showHeaderBorder={false}
          bodyPadding="0"
          headerPadding="0 !important"
          headerAction={closeBtn}
          sx={panelSx}
          bodySx={{ padding: "0" }}
        >
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 2.5 }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: "16px",
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <Typography sx={{ fontSize: "28px" }}>🔐</Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "20px", color: "text.primary", fontFamily: "UrbanistBold" }}>
              {t("forgotPasswordDialog.otpTitle")}
            </Typography>
            <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "UrbanistMedium", mt: 0.5, lineHeight: 1.5 }}>
              {t("forgotPasswordDialog.otpSubtitlePrefix")}{" "}
              <Typography component="span" sx={{ fontWeight: 600, color: "text.primary", fontSize: "14px" }}>
                {maskedTarget}
              </Typography>
            </Typography>
          </Box>

          {/* Shared OTP block — auto-submits the moment 6 digits are entered */}
          <OtpInputPanel
            contactType={method === "email" ? "email" : "phone"}
            otpLength={6}
            onVerify={handleVerifyOtp}
            onResendCode={handleResendOtp}
            onClearError={() => setError("")}
            countdown={countdown}
            loading={loading}
            error={error}
            primaryButtonLabel={t("forgotPasswordDialog.verifyBtn")}
            showInfoChip={false}
            showLabel={false}
            actionsLayout="stacked"
            resetKey={otpResetKey}
          />

          {/* Back */}
          <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
            <Link
              component="button"
              onClick={() => { setStep("method"); setError(""); setOtpResetKey((k) => k + 1); }}
              sx={{
                fontSize: "13px", color: "text.secondary", fontFamily: "UrbanistMedium",
                textDecoration: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px",
                background: "transparent", border: "none", padding: 0,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              <ArrowBack sx={{ fontSize: "16px" }} />
              {method === "email" ? t("forgotPasswordDialog.changeEmail") : t("forgotPasswordDialog.changePhone")}
            </Link>
          </Box>
        </PanelCard>
      </PopupModal>
    );
  }

  // ════════════════════════════════════════════
  // STEP 3: New Password
  // ════════════════════════════════════════════
  if (step === "newPassword") {
    return (
      <PopupModal open={open} handleClose={handleClose} showHeader={false} transparent sx={modalSx}>
        <PanelCard
          title=""
          showHeaderBorder={false}
          bodyPadding="0"
          headerPadding="0 !important"
          headerAction={closeBtn}
          sx={panelSx}
          bodySx={{ padding: "0" }}
        >
          {/* Header */}
          <Box sx={{ textAlign: "center", mb: 2.5 }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: "16px",
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
              }}
            >
              <Image src={LockIcon.src} alt="lock" width={24} height={24} draggable={false} style={{ filter: "brightness(10)" }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: "20px", color: "text.primary", fontFamily: "UrbanistBold" }}>
              {t("forgotPasswordDialog.newPwTitle")}
            </Typography>
            <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "UrbanistMedium", mt: 0.5 }}>
              {t("forgotPasswordDialog.newPwSubtitle")}
            </Typography>
          </Box>

          {/* New Password */}
          <Box ref={passwordFieldRef} sx={{ position: "relative", width: "100%", mb: 1.5 }}>
            <InputField
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              autoComplete="new-password"
              label={t("forgotPasswordDialog.newPwLabel")}
              onChange={(e) => {
                const val = e.target.value.replace(/\s/g, "");
                setNewPassword(val);
                setError("");
                if (!val) setShowPasswordValidation(false);
                else if (passwordRegex.test(val)) setShowPasswordValidation(false);
                else setShowPasswordValidation(true);
              }}
              onFocus={() => {
                if (newPassword && !passwordRegex.test(newPassword)) setShowPasswordValidation(true);
              }}
              onBlur={() => { setTimeout(() => setShowPasswordValidation(false), 200); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
              placeholder={t("forgotPasswordDialog.newPwPlaceholder")}
              error={!!error && error.includes("requirements")}
              sideButton={true}
              sideButtonType="primary"
              sideButtonIcon={showNewPassword ? <VisibilityOffIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} />}
              sideButtonIconWidth="18px"
              sideButtonIconHeight="18px"
              onSideButtonClick={() => setShowNewPassword(!showNewPassword)}
              showPasswordToggle={true}
            />
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", position: "absolute", zIndex: 5 }}>
              <PasswordValidation
                password={newPassword}
                anchorEl={passwordFieldRef.current}
                open={showPasswordValidation}
                onClose={() => setShowPasswordValidation(false)}
                showOnMobile={showPasswordValidation}
              />
            </Box>
          </Box>

          {/* Confirm Password */}
          <Box sx={{ mb: 2 }}>
            <InputField
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              autoComplete="new-password"
              label={t("forgotPasswordDialog.confirmPwLabel")}
              onChange={(e) => { setConfirmPassword(e.target.value.replace(/\s/g, "")); setError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleResetPassword(); }}
              placeholder={t("forgotPasswordDialog.confirmPwPlaceholder")}
              error={(!!confirmPassword && newPassword !== confirmPassword) || (!!error && error.includes("match"))}
              helperText={confirmPassword && newPassword !== confirmPassword ? t("forgotPasswordDialog.errPwMismatch") : ""}
              sideButton={true}
              sideButtonType="primary"
              sideButtonIcon={showConfirmPassword ? <VisibilityOffIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} /> : <VisibilityIcon sx={{ color: "text.secondary", height: "18px", width: "16px" }} />}
              sideButtonIconWidth="18px"
              sideButtonIconHeight="18px"
              onSideButtonClick={() => setShowConfirmPassword(!showConfirmPassword)}
              showPasswordToggle={true}
            />
          </Box>

          {/* Error */}
          {error && !error.includes("match") && !error.includes("requirements") && (
            <Typography sx={{ fontSize: "13px", color: theme.palette.error.main, fontFamily: "UrbanistMedium", mb: 1.5, textAlign: "center" }}>
              {error}
            </Typography>
          )}

          {/* Reset Button */}
          <CustomButton
            variant="primary"
            size="medium"
            label={t("forgotPasswordDialog.resetBtn")}
            onClick={handleResetPassword}
            disabled={loading || !newPassword || !confirmPassword}
            fullWidth
            sx={{ fontWeight: 700, padding: "14px 24px", borderRadius: "12px", fontSize: "15px" }}
            endIcon={loading ? <LoadingIcon size={18} /> : undefined}
            hideLabelWhenLoading={true}
          />
        </PanelCard>
      </PopupModal>
    );
  }

  // ════════════════════════════════════════════
  // STEP 4: Success
  // ════════════════════════════════════════════
  return (
    <PopupModal open={open} handleClose={handleClose} showHeader={false} transparent sx={modalSx}>
      <PanelCard
        title=""
        showHeaderBorder={false}
        bodyPadding="0"
        headerPadding="0 !important"
        sx={panelSx}
        bodySx={{ padding: "0" }}
      >
        <Box sx={{ textAlign: "center", py: 2 }}>
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

          <Typography sx={{ fontWeight: 700, fontSize: "22px", color: "text.primary", fontFamily: "UrbanistBold", mb: 1 }}>
            {t("forgotPasswordDialog.successTitle")}
          </Typography>
          <Typography sx={{ fontSize: "14px", color: "text.secondary", fontFamily: "UrbanistMedium", lineHeight: 1.6, mb: 3, maxWidth: "320px", mx: "auto" }}>
            {t("forgotPasswordDialog.successBody")}
          </Typography>

          <CustomButton
            variant="primary"
            size="medium"
            label={t("forgotPasswordDialog.backToLoginBtn")}
            onClick={handleClose}
            fullWidth
            sx={{ fontWeight: 700, padding: "14px 24px", borderRadius: "12px", fontSize: "15px" }}
          />
        </Box>
      </PanelCard>
    </PopupModal>
  );
};

export default ForgotPasswordDialog;
