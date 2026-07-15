// https://jsonplaceholder.typicode.com/todos/1

import { call, put } from "redux-saga/effects";
import {
  USER_API_ERROR,
  USER_CONFIRM_CODE,
  USER_LOGIN,
  USER_PROFILE_FETCH,
  USER_REGISTER,
  USER_RESET_PASSWORD,
  USER_SEND_OTP,
  USER_SEND_RESET_LINK,
  USER_UPDATE,
  USER_UPDATE_PASSWORD,
  USER_VERIFY_EMAIL,
  USER_RESEND_VERIFICATION,
  USER_EMAIL_VERIFIED,
  USER_LOGIN_OTP_REQUIRED,
  USER_VERIFY_LOGIN_OTP,
  USER_RESEND_LOGIN_OTP,
} from "../Actions/UserAction";
import axios from "@/axiosConfig";
import { TOAST_SHOW } from "../Actions/ToastAction";
import { unAuthorizedHelper } from "@/helpers";

interface IUserAction {
  crudType: string;
  payload: any;
}

export function* UserSaga(action: IUserAction): unknown {
  switch (action.crudType) {
    case USER_LOGIN:
      yield userLogin(action.payload);
      break;
    case USER_REGISTER:
      yield registerUser(action.payload);
      break;
    case USER_SEND_OTP:
      yield generateOTP(action.payload);
      break;
    case USER_CONFIRM_CODE:
      yield confirmOTP(action.payload);
      break;
    case USER_UPDATE:
      yield updateUser(action.payload);
      break;
    case USER_UPDATE_PASSWORD:
      yield changePassword(action.payload);
      break;
    case USER_SEND_RESET_LINK:
      yield generateResetLink(action.payload);
      break;
    case USER_RESET_PASSWORD:
      yield resetPassword(action.payload);
      break;
    case USER_PROFILE_FETCH:
      yield fetchProfile();
      break;
    case USER_VERIFY_EMAIL:
      yield verifyEmail(action.payload);
      break;
    case USER_RESEND_VERIFICATION:
      yield resendVerification(action.payload);
      break;
    case USER_VERIFY_LOGIN_OTP:
      yield verifyLoginOTP(action.payload);
      break;
    case USER_RESEND_LOGIN_OTP:
      yield resendLoginOTP(action.payload);
      break;
    default:
      yield put({ type: USER_API_ERROR });
      break;
  }
}

export function* userLogin(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/login", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Login failed";
      throw new Error(errorMessage);
    }

    const { data, message } = responseData;

    // Validate that data exists and has the required properties
    if (!data) {
      throw new Error("Response data is missing");
    }

    // Check if login OTP is required
    if (data.requires_login_otp) {
      yield put({
        type: TOAST_SHOW,
        payload: { message: message || "OTP sent to your email" },
      });
      yield put({
        type: USER_LOGIN_OTP_REQUIRED,
        payload: {
          login_otp_session: data.login_otp_session,
          masked_email: data.masked_email,
        },
      });
      return;
    }

    if (!data.userData || !data.accessToken) {
      throw new Error(
        "Invalid response structure: missing userData or accessToken",
      );
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Login successful" },
    });
    yield put({
      type: USER_LOGIN,
      payload: { ...data.userData, accessToken: data.accessToken, refreshToken: data.refreshToken, remember: payload?.remember },
    });
  } catch (e: any) {
    const message = e.response?.data?.message ?? e.message ?? "Login failed";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_LOGIN,
      },
    });
  }
}


export function* verifyLoginOTP(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/verifyLoginOTP", payload);
    const responseData = response?.data;

    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    if (responseData.success === false) {
      throw new Error(responseData.message || "OTP verification failed");
    }

    const { data, message } = responseData;

    if (!data || !data.userData || !data.accessToken) {
      throw new Error("Invalid response structure");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Login successful" },
    });
    yield put({
      type: USER_LOGIN,
      payload: { ...data.userData, accessToken: data.accessToken, refreshToken: data.refreshToken, remember: payload?.remember },
    });
  } catch (e: any) {
    const message = e.response?.data?.message ?? e.message ?? "OTP verification failed";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({
      type: USER_API_ERROR,
      payload: { message, actionType: USER_VERIFY_LOGIN_OTP },
    });
  }
}

export function* resendLoginOTP(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/resendLoginOTP", payload);
    const responseData = response?.data;

    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    if (responseData.success === false) {
      throw new Error(responseData.message || "Failed to resend OTP");
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: responseData.message || "New OTP sent to your email" },
    });
  } catch (e: any) {
    const message = e.response?.data?.message ?? e.message ?? "Failed to resend OTP";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({
      type: USER_API_ERROR,
      payload: { message, actionType: USER_RESEND_LOGIN_OTP },
    });
  }
}

export function* registerUser(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/registerUser", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Registration failed";
      throw new Error(errorMessage);
    }

    const { data, message } = responseData;

    // Validate that data exists and has the required properties
    if (!data) {
      throw new Error("Response data is missing");
    }

    if (!data.userData || !data.accessToken) {
      throw new Error(
        "Invalid response structure: missing userData or accessToken",
      );
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Registration successful" },
    });
    yield put({
      type: USER_REGISTER,
      payload: { ...data.userData, accessToken: data.accessToken, refreshToken: data.refreshToken },
    });
  } catch (e: any) {
    const message =
      e.response?.data?.message ?? e.message ?? "Registration failed";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_REGISTER,
      },
    });
  }
}

