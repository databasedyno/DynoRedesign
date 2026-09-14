import React, { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useRouter } from "next/router";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import axiosBaseApi from "@/axiosConfig";
import { useTranslation } from "react-i18next";
import AuthShell from "@/Components/UI/AuthLayout/AuthShell";
import AuthStatus from "@/Components/UI/AuthLayout/AuthStatus";

type Status = "loading" | "success" | "error" | "invalid";

const SecureAccountPage = () => {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation("auth");
  const { token } = router.query;

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!router.isReady) return;
    if (!token || typeof token !== "string") {
      setStatus("invalid");
      setMessage(t("secureAccount.invalidDefault"));
      return;
    }

    const flagLogin = async () => {
      try {
        const res = await axiosBaseApi.post("user/security/flag-login", { token });
        setStatus("success");
        setMessage(res.data?.message || t("secureAccount.successDefault"));
      } catch (e: any) {
        const msg = e.response?.data?.message || t("secureAccount.failedDefault");
        if (e.response?.status === 404) {
          setStatus("invalid");
          setMessage(t("secureAccount.invalidDefault"));
        } else {
          setStatus("error");
          setMessage(msg);
        }
      }
    };

    flagLogin();
  }, [router.isReady, token, t]);

  const cfg: Record<Status, { tone: "loading" | "success" | "error" | "neutral"; icon: React.ReactNode; title: string; subtitle: string }> = {
    loading: { tone: "loading", icon: null, title: t("secureAccount.loadingTitle"), subtitle: t("secureAccount.loadingSubtitle") },
    success: { tone: "success", icon: <CheckCircleOutlineIcon fontSize="medium" />, title: t("secureAccount.successTitle"), subtitle: message },
    error: { tone: "error", icon: <ErrorOutlineIcon fontSize="medium" />, title: t("secureAccount.errorTitle"), subtitle: message },
    invalid: { tone: "neutral", icon: <ShieldOutlinedIcon fontSize="medium" />, title: t("secureAccount.invalidTitle"), subtitle: message },
  };
  const c = cfg[status];
  const goToLogin = { label: t("secureAccount.goToLogin"), onClick: () => router.push("/auth/login"), testId: "secure-account-login-btn" };

  return (
    <AuthShell brand title={`${t("secureAccount.headTitle", { defaultValue: "Secure your account" })} · Dynopay`} testId="secure-account-page">
      <Box data-testid="secure-account-card" data-status={status}>
        <AuthStatus tone={c.tone} icon={c.icon} title={c.title} description={c.subtitle} titleTestId="secure-account-title" descriptionTestId="secure-account-message" action={status === "loading" ? undefined : goToLogin} testId="secure-account-status">
          {status === "success" && (
            <Box
              component="ul"
              data-testid="secure-account-next"
              sx={{ m: 0, pl: 2.25, py: 1.5, pr: 2, width: "100%", boxSizing: "border-box", borderRadius: "12px", fontSize: 13.5, lineHeight: 1.6, fontFamily: "var(--font-body), var(--font-sans)", color: theme.palette.text.secondary, backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,15,20,0.03)", "& li + li": { mt: 0.5 } }}
            >
              <Typography component="li" sx={{ listStyle: "none", ml: -2.25, mb: 0.75, fontSize: 13.5, fontWeight: 700, color: theme.palette.text.primary }}>{t("secureAccount.nextTitle")}</Typography>
              <li>{t("secureAccount.next1")}</li>
              <li>{t("secureAccount.next2")}</li>
              <li>{t("secureAccount.next3")}</li>
            </Box>
          )}
        </AuthStatus>
      </Box>
    </AuthShell>
  );
};

export default SecureAccountPage;
