import { showToast } from "@/helpers/toastStore";
import { useMemo, useSyncExternalStore } from "react";
import { mutate } from "swr";

import axios from "@/axiosConfig";
import { unAuthorizedHelper } from "@/helpers";
import { applyPersistence } from "@/helpers/authPersistence";
import useProfile, { PROFILE_KEY, revalidateProfile } from "@/hooks/useProfile";

/**
 * useUser — SWR/store-backed replacement for the old Redux `userReducer` +
 * `UserSaga` (data-layer consolidation, REFACTOR Part D / Phase 2, Wave 5 —
 * the riskiest wave: auth/profile).
 *
 * WHY a module store (not SWR) for the auth flow: login / register / OTP /
 * password-reset / email-verify are imperative, one-shot, cross-component
 * flows whose ephemeral state (`loading`, `error`, `loginOtp*`, transient
 * `email`/`name`) is shared across steps of the SAME login page and a few
 * banners. A tiny module store + `useSyncExternalStore` reproduces the exact
 * global-redux semantics (single source of truth, synchronous updates, stable
 * snapshot identity) so the login page's delicate reactive effects keep working
 * unchanged. The profile READ-state comes from SWR (`useProfile`).
 *
 * Every method mirrors the corresponding `UserSaga` handler BYTE-FOR-BYTE —
 * same axios endpoints, same success/error toasts, same localStorage/token
 * writes, same `error.actionType` values — so behaviour is identical. The
 * action-type string constants are re-exported here (they were the old
 * `UserAction` types) because a few consumers compare `error.actionType`.
 */

// ── Action-type constants (preserve the exact old string values) ──────────────
export const USER_LOGIN = "USER_LOGIN";
export const USER_CONFIRM_CODE = "USER_CONFIRM_CODE";
export const USER_SEND_OTP = "USER_SEND_OTP";
export const USER_SEND_RESET_LINK = "USER_SEND_RESET_LINK";
export const USER_RESET_PASSWORD = "USER_RESET_PASSWORD";
export const USER_VERIFY_EMAIL = "USER_VERIFY_EMAIL";
export const USER_RESEND_VERIFICATION = "USER_RESEND_VERIFICATION";
export const USER_VERIFY_LOGIN_OTP = "USER_VERIFY_LOGIN_OTP";
export const USER_RESEND_LOGIN_OTP = "USER_RESEND_LOGIN_OTP";

// ── Ephemeral auth state (module store) ───────────────────────────────────────
export interface AuthState {
  email: string;
  name: string;
  mobile: string;
  loading: boolean;
  error: { message: string; actionType: string } | null;
  email_verified: boolean;
  loginOtpRequired: boolean;
  loginOtpSession: string;
  loginOtpMaskedEmail: string;
  loginOtpLoading: boolean;
  loginOtpError: string | null;
}

const initialAuthState: AuthState = {
  email: "",
  name: "",
  mobile: "",
  loading: false,
  error: null,
  email_verified: false,
  loginOtpRequired: false,
  loginOtpSession: "",
  loginOtpMaskedEmail: "",
  loginOtpLoading: false,
  loginOtpError: null,
};

let authState: AuthState = { ...initialAuthState };
const listeners = new Set<() => void>();

const getAuthSnapshot = (): AuthState => authState;
const subscribeAuth = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};
/** Merge-patch the auth store and notify subscribers (new object identity). */
const setAuth = (patch: Partial<AuthState>): void => {
  authState = { ...authState, ...patch };
  listeners.forEach((l) => l());
};

// ── Return shape ──────────────────────────────────────────────────────────────
export interface UseUserResult extends AuthState {
  profile: any;
  profileLoading: boolean;
  // Async flows (mirror the old saga handlers)
  login: (payload: any) => Promise<void>;
  verifyLoginOTP: (payload: any) => Promise<void>;
  resendLoginOTP: (payload: any) => Promise<void>;
  sendOtp: (payload: any) => Promise<void>;
  confirmCode: (payload: any) => Promise<void>;
  sendResetLink: (payload: any) => Promise<void>;
  resetPassword: (payload: any) => Promise<void>;
  verifyEmail: (payload: any) => Promise<void>;
  resendVerification: (payload?: any) => Promise<void>;
  // Synchronous transitions (were raw reducer dispatches)
  applyLoginData: (payload: any) => void;
  applyUserUpdate: (payload: any) => void;
  applyEmailCheck: (payload: any) => void;
  resetLoginOtp: () => void;
  clearApiError: () => void;
  /** Was dispatch(UserAction(USER_PROFILE_FETCH)). */
  fetchProfile: () => Promise<any>;
}

