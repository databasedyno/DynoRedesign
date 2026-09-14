import { useCallback, useEffect, useState } from "react";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";

const RESEND_SECONDS = 30;

/** Resend the emailed sign-in code for a live challenge, with a 30s cooldown (matches the backend). */
export const useResendChallengeCode = (challengeToken: string, active: boolean) => {
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!active) return;
    setCountdown(RESEND_SECONDS);
    setMessage("");
    setIsError(false);
  }, [active, challengeToken]);

  useEffect(() => {
    if (countdown <= 0) return;
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const send = useCallback(async () => {
    if (!challengeToken || sending) return;
    setSending(true);
    setMessage("");
    try {
      await axiosBaseApi.post(API_ENDPOINTS.user.twoFaResend, { challenge_token: challengeToken });
      setIsError(false);
      setMessage("New code sent.");
      setCountdown(RESEND_SECONDS);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setIsError(true);
      setMessage(msg || "Could not resend the code.");
    } finally {
      setSending(false);
    }
  }, [challengeToken, sending]);

  return { countdown, sending, message, isError, send };
};
