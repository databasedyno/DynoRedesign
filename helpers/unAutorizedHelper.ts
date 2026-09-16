import Router from "next/router";
import { setAuthNotice } from "@/helpers/authNotice";
import { isProtectedPath } from "@/helpers/publicPaths";
import { notifyTokenUpdated } from "@/hooks/useTokenData";

const unAuthorizedHelper = (e: any) => {
  const status = e?.response?.status;
  if (status === 401 || status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setAuthNotice("session_expired");
    notifyTokenUpdated();
    // Only in-app / admin routes bounce to login. Public surfaces (marketing,
    // blog, help centre, auth screens, checkout…) just drop the stale token and
    // stay put — redirecting from /auth/login onto itself also caused a reload
    // loop on browsers where the removal above doesn't persist (Firefox mobile).
    const p =
      typeof window !== "undefined" ? window.location.pathname || "" : "";
    if (isProtectedPath(p)) Router.replace("/auth/login");
  }
};

export default unAuthorizedHelper;
