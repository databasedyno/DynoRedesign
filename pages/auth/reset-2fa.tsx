import React, { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/router";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import AuthShell from "@/Components/UI/AuthLayout/AuthShell";
import AuthStatus from "@/Components/UI/AuthLayout/AuthStatus";

type Status = "confirm" | "loading" | "success" | "error" | "invalid";

/** /auth/reset-2fa?token=… — signed link from the "Lost your authenticator?" email. */
const Reset2FAPage = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("auth");
  const { token } = router.query;
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [freezeUntil, setFreezeUntil] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (!token || typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
      setStatus("invalid");
      setMessage(t("reset2fa.invalidDefault", { defaultValue: "This reset link is invalid or incomplete. Sign in again and request a new one." }));
      return;
    }
    setStatus("confirm");
  }, [router.isReady, token, t]);

  const confirm = async () => {
    setStatus("loading");
    try {
      const res = await axiosBaseApi.post(API_ENDPOINTS.user.twoFaResetConfirm, { token });
      setFreezeUntil(res.data?.data?.wallet_frozen_until || null);
      setStatus("success");
      setMessage(res.data?.message || t("reset2fa.successDefault", { defaultValue: "Two-step verification was reset." }));
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setStatus("error");
      setMessage(err.response?.data?.message || t("reset2fa.failedDefault", { defaultValue: "This reset link has expired or was already used." }));
    }
  };

  const untilLabel = freezeUntil ? new Date(freezeUntil).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";
  const cfg: Record<Status, { tone: "loading" | "success" | "error" | "neutral"; icon: React.ReactNode; title: string; subtitle: string }> = {
    confirm: { tone: "neutral", icon: <LockResetIcon fontSize="medium" />, title: t("reset2fa.confirmTitle", { defaultValue: "Reset two-step verification?" }), subtitle: t("reset2fa.confirmSubtitle", { defaultValue: "Your authenticator app will be removed and email codes become your second step. For your safety this signs you out everywhere, forgets all trusted browsers and locks payout address changes for 24 hours." }) },
    loading: { tone: "loading", icon: null, title: t("reset2fa.loadingTitle", { defaultValue: "Resetting…" }), subtitle: t("reset2fa.loadingSubtitle", { defaultValue: "Signing out other sessions and updating your account." }) },
    success: { tone: "success", icon: <CheckCircleOutlineIcon fontSize="medium" />, title: t("reset2fa.successTitle", { defaultValue: "Two-step verification reset" }), subtitle: message },
    error: { tone: "error", icon: <ErrorOutlineIcon fontSize="medium" />, title: t("reset2fa.errorTitle", { defaultValue: "Couldn't reset" }), subtitle: message },
    invalid: { tone: "neutral", icon: <ShieldOutlinedIcon fontSize="medium" />, title: t("reset2fa.invalidTitle", { defaultValue: "Invalid link" }), subtitle: message },
  };
  const c = cfg[status];
  const goToLogin = { label: t("reset2fa.goToLogin", { defaultValue: "Go to sign in" }), onClick: () => router.push("/auth/login"), testId: "reset-2fa-login-btn" };
  const action = status === "confirm"
    ? { label: t("reset2fa.confirmCta", { defaultValue: "Yes, reset my two-step verification" }), onClick: confirm, testId: "reset-2fa-confirm-btn" }
    : status === "loading" ? undefined : goToLogin;

  return (
    <AuthShell brand title={`${t("reset2fa.headTitle", { defaultValue: "Reset two-step verification" })} · Dynopay`} testId="reset-2fa-page">
      <Box data-testid="reset-2fa-card" data-status={status}>
        <AuthStatus tone={c.tone} icon={c.icon} title={c.title} description={c.subtitle} titleTestId="reset-2fa-title" descriptionTestId="reset-2fa-message" action={action} secondary={status === "confirm" ? (
            <Button onClick={goToLogin.onClick} data-testid="reset-2fa-cancel-btn" sx={{ textTransform: "none", fontSize: 13, color: theme.palette.text.secondary }}>
              {t("reset2fa.cancel", { defaultValue: "Cancel — keep my authenticator" })}
            </Button>
          ) : undefined} testId="reset-2fa-status">
          {status === "success" && (
            <Box
              component="ul"
              data-testid="reset-2fa-next"
              sx={{ m: 0, pl: 2.25, py: 1.5, pr: 2, width: "100%", boxSizing: "border-box", borderRadius: "12px", fontSize: 13.5, lineHeight: 1.6, fontFamily: "var(--font-body), var(--font-sans)", color: theme.palette.text.secondary, backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,15,20,0.03)", "& li + li": { mt: 0.5 } }}
            >
              <Typography component="li" sx={{ listStyle: "none", ml: -2.25, mb: 0.75, fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary }}>{t("reset2fa.nextTitle", { defaultValue: "What happens next" })}</Typography>
              <li>{t("reset2fa.next1", { defaultValue: "Sign in with your password — we'll email you a 6-digit code." })}</li>
              <li>{t("reset2fa.next2", { defaultValue: "Add a new authenticator app from Settings → Security when you're ready." })}</li>
              <li data-testid="reset-2fa-freeze-note">{untilLabel ? t("reset2fa.next3", { defaultValue: "Payout address changes are locked until {{until}}. Contact support to unlock sooner.", until: untilLabel }) : t("reset2fa.next3NoDate", { defaultValue: "Payout address changes are locked for 24 hours. Contact support to unlock sooner." })}</li>
            </Box>
          )}
        </AuthStatus>
      </Box>
    </AuthShell>
  );
};

export default Reset2FAPage;
