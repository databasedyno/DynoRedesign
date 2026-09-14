import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, Button, Chip, CircularProgress, Skeleton, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Icon } from "@/styles/uiKit";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useDispatch } from "react-redux";
import { TOAST_SHOW } from "@/Redux/Actions/ToastAction";
import axiosBaseApi from "@/axiosConfig";
import { API_ENDPOINTS } from "@/api/endpoints";
import { formatDateI18n, formatDateTimeI18n } from "@/utils/formatDate";

interface TrustedDevice {
  id: number;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  ip_address: string | null;
  created_at: string;
  last_seen_at: string;
  expires_at: string;
  is_current: boolean;
}

const fetcher = async (url: string) => {
  const res = await axiosBaseApi.get(url);
  return (res.data?.data?.devices as TrustedDevice[]) || [];
};

/** Settings › Security — browsers that skip the 2FA challenge (90 rolling days). */
const TrustedDevices: React.FC = () => {
  const { t } = useTranslation("profile");
  const theme = useTheme();
  const isMobile = useIsMobile("sm");
  const dispatch = useDispatch();
  const toast = (message: string, severity: "success" | "error" = "success") => dispatch({ type: TOAST_SHOW, payload: { message, severity } });
  const { data, isLoading, mutate } = useSWR<TrustedDevice[]>(API_ENDPOINTS.user.trustedDevices, fetcher, { revalidateOnFocus: false });
  const [busy, setBusy] = useState<number | "all" | null>(null);
  const devices = data ?? [];
  const loading = isLoading && data === undefined;

  const forget = async (id: number | "all") => {
    setBusy(id);
    try {
      await axiosBaseApi.delete(id === "all" ? API_ENDPOINTS.user.trustedDevices : API_ENDPOINTS.user.trustedDevice(id));
      toast(
        id === "all"
          ? t("trustedDevices.forgotAll", { defaultValue: "All devices forgotten. Every browser will be asked for a code next time." })
          : t("trustedDevices.forgotOne", { defaultValue: "Device forgotten. It will be asked for a code next time." })
      );
      await mutate();
    } catch (e: unknown) {
      toast((e as { response?: { data?: { message?: string } } })?.response?.data?.message || t("trustedDevices.failed", { defaultValue: "Couldn't update trusted devices." }), "error");
    } finally {
      setBusy(null);
    }
  };

  const relative = (iso: string) => {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
    if (days < 1) return t("today", { defaultValue: "today" });
    if (days < 7) return t("daysAgo", { count: days, defaultValue: `${days}d ago` });
    return formatDateI18n(iso, { day: "2-digit", month: "short", year: "numeric" });
  };

  return (
    <PanelCard
      bodyPadding={isMobile ? `${theme.spacing(1.5, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
      title={t("trustedDevices.title", { defaultValue: "Trusted devices" })}
      subTitle={t("trustedDevices.subtitle", { defaultValue: "Browsers that passed two-step verification skip the code for 90 days. Forget one to make it ask again." })}
      showHeaderBorder={false}
      headerAction={
        devices.length > 0 ? (
          <Button
            data-testid="trusted-devices-forget-all"
            size="small"
            color="error"
            variant="outlined"
            onClick={() => forget("all")}
            disabled={busy !== null || loading}
            startIcon={busy === "all" ? <CircularProgress size={14} color="inherit" /> : <Icon name="shield-off" size={16} />}
            sx={{ textTransform: "none", fontSize: "12px", fontFamily: "var(--font-sans)", borderRadius: "8px" }}
          >
            {t("trustedDevices.forgetAll", { defaultValue: "Forget all" })}
          </Button>
        ) : (
          <Box aria-hidden sx={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="shield-check" size={16} color={theme.palette.text.secondary} />
          </Box>
        )
      }
    >
      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2].map((i) => <Skeleton key={i} variant="rounded" height={56} sx={{ borderRadius: "8px" }} />)}
        </Box>
      ) : devices.length === 0 ? (
        <Typography data-testid="no-trusted-devices" sx={{ fontSize: "14px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", textAlign: "center", py: 3 }}>
          {t("trustedDevices.empty", { defaultValue: "No trusted devices yet — the next browser you verify with a code will appear here." })}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }} data-testid="trusted-devices-list">
          {devices.map((d) => (
            <Box
              key={d.id}
              data-testid={`trusted-device-${d.id}`}
              sx={{
                display: "flex", alignItems: "center", gap: isMobile ? "10px" : "14px", p: isMobile ? "10px 12px" : "12px 16px", borderRadius: "10px", border: "1px solid",
                borderColor: d.is_current ? (theme.palette.mode === "dark" ? "rgba(34,197,94,0.35)" : "rgba(22,163,74,0.30)") : "divider",
                backgroundColor: d.is_current ? (theme.palette.mode === "dark" ? "rgba(34,197,94,0.06)" : "rgba(22,163,74,0.04)") : "transparent",
              }}
            >
              <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "8px", backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
                <Icon name={(d.device_name || "").toLowerCase().includes("phone") ? "smartphone" : "laptop"} size={18} color={theme.palette.text.secondary} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, lineHeight: 1.3 }}>
                    {d.device_name || t("unknownDevice", { defaultValue: "Unknown device" })}
                    {d.browser && d.browser !== "Unknown" ? ` · ${d.browser}` : ""}
                  </Typography>
                  {d.os && d.os !== "Unknown" && <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>{d.os}</Typography>}
                  {d.is_current && (
                    <Chip data-testid={`trusted-device-current-${d.id}`} label={t("thisDevice", { defaultValue: "This device" })} size="small" color="success" variant="outlined" sx={{ height: "20px", fontSize: "11px", fontFamily: "var(--font-sans)" }} />
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "4px", mt: "2px", flexWrap: "wrap" }}>
                  {d.ip_address && (
                    <>
                      <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>IP: {d.ip_address}</Typography>
                      <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, mx: "2px" }}>·</Typography>
                    </>
                  )}
                  <Tooltip title={formatDateTimeI18n(d.last_seen_at, { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} placement="top" arrow>
                    <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                      {t("trustedDevices.lastUsed", { defaultValue: "last used" })} {relative(d.last_seen_at)}
                    </Typography>
                  </Tooltip>
                  <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, mx: "2px" }}>·</Typography>
                  <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                    {t("trustedDevices.expires", { defaultValue: "trusted until" })} {formatDateI18n(d.expires_at, { day: "2-digit", month: "short" })}
                  </Typography>
                </Box>
              </Box>
              <Button
                data-testid={`trusted-device-forget-${d.id}`}
                size="small"
                color="error"
                variant="text"
                onClick={() => forget(d.id)}
                disabled={busy !== null}
                startIcon={busy === d.id ? <CircularProgress size={13} color="inherit" /> : <Icon name="x" size={15} />}
                sx={{ textTransform: "none", fontSize: "12px", fontFamily: "var(--font-sans)", flexShrink: 0 }}
              >
                {t("trustedDevices.forget", { defaultValue: "Forget" })}
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </PanelCard>
  );
};

export default TrustedDevices;
