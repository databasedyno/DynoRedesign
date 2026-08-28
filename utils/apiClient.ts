import axios, { AxiosInstance } from "axios";

/**
 * Single source of truth for the API base URL + bare-instance creation, shared
 * by BOTH frontend axios clients:
 *   • axiosConfig.ts  → axiosBaseApi  (merchant: JWT in localStorage 'token',
 *     auth-endpoint exclusion, X-Company-Id header, 401 refresh-token flow, 403 redirect)
 *   • axiosAdmin.ts   → adminBaseApi  (admin: JWT in localStorage 'admin_token', no refresh)
 *
 * Before this, each file recomputed the base URL from NEXT_PUBLIC_BASE_URL with
 * slightly different trailing-slash logic. It now lives here once.
 *
 * ⚠️ There are intentionally TWO instances, NOT one — they serve DIFFERENT auth
 * realms with different interceptors. Do NOT collapse them into a single client;
 * doing so would leak the merchant refresh/redirect logic into admin requests
 * (and vice-versa). Only the shared, behaviour-neutral setup lives in this module.
 */

/** API origin WITHOUT the trailing `/api/` (e.g. "https://host" or "" in dev). */
export const API_ORIGIN = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");

/** Full API base URL WITH the trailing `/api/` — what axios `baseURL` uses. */
export const API_BASE_URL = `${API_ORIGIN}/api/`;

/** Create a bare axios instance pointed at the API with JSON defaults. */
export const createApiClient = (): AxiosInstance =>
  axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Content-Type": "application/json",
    },
  });

export default createApiClient;
