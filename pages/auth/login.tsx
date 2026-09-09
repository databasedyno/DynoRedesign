import Script from "next/script";
import { brandFg } from "@/constants/theme";
import EditIcon from "@/assets/Icons/editicon.png";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import ArrowUpwardIcon from "@/assets/Icons/up-arrow-icon.png";
import Logo from "@/assets/Icons/home/dynopay-blackLogo.svg";
import WhiteLogo from "@/assets/Icons/home/dynopay-whiteLogo.svg";
import axiosBaseApi from "@/axiosConfig";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import SocialAuthButtons from "@/Components/Common/SocialAuthButtons";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import TrustStrip from "@/Components/UI/AuthLayout/TrustStrip";
import CustomButton from "@/Components/UI/Buttons";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import ForgotPasswordDialog from "@/Components/UI/ForgotPasswordDialog";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import OtpDialog from "@/Components/UI/OtpDialog";
import TwoFactorLoginDialog from "@/Components/UI/TwoFactorLoginDialog";
import OtpInputPanel from "@/Components/UI/OtpInputPanel";
import CustomRadio from "@/Components/UI/RadioGroup";
import {
  AuthContainer,
  AuthPageBackground,
  SplitLayoutWrapper,
  FormPanel,
  CardWrapper,
} from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { takeAuthNotice } from "@/helpers/authNotice";
import {
  USER_API_ERROR,
  USER_CONFIRM_CODE,
  USER_EMAIL_CHECK,
  USER_LOGIN,
  USER_SEND_OTP,
  USER_SEND_RESET_LINK,
  USER_VERIFY_LOGIN_OTP,
  USER_RESEND_LOGIN_OTP,
  USER_LOGIN_OTP_RESET,
  USER_LOGIN_2FA_REQUIRED,
  USER_LOGIN_2FA_RESET,
  USER_VERIFY_2FA,
  UserAction,
} from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Box,
  Checkbox,
  Divider,
  FormControlLabel,
  RadioGroup,
  Typography,
  useTheme,
} from "@mui/material";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";
import { API_ENDPOINTS } from "@/api/endpoints";
import { prefetchDashboardData } from "@/utils/prefetchDashboard";

