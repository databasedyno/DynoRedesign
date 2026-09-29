import axios from "axios";
// Mirror axiosConfig.ts: strip trailing slashes then append "/api/" so the
// baseURL is ABSOLUTE ("/api/" when BASE_URL is empty). A relative "api/"
// base resolves against the current page path and 404s on depth-2 admin
// routes like /admin/merchants or /admin/support (→ /admin/api/...).
const apiBaseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

const adminBaseApi = axios.create({
  baseURL: apiBaseUrl + "/api/",
  headers: {
    "Content-Type": "application/json",
  },
});

adminBaseApi.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      delete adminBaseApi.defaults.headers.common.Authorization;
    }
    return config;
  },

  (error) => console.error(error)
);

// On an expired/revoked admin session (401/403 from a protected admin route),
// drop the stale token and bounce back to the login screen. The login/enroll
// endpoints are exempt so their own error messages surface in the form.
adminBaseApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || "";
    const isAuthRoute = /\/admin\/(login|enroll)\b/.test(url);
    if ((status === 401 || status === 403) && !isAuthRoute && typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
      if (!window.location.pathname.startsWith("/admin/login")) {
        window.location.replace("/admin/login");
      }
    }
    return Promise.reject(error);
  }
);

export default adminBaseApi;
