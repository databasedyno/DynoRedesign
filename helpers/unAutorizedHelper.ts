import Router from "next/router";
import { setAuthNotice } from "@/helpers/authNotice";

const unAuthorizedHelper = (e: any) => {
  const status = e?.response?.status;
  if (status === 401 || status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setAuthNotice("session_expired");
    // Never bounce to /auth/login when already on an auth surface — it would
    // just reload the same page (and can loop on browsers where the token
    // removal above doesn't persist across reloads, e.g. Firefox mobile).
    const p =
      typeof window !== "undefined" ? window.location.pathname || "" : "";
    const onAuthPage =
      p.startsWith("/auth") || p === "/reset-password" || p === "/admin/login";
    if (!onAuthPage) Router.replace("/auth/login");
  }
};

export default unAuthorizedHelper;
