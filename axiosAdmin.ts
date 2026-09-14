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

export default adminBaseApi;
