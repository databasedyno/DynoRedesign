import React, { useState } from "react";
import { Box, Button, Chip, CircularProgress, IconButton, Skeleton, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import useSWR from "swr";
import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import { rootReducer } from "@/utils/types";
import { Icon } from "@/styles/uiKit";
import { formatDateI18n } from "@/utils/formatDate";
import TwoFactorSetupDialog from "./twoFactor/TwoFactorSetupDialog";
import ReauthDialog, { ReauthIntent } from "./twoFactor/ReauthDialog";

interface TwoFAStatus {
  enabled: boolean;
  method: string;
  backup_codes_remaining: number;
  enabled_at: string | null;
  last_used_at: string | null;
}

const statusFetcher = async (url: string): Promise<TwoFAStatus> => {
  const res = await axiosBaseApi.get(url);
  return res.data?.data as TwoFAStatus;
};

/** Settings › Profile & Security — authenticator-app (TOTP) two-factor authentication. */
const TwoFactorAuth = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("profile");
  const dispatch = useDispatch();
  const profile = useSelector((state: rootReducer) => state.userReducer.profile);
  const hasPassword = !!profile?.has_password;

  const { data, isLoading, mutate } = useSWR<TwoFAStatus>(API_ENDPOINTS.user.twoFaStatus, statusFetcher);
  const loading = isLoading && data === undefined;
  const enabled = !!data?.enabled;

  const [setupOpen, setSetupOpen] = useState(false);
  const [reauth, setReauth] = useState<ReauthIntent | null>(null);

  const toast = (message: string, severity: "success" | "error" = "success") =>
    dispatch({ type: TOAST_SHOW, payload: { message, severity } });

  const handleEnabled = async () => {
    await mutate();
    toast(t("twoFactor.toastEnabled", { defaultValue: "Two-factor authentication is now on." }));
  };

  const handleReauthConfirm = async (credential: { password?: string; token?: string }) => {
    if (reauth === "disable") {
      await axiosBaseApi.post(API_ENDPOINTS.user.twoFaDisable, credential);
      await mutate();
      toast(t("twoFactor.toastDisabled", { defaultValue: "Two-factor authentication has been turned off." }));
      return;
    }
    const res = await axiosBaseApi.post(API_ENDPOINTS.user.twoFaRegenerateBackupCodes, credential);
    await mutate();
    return (res.data?.data?.backup_codes || []) as string[];
  };

  const isDark = theme.palette.mode === "dark";
  const okBg = isDark ? "rgba(34,197,94,0.08)" : "rgba(22,163,74,0.06)";
  const okBorder = isDark ? "rgba(34,197,94,0.35)" : "rgba(22,163,74,0.30)";
  const lowCodes = enabled && (data?.backup_codes_remaining ?? 0) <= 2;

  return (
    <>
      <PanelCard
        bodyPadding={isMobile ? `${theme.spacing(1.5, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
        title={t("twoFactor.cardTitle", { defaultValue: "Two-factor authentication" })}
        subTitle={t("twoFactor.cardSubtitle", { defaultValue: "Add a second step at sign-in with a code from an authenticator app." })}
        showHeaderBorder={false}
        headerAction={
          <IconButton>
            <Icon name="shield-check" size={16} color={theme.palette.text.secondary} />
          </IconButton>
        }
      >
        {loading ? (
          <Skeleton variant="rounded" height={72} sx={{ borderRadius: "10px" }} />
        ) : (
          <Box
            data-testid="twofa-status-row"
            data-enabled={enabled ? "true" : "false"}
            sx={{
              display: "flex",
              alignItems: isMobile ? "flex-start" : "center",
              flexDirection: isMobile ? "column" : "row",
              gap: isMobile ? "12px" : "16px",
              p: isMobile ? "12px 14px" : "14px 16px",
              borderRadius: "10px",
              border: "1px solid",
              borderColor: enabled ? okBorder : "divider",
              backgroundColor: enabled ? okBg : "transparent",
            }}
          >
            <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "8px", backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
              <Icon name={enabled ? "lucide:shield-check" : "lucide:shield-off"} size={18} color={enabled ? (isDark ? "#4ade80" : "#16a34a") : theme.palette.text.secondary} />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <Typography sx={{ fontSize: "14px", fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary }}>
                  {t("twoFactor.methodApp", { defaultValue: "Authenticator app" })}
                </Typography>
                <Chip
                  data-testid="twofa-status-chip"
                  label={enabled ? t("twoFactor.statusOn", { defaultValue: "On" }) : t("twoFactor.statusOff", { defaultValue: "Off" })}
                  size="small"
                  color={enabled ? "success" : "default"}
                  variant="outlined"
                  sx={{ height: "20px", fontSize: "11px", fontFamily: "var(--font-sans)", fontWeight: 600 }}
                />
              </Box>
              <Typography sx={{ fontSize: "12.5px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", mt: "3px" }}>
                {enabled
                  ? t("twoFactor.enabledSince", {
                      date: data?.enabled_at ? formatDateI18n(data.enabled_at, { day: "2-digit", month: "short", year: "numeric" }) : "—",
                      count: data?.backup_codes_remaining ?? 0,
                      defaultValue: `On since {{date}} · {{count}} backup codes left`,
                    })
                  : t("twoFactor.offHint", { defaultValue: "Recommended — protects your funds even if your password leaks." })}
              </Typography>
              {lowCodes && (
                <Typography data-testid="twofa-low-codes" sx={{ fontSize: "12px", color: isDark ? "#FBBF24" : "#B45309", fontFamily: "var(--font-sans)", mt: "4px", fontWeight: 600 }}>
                  {t("twoFactor.lowCodes", { defaultValue: "You're running low on backup codes — generate a new set." })}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: "flex", gap: "8px", flexShrink: 0, width: isMobile ? "100%" : "auto", flexWrap: "wrap" }}>
              {enabled ? (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setReauth("regenerate")}
                    data-testid="twofa-regenerate-btn"
                    sx={{ textTransform: "none", fontSize: "12.5px", fontFamily: "var(--font-sans)", borderRadius: "8px", flex: isMobile ? 1 : "none" }}
                  >
                    {t("twoFactor.newCodes", { defaultValue: "New backup codes" })}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => setReauth("disable")}
                    data-testid="twofa-disable-btn"
                    sx={{ textTransform: "none", fontSize: "12.5px", fontFamily: "var(--font-sans)", borderRadius: "8px", flex: isMobile ? 1 : "none" }}
                  >
                    {t("twoFactor.turnOff", { defaultValue: "Turn off" })}
                  </Button>
                </>
              ) : (
                <Button
                  size="small"
                  variant="contained"
                  disableElevation
                  onClick={() => setSetupOpen(true)}
                  data-testid="twofa-enable-btn"
                  startIcon={isLoading ? <CircularProgress size={13} color="inherit" /> : undefined}
                  sx={{ textTransform: "none", fontSize: "12.5px", fontFamily: "var(--font-sans)", borderRadius: "8px", backgroundColor: "#4F46E5", "&:hover": { backgroundColor: "#4338CA" }, width: isMobile ? "100%" : "auto" }}
                >
                  {t("twoFactor.turnOn", { defaultValue: "Turn on 2FA" })}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </PanelCard>

      <TwoFactorSetupDialog open={setupOpen} onClose={() => setSetupOpen(false)} onEnabled={handleEnabled} />
      <ReauthDialog
        open={reauth !== null}
        intent={reauth || "disable"}
        hasPassword={hasPassword}
        onClose={() => setReauth(null)}
        onConfirm={handleReauthConfirm}
      />
    </>
  );
};

export default TwoFactorAuth;
