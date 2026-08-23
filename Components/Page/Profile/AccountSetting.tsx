import CameraIcon from "@/assets/Icons/camera-icon.svg";
import TrashIcon from "@/assets/Icons/trash-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import CustomButton from "@/Components/UI/Buttons";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import OtpDialog from "@/Components/UI/OtpDialog";
import PanelCard from "@/Components/UI/PanelCard";
import { getInitials } from "@/helpers";
import useIsMobile from "@/hooks/useIsMobile";
import { UserAction } from "@/Redux/Actions";
import { USER_LOGIN, USER_PROFILE_FETCH, USER_UPDATE } from "@/Redux/Actions/UserAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { TokenData } from "@/utils/types";
import { Icon } from "@/styles/uiKit";
import { Box, Grid, IconButton, MenuItem, Select, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

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

  const fileRef = useRef<any>();
  const isMobile = useIsMobile("md");
  const [media, setMedia] = useState<any>();
  const [userPhoto, setUserPhoto] = useState("");
  const [initialPhoto, setInitialPhoto] = useState("");
  const [imageError, setImageError] = useState(false);

  // Name fields (from tokenData)
  const nameParts = (tokenData.name || "").trim().split(" ").filter(Boolean);
  const firstName = nameParts[0] || tokenData.email?.charAt(0)?.toUpperCase() || "";
  const lastName = nameParts.slice(1).join(" ") || "";

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

  useEffect(() => {
    const raw = tokenData.photo || "";
    const normalized = raw && !raw.startsWith("/") && !raw.startsWith("http") && !raw.startsWith("blob:") ? `/${raw}` : raw;
    setUserPhoto(normalized);
    setInitialPhoto(normalized);
    setImageError(false);
  }, [tokenData]);

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

  // Photo upload
  const MAX_FILE_SIZE_MB = 10;
  const [photoError, setPhotoError] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const file = e.target.files[0];
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        setPhotoError(t("imageSizeError", { ns: "profile", max: MAX_FILE_SIZE_MB }));
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setPhotoError("");
      setUserPhoto(URL.createObjectURL(file));
      setMedia(file);
      setImageError(false);
    }
  };

  const handleRemovePhoto = () => {
    setUserPhoto("");
    setMedia(null);
    setImageError(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handlePhotoSave = () => {
    const formData = new FormData();
    if (media) {
      formData.append("image", media);
    }
    formData.append("data", JSON.stringify({}));
    dispatch(UserAction(USER_UPDATE, formData));
    setInitialPhoto(userPhoto);
    setMedia(undefined);
  };

  const hasPhotoChanges = (media !== undefined && media !== null) || userPhoto !== initialPhoto;

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
    dispatch({ type: TOAST_SHOW, payload: { message: t("communicationLanguageSaved", { ns: "profile" }) } });
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
        <IconButton>
          <Icon name="square-user" size={16} color={theme.palette.text.secondary} />
        </IconButton>
      }
    >
      <Box>
        {/* Avatar */}
        <Box
          data-testid="profile-avatar"
          sx={{
            mx: "auto",
            border: "1px solid",
            position: "relative",
            width: 70,
            height: 70,
            borderRadius: "50%",
            overflow: "hidden",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: userPhoto && !imageError ? "transparent" : "primary.main",
          }}
        >
          {userPhoto && !imageError ? (
            <Image
              src={userPhoto}
              alt="Profile photo"
              fill
              style={{ objectFit: "cover", borderRadius: "50%" }}
              draggable={false}
              onError={() => setImageError(true)}
            />
          ) : (
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
              {getInitials(firstName, lastName) || "?"}
            </Typography>
          )}
        </Box>

        {/* Photo Actions */}
        <Box mt={isMobile ? "10px" : "4px"}>
          <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: { xs: "12px", md: "21px" } }}>
            <CustomButton
              data-testid="upload-photo-btn"
              label={t("uploadNewPhoto", { ns: "profile" })}
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              startIcon={<Image src={CameraIcon.src} alt="camera-icon" width={14} height={12} draggable={false} />}
              iconSize={18}
              onClick={() => fileRef.current?.click()}
              sx={{ padding: { xs: "0px 10px", md: "0px 16px" }, fontSize: { xs: "13px", sm: "15px" } }}
            />
            <CustomButton
              data-testid="remove-photo-btn"
              label={t("remove", { ns: "profile" })}
              variant="outlined"
              size={isMobile ? "small" : "medium"}
              startIcon={<Image src={TrashIcon.src} alt="trash-icon" width={12} height={12} draggable={false} />}
              iconSize={18}
              onClick={handleRemovePhoto}
              sx={{ color: theme.palette.text.secondary, padding: { xs: "0px 16px", sm: "0px 49px" }, fontSize: { xs: "13px", sm: "15px" } }}
            />
          </Box>
          {hasPhotoChanges && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
              <CustomButton
                label={t("savePhoto", { ns: "profile" })}
                data-testid="save-photo-btn"
                variant="primary"
                size="small"
                onClick={handlePhotoSave}
              />
            </Box>
          )}
        </Box>

        <input type="file" accept="image/*" hidden ref={fileRef} onChange={handleFileChange} />
        {photoError && (
          <Typography sx={{ color: theme.palette.error.main, fontSize: "12px", fontFamily: "var(--font-sans)", textAlign: "center", mt: 0.5 }}>
            {photoError}
          </Typography>
        )}
      </Box>

      {/* Form Fields */}
      <Box sx={{ display: "flex", flexDirection: "column", rowGap: isMobile ? "12px" : "14px", width: "100%", mt: isMobile ? "16px" : "14px" }}>
        {/* First Name & Last Name (Read-only) */}
        <Grid container columnSpacing={2} rowSpacing={0}>
          <Grid item xs={12} sm={6}>
            <Tooltip title={t("contactSupportName", { ns: "profile" })} placement="top" arrow>
              <Box>
                <InputField
                  data-testid="first-name-input"
                  fullWidth
                  inputHeight={isMobile ? "32px" : "38px"}
                  label={t("firstName", { ns: "profile" })}
                  placeholder={t("firstName", { ns: "profile" })}
                  value={firstName}
                  name="firstName"
                  disabled
                  sx={inputSx}
                />
              </Box>
            </Tooltip>
          </Grid>
          <Grid item xs={12} sm={6} sx={{ marginTop: { xs: "12px", sm: "0px" } }}>
            <Tooltip title={t("contactSupportName", { ns: "profile" })} placement="top" arrow>
              <Box>
                <InputField
                  data-testid="last-name-input"
                  fullWidth
                  inputHeight={isMobile ? "32px" : "38px"}
                  label={t("lastName", { ns: "profile" })}
                  placeholder={t("lastName", { ns: "profile" })}
                  value={lastName}
                  name="lastName"
                  disabled
                  sx={inputSx}
                />
              </Box>
            </Tooltip>
          </Grid>
        </Grid>

        {/* Name restriction notice */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "6px", px: "2px" }}>
          <Icon name="info" size={14} color={theme.palette.text.secondary} />
          <Typography
            data-testid="name-restriction-notice"
            sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}
          >
            {t("updateNameNotice", { ns: "profile" })}
          </Typography>
        </Box>

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
