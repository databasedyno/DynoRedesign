import InfoIcon from "@/assets/Icons/info-icon.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import CustomButton from "@/Components/UI/Buttons";
import PanelCard from "@/Components/UI/PanelCard";
import { isStepUpCancelled } from "@/Components/UI/StepUp/stepUpBus";
import { useStepUpSession } from "@/Components/UI/StepUp/useStepUpSession";
import useIsMobile from "@/hooks/useIsMobile";
import { UserAction } from "@/Redux/Actions";
import { USER_PROFILE_FETCH } from "@/Redux/Actions/UserAction";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { rootReducer } from "@/utils/types";
import { Icon } from "@/styles/uiKit";
import { Box, CircularProgress, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Image from "next/image";
import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";
import FormManager from "../Common/FormManager";
import { InfoIconBox, InfoText, InfoWrapper } from "./styled";
import axiosBaseApi from "@/axiosConfig";
import { DirtyReporter } from "@/Components/Page/Settings/settingsDirty";

const passwordRegex =
  /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=__+{}\[\]:;<>,.?/~]).{8,20}$/;

/**
 * Set / update the account password. Identity is proven by the shared `security`
 * step-up (email code, authenticator, SMS or backup code — whatever the account has
 * enrolled); the backend gates POST user/profile/set-password on that session.
 */
const UpdatePassword = () => {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { t } = useTranslation("profile");
  const isMobile = useIsMobile("md");

  const profile = useSelector((state: rootReducer) => state.userReducer.profile);
  const hasPassword = profile?.has_password ?? false;

  const [editing, setEditing] = useState(false);
  const session = useStepUpSession("security", editing, () => setEditing(false));

  const [formKey, setFormKey] = useState(0);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPasswordValidation, setShowPasswordValidation] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const newPasswordFieldRef = useRef<HTMLDivElement | null>(null);

  const handlePasswordSubmit = async (values: any) => {
    const { newPassword } = values;
    setSavingPassword(true);
    try {
      // If the 10-min step-up window lapsed, the axios interceptor re-prompts and retries.
      const res = await axiosBaseApi.post("user/profile/set-password", { newPassword });
      dispatch({ type: TOAST_SHOW, payload: { message: res.data?.message || t("passwordSetSuccess") } });
      dispatch(UserAction(USER_PROFILE_FETCH));
      setEditing(false);
      setFormKey((prev) => prev + 1);
    } catch (e: any) {
      if (isStepUpCancelled(e)) return;
      const msg = e.response?.data?.message || t("failedSetPassword");
      dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
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
  const subtitle = hasPassword ? t("updatePasswordSubtitle") : t("setPasswordSubtitle");
  const dark = theme.palette.mode === "dark";
  const mm = Math.floor(session.remaining / 60);
  const ss = String(session.remaining % 60).padStart(2, "0");

  return (
    <PanelCard
      bodyPadding={isMobile ? `${theme.spacing(2, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
      title={title}
      showHeaderBorder={false}
      headerAction={
        <Box aria-hidden sx={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="lock" size={16} color={theme.palette.text.secondary} />
        </Box>
      }
    >
      <Box sx={{ mb: isMobile ? "12px" : "14px" }}>
        <InfoWrapper>
          <InfoIconBox>
            <Image src={InfoIcon.src} alt="info-icon" width={16} height={16} draggable={false} />
          </InfoIconBox>
          <InfoText data-testid="password-info-text">{subtitle}</InfoText>
        </InfoWrapper>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
        {!editing && (
          <Box sx={{ display: "flex", justifyContent: { xs: "stretch", sm: "flex-start" } }}>
            <CustomButton
              data-testid="request-password-otp-btn"
              label={hasPassword ? t("updatePassword") : t("setPassword")}
              variant="primary"
              size={isMobile ? "small" : "medium"}
              onClick={() => setEditing(true)}
              sx={{ width: { xs: "100%", sm: "auto" } }}
            />
          </Box>
        )}

        {editing && !session.active && (
          <Box data-testid="password-stepup-pending" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <CircularProgress size={16} thickness={5} sx={{ color: theme.palette.primary.main }} />
            <Typography sx={{ fontSize: "13px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
              {t("verifyYourIdentity")}
            </Typography>
          </Box>
        )}

        {editing && session.active && (
          <FormManager
            key={formKey}
            initialValues={{ newPassword: "", confirmPassword: "" }}
            yupSchema={passwordSchema}
            onSubmit={handlePasswordSubmit}
          >
            {({ errors, handleBlur, handleChange, submitDisable, touched, values }) => (
              <Box sx={{ display: "flex", flexDirection: "column", gap: isMobile ? "12px" : "14px" }}>
                <DirtyReporter section="profile" dirty={!!values.newPassword || !!values.confirmPassword} />
                <Box
                  data-testid="password-identity-verified"
                  sx={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px",
                    p: "8px 12px", borderRadius: "8px",
                    backgroundColor: dark ? "rgba(34, 197, 94, 0.1)" : "rgba(34, 197, 94, 0.08)",
                    border: "1px solid", borderColor: dark ? "rgba(34, 197, 94, 0.3)" : "rgba(34, 197, 94, 0.2)",
                  }}
                >
                  <Typography sx={{ fontSize: "13px", color: dark ? "#4ade80" : "#16a34a", fontFamily: "var(--font-sans)" }}>
                    {t("identityVerifiedEnterPassword")}
                  </Typography>
                  <Typography data-testid="password-stepup-countdown" sx={{ fontSize: "12px", fontVariantNumeric: "tabular-nums", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", whiteSpace: "nowrap" }}>
                    {mm}:{ss}
                  </Typography>
                </Box>

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

                <Box sx={{ display: "flex", gap: "8px", justifyContent: { xs: "stretch", sm: "flex-end" }, flexDirection: { xs: "column-reverse", sm: "row" } }}>
                  <CustomButton
                    data-testid="cancel-password-btn"
                    label={t("cancel")}
                    variant="outlined"
                    size={isMobile ? "small" : "medium"}
                    onClick={() => setEditing(false)}
                    sx={{ width: { xs: "100%", sm: "auto" } }}
                  />
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
    </PanelCard>
  );
};

export default UpdatePassword;
