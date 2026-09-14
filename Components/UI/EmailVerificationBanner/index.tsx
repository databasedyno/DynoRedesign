import React, { useCallback, useEffect, useState } from "react";
import {Box, Typography, Button, CircularProgress, useTheme} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useDispatch, useSelector } from "react-redux";
import { UserAction } from "@/Redux/Actions/UserAction";
import {
  USER_VERIFY_EMAIL,
  USER_RESEND_VERIFICATION,
} from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import OtpDialog from "@/Components/UI/OtpDialog";
import useIsMobile from "@/hooks/useIsMobile";
import { useTranslation } from "react-i18next";
import { brandFg } from "@/constants/theme";

const EmailVerificationBanner: React.FC = () => {
  const { t } = useTranslation("common");
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobile = useIsMobile("sm");
  const userState = useSelector((state: rootReducer) => state.userReducer);

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
    dispatch(UserAction(USER_RESEND_VERIFICATION, {}));
    setCountdown(30);
    setShowOtp(true);
    setTimeout(() => setSending(false), 2000);
  }, [dispatch]);

  const handleVerifyOtp = useCallback(
    (otp: string) => {
      setOtpError("");
      dispatch(UserAction(USER_VERIFY_EMAIL, { otp: otp.trim() }));
    },
    [dispatch],
  );

  const handleResend = useCallback(() => {
    setOtpError("");
    dispatch(UserAction(USER_RESEND_VERIFICATION, {}));
    setCountdown(30);
  }, [dispatch]);

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
        title={t("emailVerify.title")}
        subtitle={t("emailVerify.subtitle")}
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
