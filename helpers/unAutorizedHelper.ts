import Router from "next/router";
import { setAuthNotice } from "@/helpers/authNotice";

const unAuthorizedHelper = (e: any) => {
  const status = e?.response?.status;
  if (status === 401 || status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    setAuthNotice("session_expired");
    Router.replace("/auth/login");
  }
};

export default unAuthorizedHelper;
