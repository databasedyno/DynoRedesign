import unAuthorizedHelper from "@/helpers/unAutorizedHelper";
import { setAuthNotice } from "@/helpers/authNotice";
import axios from "axios";

const apiBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
console.log("url for base", apiBaseUrl);

const axiosBaseApi = axios.create({
  baseURL: apiBaseUrl + "/api/",
  headers: {
    "Content-Type": "application/json",
  },
});

// Auth endpoints that should NOT send Authorization headers
const AUTH_ENDPOINTS = ["user/login", "user/register", "user/checkEmail", "user/forgot", "user/reset", "user/confirmOTP", "user/generateOTP"];

// Session 54 fix (Bug D): match on the path (query stripped) and treat
// "user/login" as an EXACT match. Previously `url.includes("user/login")`
// also matched authenticated routes like "user/login-activity" and
// "user/login-history", stripping their Authorization header → 401 → the
// Login Activity panel always showed "No login activity recorded yet".
// Register/forgot/reset intentionally keep substring matching so their
// hyphenated variants (user/forgot-password, user/reset-password,
// user/registerEmail, …) are still recognised as pre-auth endpoints.
const isAuthEndpoint = (url: string) => {
  const path = (url || "").split("?")[0].replace(/^\/+/, "");
  return AUTH_ENDPOINTS.some((ep) =>
    ep === "user/login" ? path === "user/login" : path.includes(ep)
  );
};

// --- Token Refresh State ---
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

// Request interceptor: attach token (skip for auth endpoints)
axiosBaseApi.interceptors.request.use(
  (config: any) => {
    const requestUrl = config.url || "";
    if (isAuthEndpoint(requestUrl)) {
      // Don't send Authorization header for auth endpoints
      delete config.headers.Authorization;
      return config;
    }

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete axiosBaseApi.defaults.headers.common.Authorization;
    }

    // Storefront-per-company: tell the backend which company the merchant is
    // acting within. Harmless when the feature flag is OFF (backend ignores it).
    try {
      const companyId = localStorage.getItem("last_company_id");
      if (companyId) {
        config.headers["X-Company-Id"] = companyId;
      }
    } catch {
      /* localStorage unavailable — skip */
    }
    return config;
  },
  (error) => {
    console.error("Request error:", error);
    return Promise.reject(error);
  },
);

// Response interceptor: handle 401 with token refresh
axiosBaseApi.interceptors.response.use(
  (response) => response, // success responses
  async (error) => {
    const originalRequest = error.config;

    // Skip auth redirect for public pages (homepage, checkout, fees, etc.) — visitors are not logged in.
    //
    // IMPORTANT (Session 43 bug fix, 2026-07-13): the checkout / payment surfaces are treated as
    // "never redirect to /auth/login" regardless of whether a token exists in localStorage. A
    // merchant previewing their own paylink (token in LS on the checkout subdomain) used to get
    // bounced to /auth/login mid-checkout when any incidental API call returned 401 (e.g. the old
    // LanguageSwitcher firing PUT /user/profile from /pay?d=…). Public checkout must be a hard
    // boundary — customers on this page must never see a merchant login screen.
    const pathname = typeof window !== "undefined" ? (window.location.pathname || "") : "";
    const isCheckoutPage =
      pathname === "/pay" ||
      pathname.startsWith("/pay/") ||
      pathname.startsWith("/pay-links/") ||
      pathname.startsWith("/payment");
    const isPublicPage = typeof window !== "undefined" && (
      ["/", "/fees", "/terms-conditions", "/privacy-policy", "/aml-policy", "/system-status", "/documentation", "/blog"].includes(pathname) ||
      ["/help-support", "/blog/", "/for/", "/accept-crypto-payments-in/"].some((p) => pathname.startsWith(p))
    );
    const hasToken = typeof window !== "undefined" && !!localStorage.getItem("token");

    if (error.response?.status === 401 && !isAuthEndpoint(originalRequest?.url || "")) {
      // Checkout / payment surfaces: HARD boundary — never redirect, never clear session.
      // The caller (a component on the pay page) gets the 401 rejection and can handle it locally.
      if (isCheckoutPage) {
        return Promise.reject(error);
      }
      // Other public pages: only exempt when unauthenticated.
      if (isPublicPage && !hasToken) {
        return Promise.reject(error);
      }

      // If this was a refresh-token call that got 401, the refresh token is invalid — clear session
      if ((originalRequest.url || "").includes("user/refresh-token")) {
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        delete axiosBaseApi.defaults.headers.common.Authorization;
        setAuthNotice("session_expired");
        window.location.href = "/auth/login";
        return Promise.reject(error);
      }

      // If this was already a retry after refresh, don't nuke the session —
      // the refresh succeeded but this specific endpoint still rejected the token.
      // Just reject the error and let the caller handle it gracefully.
      if (originalRequest._retry) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosBaseApi(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        isRefreshing = false;
        localStorage.removeItem("token");
        delete axiosBaseApi.defaults.headers.common.Authorization;
        setAuthNotice("session_expired");
        window.location.href = "/auth/login";
        return Promise.reject(error);
      }

      try {
        const { data: refreshResponse } = await axios.post(
          `${apiBaseUrl}/api/user/refresh-token`,
          { refresh_token: refreshToken },
          { headers: { "Content-Type": "application/json" } }
        );

        const newAccessToken = refreshResponse?.data?.accessToken;
        const newRefreshToken = refreshResponse?.data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem("token", newAccessToken);
          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
          }
          axiosBaseApi.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          processQueue(null, newAccessToken);

          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return axiosBaseApi(originalRequest);
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem("token");
        localStorage.removeItem("refreshToken");
        delete axiosBaseApi.defaults.headers.common.Authorization;
        setAuthNotice("session_expired");
        window.location.href = "/auth/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 403 — only redirect to login for auth-related 403 errors.
    // Business-logic 403 (e.g. "no companies", "not your company") should NOT
    // redirect to login or remove the token.
    if (error.response?.status === 403) {
      const responseMsg = (
        error.response?.data?.message ||
        error.response?.data?.error ||
        ""
      ).toLowerCase();

      const isAuthRelated =
        responseMsg.includes("token") ||
        responseMsg.includes("jwt") ||
        responseMsg.includes("authentication") ||
        responseMsg.includes("login again") ||
        responseMsg.includes("expired");

      if (isAuthRelated) {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("token")
            : null;
        // Checkout / payment surfaces: same hard boundary as the 401 branch above.
        // Never call unAuthorizedHelper (which nukes the session + Router.replace("/auth/login"))
        // from a public checkout page — visitors must never be dumped onto a merchant login.
        if (token && !isCheckoutPage) {
          unAuthorizedHelper(error);
        }
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default axiosBaseApi;
