import { ReducerAction } from "@/utils/types";
import {
  USER_API_ERROR,
  USER_EMAIL_CHECK,
  USER_INIT,
  USER_LOGIN,
  USER_PROFILE_FETCH,
  USER_REGISTER,
  USER_RESET_PASSWORD,
  USER_SEND_OTP,
  USER_SEND_RESET_LINK,
  USER_UPDATE,
  USER_EMAIL_VERIFIED,
  USER_VERIFY_EMAIL,
  USER_RESEND_VERIFICATION,
  USER_LOGIN_OTP_REQUIRED,
  USER_LOGIN_OTP_RESET,
  USER_VERIFY_LOGIN_OTP,
  USER_RESEND_LOGIN_OTP,
} from "../Actions/UserAction";
import { applyPersistence } from "@/helpers/authPersistence";
import { syncAttribution } from "@/utils/attribution";

// Fire the first-touch signup-attribution beacon the INSTANT an auth token is
// stored — for EVERY flow (email login, register, Google sign-in). Previously
// this only ran on a later route change, so signups that didn't navigate again
// (e.g. landed on a "verify your email" screen) never synced → ~76% of signups
// had no attribution row. Deferred + fire-and-forget + idempotent server-side
// (first write wins), so calling it on every auth event is safe.
const fireAttribution = (): void => {
  try {
    setTimeout(() => syncAttribution(), 0);
  } catch {
    /* attribution must never break auth */
  }
};

const userInitialState = {
  email: "",
  name: "",
  mobile: "",
  loading: false,
  error: null as { message: string; actionType: string } | null,
  profile: null as any,
  profileLoading: false,
  email_verified: false,
  // Login OTP state
  loginOtpRequired: false,
  loginOtpSession: "",
  loginOtpMaskedEmail: "",
  loginOtpLoading: false,
  loginOtpError: null as string | null,
};

const userReducer = (state = userInitialState, action: ReducerAction) => {
  const { payload } = action;

  switch (action.type) {
    case USER_INIT:
      return {
        ...state,
        ...(action.crudType !== USER_SEND_OTP && action.crudType !== USER_PROFILE_FETCH && { loading: true }),
        ...(action.crudType === USER_PROFILE_FETCH && { profileLoading: true }),
      };

    case USER_LOGIN:
      localStorage.setItem("token", payload.accessToken);
      fireAttribution();
      if (payload.refreshToken) {
        localStorage.setItem("refreshToken", payload.refreshToken);
      }
      // Remember-me: default to persistent unless the login form explicitly opted out.
      applyPersistence(payload.remember !== false);
      // Persist last company from backend to localStorage for cross-session persistence
      if (payload.last_company_id) {
        localStorage.setItem("last_company_id", String(payload.last_company_id));
      }
      return {
        ...state,
        email: payload.email,
        name: payload.name,
        loading: false,
        error: null,
        email_verified: payload?.email_verified ?? state.email_verified,
      };
    case USER_REGISTER:
      localStorage.setItem("token", payload.accessToken);
      fireAttribution();
      if (payload.refreshToken) {
        localStorage.setItem("refreshToken", payload.refreshToken);
      }
      return {
        ...state,
        email: payload.email,
        name: payload.name,
        loading: false,
        error: null,
        email_verified: payload?.email_verified ?? state.email_verified,
      };
    case USER_UPDATE:
      localStorage.setItem("token", payload.accessToken);
      fireAttribution();
      if (payload.refreshToken) {
        localStorage.setItem("refreshToken", payload.refreshToken);
      }
      return { ...state };

    case USER_PROFILE_FETCH:
      return {
        ...state,
        profileLoading: false,
        profile: payload,
        email_verified: payload?.email_verified ?? state.email_verified,
      };

    case USER_EMAIL_VERIFIED:
      return {
        ...state,
        email_verified: true,
        loading: false,
        error: null,
        profile: state.profile ? { ...state.profile, email_verified: true } : state.profile,
      };

    case USER_EMAIL_CHECK:
      return {
        ...state,
        email: payload.email,
        mobile: payload.mobile,
        loading: false,
        error: null,
      };
    case USER_API_ERROR:
      return {
        ...state,
        loading: false,
        profileLoading: false,
        error: action.payload || null,
      };
    case USER_SEND_RESET_LINK:
      return {
        ...state,
        email: payload.email,
        loading: false,
        error: null,
      };
    case USER_RESET_PASSWORD:
      return {
        ...state,
        token: payload.token,
        email: payload.email,
        newPassword: payload.newPassword,
        loading: false,
        error: null,
      };
    case USER_LOGIN_OTP_REQUIRED:
      return {
        ...state,
        loading: false,
        loginOtpRequired: true,
        loginOtpSession: payload.login_otp_session,
        loginOtpMaskedEmail: payload.masked_email,
        loginOtpError: null,
        loginOtpLoading: false,
        error: null,
      };

    case USER_LOGIN_OTP_RESET:
      return {
        ...state,
        loginOtpRequired: false,
        loginOtpSession: "",
        loginOtpMaskedEmail: "",
        loginOtpError: null,
        loginOtpLoading: false,
      };

    case USER_VERIFY_LOGIN_OTP:
      return {
        ...state,
        loginOtpLoading: true,
        loginOtpError: null,
      };

    case USER_RESEND_LOGIN_OTP:
      return {
        ...state,
        loginOtpLoading: true,
        loginOtpError: null,
      };

    default:
      return {
        ...state,
      };
  }
};

export default userReducer;
