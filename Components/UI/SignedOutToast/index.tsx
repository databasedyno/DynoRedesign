import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import useToast from "@/hooks/useToast";

export const SIGNED_OUT_FLAG = "dp_signed_out";

/**
 * Shows a one-time "You're signed out" toast on the landing page after logout.
 * The flag is set just before sign-out; we read it both on mount (Dynopay does a
 * full window.location.replace → fresh mount) and on routeChangeComplete
 * (SafeDeal uses a client-side router.push → no remount). Self-clears the flag.
 */
export default function SignedOutToast() {
  const { showToast } = useToast();
  const { t } = useTranslation("common");
  const router = useRouter();
  const firedRef = useRef(false);

  useEffect(() => {
    const check = () => {
      if (firedRef.current) return;
      let flag: string | null = null;
      try {
        flag = sessionStorage.getItem(SIGNED_OUT_FLAG);
      } catch {
        flag = null;
      }
      if (!flag) return;
      firedRef.current = true;
      try {
        sessionStorage.removeItem(SIGNED_OUT_FLAG);
      } catch {
        /* storage unavailable */
      }
      showToast({
        message: t("signedOutToast", { defaultValue: "You\u2019re signed out" }),
        severity: "success",
        durationMs: 4000,
      });
    };
    check();
    router.events.on("routeChangeComplete", check);
    return () => router.events.off("routeChangeComplete", check);
  }, [router, showToast, t]);

  return null;
}
