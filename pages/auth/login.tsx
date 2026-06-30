import EditIcon from "@/assets/Icons/editicon.png";
import LoadingIcon from "@/assets/Icons/LoadingIcon";
import ArrowUpwardIcon from "@/assets/Icons/up-arrow-icon.png";
import Logo from "@/assets/Images/auth/dynopay-logo.png";
import WhiteLogo from "@/assets/Images/auth/dynopay-white-logo.png";
import GoogleIcon from "@/assets/Images/googleIcon.svg";
import axiosBaseApi from "@/axiosConfig";
import InputField from "@/Components/UI/AuthLayout/InputFields";
import TitleDescription from "@/Components/UI/AuthLayout/TitleDescription";
import CustomButton from "@/Components/UI/Buttons";
import CountryPhoneInput from "@/Components/UI/CountryPhoneInput";
import ForgotPasswordDialog from "@/Components/UI/ForgotPasswordDialog";
import LanguageSwitcher from "@/Components/UI/LanguageSwitcher";
import ThemeToggle from "@/Components/UI/ThemeToggle";
import OtpDialog from "@/Components/UI/OtpDialog";
import CustomRadio from "@/Components/UI/RadioGroup";
import AuthBrandPanel from "@/Components/UI/AuthLayout/AuthBrandPanel";
import {
  AuthContainer,
  AuthPageBackground,
  SplitLayoutWrapper,
  FormPanel,
  CardWrapper,
  ImageCenter,
} from "@/Containers/Login/styled";
import useIsMobile from "@/hooks/useIsMobile";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
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
  UserAction,
} from "@/Redux/Actions/UserAction";
import { rootReducer } from "@/utils/types";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import {
  Box,
  Divider,
  FormControlLabel,
  RadioGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { signIn } from "next-auth/react";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import * as yup from "yup";

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

  // Email check state
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [showLoginMethods, setShowLoginMethods] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [emailCheckLoading, setEmailCheckLoading] = useState(false);

  // Login method state
  const [loginMethod, setLoginMethod] = useState("email");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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

  // Navigate to home if user is logged in (but not in password recovery mode)
  useEffect(() => {
    if (userState.name && !isPasswordRecoveryMode) {
      setShowSuccessAnimation(true);
      setEmailOtpDialogOpen(false);
      // Reset login OTP state on successful login
      if (userState.loginOtpRequired) {
        dispatch({ type: USER_LOGIN_OTP_RESET });
      }
      setTimeout(() => {
        router.replace("/dashboard");
      }, 600);
    }
  }, [userState, router, isPasswordRecoveryMode]);

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
      const response = await axiosBaseApi.get("/user/checkPhone?phone=" + cleaned);
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
        payload: { message: t("errorCheckingPhone") || "Error checking phone number", severity: "error" },
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
        "/user/checkEmail?email=" + emailInput,
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

      dispatch(UserAction(USER_LOGIN, { email: verifiedEmail, password }));
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
    setLoginMethod("email");
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

  // Handle Google social login
  // Uses client-side Google Sign-In to avoid NextAuth /api/auth/* route conflicts
  // with K8s ingress. Falls back to NextAuth if client-side fails.
  const handleGoogleLogin = async () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      // Fallback to NextAuth
      signIn("google", { callbackUrl: "/auth/validateSocialLogin" });
      return;
    }

    try {
      // Try loading Google Identity Services
      if (typeof window !== "undefined" && (window as any).google?.accounts?.oauth2) {
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
                if (data?.userData && data?.accessToken) {
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
      } else {
        // Google Identity Services not loaded, fallback to NextAuth
        signIn("google", { callbackUrl: "/auth/validateSocialLogin" });
      }
    } catch {
      // Fallback to NextAuth
      signIn("google", { callbackUrl: "/auth/validateSocialLogin" });
    }
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
      } = await axiosBaseApi.get("/user/checkEmail?email=" + email);

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
    <SplitLayoutWrapper>
      {/* Left: Brand Panel */}
      <AuthBrandPanel />

      {/* Right: Form Panel */}
      <FormPanel>
      <Box sx={{ width: "100%", maxWidth: 420 }}>
        {/* Mobile-only: Logo + controls (hidden on desktop since brand panel shows logo) */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Image
            src={mounted && theme.palette.mode === "dark" ? WhiteLogo : Logo}
            alt="logo"
            width={isMobile ? 120 : 114}
            height={isMobile ? 41 : 39}
            draggable={false}
            onClick={() => router.push("/")}
            style={{ cursor: "pointer" }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <LanguageSwitcher />
            <ThemeToggle size="small" />
          </Box>
        </Box>

        {/* Desktop-only: settings row */}
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            justifyContent: "flex-end",
            alignItems: "center",
            mb: 2,
            gap: 0.5,
          }}
        >
          <LanguageSwitcher />
          <ThemeToggle size="small" />
        </Box>
        <TitleDescription
          title={t("login")}
          description={t("loginDescription")}
          align="left"
        />

        {/* Login Mode Toggle: Email / Phone */}
        {!showLoginMethods && !showPhoneLoginOtp && (
          <Box
            sx={{
              display: "flex",
              marginTop: isMobile ? "16px" : "20px",
              borderRadius: "10px",
              overflow: "hidden",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: (t: any) => t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
            }}
          >
            <Box
              onClick={() => handleLoginModeSwitch("email")}
              sx={{
                flex: 1,
                textAlign: "center",
                padding: isMobile ? "10px 0" : "10px 0",
                cursor: "pointer",
                fontFamily: "UrbanistMedium",
                fontSize: isMobile ? "14px" : "14px",
                fontWeight: loginMode === "email" ? 600 : 500,
                color: loginMode === "email" ? "#fff" : "text.secondary",
                backgroundColor: loginMode === "email" ? "primary.main" : "transparent",
                borderRadius: "9px",
                transition: "all 0.2s ease",
              }}
            >
              {t("email") || "Email"}
            </Box>
            <Box
              onClick={() => handleLoginModeSwitch("phone")}
              sx={{
                flex: 1,
                textAlign: "center",
                padding: isMobile ? "10px 0" : "10px 0",
                cursor: "pointer",
                fontFamily: "UrbanistMedium",
                fontSize: isMobile ? "14px" : "14px",
                fontWeight: loginMode === "phone" ? 600 : 500,
                color: loginMode === "phone" ? "#fff" : "text.secondary",
                backgroundColor: loginMode === "phone" ? "primary.main" : "transparent",
                borderRadius: "9px",
                transition: "all 0.2s ease",
              }}
            >
              {t("phoneNumber") || "Phone Number"}
            </Box>
          </Box>
        )}

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
                    fontFamily: "UrbanistMedium",
                    textAlign: "start",
                    color: theme.palette.text.primary,
                    letterSpacing: 0,
                    lineHeight: "100%",
                  }}
                >
                  {t("phoneNumber") || "Phone Number"}
                </Typography>
                <CountryPhoneInput
                  fullWidth={true}
                  placeholder={t("mobilePlaceholder") || "Enter phone number"}
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
                      fontFamily: "UrbanistMedium",
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
                  fontFamily: "UrbanistMedium",
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
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontFamily: "UrbanistMedium",
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
                    fontFamily: "UrbanistMedium",
                    textAlign: "start",
                    color: theme.palette.text.primary,
                    letterSpacing: 0,
                    lineHeight: "100%",
                  }}
                >
                  {t("phoneNumber") || "Phone Number"}
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

            <Box sx={{ marginTop: "16px" }}>
              <Typography
                sx={{
                  textAlign: "start",
                  fontSize: isMobile ? "13px" : "15px",
                  fontFamily: "UrbanistMedium",
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  color: "text.secondary",
                }}
              >
                {t("otpSentToPhone") || "Enter the OTP sent to your phone number"}
              </Typography>
            </Box>

            {/* Resend OTP button */}
            <Box sx={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
              <CustomButton
                variant="secondary"
                size="small"
                disabled={phoneLoginOtpCountdown > 0 || userState.loading}
                label={
                  phoneLoginOtpCountdown > 0
                    ? `${t("codeIn") || "Code in"} ${phoneLoginOtpCountdown}s`
                    : t("resendCode") || "Resend Code"
                }
                onClick={() => handleSendPhoneLoginOtp()}
                sx={{ fontWeight: 500, padding: "8px 20px" }}
              />
            </Box>

            <Box sx={{ marginTop: "16px" }}>
              <CustomButton
                label={t("continue")}
                variant="primary"
                size="medium"
                fullWidth
                disabled={userState.loading}
                onClick={() => {
                  if (!phoneLoginOtpSent) {
                    dispatch({
                      type: TOAST_SHOW,
                      payload: { message: "Please wait for OTP to be sent", severity: "error" },
                    });
                    return;
                  }
                  setPhoneLoginOtpDialogOpen(true);
                }}
                hideLabelWhenLoading={true}
                showSuccessAnimation={showSuccessAnimation}
                showErrorAnimation={showErrorAnimation}
                sx={{ fontWeight: 700 }}
                endIcon={userState.loading ? <LoadingIcon size={20} /> : undefined}
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

            {/* Don't have acc */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: isMobile ? "16px" : "16px",
              }}
            >
              <Box sx={{ display: "flex", gap: "7px" }}>
                <Typography
                  sx={{
                    fontSize: "13px",
                    color: theme.palette.text.secondary,
                    fontFamily: "UrbanistMedium",
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
                    color: theme.palette.primary.main,
                    fontWeight: 500,
                    lineHeight: "1.2",
                    letterSpacing: 0,
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontFamily: "UrbanistMedium",
                  }}
                  onClick={() => {
                    router.push("/auth/register");
                  }}
                >
                  {t("createNewAccount")}
                </Typography>
              </Box>
              <Typography
                component="span"
                sx={{
                  fontSize: "13px",
                  color: theme.palette.primary.main,
                  fontWeight: 500,
                  cursor: "pointer",
                  textDecoration: "underline",
                  textUnderlineOffset: "2px",
                  fontFamily: "UrbanistMedium",
                  lineHeight: "1.2",
                }}
                onClick={() => {
                  setForgotPasswordDialogOpen(true);
                }}
              >
                {t("forgotYourPassword")}
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

            <Box sx={{ marginTop: isMobile ? "12px" : "24px" }}>
              <Typography
                sx={{
                  textAlign: "start",
                  fontSize: isMobile ? "13px" : "15px",
                  fontFamily: "UrbanistMedium",
                  lineHeight: "1.2",
                  letterSpacing: 0,
                  color: "text.secondary",
                }}
              >
                {t("chooseLoginMethod")}
              </Typography>

              {/* Login Method Selection */}
              <Box sx={{ marginTop: "16px" }}>
                <RadioGroup
                  value={loginMethod}
                  onChange={(e) => handleLoginMethodChange(e.target.value)}
                  sx={{
                    "& .MuiFormControlLabel-label": {
                      fontSize: isMobile ? "13px" : "15px",
                      fontFamily: "UrbanistMedium",
                      color: "text.primary",
                      paddingLeft: "8px",
                    },
                  }}
                >
                  {/* SMS Option - only show if user has a registered mobile number */}
                  {userState.mobile && (
                  <>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                    }}
                  >
                    <FormControlLabel
                      value="sms"
                      control={<CustomRadio />}
                      label={t("sendVerificationCodeViaSms")}
                      sx={{ margin: "0px", flex: 1, textAlign: "start" }}
                    />

                    {/* Get Code Button - Desktop */}
                    {loginMethod === "sms" && !isMobile && !isOtpSent && (
                      <CustomButton
                        variant="secondary"
                        size="medium"
                        label={t("getCode")}
                        onClick={handleSendSmsOtp}
                        disabled={userState.loading}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 22.5px",
                        }}
                        endIcon={ArrowUpwardIcon}
                      />
                    )}

                    {/* Resend Code Button - Desktop */}
                    {loginMethod === "sms" && !isMobile && isOtpSent && (
                      <CustomButton
                        variant="secondary"
                        disabled={smsOtpCountdown > 0 || userState.loading}
                        size="medium"
                        label={
                          smsOtpCountdown > 0
                            ? `${t("codeIn")} ${smsOtpCountdown}s`
                            : t("resendCode")
                        }
                        onClick={handleSendSmsOtp}
                        endIcon={
                          smsOtpCountdown > 0 || userState.loading
                            ? undefined
                            : ArrowUpwardIcon
                        }
                        sx={{
                          fontWeight: 500,
                          padding: "11px 20px",
                        }}
                      />
                    )}
                  </Box>

                  {/* Show mobile number if available from userState */}
                  {loginMethod === "sms" && userState.mobile && (
                    <Box sx={{ marginLeft: "32px" }}>
                      <Typography
                        sx={{
                          textAlign: "start",
                          fontSize: "12px",
                          color: "text.secondary",
                          fontFamily: "UrbanistMedium",
                        }}
                      >
                        {t("codeWillBeSentTo")}
                        {userState.mobile.substring(7)}
                      </Typography>
                    </Box>
                  )}

                  {/* Get Code Button - Mobile (when mobile is in userState) */}
                  {loginMethod === "sms" &&
                    isMobile &&
                    !isOtpSent &&
                    userState.mobile && (
                      <Box sx={{ marginTop: "8px" }}>
                        <CustomButton
                          variant="secondary"
                          size="small"
                          label={t("getCode")}
                          fullWidth
                          disabled={userState.loading}
                          onClick={handleSendSmsOtp}
                          sx={{
                            fontWeight: 500,
                            padding: "8px 22.5px",
                          }}
                          endIcon={ArrowUpwardIcon}
                        />
                      </Box>
                    )}

                  {/* Resend Code Button - Mobile */}
                  {loginMethod === "sms" && isMobile && isOtpSent && (
                    <Box sx={{ marginTop: "8px" }}>
                      <CustomButton
                        variant="secondary"
                        disabled={smsOtpCountdown > 0 || userState.loading}
                        size="small"
                        label={
                          smsOtpCountdown > 0
                            ? `${t("codeIn")} ${smsOtpCountdown}s`
                            : t("resendCode")
                        }
                        fullWidth
                        onClick={handleSendSmsOtp}
                        endIcon={
                          smsOtpCountdown > 0 || userState.loading
                            ? undefined
                            : ArrowUpwardIcon
                        }
                        sx={{
                          height: "32px",
                          fontSize: "13px",
                          fontWeight: 500,
                          padding: "8px 20px",
                        }}
                      />
                    </Box>
                  )}
                  </>
                  )}

                  {/* Email Option */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      width: "100%",
                      marginTop: "16px",
                    }}
                  >
                    <FormControlLabel
                      value="email"
                      control={<CustomRadio />}
                      label={t("sendVerificationCodeViaEmail")}
                      sx={{
                        margin: "0px",
                        color: "text.primary",
                        textAlign: "start",
                        flex: 1,
                      }}
                    />
                    {/* Get Code Button */}
                    {loginMethod === "email" && !isMobile && !emailOtpSent && (
                      <CustomButton
                        variant="secondary"
                        size="medium"
                        label={t("getCode")}
                        onClick={handleSendEmailOtp}
                        disabled={userState.loading}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 22.5px",
                        }}
                        endIcon={ArrowUpwardIcon}
                      />
                    )}

                    {/* Resend Code Button */}
                    {loginMethod === "email" && !isMobile && emailOtpSent && (
                      <CustomButton
                        variant="secondary"
                        disabled={
                          (emailOtpDialogOpen && emailOtpCountdown > 0) ||
                          userState.loading
                        }
                        size="medium"
                        label={
                          emailOtpCountdown > 0
                            ? `${t("codeIn")} ${emailOtpCountdown}s`
                            : t("resendCode")
                        }
                        onClick={handleSendEmailOtp}
                        endIcon={
                          emailOtpCountdown > 0 && emailOtpDialogOpen
                            ? undefined
                            : ArrowUpwardIcon
                        }
                        sx={{
                          fontWeight: 500,
                          padding: "11px 20px",
                        }}
                      />
                    )}
                  </Box>

                  {/* Get Code Button - Mobile */}
                  {loginMethod === "email" && isMobile && !emailOtpSent && (
                    <Box sx={{ marginTop: "10px" }}>
                      <CustomButton
                        variant="secondary"
                        size="small"
                        label={t("getCode")}
                        fullWidth
                        disabled={userState.loading}
                        onClick={handleSendEmailOtp}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 22.5px",
                        }}
                        endIcon={ArrowUpwardIcon}
                      />
                    </Box>
                  )}

                  {/* Resend Code Button - Mobile */}
                  {loginMethod === "email" && isMobile && emailOtpSent && (
                    <Box sx={{ marginTop: "16px" }}>
                      <CustomButton
                        variant="secondary"
                        size="small"
                        label={
                          emailOtpCountdown > 0
                            ? `${t("codeIn")} ${emailOtpCountdown}s`
                            : t("resendCode")
                        }
                        fullWidth
                        disabled={emailOtpCountdown > 0}
                        endIcon={
                          emailOtpCountdown > 0 ? undefined : ArrowUpwardIcon
                        }
                        onClick={handleSendEmailOtp}
                        sx={{
                          fontWeight: 500,
                          padding: "8px 20px",
                        }}
                      />
                    </Box>
                  )}

                  {/* Password Option */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      margin: "16px 0 0 0",
                    }}
                  >
                    <FormControlLabel
                      value="password"
                      control={<CustomRadio />}
                      label={t("password")}
                      sx={{ margin: "0px", color: "text.primary" }}
                      onClick={() => {
                        setLoginMethod("password");
                        setTimeout(() => {
                          const input = document.getElementById("password");
                          input?.focus();
                        }, 0);
                      }}
                    />
                  </Box>
                  {/* Password Input Field */}
                  {loginMethod === "password" && (
                    <Box sx={{ marginTop: "10px" }}>
                      <InputField
                        name="password"
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
                            handleLoginSubmit();
                          }
                        }}
                        placeholder={t("passwordPlaceHolder")}
                        error={
                          loginMethod === "password" &&
                          passwordTouched &&
                          !!passwordError
                        }
                        helperText={
                          loginMethod === "password" &&
                          passwordTouched &&
                          passwordError
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
                      />
                    </Box>
                  )}
                </RadioGroup>
              </Box>

              {/* Forgot Password — always visible */}
              <Box sx={{ mt: 1, textAlign: "start" }}>
                <Typography
                  component="span"
                  sx={{
                    fontSize: "13px",
                    color: theme.palette.primary.main,
                    fontWeight: 500,
                    cursor: "pointer",
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                    fontFamily: "UrbanistMedium",
                  }}
                  onClick={() => {
                    setForgotPasswordDialogOpen(true);
                  }}
                >
                  {t("forgotYourPassword")}
                </Typography>
              </Box>
            </Box>

            {/* Continue Button - shown when login methods are visible */}
            <Box sx={{ marginTop: "24px" }}>
              <CustomButton
                label={t("continue")}
                variant="primary"
                size="medium"
                fullWidth
                disabled={
                  userState.loading &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  )
                }
                onClick={() => {
                  handleLoginSubmit();
                }}
                hideLabelWhenLoading={true}
                showSuccessAnimation={
                  showSuccessAnimation &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  )
                }
                showErrorAnimation={
                  showErrorAnimation &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  )
                }
                sx={{
                  fontWeight: 700,
                }}
                endIcon={
                  userState.loading &&
                  !(
                    (loginMethod === "email" && emailOtpDialogOpen) ||
                    (loginMethod === "sms" && smsOtpDialogOpen)
                  ) ? (
                    <LoadingIcon size={20} />
                  ) : undefined
                }
              />
            </Box>
          </>
        )}
        </>
        )}

        {/* Phone Login OTP Dialog */}
        {loginMode === "phone" && (
          <OtpDialog
            open={phoneLoginOtpDialogOpen}
            onClose={() => setPhoneLoginOtpDialogOpen(false)}
            title={t("smsVerification") || "SMS Verification"}
            subtitle={t("otpSentToPhone") || "Enter the verification code sent to your phone number"}
            contactInfo={"+" + verifiedPhone}
            contactType="phone"
            resendCodeLabel={t("resendCode") || "Resend Code"}
            resendCodeCountdownLabel={(seconds) => `${t("codeIn") || "Code in"} ${seconds}s`}
            primaryButtonLabel={t("verifyAndLogin") || "Verify & log in"}
            onResendCode={() => handleSendPhoneLoginOtp()}
            onVerify={handlePhoneLoginOtpVerify}
            onClearError={() => {
              setPhoneLoginOtpError("");
              setPhoneLoginOtpTouched(false);
            }}
            countdown={phoneLoginOtpCountdown}
            loading={userState.loading}
            preventClose={false}
            error={
              phoneLoginOtpTouched && phoneLoginOtpError
                ? phoneLoginOtpError.includes(" ")
                  ? phoneLoginOtpError
                  : t(phoneLoginOtpError)
                : undefined
            }
          />
        )}

        {/* Social Login Section - shown only when login methods are visible */}

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
                fontFamily: "UrbanistMedium",
                color: "#676768",
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

        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "16px",
            padding: 0,
            marginTop: isMobile ? "16px" : "24px",
          }}
        >
          <Typography
            variant="body2"
            sx={{
              fontSize: isMobile ? "13px" : "15px",
              fontFamily: "UrbanistMedium",
              color: "#676768",
              fontWeight: 500,
              lineHeight: "1.2",
              letterSpacing: 0,
            }}
          >
            {t("registerLogin")}
          </Typography>

          <Box
            sx={{
              height: isMobile ? "32px" : "40px",
              width: isMobile ? "32px" : "40px",
              borderRadius: "100%",
              border: "1px solid",
              borderColor: "divider",
              backgroundColor: "action.hover",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s ease",
              "&:hover": {
                backgroundColor: "action.selected",
                borderColor: "#D0D5DD",
              },
            }}
            onClick={handleGoogleLogin}
          >
            <ImageCenter>
              <Image
                src={GoogleIcon}
                alt="google login"
                width={24}
                height={24}
                draggable={false}
              />
            </ImageCenter>
          </Box>
        </Box>

      </Box>
      </FormPanel>
    </SplitLayoutWrapper>

      {/* Email OTP Dialog */}
      {loginMethod === "email" && (
        <OtpDialog
          open={emailOtpDialogOpen}
          onClose={() => {
            setEmailOtpDialogOpen(false);
          }}
          title={t("emailVerification")}
          subtitle={t("emailVerificationSubtitle")}
          contactInfo={emailInput}
          contactType="email"
          resendCodeLabel={t("resendCode")}
          resendCodeCountdownLabel={(seconds) => `${t("codeIn")} ${seconds}s`}
          primaryButtonLabel={t("verifyAndLogin") || "Verify & log in"}
          onResendCode={handleSendEmailOtp}
          onVerify={handleEmailOtpVerify}
          onClearError={() => {
            setEmailOtpError("");
            setEmailOtpTouched(false);
          }}
          countdown={emailOtpCountdown}
          loading={userState.loading}
          preventClose={false}
          error={
            emailOtpTouched && emailOtpError
              ? emailOtpError.includes(" ")
                ? emailOtpError
                : t(emailOtpError)
              : undefined
          }
        />
      )}

      {/* SMS OTP Dialog */}
      {loginMethod === "sms" && (
        <OtpDialog
          open={smsOtpDialogOpen}
          onClose={() => {
            setSmsOtpDialogOpen(false);
          }}
          title={t("smsVerification") || "SMS Verification"}
          subtitle={
            t("smsVerificationSubtitle") ||
            "Enter the verification code sent to your mobile number"
          }
          contactInfo={userState.mobile || mobile}
          contactType="phone"
          resendCodeLabel={t("resendCode")}
          resendCodeCountdownLabel={(seconds) => `${t("codeIn")} ${seconds}s`}
          primaryButtonLabel={t("verifyAndLogin") || "Verify & log in"}
          onResendCode={handleSendSmsOtp}
          onVerify={handleSmsOtpVerify}
          onClearError={() => {
            setOtpError("");
            setOtpTouched(false);
          }}
          countdown={smsOtpCountdown}
          loading={userState.loading}
          preventClose={false}
          error={
            otpTouched && otpError
              ? otpError.includes(" ")
                ? otpError
                : t(otpError)
              : undefined
          }
        />
      )}

      {/* Login OTP Dialog - shown after password validation */}
      <OtpDialog
        open={userState.loginOtpRequired}
        onClose={handleLoginOtpClose}
        title={t("loginVerification") || "Login Verification"}
        subtitle={t("loginOtpSubtitle") || "Enter the verification code sent to your email to complete login"}
        contactInfo={userState.loginOtpMaskedEmail}
        contactType="email"
        resendCodeLabel={t("resendCode") || "Resend Code"}
        resendCodeCountdownLabel={(seconds) => `${t("codeIn") || "Code in"} ${seconds}s`}
        primaryButtonLabel={t("verifyAndLogin") || "Verify & log in"}
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
