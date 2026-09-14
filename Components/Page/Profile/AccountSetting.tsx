import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import OtpDialog from "@/Components/UI/OtpDialog";
import PanelCard from "@/Components/UI/PanelCard";
import { avatarGradient } from "@/helpers/avatarGradient";
import { getInitials } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import useIdentityVerified from "@/hooks/useIdentityVerified";
import { UserAction } from "@/Redux/Actions";
import { USER_LOGIN, USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { TokenData } from "@/utils/types";
import { Icon } from "@/styles/uiKit";
import { Box, Grid, MenuItem, Select, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useReportDirty } from "@/Components/Page/Settings/settingsDirty";

const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "pt", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "nl", label: "Nederlands" },
];

const AccountSetting = ({ tokenData }: { tokenData: TokenData }) => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t, i18n } = useTranslation(["profile", "auth"]);

  const isMobile = useIsMobile("md");

  // Name fields — editable unless the account is identity-verified (then the
  // legal name is locked and the merchant must contact support). Seeded from
  // the account name and re-synced whenever it changes upstream.
  const { verified: nameLocked } = useIdentityVerified();
  const seedParts = (tokenData.name || "").trim().split(" ").filter(Boolean);
  const [firstName, setFirstName] = useState(seedParts[0] || "");
  const [lastName, setLastName] = useState(seedParts.slice(1).join(" ") || "");
  const [savingName, setSavingName] = useState(false);
  const avatarInitialSource = firstName || tokenData.email?.charAt(0)?.toUpperCase() || "";

  useEffect(() => {
    const parts = (tokenData.name || "").trim().split(" ").filter(Boolean);
    setFirstName(parts[0] || "");
    setLastName(parts.slice(1).join(" ") || "");
  }, [tokenData.name]);

  const currentFullName = (tokenData.name || "").trim();
  const editedFullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const nameDirty = !!firstName.trim() && editedFullName !== currentFullName;

  const handleSaveName = async () => {
    const first = firstName.trim();
    if (!first) {
      dispatch({ type: TOAST_SHOW, payload: { message: t("firstNameRequired", { ns: "profile" }), severity: "error" } });
      return;
    }
    const fullName = [first, lastName.trim()].filter(Boolean).join(" ");
    setSavingName(true);
    try {
      const fd = new FormData();
      fd.append("data", JSON.stringify({ name: fullName }));
      const res = await axiosBaseApi.put("user/updateUser", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const d = res?.data?.data;
      if (d?.accessToken) {
        dispatch({ type: USER_LOGIN, payload: { ...(d.userData || {}), accessToken: d.accessToken } });
      }
      dispatch(UserAction(USER_PROFILE_FETCH));
      dispatch({ type: TOAST_SHOW, payload: { message: t("nameUpdated", { ns: "profile", defaultValue: "Your name has been updated" }) } });
    } catch (e: any) {
      const msg = e?.response?.data?.message || t("verificationFailed", { ns: "profile" });
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setSavingName(false);
    }
  };

  // Email change state
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailOtpOpen, setEmailOtpOpen] = useState(false);
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0);
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpLoading, setEmailOtpLoading] = useState(false);

  // Phone change state
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneOtpOpen, setPhoneOtpOpen] = useState(false);
  const [phoneOtpCountdown, setPhoneOtpCountdown] = useState(0);
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [phoneOtpLoading, setPhoneOtpLoading] = useState(false);

  // /settings → Profile: unsaved name, or an email / phone change mid-flight (plan 3.7).
  useReportDirty(
    "profile",
    nameDirty || (editingEmail && !!emailInput.trim()) || (editingPhone && !!phoneInput.trim()),
  );

  // OTP countdown timers
  useEffect(() => {
    if (emailOtpCountdown > 0) {
      const timer = setTimeout(() => setEmailOtpCountdown(emailOtpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [emailOtpCountdown]);

  useEffect(() => {
    if (phoneOtpCountdown > 0) {
      const timer = setTimeout(() => setPhoneOtpCountdown(phoneOtpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [phoneOtpCountdown]);

  // --- Email Change Flow ---
  const handleSendEmailOtp = async () => {
    const email = emailInput.trim();
    if (!email || !email.includes("@")) {
      setEmailError(t("validEmailError", { ns: "profile" }));
      return;
    }
    setEmailError("");
    setEmailLoading(true);
    try {
      await axiosBaseApi.post("user/addEmail", { email });
      setEmailOtpOpen(true);
      setEmailOtpCountdown(30);
      dispatch({ type: TOAST_SHOW, payload: { message: t("codeSentEmail", { ns: "profile" }) } });
    } catch (e: any) {
      const msg = e.response?.data?.message || t("failedSendCode", { ns: "profile" });
      setEmailError(msg);
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setEmailOtpError(t("valid6DigitError", { ns: "profile" }));
      return;
    }
    setEmailOtpError("");
    setEmailOtpLoading(true);
    try {
      const res = await axiosBaseApi.post("user/verifyAddEmail", { email: emailInput.trim(), otp });
      const { data, message } = res.data || {};
      if (data?.userData && data?.accessToken) {
        dispatch({ type: USER_LOGIN, payload: { ...data.userData, accessToken: data.accessToken } });
      }
      dispatch(UserAction(USER_PROFILE_FETCH));
      setEmailOtpOpen(false);
      setEditingEmail(false);
      setEmailInput("");
      dispatch({ type: TOAST_SHOW, payload: { message: message || t("emailUpdated", { ns: "profile" }) } });
    } catch (e: any) {
      setEmailOtpError(e.response?.data?.message || t("verificationFailed", { ns: "profile" }));
    } finally {
      setEmailOtpLoading(false);
    }
  };

  // --- Phone Change Flow ---
  const handleSendPhoneOtp = async () => {
    const cleaned = phoneInput.replace(/[^0-9]/g, "");
    if (!cleaned || cleaned.length < 10) {
      setPhoneError(t("validPhoneError", { ns: "profile" }));
      return;
    }
    setPhoneError("");
    setPhoneLoading(true);
    try {
      await axiosBaseApi.post(API_ENDPOINTS.user.addPhone, { phone: cleaned });
      setPhoneOtpOpen(true);
      setPhoneOtpCountdown(30);
      dispatch({ type: TOAST_SHOW, payload: { message: t("codeSentPhone", { ns: "profile" }) } });
    } catch (e: any) {
      const msg = e.response?.data?.message || t("failedSendCode", { ns: "profile" });
      setPhoneError(msg);
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleVerifyPhoneOtp = async (otp: string) => {
    if (!otp || otp.length !== 6) {
      setPhoneOtpError(t("valid6DigitError", { ns: "profile" }));
      return;
    }
    setPhoneOtpError("");
    setPhoneOtpLoading(true);
    try {
      const cleaned = phoneInput.replace(/[^0-9]/g, "");
      const res = await axiosBaseApi.post("user/verifyAddPhone", { phone: cleaned, otp });
      const { data, message } = res.data || {};
      if (data?.userData && data?.accessToken) {
        dispatch({ type: USER_LOGIN, payload: { ...data.userData, accessToken: data.accessToken } });
      }
      dispatch(UserAction(USER_PROFILE_FETCH));
      setPhoneOtpOpen(false);
      setEditingPhone(false);
      setPhoneInput("");
      dispatch({ type: TOAST_SHOW, payload: { message: message || t("phoneUpdated", { ns: "profile" }) } });
    } catch (e: any) {
      setPhoneOtpError(e.response?.data?.message || t("verificationFailed", { ns: "profile" }));
    } finally {
      setPhoneOtpLoading(false);
    }
  };

  // --- Communication Language ---
  const [selectedLanguage, setSelectedLanguage] = useState<string>(i18n.language || "en");
  useEffect(() => {
    setSelectedLanguage(i18n.language || "en");
  }, [i18n.language]);

  const handleLanguageChange = async (lng: string) => {
    setSelectedLanguage(lng);
    const { setAppLanguage } = await import("@/helpers/setAppLanguage");
    await setAppLanguage(lng);
    // Use the live i18n instance (not the render-captured `t`, which is bound to
    // the previous language) so the toast shows in the just-selected language.
    dispatch({ type: TOAST_SHOW, payload: { message: i18n.t("communicationLanguageSaved", { ns: "profile" }) } });
  };

  const inputSx = { gap: isMobile ? "6px" : "8px" };
  const labelSx = {
    fontWeight: 500,
    fontSize: isMobile ? "13px" : "15px",
    fontFamily: "var(--font-sans)",
    textAlign: "start" as const,
    color: theme.palette.text.primary,
    letterSpacing: 0,
    lineHeight: "100%",
  };

  return (
    <PanelCard
      bodyPadding={isMobile ? `${theme.spacing("12px", 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
      title={t("accountSetting", { ns: "profile" })}
      showHeaderBorder={false}
      headerAction={
        <Box aria-hidden sx={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="square-user" size={16} color={theme.palette.text.secondary} />
        </Box>
      }
    >
      <Box>
        {/* Account avatar — initials only. Logos live on brands (Settings → Brand),
            so the account mark never conflicts with the active brand's logo. */}
        <Box
          data-testid="profile-avatar"
          data-avatar-kind="initials"
          sx={{
            mx: "auto",
            width: 70,
            height: 70,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: avatarGradient(tokenData.name || tokenData.email),
            boxShadow: theme.palette.mode === "dark" ? "0 2px 8px rgba(0,0,0,0.35)" : "0 2px 8px rgba(10,10,15,0.18)",
          }}
        >
          <Typography
            sx={{
              fontSize: isMobile ? "24px" : "28px",
              fontWeight: 700,
              color: "#fff",
              fontFamily: "var(--font-sans)",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            {getInitials(avatarInitialSource, lastName) || "?"}
          </Typography>
        </Box>
        <Typography
          data-testid="profile-avatar-hint"
          sx={{ mt: 1, textAlign: "center", fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
        >
          {t("brandLogoHint", { ns: "profile", defaultValue: "Looking for your logo? Each brand has its own —" })}{" "}
          <Link
            href="/settings?section=company"
            data-testid="profile-brand-logo-link"
            style={{ color: theme.palette.primary.main, fontWeight: 600, textDecoration: "none" }}
          >
            {t("brandLogoLink", { ns: "profile", defaultValue: "manage brand logos" })}
          </Link>
        </Typography>
      </Box>

      {/* Form Fields */}
      <Box sx={{ display: "flex", flexDirection: "column", rowGap: isMobile ? "12px" : "14px", width: "100%", mt: isMobile ? "16px" : "14px" }}>
        {/* First Name & Last Name — editable unless identity-verified */}
        <Grid container columnSpacing={2} rowSpacing={0}>
          <Grid item xs={12} sm={6}>
            <InputField
              data-testid="first-name-input"
              fullWidth
              inputHeight={isMobile ? "32px" : "38px"}
              label={t("firstName", { ns: "profile" })}
              placeholder={t("firstNamePlaceholder", { ns: "profile" })}
              value={firstName}
              name="firstName"
              disabled={nameLocked || savingName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFirstName(e.target.value)}
              sx={inputSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} sx={{ marginTop: { xs: "12px", sm: "0px" } }}>
            <InputField
              data-testid="last-name-input"
              fullWidth
              inputHeight={isMobile ? "32px" : "38px"}
              label={t("lastName", { ns: "profile" })}
              placeholder={t("lastNamePlaceholder", { ns: "profile" })}
              value={lastName}
              name="lastName"
              disabled={nameLocked || savingName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLastName(e.target.value)}
              sx={inputSx}
            />
          </Grid>
        </Grid>

        {/* Locked (verified) → contact-support notice. Editable → Save button. */}
        {nameLocked ? (
          <Box sx={{ display: "flex", alignItems: "center", gap: "6px", px: "2px" }}>
            <Icon name="info" size={14} color={theme.palette.text.secondary} />
            <Typography
              data-testid="name-restriction-notice"
              sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
            >
              {t("updateNameNotice", { ns: "profile" })}
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <CustomButton
              data-testid="save-name-btn"
              label={savingName ? t("saving", { ns: "profile", defaultValue: "Saving…" }) : t("saveName", { ns: "profile", defaultValue: "Save name" })}
              variant="primary"
              size="small"
              disabled={savingName || !nameDirty}
              onClick={handleSaveName}
            />
          </Box>
        )}

        {/* Email */}
        <Grid container columnSpacing={2} rowSpacing={0}>
          <Grid item xs={12}>
            {!editingEmail ? (
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                <Box sx={{ flex: 1 }}>
                  <InputField
                    data-testid="email-display-input"
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("email", { ns: "profile" })}
                    placeholder={t("placeholderNoEmail", { ns: "profile" })}
                    value={tokenData.email || ""}
                    name="email"
                    disabled
                    sx={inputSx}
                  />
                </Box>
                <CustomButton
                  data-testid="change-email-btn"
                  label={tokenData.email ? t("change", { ns: "profile" }) : t("addEmailBtn", { ns: "profile" })}
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                  startIcon={<Icon name="pencil" size={16} />}
                  onClick={() => { setEditingEmail(true); setEmailInput(""); setEmailError(""); }}
                  sx={{ minWidth: "auto", whiteSpace: "nowrap", mb: "1px", fontSize: { xs: "12px", sm: "14px" } }}
                />
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <InputField
                  data-testid="new-email-input"
                  fullWidth
                  inputHeight={isMobile ? "32px" : "38px"}
                  label={t("newEmailAddress", { ns: "profile" })}
                  placeholder={t("enterNewEmail", { ns: "profile" })}
                  type="email"
                  value={emailInput}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setEmailInput(e.target.value); if (emailError) setEmailError(""); }}
                  error={!!emailError}
                  helperText={emailError}
                  sx={inputSx}
                />
                <Box sx={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <CustomButton
                    data-testid="cancel-email-btn"
                    label={t("cancel", { ns: "profile" })}
                    variant="outlined"
                    size="small"
                    onClick={() => { setEditingEmail(false); setEmailInput(""); setEmailError(""); }}
                  />
                  <CustomButton
                    data-testid="send-email-otp-btn"
                    label={t("sendVerificationCode", { ns: "profile" })}
                    variant="primary"
                    size="small"
                    onClick={handleSendEmailOtp}
                    disabled={emailLoading || !emailInput.trim()}
                  />
                </Box>
              </Box>
            )}
          </Grid>
        </Grid>

        {/* Phone */}
        <Grid container columnSpacing={2} rowSpacing={0}>
          <Grid item xs={12}>
            {!editingPhone ? (
              <Box sx={{ display: "flex", alignItems: "flex-end", gap: "8px" }}>
                <Box sx={{ flex: 1 }}>
                  <InputField
                    data-testid="phone-display-input"
                    fullWidth
                    inputHeight={isMobile ? "32px" : "38px"}
                    label={t("mobile", { ns: "profile" })}
                    placeholder={t("placeholderNoPhone", { ns: "profile" })}
                    value={tokenData.mobile || ""}
                    name="mobile"
                    disabled
                    sx={inputSx}
                  />
                </Box>
                <CustomButton
                  data-testid="change-phone-btn"
                  label={tokenData.mobile ? t("change", { ns: "profile" }) : t("addPhoneBtn", { ns: "profile" })}
                  variant="outlined"
                  size={isMobile ? "small" : "medium"}
                  startIcon={<Icon name="pencil" size={16} />}
                  onClick={() => { setEditingPhone(true); setPhoneInput(""); setPhoneError(""); }}
                  sx={{ minWidth: "auto", whiteSpace: "nowrap", mb: "1px", fontSize: { xs: "12px", sm: "14px" } }}
                />
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Box>
                  <Typography variant="body2" sx={labelSx}>
                    {t("newPhoneNumber", { ns: "profile" })}
                  </Typography>
                  <Box sx={{ mt: "8px" }}>
                    <CountryPhoneInput
                      fullWidth
                      placeholder={t("enterNewPhone", { ns: "profile" })}
                      name="newPhone"
                      defaultCountry="US"
                      value={phoneInput}
                      inputHeight={isMobile ? "32px" : "38px"}
                      onChange={(newValue) => { setPhoneInput(newValue); if (phoneError) setPhoneError(""); }}
                    />
                  </Box>
                  {phoneError && (
                    <Typography sx={{ fontSize: "12px", color: "error.main", fontFamily: "var(--font-sans)", mt: "4px" }}>
                      {phoneError}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                  <CustomButton
                    data-testid="cancel-phone-btn"
                    label={t("cancel", { ns: "profile" })}
                    variant="outlined"
                    size="small"
                    onClick={() => { setEditingPhone(false); setPhoneInput(""); setPhoneError(""); }}
                  />
                  <CustomButton
                    data-testid="send-phone-otp-btn"
                    label={t("sendVerificationCode", { ns: "profile" })}
                    variant="primary"
                    size="small"
                    onClick={handleSendPhoneOtp}
                    disabled={phoneLoading || !phoneInput}
                  />
                </Box>
              </Box>
            )}
          </Grid>
        </Grid>

        {/* Communication Language */}
        <Grid container columnSpacing={2} rowSpacing={0}>
          <Grid item xs={12}>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <Typography variant="body2" sx={labelSx}>
                {t("communicationLanguage", { ns: "profile" })}
              </Typography>
              <Select
                data-testid="communication-language-select"
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value as string)}
                size="small"
                sx={{
                  height: isMobile ? "32px" : "38px",
                  fontFamily: "var(--font-sans)",
                  fontSize: isMobile ? "13px" : "15px",
                }}
              >
                {LANGUAGE_OPTIONS.map((l) => (
                  <MenuItem key={l.code} value={l.code} data-testid={`language-option-${l.code}`}>
                    {l.label}
                  </MenuItem>
                ))}
              </Select>
              <Typography
                sx={{
                  fontSize: "12px",
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                }}
              >
                {t("communicationLanguageHelp", { ns: "profile" })}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Email OTP Dialog */}
      <OtpDialog
        open={emailOtpOpen}
        onClose={() => setEmailOtpOpen(false)}
        title={t("emailVerification", { ns: "profile" })}
        subtitle={t("emailVerificationSubtitle", { ns: "profile" })}
        contactInfo={emailInput}
        contactType="email"
        resendCodeLabel={t("resendCode", { ns: "profile" })}
        resendCodeCountdownLabel={(s) => t("codeInSeconds", { ns: "profile", seconds: s })}
        primaryButtonLabel={t("verify", { ns: "profile" })}
        onResendCode={handleSendEmailOtp}
        onVerify={handleVerifyEmailOtp}
        onClearError={() => setEmailOtpError("")}
        countdown={emailOtpCountdown}
        loading={emailOtpLoading}
        preventClose={false}
        error={emailOtpError || undefined}
      />

      {/* Phone OTP Dialog */}
      <OtpDialog
        open={phoneOtpOpen}
        onClose={() => setPhoneOtpOpen(false)}
        title={t("smsVerification", { ns: "profile" })}
        subtitle={t("smsVerificationSubtitle", { ns: "profile" })}
        contactInfo={phoneInput}
        contactType="phone"
        resendCodeLabel={t("resendCode", { ns: "profile" })}
        resendCodeCountdownLabel={(s) => t("codeInSeconds", { ns: "profile", seconds: s })}
        primaryButtonLabel={t("verify", { ns: "profile" })}
        onResendCode={handleSendPhoneOtp}
        onVerify={handleVerifyPhoneOtp}
        onClearError={() => setPhoneOtpError("")}
        countdown={phoneOtpCountdown}
        loading={phoneOtpLoading}
        preventClose={false}
        error={phoneOtpError || undefined}
      />
    </PanelCard>
  );
};

export default AccountSetting;
