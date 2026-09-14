import AuthShell from "@/Components/UI/AuthLayout/AuthShell";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import useIsMobile from "@/hooks/useIsMobile";
import { UserAction } from "@/Redux/Actions";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { setAuthNotice } from "@/helpers/authNotice";
import { USER_RESET_PASSWORD } from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { Box, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";

const ResetPasswordPage = () => {
  const router = useRouter();
  const { token, email } = router.query;
  const [allowed, setAllowed] = useState(false);
  const dispatch = useDispatch();

  const isMobile = useIsMobile();
  const theme = useTheme();
  const userState = useSelector((state: rootReducer) => state.userReducer);
  const { t } = useTranslation("auth");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [newPasswordConfirmError, setNewPasswordConfirmError] = useState("");
  const [newPasswordShowPassword, setNewPasswordShowPassword] = useState(false);
  const [newPasswordConfirmShowPassword, setNewPasswordConfirmShowPassword] =
    useState(false);
  const [
    newPasswordShowPasswordValidation,
    setNewPasswordShowPasswordValidation,
  ] = useState(false);
  const newPasswordFieldRef = useRef<HTMLDivElement | null>(null);

  const passwordRegex =
    /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()\-=__+{}\[\]:;<>,.?/~]).{8,20}$/;

  const handleNewPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewPassword(value);

    // Public-surfaces clarity pass: keep the rules checklist visible until
    // the password satisfies them (rules are stated BEFORE the user fails).
    setNewPasswordShowPasswordValidation(!passwordRegex.test(value));

    if (newPasswordConfirm) {
      if (value && newPasswordConfirm && value !== newPasswordConfirm) {
        setNewPasswordConfirmError("passwordAndConfirmPasswordShouldBeSame");
      } else {
        setNewPasswordConfirmError("");
      }
    }
  };

  const handleNewPasswordBlur = () => {
    setTimeout(() => {
      setNewPasswordShowPasswordValidation(false);
    }, 200);
  };

  const handleNewPasswordFocus = () => {
    // Show the rules as soon as the field is focused — even while empty —
    // so users never discover requirements via an error.
    if (!passwordRegex.test(newPassword)) {
      setNewPasswordShowPasswordValidation(true);
    }
  };

  const handleNewPasswordConfirmChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value;
    setNewPasswordConfirm(value);
    setNewPasswordConfirmError("");

    if (newPassword && value && newPassword !== value) {
      setNewPasswordConfirmError("passwordAndConfirmPasswordShouldBeSame");
    } else {
      setNewPasswordConfirmError("");
    }
  };

  const handleSetNewPassword = () => {
    try {
      if (
        newPassword &&
        newPasswordConfirm &&
        token &&
        email &&
        newPassword === newPasswordConfirm
      ) {
        dispatch(
          UserAction(USER_RESET_PASSWORD, {
            token: token,
            email: email,
            newPassword: newPassword,
            onSuccess: () => {
              router.replace("/auth/login");
            },
          }),
        );
      }
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "An error occurred";
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  useEffect(() => {
    if (!router.isReady) return;

    if (!token || !email) {
      setAuthNotice("reset_invalid");
      router.replace("/auth/login");
    } else {
      setAllowed(true);
    }
  }, [router, router.isReady, token, email]);

  if (!allowed) return null;

  return (
    <AuthShell title={`${t("setNewPassword")} · Dynopay`} testId="reset-password-page">
        <TitleDescription
          title={t("setNewPassword")}
          description={t("setNewPasswordDescription", { defaultValue: "Pick a strong password for {{email}} — you'll use it the next time you log in.", email: String(email || "") })}
          align="left"
        />
        <Box
          ref={newPasswordFieldRef}
          sx={{ position: "relative", width: "100%", marginTop: "24px" }}
        >
          <InputField
            data-testid="reset-password-new"
            label={t("newPassword")}
            type={newPasswordShowPassword ? "text" : "password"}
            value={newPassword}
            autoComplete="off"
            onChange={handleNewPasswordChange}
            onFocus={handleNewPasswordFocus}
            onBlur={handleNewPasswordBlur}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !userState.loading &&
                newPassword &&
                newPasswordConfirm
              ) {
                e.preventDefault();
                handleSetNewPassword();
              }
            }}
            placeholder={t("newPasswordPlaceholder")}
            sideButton={true}
            sideButtonType="primary"
            sideButtonIcon={
              newPasswordShowPassword ? (
                <VisibilityOffIcon
                  sx={{
                    color: theme.palette.text.secondary,
                    height: "18px",
                    width: "16px",
                  }}
                />
              ) : (
                <VisibilityIcon
                  sx={{
                    color: theme.palette.text.secondary,
                    height: "18px",
                    width: "16px",
                  }}
                />
              )
            }
            sideButtonIconWidth={isMobile ? "14px" : "18px"}
            sideButtonIconHeight={isMobile ? "14px" : "18px"}
            onSideButtonClick={() => {
              setNewPasswordShowPassword(!newPasswordShowPassword);
            }}
            showPasswordToggle={true}
          />
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              position: "absolute",
              ...(isMobile &&
                theme.breakpoints.down("lg") && {
                  left: "50%",
                  transform: "translateX(-50%)",
                  width: "100%",
                }),
              zIndex: 5,
            }}
          >
            <PasswordValidation
              password={newPassword}
              anchorEl={newPasswordFieldRef.current}
              open={newPasswordShowPasswordValidation}
              onClose={() => setNewPasswordShowPasswordValidation(false)}
              showOnMobile={newPasswordShowPasswordValidation}
            />
          </Box>
        </Box>
        <Box sx={{ marginTop: "16px" }}>
          <InputField
            data-testid="reset-password-confirm"
            label={t("newPasswordConfirm")}
            type={newPasswordConfirmShowPassword ? "text" : "password"}
            value={newPasswordConfirm}
            autoComplete="off"
            onChange={handleNewPasswordConfirmChange}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !userState.loading &&
                newPassword &&
                newPasswordConfirm
              ) {
                e.preventDefault();
                handleSetNewPassword();
              }
            }}
            placeholder={t("newPasswordConfirmPlaceholder")}
            error={!!newPasswordConfirmError}
            helperText={
              newPasswordConfirmError
                ? newPasswordConfirmError.includes(" ")
                  ? newPasswordConfirmError
                  : t(newPasswordConfirmError)
                : ""
            }
            sideButton={true}
            sideButtonType="primary"
            sideButtonIcon={
              newPasswordConfirmShowPassword ? (
                <VisibilityOffIcon
                  sx={{
                    color: theme.palette.text.secondary,
                    height: "18px",
                    width: "16px",
                  }}
                />
              ) : (
                <VisibilityIcon
                  sx={{
                    color: theme.palette.text.secondary,
                    height: "18px",
                    width: "16px",
                  }}
                />
              )
            }
            sideButtonIconWidth={isMobile ? "14px" : "18px"}
            sideButtonIconHeight={isMobile ? "14px" : "18px"}
            onSideButtonClick={() => {
              setNewPasswordConfirmShowPassword(
                !newPasswordConfirmShowPassword,
              );
            }}
            showPasswordToggle={true}
          />
        </Box>
        <Box sx={{ marginTop: "24px" }}>
          <CustomButton
            label={t("continue")}
            variant="primary"
            size={isMobile ? "small" : "medium"}
            fullWidth
            onClick={handleSetNewPassword}
            disabled={userState.loading || !newPassword || !newPasswordConfirm || newPassword !== newPasswordConfirm}
            data-testid="reset-password-submit"
          />
        </Box>
    </AuthShell>
  );
};

export default ResetPasswordPage;
