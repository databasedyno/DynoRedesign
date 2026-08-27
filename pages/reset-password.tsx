import { showToast } from "@/helpers/toastStore";
import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import PasswordValidation from "@/Components/UI/AuthLayout/PasswordValidation";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import { AuthContainer, CardWrapper } from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import { setAuthNotice } from "@/helpers/authNotice";
import { theme } from "@/styles/theme";
import useUser from "@/hooks/useUser";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {Box, useTheme} from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";


const ResetPasswordPage = () => {
  const router = useRouter();
  const { token, email } = router.query;
  const [allowed, setAllowed] = useState(false);

  const isMobile = useIsMobile();
  const muiTheme = useTheme();
  const userState = useUser();
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
        userState.resetPassword({
          token: token,
          email: email,
          newPassword: newPassword,
          onSuccess: () => {
            router.replace("/auth/login");
          },
        });
      }
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "An error occurred";
      showToast({
          message: message,
          severity: "error",
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
    <AuthContainer>
      <CardWrapper
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: isMobile ? "10px 18px" : "8px 27px",
          height: isMobile ? "49px" : "56px",
          overflow: "visible",
        }}
      >
        {/* Logo */}
        <Image
          src={muiTheme.palette.mode === "dark" ? WhiteLogo : Logo}
          alt="logo"
          width={isMobile ? 86 : 114}
          height={isMobile ? 29 : 39}
          draggable={false}
          onClick={() => {
            router.push("/");
          }}
          style={{ cursor: "pointer" }}
        />

        <Box>
          <LanguageSwitcher />
        </Box>
      </CardWrapper>

      <CardWrapper sx={{ padding: "30px" }}>
        <TitleDescription
          title={t("setNewPassword")}
          align="left"
          titleVariant="h2"
          descriptionVariant="p"
        />
        <Box
          ref={newPasswordFieldRef}
          sx={{ position: "relative", width: "100%", marginTop: "24px" }}
        >
          <InputField
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
          />
        </Box>
      </CardWrapper>
    </AuthContainer>
  );
};

export default ResetPasswordPage;
