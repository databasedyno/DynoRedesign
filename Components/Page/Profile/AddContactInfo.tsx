import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, Alert } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import CustomButton from "@/Components/UI/Buttons";
import OtpDialog from "@/Components/UI/OtpDialog";
import PanelCard from "@/Components/UI/PanelCard";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { USER_LOGIN, USER_PROFILE_FETCH, UserAction } from "@/Redux/Actions/UserAction";
import axiosBaseApi from "@/axiosConfig";
import useIsMobile from "@/hooks/useIsMobile";
import { TokenData } from "@/utils/types";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";

interface AddContactInfoProps {
  tokenData: TokenData;
}

const AddContactInfo: React.FC<AddContactInfoProps> = ({ tokenData }) => {
  const theme = useTheme();
  const dispatch = useDispatch();
  const isMobile = useIsMobile("md");
  const namespaces = ["profile", "common", "auth"];
  const { t } = useTranslation(namespaces);
  const tProfile = useCallback((key: string) => t(key, { ns: "profile" }), [t]);

  const hasEmail = !!tokenData.email;
  const hasPhone = !!tokenData.mobile;

  // Add Email state
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailOtpDialogOpen, setEmailOtpDialogOpen] = useState(false);
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0);
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);

  // Add Phone state
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneOtpDialogOpen, setPhoneOtpDialogOpen] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);

  // Email OTP countdown
  useEffect(() => {
    if (emailOtpCountdown > 0) {
      const timerId = setTimeout(() => setEmailOtpCountdown(emailOtpCountdown - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [emailOtpCountdown]);

  // Phone OTP countdown
  useEffect(() => {
    if (phoneOtpCountdown > 0) {
      const timerId = setTimeout(() => setPhoneOtpCountdown(phoneOtpCountdown - 1), 1000);
      return () => clearTimeout(timerId);
    }
  }, [phoneOtpCountdown]);

  // Handle send email OTP
  const handleSendEmailOtp = async () => {
    if (!emailInput || !emailInput.includes("@")) {
      setEmailError("Please enter a valid email address");
      return;
    }
    setEmailError("");
    setEmailLoading(true);
    try {
      await axiosBaseApi.post("/user/addEmail", { email: emailInput });
      setEmailOtpDialogOpen(true);
      setEmailOtpCountdown(30);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "Verification code sent to your email" },
      });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to send verification code";
      setEmailError(msg);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: msg, severity: "error" },
      });
    } finally {
      setEmailLoading(false);
    }
  };

  // Handle verify email OTP
  const handleVerifyEmailOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setEmailOtpError("Please enter a valid 6-digit code");
      return;
    }
    setEmailOtpError("");
    setEmailOtpLoading(true);
    try {
      const res = await axiosBaseApi.post("/user/verifyAddEmail", {
        email: emailInput,
        otp,
      });
      const { data, message } = res.data || {};
      if (data?.userData && data?.accessToken) {
        dispatch({
          type: USER_LOGIN,
          payload: { ...data.userData, accessToken: data.accessToken },
        });
      }
      dispatch(UserAction(USER_PROFILE_FETCH));
      setEmailOtpDialogOpen(false);
      setEmailInput("");
      dispatch({
        type: TOAST_SHOW,
        payload: { message: message || tProfile("emailAdded") },
      });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Verification failed";
      setEmailOtpError(msg);
    } finally {
      setEmailOtpLoading(false);
    }
  };

  // Handle send phone OTP
  const handleSendPhoneOtp = async () => {
    const cleaned = phoneInput.replace(/[^0-9]/g, "");
    if (!cleaned || cleaned.length < 10) {
      setPhoneError("Please enter a valid phone number");
      return;
    }
    setPhoneError("");
    setPhoneLoading(true);
    try {
      await axiosBaseApi.post("/user/addPhone", { phone: cleaned });
      setPhoneOtpDialogOpen(true);
      setPhoneOtpCountdown(30);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: "Verification code sent to your phone" },
      });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Failed to send verification code";
      setPhoneError(msg);
      dispatch({
        type: TOAST_SHOW,
        payload: { message: msg, severity: "error" },
      });
    } finally {
      setPhoneLoading(false);
    }
  };

  // Handle verify phone OTP
  const handleVerifyPhoneOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setPhoneOtpError("Please enter a valid 6-digit code");
      return;
    }
    setPhoneOtpError("");
    setPhoneOtpLoading(true);
    try {
      const cleaned = phoneInput.replace(/[^0-9]/g, "");
      const res = await axiosBaseApi.post("/user/verifyAddPhone", {
        phone: cleaned,
        otp,
      });
      const { data, message } = res.data || {};
      if (data?.userData && data?.accessToken) {
        dispatch({
          type: USER_LOGIN,
          payload: { ...data.userData, accessToken: data.accessToken },
        });
      }
      dispatch(UserAction(USER_PROFILE_FETCH));
      setPhoneOtpDialogOpen(false);
      setPhoneInput("");
      dispatch({
        type: TOAST_SHOW,
        payload: { message: message || tProfile("phoneAdded") },
      });
    } catch (e: any) {
      const msg = e.response?.data?.message || "Verification failed";
      setPhoneOtpError(msg);
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  // If user has both, don't show this component
  if (hasEmail && hasPhone) return null;

  return (
    <>
      {/* Add Email Section */}
      {!hasEmail && (
        <PanelCard
          bodyPadding={
            isMobile
              ? `${theme.spacing("12px", 2, 2, 2)}`
              : `${theme.spacing(2, 2.5, 2.5, 2.5)}`
          }
          title={tProfile("addEmail")}
          showHeaderBorder={false}
          headerAction={
            <EmailOutlinedIcon
              color="action"
              style={{ height: "18px", width: "18px" }}
            />
          }
        >
          <Box>
            <Alert severity="info" sx={{ mb: 2, fontSize: "13px" }}>
              {tProfile("addEmailDescription")}
            </Alert>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <InputField
                fullWidth
                inputHeight={isMobile ? "32px" : "38px"}
                label={t("email", { ns: "auth" })}
                placeholder={tProfile("enterEmail")}
                type="email"
                value={emailInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setEmailInput(e.target.value);
                  if (emailError) setEmailError("");
                }}
                error={!!emailError}
                helperText={emailError}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <CustomButton
                  variant="primary"
                  size={isMobile ? "small" : "medium"}
                  label={tProfile("sendVerificationCode")}
                  onClick={handleSendEmailOtp}
                  disabled={emailLoading || !emailInput}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                />
              </Box>
            </Box>
          </Box>

          <OtpDialog
            open={emailOtpDialogOpen}
            onClose={() => setEmailOtpDialogOpen(false)}
            title={t("emailVerification", { ns: "auth" })}
            subtitle={t("emailVerificationSubtitle", { ns: "auth" })}
            contactInfo={emailInput}
            contactType="email"
            resendCodeLabel={t("resendCode", { ns: "auth" })}
            resendCodeCountdownLabel={(seconds) => `Code in ${seconds}s`}
            primaryButtonLabel={tProfile("verifyAndSave")}
            onResendCode={handleSendEmailOtp}
            onVerify={handleVerifyEmailOtp}
            onClearError={() => setEmailOtpError("")}
            countdown={emailOtpCountdown}
            loading={emailOtpLoading}
            preventClose={false}
            error={emailOtpError || undefined}
          />
        </PanelCard>
      )}

      {/* Add Phone Section */}
      {!hasPhone && (
        <PanelCard
          bodyPadding={
            isMobile
              ? `${theme.spacing("12px", 2, 2, 2)}`
              : `${theme.spacing(2, 2.5, 2.5, 2.5)}`
          }
          title={tProfile("addPhone")}
          showHeaderBorder={false}
          headerAction={
            <PhoneOutlinedIcon
              color="action"
              style={{ height: "18px", width: "18px" }}
            />
          }
        >
          <Box>
            <Alert severity="info" sx={{ mb: 2, fontSize: "13px" }}>
              {tProfile("addPhoneDescription")}
            </Alert>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: isMobile ? "13px" : "15px",
                    fontFamily: "UrbanistMedium",
                    textAlign: "start",
                    color: theme.palette.text.primary,
                    letterSpacing: 0,
                    lineHeight: "100%",
                  }}
                >
                  {t("phoneNumber", { ns: "auth" })}
                </Typography>
                <CountryPhoneInput
                  fullWidth
                  placeholder={tProfile("enterPhone")}
                  name="addPhone"
                  defaultCountry="US"
                  value={phoneInput}
                  inputHeight={isMobile ? "32px" : "38px"}
                  onChange={(newValue) => {
                    setPhoneInput(newValue);
                    if (phoneError) setPhoneError("");
                  }}
                />
                {phoneError && (
                  <Typography
                    sx={{
                      fontSize: "12px",
                      color: "error.main",
                      fontFamily: "UrbanistMedium",
                      textAlign: "start",
                    }}
                  >
                    {phoneError}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <CustomButton
                  variant="primary"
                  size={isMobile ? "small" : "medium"}
                  label={tProfile("sendVerificationCode")}
                  onClick={handleSendPhoneOtp}
                  disabled={phoneLoading || !phoneInput}
                  sx={{ width: { xs: "100%", sm: "auto" } }}
                />
              </Box>
            </Box>
          </Box>

          <OtpDialog
            open={phoneOtpDialogOpen}
            onClose={() => setPhoneOtpDialogOpen(false)}
            title={t("smsVerification", { ns: "auth" })}
            subtitle={t("otpSentToPhone", { ns: "auth" })}
            contactInfo={phoneInput}
            contactType="phone"
            resendCodeLabel={t("resendCode", { ns: "auth" })}
            resendCodeCountdownLabel={(seconds) => `Code in ${seconds}s`}
            primaryButtonLabel={tProfile("verifyAndSave")}
            onResendCode={handleSendPhoneOtp}
            onVerify={handleVerifyPhoneOtp}
            onClearError={() => setPhoneOtpError("")}
            countdown={phoneOtpCountdown}
            loading={phoneOtpLoading}
            preventClose={false}
            error={phoneOtpError || undefined}
          />
        </PanelCard>
      )}
    </>
  );
};

export default AddContactInfo;
