import { createApiClient } from "@/utils/apiClient";

// Admin client — SEPARATE from the merchant axiosBaseApi (axiosConfig.ts).
// Different auth realm: reads localStorage 'admin_token', and has NO refresh /
// 403-redirect / X-Company-Id logic. Base URL comes from the shared source.
const adminBaseApi = createApiClient();

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
