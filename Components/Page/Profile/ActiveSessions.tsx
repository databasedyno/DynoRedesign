import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Skeleton,
  Snackbar,
  Alert,
  Tooltip,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DevicesIcon from "@mui/icons-material/Devices";
import LaptopIcon from "@mui/icons-material/Laptop";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TabletIcon from "@mui/icons-material/Tablet";
import LogoutIcon from "@mui/icons-material/Logout";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";

interface SessionEntry {
  session_id: number;
  ip_address: string;
  device_type: string | null;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  location: string | null;
  last_activity: string;
  created_at: string;
  is_current: boolean;
}

const ActiveSessions = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("profile");

  const [sessions, setSessions] = useState<SessionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [toast, setToast] = useState<{ msg: string; sev: "success" | "error" } | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosBaseApi.get("user/sessions");
      const data = res.data?.data;
      setSessions((data?.sessions || []) as SessionEntry[]);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const revokeOne = async (id: number) => {
    setRevoking(id);
    try {
      await axiosBaseApi.delete(`user/sessions/${id}`);
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
      setToast({ msg: t("sessionSignedOut", { defaultValue: "Device signed out" }), sev: "success" });
    } catch {
      setToast({ msg: t("sessionSignOutFailed", { defaultValue: "Couldn't sign out that device" }), sev: "error" });
    } finally {
      setRevoking(null);
    }
  };

  const revokeAllOthers = async () => {
    const current = sessions.find((s) => s.is_current);
    setRevokingAll(true);
    try {
      await axiosBaseApi.delete("user/sessions", {
        data: { current_session_id: current?.session_id },
      });
      setToast({ msg: t("otherSessionsSignedOut", { defaultValue: "All other devices signed out" }), sev: "success" });
      await fetchSessions();
    } catch {
      setToast({ msg: t("sessionSignOutFailed", { defaultValue: "Couldn't sign out other devices" }), sev: "error" });
    } finally {
      setRevokingAll(false);
    }
  };

  const relativeTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return t("justNow", { defaultValue: "just now" });
    if (mins < 60) return t("minutesAgo", { count: mins, defaultValue: `${mins}m ago` });
    if (hours < 24) return t("hoursAgo", { count: hours, defaultValue: `${hours}h ago` });
    if (days < 7) return t("daysAgo", { count: days, defaultValue: `${days}d ago` });
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const fullTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) +
      " at " +
      d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })
    );
  };

  const getDeviceIcon = (device: string | null) => {
    const d = (device || "").toLowerCase();
    if (d.includes("phone") || d.includes("mobile") || d.includes("iphone")) {
      return <PhoneAndroidIcon sx={{ fontSize: "18px", color: theme.palette.text.secondary }} />;
    }
    if (d.includes("tablet") || d.includes("ipad")) {
      return <TabletIcon sx={{ fontSize: "18px", color: theme.palette.text.secondary }} />;
    }
    return <LaptopIcon sx={{ fontSize: "18px", color: theme.palette.text.secondary }} />;
  };

  const hasOthers = sessions.some((s) => !s.is_current);

  return (
    <>
      <PanelCard
        bodyPadding={isMobile ? `${theme.spacing(1.5, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
        title={t("activeSessions", { defaultValue: "Active devices" })}
        showHeaderBorder={false}
        headerAction={
          hasOthers ? (
            <Button
              data-testid="sign-out-all-others"
              size="small"
              color="error"
              variant="outlined"
              onClick={revokeAllOthers}
              disabled={revokingAll || loading}
              startIcon={revokingAll ? <CircularProgress size={14} color="inherit" /> : <LogoutIcon sx={{ fontSize: "16px" }} />}
              sx={{ textTransform: "none", fontSize: "12px", fontFamily: "var(--font-sans)", borderRadius: "8px" }}
            >
              {t("signOutAllOthers", { defaultValue: "Sign out all others" })}
            </Button>
          ) : (
            <IconButton>
              <DevicesIcon color="action" style={{ height: "16px", width: "16px" }} />
            </IconButton>
          )
        }
      >
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2].map((i) => (
              <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: "8px" }} />
            ))}
          </Box>
        ) : sessions.length === 0 ? (
          <Typography
            data-testid="no-active-sessions"
            sx={{ fontSize: "14px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", textAlign: "center", py: 3 }}
          >
            {t("noActiveSessions", { defaultValue: "No active sessions found." })}
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sessions.map((s) => (
              <Box
                key={s.session_id}
                data-testid={`session-row-${s.session_id}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: isMobile ? "10px" : "14px",
                  p: isMobile ? "10px 12px" : "12px 16px",
                  borderRadius: "10px",
                  border: "1px solid",
                  borderColor: s.is_current
                    ? theme.palette.mode === "dark" ? "rgba(34,197,94,0.35)" : "rgba(22,163,74,0.30)"
                    : "divider",
                  backgroundColor: s.is_current
                    ? theme.palette.mode === "dark" ? "rgba(34,197,94,0.06)" : "rgba(22,163,74,0.04)"
                    : "transparent",
                }}
              >
                <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "8px", backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
                  {getDeviceIcon(s.device_type || s.device_name)}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                    <Typography sx={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 600, fontFamily: "var(--font-sans)", color: theme.palette.text.primary, lineHeight: 1.3 }}>
                      {s.device_name || s.device_type || "Unknown device"}
                      {s.browser && s.browser !== "Unknown" ? ` · ${s.browser}` : ""}
                    </Typography>
                    {s.os && s.os !== "Unknown" && (
                      <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                        {s.os}
                      </Typography>
                    )}
                    {s.is_current && (
                      <Chip
                        data-testid={`session-current-${s.session_id}`}
                        label={t("thisDevice", { defaultValue: "This device" })}
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ height: "20px", fontSize: "11px", fontFamily: "var(--font-sans)" }}
                      />
                    )}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "4px", mt: "2px", flexWrap: "wrap" }}>
                    {s.location && (
                      <>
                        <LocationOnOutlinedIcon sx={{ fontSize: "13px", color: theme.palette.text.secondary }} />
                        <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                          {s.location}
                        </Typography>
                        <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, mx: "2px" }}>·</Typography>
                      </>
                    )}
                    <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)", fontVariantNumeric: "tabular-nums" }}>
                      IP: {s.ip_address}
                    </Typography>
                    <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, mx: "2px" }}>·</Typography>
                    <Tooltip title={fullTime(s.last_activity)} placement="top" arrow>
                      <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "var(--font-sans)" }}>
                        {t("activeLabel", { defaultValue: "active" })} {relativeTime(s.last_activity)}
                      </Typography>
                    </Tooltip>
                  </Box>
                </Box>

                {!s.is_current && (
                  <Button
                    data-testid={`session-signout-${s.session_id}`}
                    size="small"
                    color="error"
                    variant="text"
                    onClick={() => revokeOne(s.session_id)}
                    disabled={revoking === s.session_id}
                    startIcon={revoking === s.session_id ? <CircularProgress size={13} color="inherit" /> : <LogoutIcon sx={{ fontSize: "15px" }} />}
                    sx={{ textTransform: "none", fontSize: "12px", fontFamily: "var(--font-sans)", flexShrink: 0 }}
                  >
                    {t("signOut", { defaultValue: "Sign out" })}
                  </Button>
                )}
              </Box>
            ))}
          </Box>
        )}
      </PanelCard>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {toast ? (
          <Alert severity={toast.sev} variant="filled" onClose={() => setToast(null)} sx={{ fontFamily: "var(--font-sans)" }}>
            {toast.msg}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};

export default ActiveSessions;
