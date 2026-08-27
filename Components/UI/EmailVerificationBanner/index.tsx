import React, { useCallback, useEffect, useState } from "react";
import {Box, Typography, Button, CircularProgress, useTheme} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import useUser, { USER_VERIFY_EMAIL } from "@/hooks/useUser";
import OtpDialog from "@/Components/UI/OtpDialog";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { brandFg } from "@/constants/theme";

const EmailVerificationBanner: React.FC = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const userState = useUser();

  const [showOtp, setShowOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [sending, setSending] = useState(false);

  // If user is not logged in or email is already verified, don't show banner.
  // Also hide for phone-only accounts that have NO email on file — there is
  // nothing to verify, and prompting would send a verification email to a
  // non-existent address (confusing for SMS/phone users).
  const userEmail = userState.email || userState.profile?.email || "";
  const hasEmail = !!userEmail;
  const isVerified = userState.email_verified || userState.profile?.email_verified;
  const isLoggedIn = !!userState.name;

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleSendVerification = useCallback(() => {
    setSending(true);
    userState.resendVerification();
    setCountdown(30);
    setShowOtp(true);
    setTimeout(() => setSending(false), 2000);
  }, [userState]);

  const handleVerifyOtp = useCallback(
    (otp: string) => {
      setOtpError("");
      userState.verifyEmail({ otp: otp.trim() });
    },
    [userState],
  );

  const handleResend = useCallback(() => {
    setOtpError("");
    userState.resendVerification();
    setCountdown(30);
  }, [userState]);

  // Listen for verification success
  useEffect(() => {
    if (isVerified && showOtp) {
      setShowOtp(false);
    }
  }, [isVerified, showOtp]);

  // Listen for errors
  useEffect(() => {
    if (userState.error?.actionType === USER_VERIFY_EMAIL) {
      setOtpError(userState.error.message || "Verification failed");
    }
  }, [userState.error]);

  if (!isLoggedIn || isVerified || !hasEmail) {
    return null;
  }

  return (
    <>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: isMobile ? 2 : 3,
          py: 1.5,
          backgroundColor: "rgba(255, 152, 0, 0.08)",
          borderBottom: "1px solid rgba(255, 152, 0, 0.3)",
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <WarningAmberIcon sx={{ color: "#FF9800", fontSize: 20 }} />
          <Typography
            sx={{
              fontSize: isMobile ? "12px" : "14px",
              fontFamily: "var(--font-sans)",
              color: theme.palette.text.primary,
            }}
          >
            {t("verifyEmailBanner")}
          </Typography>
        </Box>
        <Button
          onClick={handleSendVerification}
          disabled={sending}
          sx={{
            fontSize: isMobile ? "11px" : "13px",
            fontFamily: "var(--font-sans)",
            color: brandFg(theme.palette.mode === "dark"),
            textTransform: "none",
            border: `1px solid ${theme.palette.primary.main}`,
            borderRadius: "6px",
            px: 2,
            py: 0.5,
            whiteSpace: "nowrap",
            "&:hover": { backgroundColor: theme.palette.primary.light },
          }}
        >
          {sending ? <CircularProgress size={16} /> : "Verify Now"}
        </Button>
      </Box>

      <OtpDialog
        open={showOtp}
        onClose={() => setShowOtp(false)}
        title="Verify Your Email"
        subtitle="Enter the verification code sent to your email"
        contactInfo={userState.email || userState.profile?.email || ""}
        contactType="email"
        otpLength={6}
        onVerify={handleVerifyOtp}
        onResendCode={handleResend}
        countdown={countdown}
        loading={userState.loading}
        error={otpError}
        onClearError={() => setOtpError("")}
      />
    </>
  );
};

export default EmailVerificationBanner;
