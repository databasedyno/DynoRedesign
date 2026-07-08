import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography, CircularProgress, Skeleton, useTheme } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SuccessChip,
  TypographyDescription,
  TypographyTime,
  TypographyTitle,
} from "@/Components/UI/HomeCard/styled";
import successIcon from "@/assets/Icons/home/success.svg";
import serviceIcon from "@/assets/Icons/home/service.svg";
import Image from "next/image";
import Bars from "@/Components/UI/APIStatus/Bars";
import axiosBaseApi from "@/axiosConfig";

interface ServiceData {
  id: string;
  name: string;
  status: string;
  uptime: string;
  uptime_value: number;
  latency_ms: number;
  total_checks: number;
  failed_checks: number;
  last_check: string | null;
}

interface IncidentData {
  id: number;
  title: string;
  description: string;
  status: string;
  date: string;
  formatted_date: string;
  services_affected: string[];
}

interface UptimeDay {
  date: string;
  status: string;
}

interface UptimeData {
  period_days: number;
  uptime_percentage: string;
  summary: {
    operational_days: number;
    degraded_days: number;
    outage_days: number;
  };
  daily_status: UptimeDay[];
}

const StatusPage = () => {
  const isMobile = useIsMobile();
  const { t } = useTranslation("apiStatus");

  const [services, setServices] = useState<ServiceData[]>([]);
  const [incidents, setIncidents] = useState<IncidentData[]>([]);
  const [uptimeData, setUptimeData] = useState<UptimeData | null>(null);
  const [overallStatus, setOverallStatus] = useState<string>("operational");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      setLoading(true);
      setError(null);

      try {
        const [servicesRes, incidentsRes, uptimeRes] = await Promise.all([
          axiosBaseApi.get("/status/services").catch((err) => {
            console.error("Failed to fetch services:", err);
            return null;
          }),
          axiosBaseApi.get("/status/incidents").catch((err) => {
            console.error("Failed to fetch incidents:", err);
            return null;
          }),
          axiosBaseApi.get("/status/uptime").catch((err) => {
            console.error("Failed to fetch uptime:", err);
            return null;
          }),
        ]);

        // Parse services
        if (servicesRes?.data?.data?.services) {
          const svc: ServiceData[] = servicesRes.data.data.services;
          setServices(svc);
          const allOp = svc.every((s) => s.status === "operational");
          const hasOutage = svc.some((s) => s.status === "outage");
          setOverallStatus(
            hasOutage ? "partial_outage" : allOp ? "operational" : "degraded"
          );
        }

        // Parse incidents
        if (incidentsRes?.data?.data?.incidents) {
          setIncidents(incidentsRes.data.data.incidents);
        }

        // Parse uptime
        if (uptimeRes?.data?.data) {
          setUptimeData(uptimeRes.data.data);
        }
      } catch (err) {
        console.error("Failed to fetch status data:", err);
        setError("Unable to load status data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "#22C55E";
      case "degraded":
        return "#F59E0B";
      case "outage":
        return "#EF4444";
      default:
        return "#676B7E";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "operational":
        return "Operational";
      case "degraded":
        return "Degraded";
      case "outage":
        return "Outage";
      case "partial_outage":
        return "Partial Outage";
      default:
        return "Unknown";
    }
  };

  const getOverallChipBg = () => {
    switch (overallStatus) {
      case "operational":
        return "#22C55E1A";
      case "degraded":
        return "#F59E0B1A";
      case "partial_outage":
      case "outage":
        return "#EF44441A";
      default:
        return "#22C55E1A";
    }
  };

  const getOverallChipBorder = () => {
    switch (overallStatus) {
      case "operational":
        return "#22C55E33";
      case "degraded":
        return "#F59E0B33";
      case "partial_outage":
      case "outage":
        return "#EF444433";
      default:
        return "#22C55E33";
    }
  };

  return (
    <Box
      sx={{
        width: isMobile ? "100%" : 768,
        maxWidth: "100%",
        minWidth: 320,
        px: "24px",
        mx: "auto",
        pt: isMobile ? "113px" : "128px",
        mb: isMobile ? 6 : "93px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: isMobile ? "23px" : "48px",
      }}
    >
      {/* STATUS HEADER */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {loading ? (
          <Skeleton
            variant="rounded"
            width={320}
            height={50}
            sx={{ borderRadius: "9999px" }}
          />
        ) : (
          <Box
            sx={{
              backgroundColor: getOverallChipBg(),
              height: "50px",
              width: "100%",
              border: "1px solid",
              borderColor: getOverallChipBorder(),
              borderRadius: "9999px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              px: 3,
            }}
          >
            <Image src={successIcon} alt="status" width={24} height={24} />
            <Typography
              sx={{
                fontWeight: 600,
                color: getStatusColor(overallStatus),
                fontFamily: "OutfitSemiBold",
                lineHeight: "24px",
                letterSpacing: 0,
              }}
            >
              {overallStatus === "operational"
                ? t("allSystemsOperational")
                : getStatusLabel(overallStatus)}
            </Typography>
          </Box>
        )}

        <Typography
          sx={{
            mt: "16px",
            fontWeight: 700,
            fontSize: "30px",
            lineHeight: "36px",
            fontFamily: "OutfitBold",
            color: "text.primary",
            letterSpacing: 0,
          }}
        >
          {t("dynoPayStatus")}
        </Typography>

        <Typography
          sx={{
            mt: "8px",
            fontSize: "16px",
            lineHeight: "24px",
            letterSpacing: 0,
            fontFamily: "OutfitRegular",
            color: "text.secondary",
          }}
        >
          {t("statusSubtitle")}
        </Typography>
      </Box>

      {/* SERVICES */}
      <Box
        width="100%"
        sx={{
          border: "1px solid",
          borderColor: "border.main",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        <Box
          height={57}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            pl: "24px",
          }}
        >
          <Image src={serviceIcon} alt="service" width={20} height={20} />
          <TypographyTitle>{t("services")}</TypographyTitle>
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Box
                  key={i}
                  height={isMobile ? 79 : 57}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: "24px",
                    borderTop: "1px solid",
                    borderColor: "border.main",
                  }}
                >
                  <Skeleton variant="text" width={150} height={24} />
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Skeleton variant="text" width={80} height={20} />
                    <Skeleton variant="text" width={80} height={20} />
                  </Box>
                </Box>
              ))
            : services.map((service, index) => (
                <Box
                  key={service.id || index}
                  height={isMobile ? 79 : 57}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    px: "24px",
                    borderTop: "1px solid",
                    borderColor: "border.main",
                  }}
                >
                  <Box
                    width={isMobile ? 120 : "auto"}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    {/* Status dot */}
                    <Box
                      sx={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        backgroundColor: getStatusColor(service.status),
                        flexShrink: 0,
                      }}
                    />
                    <Typography
                      sx={{
                        fontFamily: "OutfitRegular",
                        lineHeight: "24px",
                        letterSpacing: 0,
                        color: "text.primary",
                      }}
                    >
                      {service.name}
                    </Typography>
                  </Box>

                  <Box
                    width={isMobile ? 180 : 240}
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "12px",
                      ml: "auto",
                    }}
                  >
                    <TypographyDescription>
                      {service.uptime} {t("uptime")}
                    </TypographyDescription>

                    {service.latency_ms > 0 && !isMobile && (
                      <TypographyDescription>
                        {service.latency_ms}ms
                      </TypographyDescription>
                    )}

                    <Typography
                      sx={{
                        fontSize: "14px",
                        lineHeight: "20px",
                        letterSpacing: 0,
                        fontFamily: "OutfitRegular",
                        color: getStatusColor(service.status),
                        textTransform: "capitalize",
                      }}
                    >
                      {getStatusLabel(service.status)}
                    </Typography>
                  </Box>
                </Box>
              ))}
        </Box>
      </Box>

      {/* 90-DAY UPTIME CHART */}
      <Box
        width="100%"
        sx={{
          border: "1px solid",
          borderColor: "border.main",
          borderRadius: "16px",
          p: isMobile ? "25px" : "24px",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <TypographyTitle>{t("ninetyDayUptime")}</TypographyTitle>
          {uptimeData && (
            <Typography
              sx={{
                fontSize: "14px",
                fontFamily: "OutfitMedium",
                color: getStatusColor("operational"),
              }}
            >
              {uptimeData.uptime_percentage}%
            </Typography>
          )}
        </Box>

        {loading ? (
          <Skeleton
            variant="rounded"
            width="100%"
            height={32}
            sx={{ mt: "16px" }}
          />
        ) : (
          <Bars dailyStatus={uptimeData?.daily_status} />
        )}

        <Box
          sx={{ mt: "8px", display: "flex", justifyContent: "space-between" }}
        >
          <TypographyTime>{t("ninetyDaysAgo")}</TypographyTime>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            {/* Legend */}
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "2px",
                  backgroundColor: "#22C55E",
                }}
              />
              <TypographyTime>Operational</TypographyTime>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "2px",
                  backgroundColor: "#F59E0B",
                }}
              />
              <TypographyTime>Degraded</TypographyTime>
            </Box>
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "2px",
                  backgroundColor: "#E5E7EB",
                }}
              />
              <TypographyTime>No Data</TypographyTime>
            </Box>
          </Box>
          <TypographyTime>{t("today")}</TypographyTime>
        </Box>
      </Box>

      {/* RECENT INCIDENTS */}
      <Box
        width="100%"
        sx={{ display: "flex", flexDirection: "column", gap: "16px" }}
      >
        <TypographyTitle>{t("recentIncidents")}</TypographyTitle>
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              width="100%"
              height={136}
              sx={{ borderRadius: "16px" }}
            />
          ))
        ) : incidents.length === 0 ? (
          <Box
            sx={{
              border: "1px solid",
          borderColor: "border.main",
              borderRadius: "16px",
              p: "24px",
              textAlign: "center",
            }}
          >
            <TypographyDescription>
              {t('noRecentIncidents')}
            </TypographyDescription>
          </Box>
        ) : (
          incidents.map((incident, index) => (
            <Box
              key={incident.id || index}
              sx={{
                border: "1px solid",
          borderColor: "border.main",
                borderRadius: "16px",
                p: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography
                  sx={{
                    fontFamily: "OutfitMedium",
                    fontWeight: 500,
                    lineHeight: "24px",
                    letterSpacing: 0,
                    color: "text.primary",
                  }}
                >
                  {incident.title}
                </Typography>
                <TypographyTime>{incident.formatted_date}</TypographyTime>
              </Box>
              <TypographyDescription>
                {incident.description}
              </TypographyDescription>
              {incident.services_affected &&
                incident.services_affected.length > 0 && (
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    {incident.services_affected.map((svc) => (
                      <Box
                        key={svc}
                        sx={{
                          px: "8px",
                          py: "2px",
                          backgroundColor: "action.hover",
                          borderRadius: "4px",
                        }}
                      >
                        <Typography
                          sx={{
                            fontSize: "11px",
                            fontFamily: "OutfitRegular",
                            color: "text.secondary",
                            textTransform: "capitalize",
                          }}
                        >
                          {svc.replace(/_/g, " ")}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              <Box
                height={26}
                width={64}
                sx={{
                  px: "8px",
                  pt: "6px",
                  pb: "4px",
                  backgroundColor:
                    incident.status === "resolved" ? "#22C55E1A" : "#F59E0B1A",
                  borderRadius: "4px",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "12px",
                    fontFamily: "OutfitRegular",
                    fontWeight: 400,
                    lineHeight: "16px",
                    letterSpacing: 0,
                    color:
                      incident.status === "resolved" ? "#22C55E" : "#F59E0B",
                    textTransform: "capitalize",
                  }}
                >
                  {incident.status}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Box>

      {/* LAST UPDATED */}
      {!loading && (
        <TypographyTime sx={{ textAlign: "center" }}>
          {t('autoRefresh60')}
        </TypographyTime>
      )}
    </Box>
  );
};

export default StatusPage;
