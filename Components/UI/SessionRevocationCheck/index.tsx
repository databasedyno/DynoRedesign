import { useEffect } from "react";
import axiosBaseApi from "@/axiosConfig";
import { isPublicPath } from "@/helpers/publicPaths";

/**
 * Cross-device sign-out: when this tab is opened or comes back to the
 * foreground on an authenticated page, ping GET /user/session-check. A device
 * that was signed out elsewhere ("Sign out all others" / "Sign out everywhere")
 * gets a 401, which axiosConfig turns into a clean logout + redirect — instead
 * of looking signed in until the next user action. Renders nothing.
 */
const SessionRevocationCheck = () => {
  useEffect(() => {
    const check = () => {
      if (document.visibilityState === "hidden") return;
      let token: string | null = null;
      try {
        token = localStorage.getItem("token");
      } catch {
        return;
      }
      if (!token || isPublicPath(window.location.pathname)) return;
      axiosBaseApi.get("user/session-check").catch(() => {
        /* 401 is handled centrally by the axios interceptor */
      });
    };

    check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  return null;
};

export default SessionRevocationCheck;
