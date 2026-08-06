/**
 * Central map of backend API endpoint paths.
 *
 * Paths are relative to the axios base (`axiosBaseApi`, which already prefixes
 * `/api/`), so pass them straight to `axiosBaseApi.get/post/put`. For raw
 * `fetch()` callers, prefix with `/api` (e.g. `fetch("/api" + API_ENDPOINTS...)`).
 *
 * Consolidates inline endpoint strings so a route rename is a one-line change.
 */
export const API_ENDPOINTS = {
  creator: {
    /** Authenticated availability check (dashboard editor). */
    checkHandle: "/user/creator/check-handle",
    /** Public availability check (landing hero, unauthenticated). */
    checkHandlePublic: "/user/creator/check-handle-public",
    /** Public reservation (Redis TTL lock) claimed from the landing hero. */
    reserveHandle: "/user/creator/reserve-handle",
    /** Get/update the creator profile. */
    profile: "/user/creator/profile",
    /** Creator analytics (30-day tips + top supporters). */
    analytics: "/user/creator/analytics",
    /** Cover-image upload. */
    uploadCover: "/user/creator/upload-cover",
  },
} as const;

export default API_ENDPOINTS;
