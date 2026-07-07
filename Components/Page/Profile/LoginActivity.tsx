import PanelCard from "@/Components/UI/PanelCard";
import useIsMobile from "@/hooks/useIsMobile";
import { Box, Chip, IconButton, Pagination, Skeleton, Tooltip, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import HistoryIcon from "@mui/icons-material/History";
import LaptopIcon from "@mui/icons-material/Laptop";
import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import TabletIcon from "@mui/icons-material/Tablet";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import axiosBaseApi from "@/axiosConfig";

interface LoginEntry {
  id: number;
  ip_address: string;
  device: string;
  browser: string;
  os: string;
  location: string | null;
  flagged: boolean;
  flagged_at: string | null;
  login_at: string;
}

const LoginActivity = () => {
  const theme = useTheme();
  const isMobile = useIsMobile("md");
  const { t } = useTranslation("profile");
  const [activities, setActivities] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchActivity = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await axiosBaseApi.get(`user/login-activity?page=${p}&limit=10`);
      const data = res.data?.data;
      setActivities(data?.activities || []);
      setTotalPages(data?.pagination?.totalPages || 1);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActivity(page);
  }, [page, fetchActivity]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) +
      ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getDeviceIcon = (device: string) => {
    if (device.includes('Phone') || device === 'iPhone' || device === 'Mobile') {
      return <PhoneAndroidIcon sx={{ fontSize: "18px", color: theme.palette.text.secondary }} />;
    }
    if (device === 'iPad' || device.includes('Tablet')) {
      return <TabletIcon sx={{ fontSize: "18px", color: theme.palette.text.secondary }} />;
    }
    return <LaptopIcon sx={{ fontSize: "18px", color: theme.palette.text.secondary }} />;
  };

  return (
    <PanelCard
      bodyPadding={isMobile ? `${theme.spacing(1.5, 2, 2, 2)}` : `${theme.spacing(2, 2.5, 2.5, 2.5)}`}
      title={t("loginActivity")}
      showHeaderBorder={false}
      headerAction={
        <IconButton>
          <HistoryIcon color="action" style={{ height: "16px", width: "16px" }} />
        </IconButton>
      }
    >
      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={60} sx={{ borderRadius: "8px" }} />
          ))}
        </Box>
      ) : activities.length === 0 ? (
        <Typography
          data-testid="no-login-activity"
          sx={{ fontSize: "14px", color: theme.palette.text.secondary, fontFamily: "UrbanistMedium", textAlign: "center", py: 3 }}
        >
          {t("noLoginActivity")}
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {activities.map((entry) => (
            <Box
              key={entry.id}
              data-testid={`login-activity-row-${entry.id}`}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: isMobile ? "10px" : "14px",
                p: isMobile ? "10px 12px" : "12px 16px",
                borderRadius: "10px",
                border: "1px solid",
                borderColor: entry.flagged
                  ? (theme.palette.mode === "dark" ? "rgba(239, 68, 68, 0.3)" : "rgba(239, 68, 68, 0.2)")
                  : "divider",
                backgroundColor: entry.flagged
                  ? (theme.palette.mode === "dark" ? "rgba(239, 68, 68, 0.06)" : "rgba(239, 68, 68, 0.03)")
                  : "transparent",
                transition: "background-color 0.15s",
                "&:hover": {
                  backgroundColor: entry.flagged
                    ? (theme.palette.mode === "dark" ? "rgba(239, 68, 68, 0.1)" : "rgba(239, 68, 68, 0.06)")
                    : (theme.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)"),
                },
              }}
            >
              {/* Device icon */}
              <Box sx={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "8px", backgroundColor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" }}>
                {getDeviceIcon(entry.device)}
              </Box>

              {/* Details */}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  <Typography sx={{ fontSize: isMobile ? "13px" : "14px", fontWeight: 600, fontFamily: "UrbanistSemibold", color: theme.palette.text.primary, lineHeight: 1.3 }}>
                    {entry.device}{entry.browser && entry.browser !== 'Unknown' ? ` · ${entry.browser}` : ''}
                  </Typography>
                  {entry.os && entry.os !== 'Unknown' && (
                    <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "UrbanistMedium" }}>
                      {entry.os}
                    </Typography>
                  )}
                  {entry.flagged && (
                    <Chip
                      data-testid={`flagged-badge-${entry.id}`}
                      icon={<FlagOutlinedIcon sx={{ fontSize: "13px !important" }} />}
                      label={t("flagged")}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ height: "20px", fontSize: "11px", fontFamily: "UrbanistMedium" }}
                    />
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "4px", mt: "2px" }}>
                  {entry.location && (
                    <>
                      <LocationOnOutlinedIcon sx={{ fontSize: "13px", color: theme.palette.text.secondary }} />
                      <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "UrbanistMedium" }}>
                        {entry.location}
                      </Typography>
                      <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, mx: "2px" }}>·</Typography>
                    </>
                  )}
                  <Typography sx={{ fontSize: "12px", color: theme.palette.text.secondary, fontFamily: "UrbanistMedium", fontVariantNumeric: "tabular-nums" }}>
                    IP: {entry.ip_address}
                  </Typography>
                </Box>
              </Box>

              {/* Time */}
              <Tooltip title={formatFullDate(entry.login_at)} placement="left" arrow>
                <Typography
                  sx={{
                    fontSize: isMobile ? "11px" : "12px",
                    color: theme.palette.text.secondary,
                    fontFamily: "UrbanistMedium",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {formatDate(entry.login_at)}
                </Typography>
              </Tooltip>
            </Box>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: "8px" }}>
              <Pagination
                data-testid="login-activity-pagination"
                count={totalPages}
                page={page}
                onChange={(_, p) => setPage(p)}
                size="small"
                shape="rounded"
              />
            </Box>
          )}
        </Box>
      )}
    </PanelCard>
  );
};

export default LoginActivity;