export function* generateResetLink(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/forgot-password", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Failed to send Reset Link";
      throw new Error(errorMessage);
    }

    const { data, message } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Reset Link sent successfully" },
    });
  } catch (e: any) {
    const message =
      e.response?.data?.message ?? e.message ?? "Failed to send Reset Link";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_SEND_RESET_LINK,
      },
    });
  }
}

export function* generateOTP(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/generateOTP", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Failed to send OTP";
      throw new Error(errorMessage);
    }

    const { data, message } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "OTP sent successfully" },
    });
  } catch (e: any) {
    const message =
      e.response?.data?.message ?? e.message ?? "Failed to send OTP";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_SEND_OTP,
      },
    });
  }
}

export function* confirmOTP(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/confirmOTP", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "OTP verification failed";
      throw new Error(errorMessage);
    }

    const { data, message } = responseData;

    // Validate that data exists and has the required properties
    if (!data) {
      throw new Error("Response data is missing");
    }

    if (!data.userData || !data.accessToken) {
      throw new Error(
        "Invalid response structure: missing userData or accessToken",
      );
    }

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "OTP verified successfully" },
    });
    yield put({
      type: USER_LOGIN,
      payload: { ...data.userData, accessToken: data.accessToken },
    });
  } catch (e: any) {
    const message =
      e.response?.data?.message ?? e.message ?? "OTP verification failed";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_CONFIRM_CODE,
      },
    });
  }
}

function* updateUser(payload: any): unknown {
  try {
    const response = yield call(axios.put, "/user/updateUser", payload, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Update failed";
      throw new Error(errorMessage);
    }

    const { message, data } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Update successful" },
    });
    yield put({
      type: USER_UPDATE,
      payload: data,
    });
  } catch (e: any) {
    unAuthorizedHelper(e);
    const message = e.response?.data?.message ?? e.message ?? "Update failed";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_UPDATE,
      },
    });
  }
}

function* resetPassword(payload: any): unknown {
  try {
    const response = yield call(axios.post, "/user/reset-password", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Password reset failed";
      throw new Error(errorMessage);
    }

    const { message, data } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: "Now you can login with the new password" },
    });

    if (payload.onSuccess) {
      payload.onSuccess();
    }
  } catch (e: any) {
    unAuthorizedHelper(e);
    const message =
      e.response?.data?.message ?? e.message ?? "Password reset failed";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_RESET_PASSWORD,
      },
    });
  }
}

function* changePassword(payload: any): unknown {
  try {
    const response = yield call(axios.put, "/user/changePassword", payload);
    const responseData = response?.data;

    // Check if response has the expected structure
    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    // Check if API returned an error response (success: false)
    if (responseData.success === false) {
      const errorMessage = responseData.message || "Password change failed";
      throw new Error(errorMessage);
    }

    const { message, data } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Password changed successfully" },
    });
  } catch (e: any) {
    unAuthorizedHelper(e);
    const message =
      e.response?.data?.message ?? e.message ?? "Password change failed";
    yield put({
      type: TOAST_SHOW,
      payload: {
        message: message,
        severity: "error",
      },
    });
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_UPDATE_PASSWORD,
      },
    });
  }
}


function* fetchProfile(): unknown {
  try {
    const response = yield call(axios.get, "user/profile");
    const responseData = response?.data;

    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    if (responseData.success === false) {
      throw new Error(responseData.message || "Failed to fetch profile");
    }

    const profileData = responseData.data || responseData;

    yield put({
      type: USER_PROFILE_FETCH,
      payload: profileData,
    });
  } catch (e: any) {
    const message = e.response?.data?.message ?? e.message ?? "Failed to fetch profile";
    console.error("fetchProfile error:", message);
    yield put({
      type: USER_API_ERROR,
      payload: {
        message: message,
        actionType: USER_PROFILE_FETCH,
      },
    });
  }
}


function* verifyEmail(payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/verify-email", { otp: payload.otp });
    const responseData = response?.data;

    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    if (responseData.success === false) {
      const errorMessage = responseData.message || "Email verification failed";
      throw new Error(errorMessage);
    }

    const { message } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Email verified successfully!" },
    });
    yield put({
      type: USER_EMAIL_VERIFIED,
      payload: { email_verified: true },
    });
  } catch (e: any) {
    const message = e.response?.data?.message ?? e.message ?? "Email verification failed";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({
      type: USER_API_ERROR,
      payload: { message, actionType: USER_VERIFY_EMAIL },
    });
  }
}

function* resendVerification(_payload: any): unknown {
  try {
    const response = yield call(axios.post, "user/resend-verification");
    const responseData = response?.data;

    if (!responseData) {
      throw new Error("Invalid response from server");
    }

    if (responseData.success === false) {
      const errorMessage = responseData.message || "Failed to resend verification";
      throw new Error(errorMessage);
    }

    const { message } = responseData;

    yield put({
      type: TOAST_SHOW,
      payload: { message: message || "Verification code sent!" },
    });
  } catch (e: any) {
    const message = e.response?.data?.message ?? e.message ?? "Failed to resend verification";
    yield put({
      type: TOAST_SHOW,
      payload: { message, severity: "error" },
    });
    yield put({
      type: USER_API_ERROR,
      payload: { message, actionType: USER_RESEND_VERIFICATION },
    });
  }
}
