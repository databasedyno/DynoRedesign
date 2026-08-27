import { brandFg } from "@/constants/theme";
import InfoIcon from "@/assets/Icons/info-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import CustomButton from "@/Components/UI/Buttons";
import OtpDialog from "@/Components/UI/OtpDialog";
import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import useProfile, { revalidateProfile } from "@/hooks/useProfile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { Icon } from "@/styles/uiKit";
import { Box, IconButton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import * as yup from "yup";
import FormManager from "../Common/FormManager";
import { InfoIconBox, InfoText, InfoWrapper } from "./styled";
import axiosBaseApi from "@/axiosConfig";

const passwordRegex =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=__+{}\[\]:;<>,.?/~]).{8,20}$/;

const UpdatePassword = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("profile");
  const isMobile = useIsMobile("md");

  const profile = useProfile().profile;
  const hasPassword = profile?.has_password ?? false;
  const hasEmail = !!profile?.email;
  const hasPhone = !!profile?.mobile;
  const hasBoth = hasEmail && hasPhone;

  // OTP flow state
  const [otpStep, setOtpStep] = useState<"idle" | "choose" | "otp_sent" | "verified">("idle");
  const [selectedChannel, setSelectedChannel] = useState<"email" | "phone" | "">(""); 
  const [otpSentVia, setOtpSentVia] = useState("");
  const [otpMaskedContact, setOtpMaskedContact] = useState("");
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifiedOtp, setVerifiedOtp] = useState("");

  // Password form state
  const [formKey, setFormKey] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const newPasswordFieldRef = useRef<HTMLDivElement | null>(null);

  // OTP countdown
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  // Start the OTP flow
  const handleStartOtp = () => {
    if (hasBoth) {
      setOtpStep("choose");
    } else {
      // Only one channel available, send directly
      sendOtp();
    }
  };

  // Send OTP to the selected or only available channel
  const sendOtp = async (channel?: "email" | "phone") => {
    try {
      const res = await axiosBaseApi.post("user/profile/request-password-otp", channel ? { channel } : {});
      const { data } = res.data || {};
      setOtpSentVia(data?.sent_via || "email");
      setOtpMaskedContact(data?.masked_contact || "");
      setSelectedChannel(data?.sent_via || "email");
      setOtpDialogOpen(true);
      setOtpCountdown(30);
      setOtpStep("otp_sent");
      dispatch({ type: TOAST_SHOW, payload: { message: t("codeSentToChannel", { channel: data?.sent_via || "email" }) } });
    } catch (e: any) {
      const msg = e.response?.data?.message || t("failedSendCode");
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
      setOtpStep("idle");
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    try {
      const res = await axiosBaseApi.post("user/profile/request-password-otp", selectedChannel ? { channel: selectedChannel } : {});
      const { data } = res.data || {};
      setOtpCountdown(30);
      dispatch({ type: TOAST_SHOW, payload: { message: t("newCodeSentToChannel", { channel: data?.sent_via || "email" }) } });
    } catch (e: any) {
      const msg = e.response?.data?.message || t("failedResendCode");
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    }
  };

  // Verify OTP (just store it, password is set in the form submit)
  const handleVerifyOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setOtpError(t("valid6DigitError"));
      return;
    }
    setOtpError("");
    setVerifiedOtp(otp);
    setOtpDialogOpen(false);
    setOtpStep("verified");
    dispatch({ type: TOAST_SHOW, payload: { message: t("identityVerifiedEnterPassword") } });
  };

  // Submit new password with OTP
  const handlePasswordSubmit = async (values: any) => {
    const { newPassword } = values;
    setSavingPassword(true);
    try {
      const res = await axiosBaseApi.post("user/profile/set-password", {
        otp: verifiedOtp,
        newPassword,
      });
      dispatch({ type: TOAST_SHOW, payload: { message: res.data?.message || t("passwordSetSuccess") } });
      revalidateProfile();
      setOtpStep("idle");
      setVerifiedOtp("");
      setSelectedChannel("");
      setFormKey((prev) => prev + 1);
    } catch (e: any) {
      const msg = e.response?.data?.message || t("failedSetPassword");
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
      if (msg.toLowerCase().includes("otp") || msg.toLowerCase().includes("expired")) {
        setOtpStep("idle");
        setVerifiedOtp("");
      }
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordSchema = yup.object().shape({
    newPassword: yup.string()
      .required(t("newPasswordRequired"))
      .test("password-validation", t("passwordComplexity"), (value) => {
        if (!value || value.trim() === "") return true;
        return passwordRegex.test(value);
      }),
    confirmPassword: yup.string()
      .required(t("confirmPasswordRequired"))
      .test("password-match", t("passwordMismatch"), function (value) {
        if (!value || value.trim() === "") return true;
        return value === this.parent.newPassword;
      }),
  });

  const title = hasPassword ? t("updatePassword") : t("setPassword");
  const subtitle = hasPassword
    ? t("updatePasswordSubtitle")
    : t("setPasswordSubtitle");

  const maskEmail = (email: string) => email?.replace(/(.{2})(.*)(@.*)/, "$1***$3") || "";
  const maskPhone = (phone: string) => phone ? `****${phone.slice(-4)}` : "";

  return (
    <PanelCard
      bodyPadding={isMobile ? `${theme.spacing(2, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
      title={title}
      showHeaderBorder={false}
      headerAction={
        <IconButton>
          <Icon name="lock" size={16} color={theme.palette.text.secondary} />
        </IconButton>
      }
    >
      {/* Info banner */}
      <Box sx={{ mb: isMobile ? "12px" : "14px" }}>
        <InfoWrapper>
          <InfoIconBox>
            <Image src={InfoIcon.src} alt="info-icon" width={16} height={16} draggable={false} />
          </InfoIconBox>
          <InfoText data-testid="password-info-text">{subtitle}</InfoText>
        </InfoWrapper>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
        {/* Step 1: Idle — show CTA button */}
        {otpStep === "idle" && (
          <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-start" } }}>
            <CustomButton
              data-testid="request-password-otp-btn"
              label={hasPassword ? t("updatePassword") : t("setPassword")}
              variant="primary"
              size={isMobile ? "small" : "medium"}
              onClick={handleStartOtp}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            />
          </Box>
        )}

        {/* Step 2: Choose channel (only if user has both email and phone) */}
        {otpStep === "choose" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <Typography sx={{ fontSize: "14px", color: theme.palette.text.primary, fontFamily: "var(--font-sans)", mb: "4px" }}>
              {t("whereToSendCode")}
            </Typography>
            <Box
              data-testid="choose-email-btn"
              onClick={() => sendOtp("email")}
              sx={{
                display: "flex", alignItems: "center", gap: "12px",
                p: "12px 16px", borderRadius: "10px", cursor: "pointer",
                border: "1px solid", borderColor: "divider",
                transition: "all 0.15s",
                "&:hover": { borderColor: theme.palette.primary.main, backgroundColor: theme.palette.mode === "dark" ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)" },
              }}
            >
              <Icon name="mail" size={20} color={brandFg(theme.palette.mode === "dark")} />
              <Box>
                <Typography sx={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{t("channelEmail")}</Typography>
                <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>{maskEmail(profile?.email)}</Typography>
              </Box>
            </Box>
            <Box
              data-testid="choose-phone-btn"
              onClick={() => sendOtp("phone")}
              sx={{
                display: "flex", alignItems: "center", gap: "12px",
                p: "12px 16px", borderRadius: "10px", cursor: "pointer",
                border: "1px solid", borderColor: "divider",
                transition: "all 0.15s",
                "&:hover": { borderColor: theme.palette.primary.main, backgroundColor: theme.palette.mode === "dark" ? "rgba(59,130,246,0.06)" : "rgba(59,130,246,0.04)" },
              }}
            >
              <Icon name="smartphone" size={20} color={brandFg(theme.palette.mode === "dark")} />
              <Box>
                <Typography sx={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>{t("channelPhone")}</Typography>
                <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>{maskPhone(profile?.mobile)}</Typography>
              </Box>
            </Box>
            <CustomButton
              data-testid="cancel-choose-btn"
              label={t("cancel")}
              variant="outlined"
              size="small"
              onClick={() => setOtpStep("idle")}
              sx={{ alignSelf: "flex-start", mt: "4px" }}
            />
          </Box>
        )}

        {/* Step 3: OTP sent — show notice */}
        {otpStep === "otp_sent" && (
          <Typography
            data-testid="otp-sent-notice"
            sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
          >
            {t("otpSentNotice", { contact: otpMaskedContact, channel: otpSentVia })}
          </Typography>
        )}

        {/* Step 4: Verified — show password form */}
        {otpStep === "verified" && (
          <FormManager
            key={formKey}
            initialValues={{ newPassword: "", confirmPassword: "" }}
            yupSchema={passwordSchema}
            onSubmit={handlePasswordSubmit}
          >
            {({ errors, handleBlur, handleChange, submitDisable, touched, values }) => (
              <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "6px", p: "8px 12px", borderRadius: "8px", backgroundColor: theme.palette.mode === "dark" ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.08)", border: "1px solid", borderColor: theme.palette.mode === "dark" ? "rgba(34, 197, 94, 0.3)" : "rgba(34, 197, 94, 0.2)" }}>
                  <Typography sx={{ fontSize: "13px", color: theme.palette.mode === "dark" ? "#4ade80" : "#16a34a", fontFamily: "var(--font-sans)" }}>
                    {t("identityVerifiedViaChannel", { channel: otpSentVia })}
                  </Typography>
                </Box>

                {/* New Password */}
                <Box ref={newPasswordFieldRef} sx={{ position: "relative", width: "100%" }}>
                  <InputField
                    data-testid="new-password-input"
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("newPassword")}
                    type={showNewPassword ? "text" : "password"}
                    name="newPassword"
                    value={values.newPassword || ""}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      handleChange(e);
                      const val = e.target.value.replace(/\s/g, "");
                      if (!val) setShowPasswordValidation(false);
                      else if (passwordRegex.test(val)) setShowPasswordValidation(false);
                      else setShowPasswordValidation(true);
                    }}
                    onFocus={() => {
                      if (values.newPassword && !passwordRegex.test(values.newPassword)) setShowPasswordValidation(true);
                    }}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                      handleBlur(e);
                      setTimeout(() => setShowPasswordValidation(false), 200);
                    }}
                    placeholder={t("newPasswordPlaceholder")}
                    error={(touched.newPassword && !!errors.newPassword) || showPasswordValidation}
                    helperText={touched.newPassword && errors.newPassword ? errors.newPassword : ""}
                    sx={{ gap: isMobile ? "6px" : "8px" }}
                    sideButton={true}
                    sideButtonType="primary"
                    iconBoxSize={isMobile ? "32px" : "38px"}
                    sideButtonIcon={showNewPassword ? <Icon name="eye-off" size={18} color={theme.palette.text.secondary} /> : <Icon name="eye" size={18} color={theme.palette.text.secondary} />}
                    sideButtonIconWidth={isMobile ? "14px" : "19px"}
                    sideButtonIconHeight={isMobile ? "14px" : "19px"}
                    onSideButtonClick={() => setShowNewPassword(!showNewPassword)}
                    showPasswordToggle={true}
                  />
                  <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", position: "absolute", ...(isMobile && { left: "50%", transform: "translateX(-50%)", width: "100%" }), zIndex: 5 }}>
                    <PasswordValidation
                      password={values.newPassword || ""}
                      anchorEl={newPasswordFieldRef.current}
                      open={showPasswordValidation}
                      onClose={() => setShowPasswordValidation(false)}
                      showOnMobile={showPasswordValidation}
                    />
                  </Box>
                </Box>

                {/* Confirm Password */}
                <Box sx={{ width: "100%" }}>
                  <InputField
                    data-testid="confirm-password-input"
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("confirmPassword")}
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={values.confirmPassword || ""}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder={t("confirmPasswordPlaceholder")}
                    error={touched.confirmPassword && !!errors.confirmPassword}
                    helperText={touched.confirmPassword && errors.confirmPassword ? errors.confirmPassword : ""}
                    sx={{ gap: isMobile ? "6px" : "8px" }}
                    sideButton={true}
                    sideButtonType="primary"
                    iconBoxSize={isMobile ? "32px" : "38px"}
                    sideButtonIcon={showConfirmPassword ? <Icon name="eye-off" size={18} color={theme.palette.text.secondary} /> : <Icon name="eye" size={18} color={theme.palette.text.secondary} />}
                    sideButtonIconWidth={isMobile ? "14px" : "19px"}
                    sideButtonIconHeight={isMobile ? "14px" : "19px"}
                    onSideButtonClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    showPasswordToggle={true}
                  />
                </Box>

                <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-end" } }}>
                  <CustomButton
                    data-testid="set-password-submit-btn"
                    label={hasPassword ? t("update") : t("setPassword")}
                    variant="primary"
                    size={isMobile ? "small" : "medium"}
                    disabled={submitDisable || !values.newPassword?.trim() || !values.confirmPassword?.trim() || savingPassword}
                    type="submit"
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  />
                </Box>
              </Box>
            )}
          </FormManager>
        )}
      </Box>

      {/* OTP Verification Dialog */}
      <OtpDialog
        open={otpDialogOpen}
        onClose={() => setOtpDialogOpen(false)}
        title={t("verifyYourIdentity")}
        subtitle={t("verifyIdentitySubtitle", { channel: otpSentVia })}
        contactInfo={otpMaskedContact}
        contactType={otpSentVia === "phone" ? "phone" : "email"}
        resendCodeLabel={t("resendCode")}
        resendCodeCountdownLabel={(s) => t("codeInSeconds", { seconds: s })}
        primaryButtonLabel={t("verify")}
        onResendCode={handleResendOtp}
        onVerify={handleVerifyOtp}
        onClearError={() => setOtpError("")}
        countdown={otpCountdown}
        loading={otpLoading}
        preventClose={false}
        error={otpError || undefined}
      />
    </PanelCard>
  );
};

export default UpdatePassword;