export function useUser(): UseUserResult {
  const state = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthSnapshot);
  const { profile, profileLoading } = useProfile();

  const methods = useMemo(() => {
    const toast = (message: string, severity?: string) =>
      showToast(severity ? { message, severity } : { message });

    // Mirror of userReducer USER_LOGIN: persist token + remember-me + last company.
    const applyLoginData = (payload: any) => {
      if (typeof window !== "undefined") {
        localStorage.setItem("token", payload.accessToken);
        if (payload.refreshToken) localStorage.setItem("refreshToken", payload.refreshToken);
        if (payload.last_company_id) {
          localStorage.setItem("last_company_id", String(payload.last_company_id));
        }
      }
      applyPersistence(payload.remember !== false);
      setAuth({
        email: payload.email,
        name: payload.name,
        loading: false,
        error: null,
        email_verified: payload?.email_verified ?? authState.email_verified,
      });
    };

    // Mirror of userReducer USER_UPDATE: token refresh only.
    const applyUserUpdate = (payload: any) => {
      if (typeof window !== "undefined") {
        if (payload?.accessToken) localStorage.setItem("token", payload.accessToken);
        if (payload?.refreshToken) localStorage.setItem("refreshToken", payload.refreshToken);
      }
    };

    // Mirror of userReducer USER_EMAIL_CHECK: seed email + mobile from the
    // email-existence check so the code-mode SMS option can appear.
    const applyEmailCheck = (payload: any) =>
      setAuth({
        email: payload.email,
        mobile: payload.mobile,
        loading: false,
        error: null,
      });

    const resetLoginOtp = () =>
      setAuth({
        loginOtpRequired: false,
        loginOtpSession: "",
        loginOtpMaskedEmail: "",
        loginOtpError: null,
        loginOtpLoading: false,
      });

    const clearApiError = () => setAuth({ loading: false, error: null });

    const login = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/login", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Login failed");
        const { data, message } = responseData;
        if (!data) throw new Error("Response data is missing");
        if (data.requires_login_otp) {
          toast(message || "OTP sent to your email");
          setAuth({
            loading: false,
            loginOtpRequired: true,
            loginOtpSession: data.login_otp_session,
            loginOtpMaskedEmail: data.masked_email,
            loginOtpError: null,
            loginOtpLoading: false,
            error: null,
          });
          return;
        }
        if (!data.userData || !data.accessToken) {
          throw new Error("Invalid response structure: missing userData or accessToken");
        }
        toast(message || "Login successful");
        applyLoginData({
          ...data.userData,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          remember: payload?.remember,
        });
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Login failed";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_LOGIN } });
      }
    };

    const verifyLoginOTP = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/verifyLoginOTP", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "OTP verification failed");
        const { data, message } = responseData;
        if (!data || !data.userData || !data.accessToken) throw new Error("Invalid response structure");
        toast(message || "Login successful");
        applyLoginData({
          ...data.userData,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          remember: payload?.remember,
        });
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "OTP verification failed";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_VERIFY_LOGIN_OTP } });
      }
    };

    const resendLoginOTP = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/resendLoginOTP", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Failed to resend OTP");
        toast(responseData.message || "New OTP sent to your email");
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Failed to resend OTP";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_RESEND_LOGIN_OTP } });
      }
    };

    // USER_SEND_OTP is excluded from the USER_INIT loading:true (mirror reducer).
    const sendOtp = async (payload: any) => {
      try {
        const response = await axios.post("user/generateOTP", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Failed to send OTP");
        toast(responseData.message || "OTP sent successfully");
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Failed to send OTP";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_SEND_OTP } });
      }
    };

    const confirmCode = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/confirmOTP", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "OTP verification failed");
        const { data, message } = responseData;
        if (!data) throw new Error("Response data is missing");
        if (!data.userData || !data.accessToken) {
          throw new Error("Invalid response structure: missing userData or accessToken");
        }
        toast(message || "OTP verified successfully");
        // Mirror saga: no refreshToken / remember passed here.
        applyLoginData({ ...data.userData, accessToken: data.accessToken });
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "OTP verification failed";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_CONFIRM_CODE } });
      }
    };

    const sendResetLink = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/forgot-password", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Failed to send Reset Link");
        toast(responseData.message || "Reset Link sent successfully");
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Failed to send Reset Link";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_SEND_RESET_LINK } });
      }
    };

    const resetPassword = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("/user/reset-password", payload);
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Password reset failed");
        toast("Now you can login with the new password");
        if (payload.onSuccess) payload.onSuccess();
      } catch (e: any) {
        unAuthorizedHelper(e);
        const message = e?.response?.data?.message ?? e?.message ?? "Password reset failed";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_RESET_PASSWORD } });
      }
    };

    const verifyEmail = async (payload: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/verify-email", { otp: payload.otp });
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Email verification failed");
        toast(responseData.message || "Email verified successfully!");
        setAuth({ loading: false, error: null, email_verified: true });
        // Mirror USER_EMAIL_VERIFIED profile patch (optimistic, no refetch).
        mutate(PROFILE_KEY, (cur: any) => (cur ? { ...cur, email_verified: true } : cur), {
          revalidate: false,
        });
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Email verification failed";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_VERIFY_EMAIL } });
      }
    };

    const resendVerification = async (_payload?: any) => {
      setAuth({ loading: true, error: null });
      try {
        const response = await axios.post("user/resend-verification");
        const responseData = response?.data;
        if (!responseData) throw new Error("Invalid response from server");
        if (responseData.success === false) throw new Error(responseData.message || "Failed to resend verification");
        toast(responseData.message || "Verification code sent!");
      } catch (e: any) {
        const message = e?.response?.data?.message ?? e?.message ?? "Failed to resend verification";
        toast(message, "error");
        setAuth({ loading: false, error: { message, actionType: USER_RESEND_VERIFICATION } });
      }
    };

    return {
      login,
      verifyLoginOTP,
      resendLoginOTP,
      sendOtp,
      confirmCode,
      sendResetLink,
      resetPassword,
      verifyEmail,
      resendVerification,
      applyLoginData,
      applyUserUpdate,
      applyEmailCheck,
      resetLoginOtp,
      clearApiError,
      fetchProfile: revalidateProfile,
    };
  }, []);

  // Identity changes ONLY when the auth store or profile changes — mirrors the
  // old redux slice reference semantics that the login page's effects rely on.
  return useMemo(
    () => ({ ...state, profile, profileLoading, ...methods }),
    [state, profile, profileLoading, methods],
  );
}

export default useUser;