export default function Login() {
  const { t } = useTranslation("auth");
  const theme = useTheme();
  // Gate theme-dependent rendering until mount so SSR (always 'dark') and the
  // first client render agree — prevents the logo hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isMobile = useIsMobile("sm");
  const dispatch = useDispatch();
  const router = useRouter();
  const userState = useSelector((state: rootReducer) => state.userReducer);

  // If the user was sent back here because their session timed out (or a
  // password-reset link was invalid), tell them why instead of silently
  // showing the login form. The notice is set right before the redirect and
  // consumed once here.
  useEffect(() => {
    const notice = takeAuthNotice();
    if (!notice) return;
    if (notice === "session_expired") {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: t("sessionTimedOut", {
            defaultValue: "Your session has timed out. Please sign in again.",
          }),
          severity: "warning",
        },
      });
    } else if (notice === "reset_invalid") {
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: t("resetLinkInvalid", {
            defaultValue:
              "This password reset link is invalid or has expired. Please request a new one.",
          }),
          severity: "error",
        },
      });
    }
  }, []);

  // Email check state
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [showLoginMethods, setShowLoginMethods] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

  // Login method state
  //
  // Session 82 (2026-07-28): default is now "password" (was "email"). This
  // matches Google / Coinbase / Stripe: the password field is the primary
  // affordance for returning users. Users who prefer OTP flip via the tiny
  // "Use a code instead →" link that shows below the password field — that
  // sets `useCodeMode=true`, hides the password field, and shows the inline
  // OtpInputPanel (email default; SMS chip appears if userState.mobile).
  const [loginMethod, setLoginMethod] = useState("password");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // NEW (session 82): when true, hide password field and show inline OTP
  // block instead. Reset when the user clicks "Back to password".
  const [useCodeMode, setUseCodeMode] = useState(false);
  // NEW: reset key for OtpInputPanel so resending the code clears the boxes.
  const [inlineOtpResetKey, setInlineOtpResetKey] = useState(0);

  // Email OTP state
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [emailOtpError, setEmailOtpError] = useState("");
  const [emailOtpTouched, setEmailOtpTouched] = useState(false);
  const [emailOtpCountdown, setEmailOtpCountdown] = useState(0);
  const [emailOtpDialogOpen, setEmailOtpDialogOpen] = useState(false);

  // SMS state
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [mobile, setMobile] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [mobileTouched, setMobileTouched] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpTouched, setOtpTouched] = useState(false);
  const [smsOtpCountdown, setSmsOtpCountdown] = useState(0);
  const [smsOtpDialogOpen, setSmsOtpDialogOpen] = useState(false);

  // Login OTP state
  const [loginOtpCountdown, setLoginOtpCountdown] = useState(0);

  // Animation states
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showErrorAnimation, setShowErrorAnimation] = useState(false);
  const [previousLoadingState, setPreviousLoadingState] = useState(false);

  // Login mode: "email" or "phone"
  const [loginMode, setLoginMode] = useState<"email" | "phone">("email");

  // Phone login state
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phoneCheckLoading, setPhoneCheckLoading] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState("");
  const [showPhoneLoginOtp, setShowPhoneLoginOtp] = useState(false);
  const [phoneLoginOtpSent, setPhoneLoginOtpSent] = useState(false);
  const [phoneLoginOtpDialogOpen, setPhoneLoginOtpDialogOpen] = useState(false);
  const [phoneLoginOtpCountdown, setPhoneLoginOtpCountdown] = useState(0);
  const [phoneLoginOtpError, setPhoneLoginOtpError] = useState("");
  const [phoneLoginOtpTouched, setPhoneLoginOtpTouched] = useState(false);

  // Remember-me: keep signed in for 7 days (default) vs. session-only (until browser closes)
  const [rememberMe, setRememberMe] = useState(true);

  // Forgot password state
  const [forgotPasswordDialogOpen, setForgotPasswordDialogOpen] =
    useState(false);
  const [forgotPasswordEmailError, setForgotPasswordEmailError] = useState("");
  const [forgotPasswordOtpCountdown, setForgotPasswordOtpCountdown] =
    useState(0);
  const [forgotPasswordOtpError, setForgotPasswordOtpError] = useState("");
  const [isPasswordRecoveryMode, setIsPasswordRecoveryMode] = useState(false);

  // Validation schemas - use translation keys instead of translated strings
  const emailSchema = yup.object().shape({
    email: yup.string().email("emailInvalid").required("emailRequired"),
  });

  const passwordSchema = yup.object().shape({
    password: yup.string().required("passwordRequired"),
  });

  // Navigate to home if user is logged in (but not in password recovery mode).
  // Gate on the session (email OR name) so name-less social logins (e.g. a
  // GitHub username-only account) still reach the dashboard + NameGate; phone
  // users have no email but always have a name, so both paths stay covered.
  useEffect(() => {
    if ((userState.email || userState.name) && !isPasswordRecoveryMode) {
      setShowSuccessAnimation(true);
      setEmailOtpDialogOpen(false);
      // Reset login OTP state on successful login
      if (userState.loginOtpRequired) {
        dispatch({ type: USER_LOGIN_OTP_RESET });
      }
      if (userState.login2faRequired) {
        dispatch({ type: USER_LOGIN_2FA_RESET });
      }
      setTimeout(() => {
        // Only navigate once the token is actually persisted — guards against
        // an iOS localStorage write-visibility race that would otherwise land
        // the user on the dashboard guard before the token is readable.
        if (typeof window !== "undefined" && localStorage.getItem("token")) {
          // Warm the dashboard SWR cache (company list / onboarding / fee-free)
          // BEFORE the route transition so the dashboard paints with data ready.
          prefetchDashboardData();
          router.replace("/dashboard");
        }
      }, 600);
    }
  }, [userState, router, isPasswordRecoveryMode]);

  // F5: prefetch the /dashboard route chunk once the user reaches the
  // password / OTP screen, so the post-login navigation is instant (the route
  // JS + data are already warmed while they type). Best-effort — dev mode is a
  // no-op and any failure is swallowed.
  useEffect(() => {
    if (showLoginMethods || showPhoneLoginOtp) {
      router.prefetch("/dashboard").catch(() => {});
    }
  }, [showLoginMethods, showPhoneLoginOtp, router]);

  // Handle successful OTP verification for password recovery
  useEffect(() => {
    if (
      isPasswordRecoveryMode &&
      !userState.loading &&
      previousLoadingState &&
      !userState.error
    ) {
      setForgotPasswordDialogOpen(false);
      setIsPasswordRecoveryMode(false);
    }
  }, [
    userState.loading,
    userState.error,
    isPasswordRecoveryMode,
    previousLoadingState,
  ]);

  // Handle loading state changes for animations and ensure loading stops on error
  useEffect(() => {
    if (previousLoadingState && !userState.loading) {
      if (!userState.name && showLoginMethods) {
        const shouldShowErrorAnimation = !(
          (loginMethod === "email" && emailOtpDialogOpen) ||
          (loginMethod === "sms" && smsOtpDialogOpen) ||
          userState.loginOtpRequired
        );

        if (shouldShowErrorAnimation) {
          setShowErrorAnimation(true);
          setTimeout(() => {
            setShowErrorAnimation(false);
          }, 500);
        }

        if (
          userState.error &&
          userState.error.actionType === USER_CONFIRM_CODE
        ) {
          if (isPasswordRecoveryMode) {
            setForgotPasswordOtpError(
              userState.error.message || "OTP verification failed",
            );
          } else if (loginMethod === "email" && emailOtp) {
            setEmailOtpError(
              userState.error.message || "OTP verification failed",
            );
            setEmailOtpTouched(true);
            if (!emailOtpDialogOpen) {
              setEmailOtpDialogOpen(true);
            }
          } else if (loginMethod === "sms" && otp) {
            setOtpError(userState.error.message || "OTP verification failed");
            setOtpTouched(true);
            if (!smsOtpDialogOpen) {
              setSmsOtpDialogOpen(true);
            }
          }
        } else {
          if (loginMethod === "email" && emailOtp) {
            setEmailOtpTouched(false);
            if (!emailOtpDialogOpen) {
              setEmailOtpDialogOpen(true);
            }
          } else if (loginMethod === "sms" && otp) {
            setOtpTouched(false);
            if (!smsOtpDialogOpen) {
              setSmsOtpDialogOpen(true);
            }
          }
        }
      }
    }
    setPreviousLoadingState(userState.loading);
  }, [
    userState.loading,
    userState.name,
    userState.error,
    previousLoadingState,
    showLoginMethods,
    loginMethod,
    emailOtp,
    otp,
    emailOtpDialogOpen,
    smsOtpDialogOpen,
    isPasswordRecoveryMode,
  ]);

  // Ensure loading stops if there's an error (safety check)
  useEffect(() => {
    if (userState.loading) {
      const timeout = setTimeout(() => {
        if (!userState.name) {
          dispatch({ type: USER_API_ERROR });
        }
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [userState.loading, userState.name, dispatch]);

  // Email OTP countdown timer
  useEffect(() => {
    if (emailOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setEmailOtpCountdown(emailOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [emailOtpCountdown]);

  // SMS OTP countdown timer
  useEffect(() => {
    if (smsOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setSmsOtpCountdown(smsOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [smsOtpCountdown]);

  // Login OTP countdown timer
  useEffect(() => {
    if (loginOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setLoginOtpCountdown(loginOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [loginOtpCountdown]);

  // Start countdown when login OTP is required
  useEffect(() => {
    if (userState.loginOtpRequired) {
      setLoginOtpCountdown(60);
    }
  }, [userState.loginOtpRequired]);

  // Phone login OTP countdown timer
  useEffect(() => {
    if (phoneLoginOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setPhoneLoginOtpCountdown(phoneLoginOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [phoneLoginOtpCountdown]);

  // Handle phone check on continue
  const handlePhoneCheck = async () => {
    setPhoneTouched(true);
    const cleaned = phoneInput.replace(/[^0-9]/g, "");
    if (!cleaned || cleaned.length < 10) {
      setPhoneError("mobileInvalid");
      return;
    }
    setPhoneError("");
    setPhoneCheckLoading(true);
    try {
      const response = await axiosBaseApi.get(API_ENDPOINTS.user.checkPhone + cleaned);
      const data = response.data?.data;
      if (data && data.validPhone) {
        setVerifiedPhone(cleaned);
        setShowPhoneLoginOtp(true);
        setPhoneError("");
        // Auto-send OTP
        handleSendPhoneLoginOtp(cleaned);
      } else {
        setPhoneError("phoneNotFound");
      }
    } catch (e: any) {
      setPhoneError("errorCheckingPhone");
      dispatch({
        type: TOAST_SHOW,
        payload: { message: t("errorCheckingPhone"), severity: "error" },
      });
    } finally {
      setPhoneCheckLoading(false);
    }
  };

  // Handle send phone login OTP
  const handleSendPhoneLoginOtp = async (phoneOverride?: string) => {
    const phoneToUse = phoneOverride || verifiedPhone;
    if (phoneLoginOtpCountdown > 0 && !phoneOverride) {
      setPhoneLoginOtpDialogOpen(true);
      return;
    }
    try {
      dispatch(
        UserAction(USER_SEND_OTP, {
          email: null,
          mobile: phoneToUse,
        })
      );
      setPhoneLoginOtpSent(true);
      setPhoneLoginOtpCountdown(30);
      setPhoneLoginOtpDialogOpen(true);
      setPhoneLoginOtpError("");
      setPhoneLoginOtpTouched(false);
    } catch (e: any) {
      dispatch({
        type: TOAST_SHOW,
        payload: { message: e.message || "Failed to send OTP", severity: "error" },
      });
    }
  };

  // Handle phone login OTP verify
  const handlePhoneLoginOtpVerify = (otp: string) => {
    if (userState.loading) return;
    setPhoneLoginOtpError("");
    setPhoneLoginOtpTouched(false);
    if (!otp || otp.trim().length !== 6) {
      setPhoneLoginOtpError("otpInvalid6Digit");
      setPhoneLoginOtpTouched(true);
      return;
    }
    dispatch(
      UserAction(USER_CONFIRM_CODE, {
        mobile: verifiedPhone,
        otp: otp.trim(),
      })
    );
  };

  // Reset phone login
  const handleChangePhone = () => {
    setShowPhoneLoginOtp(false);
    setVerifiedPhone("");
    setPhoneLoginOtpSent(false);
    setPhoneLoginOtpDialogOpen(false);
    setPhoneLoginOtpCountdown(0);
    setPhoneLoginOtpError("");
    setPhoneLoginOtpTouched(false);
  };

  // Handle login mode switch
  const handleLoginModeSwitch = (mode: "email" | "phone") => {
    setLoginMode(mode);
    // Reset all states when switching
    handleChangeEmail();
    handleChangePhone();
    setPhoneInput("");
    setPhoneError("");
    setPhoneTouched(false);
    setEmailInput("");
    setEmailError("");
    setEmailTouched(false);
  };

  // Handle login OTP verify
  const handleLoginOtpVerify = (otp: string) => {
    dispatch(
      UserAction(USER_VERIFY_LOGIN_OTP, {
        login_otp_session: userState.loginOtpSession,
        otp,
        remember: rememberMe,
      })
    );
  };

  // Handle login OTP resend
  const handleLoginOtpResend = () => {
    dispatch(
      UserAction(USER_RESEND_LOGIN_OTP, {
        login_otp_session: userState.loginOtpSession,
      })
    );
    setLoginOtpCountdown(60);
  };

  // Handle login OTP dialog close
  const handleLoginOtpClose = () => {
    dispatch({ type: USER_LOGIN_OTP_RESET });
  };

  // TOTP 2FA step-up (password / code / social login on an account with 2FA on)
  const handle2FAVerify = (code: string) => {
    dispatch(
      UserAction(USER_VERIFY_2FA, {
        challenge_token: userState.login2faChallenge,
        token: code,
        remember: userState.login2faRemember || rememberMe,
      })
    );
  };
  const handle2FAClose = () => {
    dispatch({ type: USER_LOGIN_2FA_RESET });
  };

  // Validate email (only called on button click)
  const validateEmail = async () => {
    if (!emailInput) {
      setEmailError("emailRequired");
      return false;
    }
    try {
      await emailSchema.validate({ email: emailInput });
      setEmailError("");
      return true;
    } catch (err: any) {
      setEmailError(err.message || "emailInvalid");
      return false;
    }
  };

  // Handle email check on continue
  const handleEmailCheck = async () => {
    setEmailTouched(true);
    const isValid = await validateEmail();
    if (!isValid) return;

    setEmailCheckLoading(true);
    try {
      const response = await axiosBaseApi.get(
        API_ENDPOINTS.user.checkEmail + encodeURIComponent(emailInput),
      );

      if (!response || !response.data) {
        setEmailError("errorCheckingEmail");
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("errorCheckingEmail"),
            severity: "error",
          },
        });
        setEmailCheckLoading(false);
        return;
      }

      const data = response.data?.data;

      if (data && typeof data.validEmail === "boolean") {
        if (data.validEmail) {
          setVerifiedEmail(emailInput);
          dispatch({ type: USER_EMAIL_CHECK, payload: data });
          setShowLoginMethods(true);
          setEmailError("");
        } else {
          setEmailError("emailNotFound");
        }
      } else {
        setEmailError("errorCheckingEmail");
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("errorCheckingEmail"),
            severity: "error",
          },
        });
      }
    } catch (e: any) {
      setEmailError("errorCheckingEmail");
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: t("errorCheckingEmail"),
          severity: "error",
        },
      });
    } finally {
      setEmailCheckLoading(false);
    }
  };

  // Handle send email OTP
  const handleSendEmailOtp = async () => {
    if (emailOtpCountdown > 0 && !emailOtpDialogOpen) {
      setEmailOtpDialogOpen(true);
      return;
    }

    if (emailOtpCountdown > 0) {
      setEmailOtpDialogOpen(true);
      return;
    }

    try {
      dispatch(
        UserAction(USER_SEND_OTP, {
          email: verifiedEmail,
          mobile: null,
        }),
      );
      setEmailOtpSent(true);
      setEmailOtpCountdown(30);
      setEmailOtpDialogOpen(true);
      setEmailOtpError("");
      setEmailOtpTouched(false);
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "Failed to send OTP";
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  // Handle OTP verification from dialog
  const handleEmailOtpVerify = (otp: string) => {
    if (userState.loading) {
      return;
    }

    setEmailOtp(otp);
    setEmailOtpError("");
    setEmailOtpTouched(false);

    if (!otp || otp.trim().length !== 6) {
      setEmailOtpError("otpInvalid6Digit");
      setEmailOtpTouched(true);
      return;
    }

    dispatch(
      UserAction(USER_CONFIRM_CODE, {
        email: verifiedEmail,
        otp: otp.trim(),
        remember: rememberMe,
      }),
    );
  };

  // Validate mobile number
  const validateMobile = () => {
    if (!mobile || mobile.trim() === "") {
      setMobileError("mobileRequired");
      return false;
    }
    const cleanedMobile = mobile.replace(/\D/g, "");
    if (cleanedMobile.length < 10) {
      setMobileError("mobileInvalid");
      return false;
    }
    setMobileError("");
    return true;
  };

  // Handle send SMS OTP
  const handleSendSmsOtp = async () => {
    if (smsOtpCountdown > 0 && !smsOtpDialogOpen) {
      setSmsOtpDialogOpen(true);
      return;
    }

    if (smsOtpCountdown > 0) {
      setSmsOtpDialogOpen(true);
      return;
    }

    if (userState.mobile) {
      try {
        dispatch(
          UserAction(USER_SEND_OTP, {
            email: verifiedEmail,
            mobile: userState.mobile,
          }),
        );
        setIsOtpSent(true);
        setSmsOtpCountdown(30);
        setSmsOtpDialogOpen(true);
        setOtpError("");
        setOtpTouched(false);
        setMobileError("");
        setMobileTouched(false);
        return;
      } catch (e: any) {
        const message =
          e.response?.data?.message ?? e.message ?? "Failed to send OTP";
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: message,
            severity: "error",
          },
        });
        return;
      }
    }

    setMobileTouched(true);
    if (!validateMobile()) {
      return;
    }

    try {
      dispatch(
        UserAction(USER_SEND_OTP, {
          email: verifiedEmail,
          mobile: mobile,
        }),
      );
      setIsOtpSent(true);
      setSmsOtpCountdown(30);
      setSmsOtpDialogOpen(true);
      setOtpError("");
      setOtpTouched(false);
      setMobileError("");
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "Failed to send OTP";
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  // Handle SMS OTP verification from dialog
  const handleSmsOtpVerify = (otp: string) => {
    if (userState.loading) {
      return;
    }

    setOtp(otp);
    setOtpError("");
    setOtpTouched(false);

    if (!otp || otp.trim().length !== 6) {
      setOtpError("otpInvalid6Digit");
      setOtpTouched(true);
      return;
    }

    const mobileToUse = mobile || userState.mobile;
    if (!mobileToUse) {
      setMobileError("mobileRequired");
      return;
    }

    dispatch(
      UserAction(USER_CONFIRM_CODE, {
        email: verifiedEmail,
        otp: otp.trim(),
        mobile: mobileToUse,
        remember: rememberMe,
      }),
    );
  };

  // Validate password
  const validatePassword = async () => {
    if (!password) {
      setPasswordError("passwordRequired");
      return false;
    }
    try {
      await passwordSchema.validate({ password });
      setPasswordError("");
      return true;
    } catch (err: any) {
      setPasswordError(err.message || "passwordRequired");
      return false;
    }
  };

  // Handle login submit
  const handleLoginSubmit = async () => {
    if (loginMethod === "password") {
      setPasswordTouched(true);
      const isValid = await validatePassword();
      if (!isValid) {
        return;
      }

      dispatch(UserAction(USER_LOGIN, { email: verifiedEmail, password, remember: rememberMe }));
    } else if (loginMethod === "email") {
      if (!emailOtpSent) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: t("pleaseGetVerificationCodeFirst"),
            severity: "error",
          },
        });
        return;
      }

      if (emailOtpDialogOpen) {
        return;
      }

      if (!emailOtp || emailOtp.trim().length !== 6) {
        setEmailOtpTouched(true);
        setEmailOtpError("otpInvalid6Digit");
        setEmailOtpDialogOpen(true);
        return;
      }

      setEmailOtpError("");
      setEmailOtpTouched(false);

      dispatch(
        UserAction(USER_CONFIRM_CODE, {
          email: verifiedEmail,
          otp: emailOtp.trim(),
        }),
      );
    } else if (loginMethod === "sms") {
      if (!isOtpSent) {
        dispatch({
          type: TOAST_SHOW,
          payload: {
            message: "Please get the verification code first",
            severity: "error",
          },
        });
        return;
      }

      if (smsOtpDialogOpen) {
        return;
      }

      if (!otp || otp.trim().length !== 6) {
        setOtpTouched(true);
        setOtpError("otpInvalid6Digit");
        setSmsOtpDialogOpen(true);
        return;
      }

      setOtpError("");
      setOtpTouched(false);

      const mobileToUse = mobile || userState.mobile;
      if (!mobileToUse) {
        setMobileError("mobileRequired");
        return;
      }

      dispatch(
        UserAction(USER_CONFIRM_CODE, {
          email: verifiedEmail,
          otp: otp.trim(),
          mobile: mobileToUse,
        }),
      );
    }
  };

  // Reset to email input
  const handleChangeEmail = () => {
    setShowLoginMethods(false);
    setVerifiedEmail("");
    setEmailOtpSent(false);
    setEmailOtp("");
    setPassword("");
    setLoginMethod("password"); // Session 82: default to password on return
    setUseCodeMode(false);
    setEmailOtpCountdown(0);
    setPasswordError("");
    setPasswordTouched(false);
    setEmailOtpError("");
    setEmailOtpTouched(false);
    setIsOtpSent(false);
    setMobile("");
    setMobileError("");
    setMobileTouched(false);
    setOtp("");
    setOtpError("");
    setOtpTouched(false);
    setSmsOtpCountdown(0);
    setSmsOtpDialogOpen(false);
  };

  // Handle login method change - clear errors when switching
  const handleLoginMethodChange = (value: string) => {
    setLoginMethod(value);
    setPasswordError("");
    setPasswordTouched(false);
    setEmailOtpError("");
    setEmailOtpTouched(false);
    setOtpError("");
    setOtpTouched(false);
    setMobileError("");
    setMobileTouched(false);
  };

  // Handle Google social login — stays on the SAME page via the Google Identity
  // Services popup token flow (no full-page redirect). The GIS script is loaded
  // async in _document.tsx, so we briefly wait for it to be ready on click.
  const runGoogleTokenFlow = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: "openid email profile",
      callback: async (tokenResponse: any) => {
        if (tokenResponse?.access_token) {
          try {
            const res = await axiosBaseApi.post("user/google-signin", {
              accessToken: tokenResponse.access_token,
            });
            const { data, message } = res?.data || {};
            if (data?.requires_2fa) {
              dispatch({ type: USER_LOGIN_2FA_REQUIRED, payload: { challenge_token: data.challenge_token, remember: rememberMe } });
            } else if (data?.userData && data?.accessToken) {
              dispatch({ type: TOAST_SHOW, payload: { message: message || "Login successful" } });
              dispatch({ type: USER_LOGIN, payload: { ...data.userData, accessToken: data.accessToken, refreshToken: data.refreshToken } });
            } else {
              throw new Error("Invalid response");
            }
          } catch (e: any) {
            const msg = e.response?.data?.message ?? e.message ?? "Google login failed";
            dispatch({ type: TOAST_SHOW, payload: { message: msg, severity: "error" } });
          }
        }
      },
    });
    tokenClient.requestAccessToken();
  };

  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      dispatch({ type: TOAST_SHOW, payload: { message: "Google sign-in is not configured", severity: "error" } });
      return;
    }

    // Wait (up to ~2.5s) for the async GIS script to finish loading, then open
    // the popup. We intentionally do NOT fall back to a full-page redirect so
    // the user always stays on this page.
    const isGisReady = () =>
      typeof window !== "undefined" && !!(window as any).google?.accounts?.oauth2;

    if (isGisReady()) {
      runGoogleTokenFlow();
      return;
    }

    let waited = 0;
    const poll = setInterval(() => {
      waited += 150;
      if (isGisReady()) {
        clearInterval(poll);
        runGoogleTokenFlow();
      } else if (waited >= 2500) {
        clearInterval(poll);
        dispatch({
          type: TOAST_SHOW,
          payload: { message: "Google sign-in is still loading — please try again in a moment.", severity: "error" },
        });
      }
    }, 150);
  };

  // Handle GitHub social login — standard OAuth authorization-code redirect flow.
  // Only reachable when NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true".
  const handleGithubLogin = () => {
    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;
    if (!clientId || typeof window === "undefined") return;
    const state = `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
    try {
      sessionStorage.setItem("gh_oauth_state", state);
    } catch {
      /* sessionStorage unavailable — state check will be skipped on callback */
    }
    const redirectUri = `${window.location.origin}/auth/github/callback`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state,
    });
    window.location.href = `https://github.com/login/oauth/authorize?${params.toString()}`;
  };

  // Forgot password countdown timer
  useEffect(() => {
    if (forgotPasswordOtpCountdown > 0) {
      const timerId = setTimeout(() => {
        setForgotPasswordOtpCountdown(forgotPasswordOtpCountdown - 1);
      }, 1000);
      return () => clearTimeout(timerId);
    }
  }, [forgotPasswordOtpCountdown]);

  const handleForgotPasswordEmailSubmit = async (email: string) => {
    setForgotPasswordEmailError("");
    setForgotPasswordDialogOpen(false);

    try {
      const {
        data: { data },
      } = await axiosBaseApi.get(API_ENDPOINTS.user.checkEmail + encodeURIComponent(email));

      if (data.validEmail) {
        dispatch(
          UserAction(USER_SEND_RESET_LINK, {
            email: email,
          }),
        );
        setForgotPasswordEmailError("");
      } else {
        setForgotPasswordEmailError("emailNotFound");
        setIsPasswordRecoveryMode(false);
      }
    } catch (e: any) {
      const message =
        e.response?.data?.message ?? e.message ?? "An error occurred";
      setForgotPasswordEmailError(message);
      setIsPasswordRecoveryMode(false);
      dispatch({
        type: TOAST_SHOW,
        payload: {
          message: message,
          severity: "error",
        },
      });
    }
  };

  return (
    <AuthPageBackground>
    {/* Google Identity Services — loaded only on this auth page (moved off _document
        so marketing pages don't pay for it). Handlers below poll for readiness. */}
    <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />
    <SplitLayoutWrapper>
      {/* Form Panel (centered) */}
      <FormPanel>
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        {/* Top row: Dynopay logo (all breakpoints) + lang/theme controls */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Image
            src={mounted && theme.palette.mode === "dark" ? WhiteLogo : Logo}
            alt="logo"
            width={isMobile ? 118 : 130}
            height={isMobile ? 40 : 44}
            draggable={false}
            priority
            fetchPriority="high"
            loading="eager"
            unoptimized
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <ThemeToggle size="small" />
          </Box>
        </Box>
        <TitleDescription
          title={t("login")}
          description={t("loginDescription")}
          align="left"
        />

        {/* Login Mode is now toggled via a subtle text link below the input
            (see "Use phone number instead" below). The old E-mail / Phone
            segmented control was removed in the 2025-07 Coinbase-clean pass —
            merchants land in email mode by default (99% of logins) and can
            switch to phone with a single line of text. */}

        {/* ===== PHONE LOGIN PATH ===== */}
        {loginMode === "phone" && !showPhoneLoginOtp ? (
          <>
            <Box sx={{ marginTop: isMobile ? "18px" : "24px" }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: isMobile ? "13px" : "15px",
                    fontFamily: "var(--font-sans)",
                    textAlign: "start",
                    color: theme.palette.text.primary,
                    letterSpacing: 0,
                    lineHeight: "100%",
                  }}
                >
                  {t("phoneNumber")}
                </Typography>
                <CountryPhoneInput
                  fullWidth={true}
                  placeholder={t("mobilePlaceholder")}
                  name="phoneLogin"
                  defaultCountry="US"
                  value={phoneInput}
                  inputHeight={isMobile ? "32px" : "38px"}
                  onChange={(newValue) => {
                    setPhoneInput(newValue);
                    if (phoneError) {
                      setPhoneError("");
                      setPhoneTouched(false);
                    }
                  }}
                />
                {phoneTouched && phoneError && (
                  <Typography
                    sx={{
                      fontSize: "12px",
                      color: "error.main",
                      fontFamily: "var(--font-sans)",
                      textAlign: "start",
                    }}
                  >
                    {phoneError.includes(" ") ? phoneError : t(phoneError) || phoneError}
                  </Typography>
                )}
              </Box>
            </Box>

            {/* Don't have acc */}
            <Box
              sx={{
                display: "flex",
                gap: "7px",
                marginTop: isMobile ? "16px" : "16px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  lineHeight: "1.2",
                  letterSpacing: 0,
                }}
                fontWeight={500}
              >
                {t("dontHaveAccount")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: brandFg(theme.palette.mode === "dark"),
                  fontWeight: 500,
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "var(--font-sans)",
                }}
                onClick={() => router.push("/auth/register")}
              >
                {t("createNewAccount")}
              </Typography>
            </Box>

            <Box sx={{ marginTop: isMobile ? "20px" : "24px" }}>
              <CustomButton
                label={t("continue")}
                variant="primary"
                size="medium"
                fullWidth
                disabled={phoneCheckLoading}
                onClick={handlePhoneCheck}
                hideLabelWhenLoading={true}
                showSuccessAnimation={showSuccessAnimation}
                showErrorAnimation={showErrorAnimation}
                sx={{ fontWeight: 700 }}
                endIcon={phoneCheckLoading ? <LoadingIcon size={20} /> : undefined}
              />
            </Box>

            {/* Subtle mode switch back to email — mirrors the "Use phone
                number instead" link in the email path. */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mt: isMobile ? "14px" : "16px",
              }}
            >
              <Typography
                onClick={() => handleLoginModeSwitch("email")}
                data-testid="switch-to-email-login"
                sx={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  "&:hover": { color: brandFg(theme.palette.mode === "dark") },
                }}
              >
                {t("useEmailInstead", {
                  defaultValue: "Use email instead",
                })}
              </Typography>
            </Box>
          </>
        ) : loginMode === "phone" && showPhoneLoginOtp ? (
          <>
            {/* Verified phone with edit button */}
            <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    fontSize: isMobile ? "13px" : "15px",
                    fontFamily: "var(--font-sans)",
                    textAlign: "start",
                    color: theme.palette.text.primary,
                    letterSpacing: 0,
                    lineHeight: "100%",
                  }}
                >
                  {t("phoneNumber")}
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <InputField
                    type="text"
                    value={"+" + verifiedPhone}
                    readOnly={true}
                    sideButton={true}
                    sideButtonType="primary"
                    sideButtonIcon={EditIcon}
                    sideButtonIconWidth={isMobile ? "12px" : "14px"}
                    sideButtonIconHeight={isMobile ? "12px" : "14px"}
                    onSideButtonClick={handleChangePhone}
                  />
                </Box>
              </Box>
            </Box>

            {/* Session 82: Inline OTP for phone login (was: modal dialog).
                OtpInputPanel auto-sends on `showPhoneLoginOtp` change (see
                handlePhoneCheck → handleSendPhoneLoginOtp), auto-verifies
                on 6 digits, and shows its own resend/verify buttons. */}
            <Box sx={{ marginTop: isMobile ? "16px" : "20px" }}>
              <OtpInputPanel
                contactInfo={"+" + verifiedPhone}
                contactType="phone"
                otpLength={6}
                resendCodeLabel={t("resendCode")}
                resendCodeCountdownLabel={(seconds) => `${t("codeIn")} ${seconds}s`}
                primaryButtonLabel={t("verifyAndLogin")}
                onResendCode={() => {
                  setInlineOtpResetKey((k) => k + 1);
                  handleSendPhoneLoginOtp();
                }}
                onVerify={handlePhoneLoginOtpVerify}
                onClearError={() => {
                  setPhoneLoginOtpError("");
                  setPhoneLoginOtpTouched(false);
                }}
                countdown={phoneLoginOtpCountdown}
                loading={userState.loading}
                error={
                  phoneLoginOtpTouched && phoneLoginOtpError
                    ? phoneLoginOtpError.includes(" ")
                      ? phoneLoginOtpError
                      : t(phoneLoginOtpError)
                    : undefined
                }
                showInfoChip={true}
                showLabel={true}
                showActions={true}
                actionsLayout="row"
                resetKey={inlineOtpResetKey}
              />
            </Box>
          </>
        ) : (
        /* ===== EMAIL LOGIN PATH (existing) ===== */
        <>
        {/* Email Input field - shown initially or when changing email */}
        {!showLoginMethods ? (
          <>
            <Box sx={{ marginTop: isMobile ? "18px" : "24px" }}>
              <InputField
                label={t("email")}
                type="email"
                data-testid="login-email-input"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  if (emailError) {
                    setEmailError("");
                    setEmailTouched(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !emailCheckLoading) {
                    e.preventDefault();
                    handleEmailCheck();
                  }
                }}
                placeholder={t("emailPlaceHolder")}
                error={emailTouched && !!emailError}
                helperText={
                  emailTouched && emailError
                    ? emailError.includes(" ")
                      ? emailError
                      : t(emailError)
                    : ""
                }
              />
            </Box>

            {/* Don't have acc — Forgot-password link was removed from this
                step in the 2025-07 pass; it now only appears on the password
                entry step, matching Coinbase's flow. */}
            <Box
              sx={{
                display: "flex",
                gap: "7px",
                marginTop: isMobile ? "16px" : "16px",
              }}
            >
              <Typography
                sx={{
                  fontSize: "13px",
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  lineHeight: "1.2",
                  letterSpacing: 0,
                }}
                fontWeight={500}
              >
                {t("dontHaveAccount")}
              </Typography>
              <Typography
                sx={{
                  fontSize: "13px",
                  color: brandFg(theme.palette.mode === "dark"),
                  fontWeight: 500,
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "var(--font-sans)",
                }}
                onClick={() => {
                  router.push("/auth/register");
                }}
              >
                {t("createNewAccount")}
              </Typography>
            </Box>

            <Box sx={{ marginTop: isMobile ? "20px" : "24px" }}>
              <CustomButton
                label={t("continue")}
                variant="primary"
                size="medium"
                fullWidth
                disabled={emailCheckLoading}
                onClick={handleEmailCheck}
                hideLabelWhenLoading={true}
                showSuccessAnimation={showSuccessAnimation}
                showErrorAnimation={showErrorAnimation}
                sx={{
                  fontWeight: 700,
                }}
                endIcon={
                  emailCheckLoading ? <LoadingIcon size={20} /> : undefined
                }
              />
            </Box>

            {/* Subtle phone-login switch — was a big Email/Phone segmented
                pill; simplified to a single text link in the 2025-07 pass. */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                mt: isMobile ? "14px" : "16px",
              }}
            >
              <Typography
                onClick={() => handleLoginModeSwitch("phone")}
                data-testid="switch-to-phone-login"
                sx={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: theme.palette.text.secondary,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                  "&:hover": { color: brandFg(theme.palette.mode === "dark") },
                }}
              >
                {t("usePhoneNumberInstead", {
                  defaultValue: "Use phone number instead",
                })}
              </Typography>
            </Box>
          </>
        ) : (
          <>
            {/* Show verified email in InputBox with edit button */}
            <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
              <InputField
                label={t("email")}
                type="email"
                value={verifiedEmail}
                readOnly={true}
                sideButton={true}
                sideButtonType="primary"
                sideButtonIcon={EditIcon}
                sideButtonIconWidth={isMobile ? "12px" : "14px"}
                sideButtonIconHeight={isMobile ? "12px" : "14px"}
                onSideButtonClick={handleChangeEmail}
              />
            </Box>

            {/* ────────────────────────────────────────────────────────────
             *  ADAPTIVE SCREEN 2  (Session 82 — 2026-07-28)
             *
             *  Two variants driven by `useCodeMode`:
             *    - FALSE (default): Password field autofocused, "Sign in"
             *      button, "Use a code instead →" secondary link. This is
             *      the ~90% path for returning users. Password is now the
             *      DEFAULT (was: Email OTP), which is the biggest tap-count
             *      win — one fewer click for every password login.
             *    - TRUE: Password field collapses in place. Inline chip
             *      toggle appears if a mobile is on file (Email code / SMS
             *      ••••XX), then the inline `OtpInputPanel` (auto-submits
             *      on 6th digit — no Continue button needed). "← Back to
             *      password" link returns to Variant A.
             *
             *  No modal dialog opens for the initial sign-in. The step-up
             *  2FA `OtpDialog` (userState.loginOtpRequired) is unchanged.
             *  ─────────────────────────────────────────────────────────── */}
            {!useCodeMode ? (
              <>
                {/* ── PASSWORD MODE (default) ────────────────────────── */}
                <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
                  <InputField
                    label={t("password")}
                    name="password"
                    id="password-inline"
                    autoFocus
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (passwordError) {
                        setPasswordError("");
                        setPasswordTouched(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !userState.loading) {
                        e.preventDefault();
                        setLoginMethod("password");
                        handleLoginSubmit();
                      }
                    }}
                    placeholder={t("passwordPlaceHolder")}
                    error={passwordTouched && !!passwordError}
                    helperText={
                      passwordTouched && passwordError
                        ? passwordError.includes(" ")
                          ? passwordError
                          : t(passwordError)
                        : ""
                    }
                    sideButton={true}
                    sideButtonType="primary"
                    sideButtonIcon={
                      showPassword ? (
                        <VisibilityOffIcon
                          sx={{
                            color: "text.secondary",
                            height: "18px",
                            width: "16px",
                          }}
                        />
                      ) : (
                        <VisibilityIcon
                          sx={{
                            color: "text.secondary",
                            height: "18px",
                            width: "16px",
                          }}
                        />
                      )
                    }
                    sideButtonIconWidth={isMobile ? "14px" : "18px"}
                    sideButtonIconHeight={isMobile ? "14px" : "18px"}
                    onSideButtonClick={() => {
                      setShowPassword(!showPassword);
                    }}
                    showPasswordToggle={true}
                    data-testid="password-input"
                  />
                </Box>

                {/* Keep me signed in + Forgot Password */}
                <Box
                  sx={{
                    mt: 1.5,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <FormControlLabel
                    data-testid="remember-me-toggle"
                    control={
                      <Checkbox
                        size="small"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        sx={{ py: 0, color: theme.palette.text.secondary }}
                      />
                    }
                    label={t("keepMeSignedIn")}
                    sx={{
                      m: 0,
                      "& .MuiFormControlLabel-label": {
                        fontSize: "13px",
                        color: theme.palette.text.secondary,
                        fontFamily: "var(--font-sans)",
                      },
                    }}
                  />
                  <Typography
                    component="span"
                    sx={{
                      fontSize: "13px",
                      color: brandFg(theme.palette.mode === "dark"),
                      fontWeight: 500,
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: "2px",
                      fontFamily: "var(--font-sans)",
                    }}
                    onClick={() => {
                      setForgotPasswordDialogOpen(true);
                    }}
                  >
                    {t("forgotYourPassword")}
                  </Typography>
                </Box>
              </>
            ) : (
              <>
                {/* ── CODE MODE ─────────────────────────────────────── */}
                {/* Chip toggle appears only if a mobile is on file */}
                {userState.mobile && (
                  <Box
                    sx={{
                      display: "flex",
                      marginTop: isMobile ? "16px" : "20px",
                      gap: "8px",
                    }}
                  >
                    <Box
                      onClick={() => {
                        if (loginMethod !== "email") {
                          setLoginMethod("email");
                          setOtpError("");
                          setEmailOtpError("");
                          setInlineOtpResetKey((k) => k + 1);
                          // Auto-send if not already in cooldown
                          if (!emailOtpSent || emailOtpCountdown === 0) {
                            handleSendEmailOtp();
                          }
                        }
                      }}
                      data-testid="channel-chip-email"
                      sx={{
                        flex: 1,
                        textAlign: "center",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid",
                        borderColor:
                          loginMethod === "email"
                            ? brandFg(theme.palette.mode === "dark")
                            : "divider",
                        background:
                          loginMethod === "email"
                            ? (t2: any) =>
                                t2.palette.mode === "dark"
                                  ? "rgba(129,140,248,0.12)"
                                  : "rgba(79,70,229,0.08)"
                            : "transparent",
                        color:
                          loginMethod === "email"
                            ? brandFg(theme.palette.mode === "dark")
                            : "text.secondary",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        fontWeight: loginMethod === "email" ? 600 : 500,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {t("channelEmail")}
                    </Box>
                    <Box
                      onClick={() => {
                        if (loginMethod !== "sms") {
                          setLoginMethod("sms");
                          setOtpError("");
                          setEmailOtpError("");
                          setInlineOtpResetKey((k) => k + 1);
                          if (!isOtpSent || smsOtpCountdown === 0) {
                            handleSendSmsOtp();
                          }
                        }
                      }}
                      data-testid="channel-chip-sms"
                      sx={{
                        flex: 1,
                        textAlign: "center",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid",
                        borderColor:
                          loginMethod === "sms"
                            ? brandFg(theme.palette.mode === "dark")
                            : "divider",
                        background:
                          loginMethod === "sms"
                            ? (t2: any) =>
                                t2.palette.mode === "dark"
                                  ? "rgba(129,140,248,0.12)"
                                  : "rgba(79,70,229,0.08)"
                            : "transparent",
                        color:
                          loginMethod === "sms"
                            ? brandFg(theme.palette.mode === "dark")
                            : "text.secondary",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                        fontSize: "13px",
                        fontWeight: loginMethod === "sms" ? 600 : 500,
                        transition: "all 0.2s ease",
                      }}
                    >
                      {`${t("channelSMS")} ••••${(userState.mobile || "").slice(-4)}`}
                    </Box>
                  </Box>
                )}

                {/* Keep me signed in — code login honours this too, so the
                    choice controls tab/session persistence on every path. */}
                <Box sx={{ marginTop: isMobile ? "12px" : "16px", display: "flex", justifyContent: "flex-start" }}>
                  <FormControlLabel
                    data-testid="remember-me-toggle-code"
                    control={
                      <Checkbox
                        size="small"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        sx={{ py: 0, color: theme.palette.text.secondary }}
                      />
                    }
                    label={t("keepMeSignedIn")}
                    sx={{
                      m: 0,
                      "& .MuiFormControlLabel-label": {
                        fontSize: "13px",
                        color: theme.palette.text.secondary,
                        fontFamily: "var(--font-sans)",
                      },
                    }}
                  />
                </Box>

                {/* Inline OTP block — auto-sends on entering code mode
                    (see handleUseCodeInstead), auto-verifies on 6 digits. */}
                <Box sx={{ marginTop: isMobile ? "16px" : "20px" }}>
                  <OtpInputPanel
                    contactInfo={
                      loginMethod === "sms"
                        ? userState.mobile || ""
                        : verifiedEmail
                    }
                    contactType={loginMethod === "sms" ? "phone" : "email"}
                    otpLength={6}
                    resendCodeLabel={t("resendCode")}
                    resendCodeCountdownLabel={(seconds) =>
                      `${t("codeIn")} ${seconds}s`
                    }
                    primaryButtonLabel={t("verifyAndLogin")}
                    onResendCode={() => {
                      setInlineOtpResetKey((k) => k + 1);
                      if (loginMethod === "sms") {
                        handleSendSmsOtp();
                      } else {
                        handleSendEmailOtp();
                      }
                    }}
                    onVerify={(otpCode) => {
                      if (loginMethod === "sms") {
                        handleSmsOtpVerify(otpCode);
                      } else {
                        handleEmailOtpVerify(otpCode);
                      }
                    }}
                    onClearError={() => {
                      setEmailOtpError("");
                      setEmailOtpTouched(false);
                      setOtpError("");
                      setOtpTouched(false);
                    }}
                    countdown={
                      loginMethod === "sms"
                        ? smsOtpCountdown
                        : emailOtpCountdown
                    }
                    loading={userState.loading}
                    error={
                      loginMethod === "sms"
                        ? otpTouched && otpError
                          ? otpError.includes(" ")
                            ? otpError
                            : t(otpError)
                          : undefined
                        : emailOtpTouched && emailOtpError
                        ? emailOtpError.includes(" ")
                          ? emailOtpError
                          : t(emailOtpError)
                        : undefined
                    }
                    showInfoChip={true}
                    showLabel={true}
                    showActions={true}
                    actionsLayout="row"
                    resetKey={inlineOtpResetKey}
                  />
                </Box>

                {/* Back-to-password link */}
                <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-start" }}>
                  <Typography
                    component="span"
                    data-testid="back-to-password-link"
                    sx={{
                      fontSize: "13px",
                      color: theme.palette.text.secondary,
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "var(--font-sans)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      "&:hover": { color: brandFg(theme.palette.mode === "dark") },
                    }}
                    onClick={() => {
                      setUseCodeMode(false);
                      setLoginMethod("password");
                      setEmailOtpError("");
                      setOtpError("");
                    }}
                  >
                    ← {t("backToPassword")}
                  </Typography>
                </Box>
              </>
            )}

            {/* Continue / Sign-in button — password mode only (code mode
                uses the inline OtpInputPanel's own Verify button). */}
            {!useCodeMode && (
              <Box sx={{ marginTop: "24px" }}>
                <CustomButton
                  label={t("signIn")}
                  variant="primary"
                  size="medium"
                  fullWidth
                  disabled={userState.loading}
                  onClick={() => {
                    setLoginMethod("password");
                    handleLoginSubmit();
                  }}
                  hideLabelWhenLoading={true}
                  showSuccessAnimation={showSuccessAnimation}
                  showErrorAnimation={showErrorAnimation}
                  sx={{ fontWeight: 700 }}
                  endIcon={
                    userState.loading ? <LoadingIcon size={20} /> : undefined
                  }
                  data-testid="signin-submit-btn"
                />
              </Box>
            )}

            {/* "Use a code instead" secondary link (password mode only) */}
            {!useCodeMode && (
              <Box sx={{ mt: 1.75, display: "flex", justifyContent: "center" }}>
                <Typography
                  component="span"
                  data-testid="use-a-code-link"
                  sx={{
                    fontSize: "13px",
                    color: theme.palette.text.secondary,
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                    "&:hover": {
                      color: brandFg(theme.palette.mode === "dark"),
                      textDecoration: "underline",
                    },
                  }}
                  onClick={() => {
                    setUseCodeMode(true);
                    // If SMS isn't available, force email
                    if (!userState.mobile) setLoginMethod("email");
                    else if (loginMethod !== "sms") setLoginMethod("email");
                    setInlineOtpResetKey((k) => k + 1);
                    // Auto-send code on entering code mode (respects cooldown)
                    setTimeout(() => {
                      if (loginMethod === "sms" && userState.mobile) {
                        if (!isOtpSent || smsOtpCountdown === 0) {
                          handleSendSmsOtp();
                        }
                      } else {
                        if (!emailOtpSent || emailOtpCountdown === 0) {
                          handleSendEmailOtp();
                        }
                      }
                    }, 0);
                  }}
                >
                  {t("useACodeInstead")} →
                </Typography>
              </Box>
            )}
          </>
        )}
        </>
        )}

        {/* NOTE (Session 82, 2026-07-28): Phone-login OTP dialog removed.
            Inline OtpInputPanel above replaces the modal for the initial
            sign-in flow. The step-up 2FA dialog (loginOtpRequired) below
            is kept — it's genuinely a blocking prompt on top of an
            already-authenticated context. */}

        {/* Social Login Section — hidden when NEXT_PUBLIC_ENABLE_GOOGLE_AUTH !== "true"
            AND NEXT_PUBLIC_ENABLE_GITHUB_AUTH !== "true". Wraps both the "or" divider
            AND the social buttons so we don't leave a useless divider dangling. */}
        {(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" ||
          process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true") && (
          <>
            <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
              <Divider
                sx={{
                  borderColor: "red",
                  "&::before, &::after": {
                    borderColor: "divider",
                  },
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    fontFamily: "var(--font-sans)",
                    color: theme.palette.text.secondary,
                    padding: "0 24px",
                    fontSize: isMobile ? "10px" : "15px",
                    fontWeight: 500,
                    lineHeight: "1.2",
                    letterSpacing: 0,
                  }}
                >
                  {t("or")}
                </Typography>
              </Divider>
            </Box>

            <Box sx={{ marginTop: isMobile ? "16px" : "24px" }}>
              <SocialAuthButtons
                googleLabel={t("continueWithGoogle")}
                onGoogle={handleGoogleLogin}
                showGoogle={process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true"}
                showGithub={process.env.NEXT_PUBLIC_ENABLE_GITHUB_AUTH === "true"}
                onGithub={handleGithubLogin}
                githubLabel={t("continueWithGithub")}
                githubAriaLabel={t("continueWithGithub")}
                googleTestId="google-login-btn"
                githubTestId="github-login-btn"
              />
            </Box>
          </>
        )}

      </Box>
      </FormPanel>
      {/* Slim social-proof strip below the card (Coinbase-clean substitute
          for the removed side marketing panel). */}
      <TrustStrip />
    </SplitLayoutWrapper>

      {/* NOTE (Session 82): Email + SMS OTP modal dialogs removed from the
          initial sign-in flow. Inline OtpInputPanel above replaces both.
          The step-up 2FA dialog (loginOtpRequired) below is kept — see
          note further up. */}

      {/* Login OTP Dialog - shown after password validation */}
      <OtpDialog
        open={!!userState.loginOtpRequired}
        onClose={handleLoginOtpClose}
        title={t("loginVerification")}
        subtitle={t("loginOtpSubtitle")}
        contactInfo={userState.loginOtpMaskedEmail}
        contactType="email"
        resendCodeLabel={t("resendCode")}
        resendCodeCountdownLabel={(seconds) => `${t("codeIn")} ${seconds}s`}
        primaryButtonLabel={t("verifyAndLogin")}
        onResendCode={handleLoginOtpResend}
        onVerify={handleLoginOtpVerify}
        onClearError={() => {}}
        countdown={loginOtpCountdown}
        loading={userState.loginOtpLoading || userState.loading}
        preventClose={false}
        error={
          userState.error && userState.error.actionType === USER_VERIFY_LOGIN_OTP
            ? userState.error.message
            : undefined
        }
      />

      {/* TOTP 2FA step-up — shown when the first factor succeeded on an account with 2FA enabled */}
      <TwoFactorLoginDialog
        open={!!userState.login2faRequired}
        loading={!!userState.login2faLoading}
        error={
          userState.error && userState.error.actionType === USER_VERIFY_2FA
            ? userState.error.message
            : undefined
        }
        onVerify={handle2FAVerify}
        onClose={handle2FAClose}
      />

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        open={forgotPasswordDialogOpen}
        onClose={() => {
          setForgotPasswordDialogOpen(false);
          setForgotPasswordEmailError("");
          setForgotPasswordOtpCountdown(0);
          setForgotPasswordOtpError("");
          setIsPasswordRecoveryMode(false);
        }}
        currentEmail={verifiedEmail}
      />
    </AuthPageBackground>
  );
}
