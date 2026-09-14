import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { useCallback, useEffect, useRef, useState } from "react";
import { SUDO_DEFAULT_TTL, Tw } from "./types";

type Toast = (message: string, severity?: "success" | "error" | "warning") => void;

export function useSudoSession(open: boolean, tw: Tw, toast: Toast) {
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [active, setActive] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [totalSecs, setTotalSecs] = useState(SUDO_DEFAULT_TTL);
  const [remaining, setRemaining] = useState(0);

  const [requesting, setRequesting] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpCountdown, setOtpCountdown] = useState(0);

  const warnedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setCheckingStatus(true);
    warnedRef.current = false;
    (async () => {
      try {
        const res: any = await axiosBaseApi.get(API_ENDPOINTS.wallet.sudoStatus);
        const d = res?.data?.data || {};
        if (cancelled) return;
        setActive(!!d.active);
        setExpiresAt(d.active ? Number(d.expires_at) : null);
        if (d.active) {
          const left = Math.round((Number(d.expires_at) - Date.now()) / 1000);
          setTotalSecs(Math.max(SUDO_DEFAULT_TTL, left));
        }
      } catch {
        if (!cancelled) {
          setActive(false);
          setExpiresAt(null);
        }
      } finally {
        if (!cancelled) setCheckingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!active || !expiresAt) {
      setRemaining(0);
      return;
    }
    const tick = () => {
      const secs = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setRemaining(secs);
      if (secs > 0 && secs <= 120 && !warnedRef.current) {
        warnedRef.current = true;
        toast(tw("sudoEndingSoon", "2 minutes left — save your changes soon"), "warning");
      }
      if (secs <= 0) setActive(false);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, expiresAt, toast, tw]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const id = setTimeout(() => setOtpCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [otpCountdown]);

  const requestOtp = useCallback(async () => {
    setRequesting(true);
    try {
      await axiosBaseApi.post(API_ENDPOINTS.wallet.sudoRequestOtp, {});
      setOtpOpen(true);
      setOtpCountdown(30);
      setOtpError("");
      toast(tw("sudoCodeSent", "Verification code sent to your email"));
    } catch (e: any) {
      toast(e?.response?.data?.message || tw("sudoCodeFailed", "Couldn't send the code"), "error");
    } finally {
      setRequesting(false);
    }
  }, [toast, tw]);

  const verifyOtp = useCallback(
    async (otp: string) => {
      setOtpLoading(true);
      setOtpError("");
      try {
        const res: any = await axiosBaseApi.post(API_ENDPOINTS.wallet.sudoVerifyOtp, { otp });
        const d = res?.data?.data || {};
        setActive(true);
        setExpiresAt(Number(d.expires_at));
        setTotalSecs(Number(d.ttl_seconds) || SUDO_DEFAULT_TTL);
        warnedRef.current = false;
        setOtpOpen(false);
        toast(tw("sudoUnlocked", "Wallet management unlocked for 10 minutes"));
        return true;
      } catch (e: any) {
        setOtpError(e?.response?.data?.message || tw("sudoInvalidCode", "Invalid code"));
        return false;
      } finally {
        setOtpLoading(false);
      }
    },
    [toast, tw],
  );

  const lockNow = useCallback(async () => {
    try {
      await axiosBaseApi.post(API_ENDPOINTS.wallet.sudoRevoke, {});
    } catch {
      /* best-effort */
    }
    setActive(false);
    setExpiresAt(null);
    toast(tw("sudoLocked", "Wallet management locked"));
  }, [toast, tw]);

  const markExpired = useCallback(() => {
    setActive(false);
    setExpiresAt(null);
  }, []);

  const closeOtp = useCallback(() => {
    setOtpOpen(false);
    setOtpError("");
  }, []);

  return {
    checkingStatus,
    active,
    remaining,
    totalSecs,
    lowTime: remaining > 0 && remaining <= 120,
    requesting,
    otpOpen,
    otpLoading,
    otpError,
    otpCountdown,
    requestOtp,
    verifyOtp,
    lockNow,
    markExpired,
    closeOtp,
    clearOtpError: () => setOtpError(""),
  };
}
