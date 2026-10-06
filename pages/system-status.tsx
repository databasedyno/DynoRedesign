import useIsMobile from "@/hooks/useIsMobile";
import { Box, Typography, Skeleton } from "@mui/material";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import Head from "next/head";
import { Icon } from "@iconify/react";
import Bars from "@/Components/UI/APIStatus/Bars";
import { API_ENDPOINTS } from "@/api/endpoints";
import useApiSWR from "@/hooks/useApiSWR";
import PageHeroV8 from "@/Components/Page/Home/v8/PageHeroV8";
import CtaBandV8 from "@/Components/Page/Home/v8/CtaBandV8";
import { SectionV8, GradientText, PANEL, FONT_BODY, FONT_DISPLAY, FONT_MONO, useConsole } from "@/Components/Page/Home/v8/kit";

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
  summary: { operational_days: number; degraded_days: number; outage_days: number };
  daily_status: UptimeDay[];
}

const DOT: Record<string, string> = {
  operational: "#22C55E",
  degraded: "#F59E0B",
  outage: "#EF4444",
  partial_outage: "#EF4444",
};
const TEXT_DARK: Record<string, string> = {
  operational: "#4ADE80",
  degraded: "#FBBF24",
  outage: "#F87171",
  partial_outage: "#F87171",
};
const TEXT_LIGHT: Record<string, string> = {
  operational: "#15803D",
  degraded: "#B45309",
  outage: "#B91C1C",
  partial_outage: "#B91C1C",
};

const StatusPage = () => {
  const isMobile = useIsMobile();
  const { t } = useTranslation("apiStatus");
  const s = useConsole();

  const { data: services = [], isLoading: sLoading } = useApiSWR<ServiceData[]>(API_ENDPOINTS.status.services, {
    refreshInterval: 60000,
    select: (raw) => (raw?.data?.services as ServiceData[]) ?? [],
  });
  const { data: incidents = [], isLoading: iLoading } = useApiSWR<IncidentData[]>(API_ENDPOINTS.status.incidents, {
    refreshInterval: 60000,
    select: (raw) => (raw?.data?.incidents as IncidentData[]) ?? [],
  });
  const { data: uptimeData = null, isLoading: uLoading } = useApiSWR<UptimeData | null>(API_ENDPOINTS.status.uptime, {
    refreshInterval: 60000,
    select: (raw) => (raw?.data as UptimeData) ?? null,
  });

  const loading = sLoading || iLoading || uLoading;
  const overallStatus = useMemo<string>(() => {
    if (!services.length) return "operational";
    const hasOutage = services.some((x) => x.status === "outage");
    const allOp = services.every((x) => x.status === "operational");
    return hasOutage ? "partial_outage" : allOp ? "operational" : "degraded";
  }, [services]);

  const dotColor = (status: string) => DOT[status] || "#8A8A86";
  const textColor = (status: string, onDark: boolean) => (onDark ? TEXT_DARK[status] : TEXT_LIGHT[status]) || (onDark ? PANEL.ink2 : s.ink2);
  const statusLabel = (status: string) => {
    switch (status) {
      case "operational": return t("operational");
      case "degraded": return t("degraded", { defaultValue: "Degraded" });
      case "outage": return t("outage", { defaultValue: "Outage" });
      case "partial_outage": return t("partialOutage", { defaultValue: "Partial Outage" });
      default: return t("unknown", { defaultValue: "Unknown" });
    }
  };

  const overallChip = loading ? (
    <Skeleton variant="rounded" width={260} height={46} sx={{ borderRadius: "999px" }} data-testid="status-overall-loading" />
  ) : (
    <Box
      data-testid="status-overall-chip"
      data-status={overallStatus}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.25,
        px: 2.25,
        py: 1.15,
        borderRadius: "999px",
        border: `1px solid ${dotColor(overallStatus)}40`,
        background: s.surface,
        boxShadow: s.dark ? "none" : "0 2px 10px rgba(17,18,20,0.05)",
      }}
    >
      <Box
        component="span"
        sx={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          backgroundColor: dotColor(overallStatus),
          flexShrink: 0,
          boxShadow: `0 0 0 4px ${dotColor(overallStatus)}26`,
          animation: "dp-status-pulse 2.4s ease-in-out infinite",
          "@keyframes dp-status-pulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.45 } },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      />
      <Typography sx={{ fontWeight: 600, fontSize: 14.5, color: textColor(overallStatus, s.dark), fontFamily: FONT_DISPLAY }}>
        {overallStatus === "operational" ? t("allSystemsOperational") : statusLabel(overallStatus)}
      </Typography>
    </Box>
  );

  const uptimePct = (() => {
    if (!uptimeData) return null;
    const sm = uptimeData.summary;
    const daysWithData = sm ? sm.operational_days + sm.degraded_days + sm.outage_days : 0;
    const enoughData = daysWithData >= 30;
    return { enoughData, value: uptimeData.uptime_percentage };
  })();

  return (
    <Box data-testid="system-status-page" sx={{ background: s.canvas }}>
      <Head>
        <title>{t("metaTitle", { defaultValue: "System Status · Dynopay" })}</title>
        <meta name="description" content={t("statusSubtitle", { defaultValue: "Real-time health, latency and 90-day availability across Dynopay payment infrastructure." })} />
        <link key="canonical" rel="canonical" href="https://dynopay.com/system-status" />
      </Head>

      <PageHeroV8
        testId="status-hero"
        eyebrow={t("eyebrow", { defaultValue: "Live operational metrics" })}
        title={
          <>
            {t("statusHeroLead", { defaultValue: "Dynopay" })} <GradientText>{t("statusHeroAccent", { defaultValue: "System Status" })}</GradientText>
          </>
        }
        body={t("statusSubtitle")}
        actions={overallChip}
      />

      {/* ───────── SERVICES — dark live monitor panel ───────── */}
      <SectionV8 testId="status-services" dark glow maxWidth={900} sx={{ py: { xs: 7, md: 10 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 3 }}>
          <Icon icon="mdi:pulse" width={20} height={20} color={PANEL.gold} />
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: PANEL.ink }}>{t("services")}</Typography>
        </Box>

        <Box data-testid="status-services-list" sx={{ border: `1px solid ${PANEL.line}`, borderRadius: "16px", overflow: "hidden", background: PANEL.surface }}>
          {loading
            ? Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ height: isMobile ? 72 : 58, display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, borderTop: i === 0 ? "none" : `1px solid ${PANEL.line}` }}>
                  <Skeleton variant="text" width={160} height={22} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
                  <Skeleton variant="text" width={90} height={20} sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
                </Box>
              ))
            : services.map((service, index) => (
                <Box
                  key={service.id || index}
                  data-testid={`status-service-row-${service.id || index}`}
                  sx={{
                    minHeight: isMobile ? 72 : 58,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 2,
                    px: 3,
                    py: isMobile ? 1.5 : 0,
                    borderTop: index === 0 ? "none" : `1px solid ${PANEL.line}`,
                    transition: "background-color 160ms ease",
                    "&:hover": { background: "rgba(255,255,255,0.03)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                    <Box sx={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: dotColor(service.status), flexShrink: 0, boxShadow: `0 0 0 4px ${dotColor(service.status)}22` }} />
                    <Typography sx={{ fontFamily: FONT_BODY, fontSize: 15, color: PANEL.ink, lineHeight: 1.3 }}>{service.name}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: isMobile ? 1.5 : 2.5, flexShrink: 0 }}>
                    <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12.5, color: PANEL.ink2 }}>{service.uptime} {t("uptime")}</Typography>
                    {service.latency_ms > 0 && !isMobile && (
                      <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12.5, color: PANEL.ink3 }}>{service.latency_ms}ms</Typography>
                    )}
                    <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 13.5, color: textColor(service.status, true), textTransform: "capitalize", minWidth: isMobile ? "auto" : 92, textAlign: "right" }}>
                      {statusLabel(service.status)}
                    </Typography>
                  </Box>
                </Box>
              ))}
        </Box>
      </SectionV8>

      {/* ───────── 90-DAY UPTIME + INCIDENTS — light canvas ───────── */}
      <SectionV8 testId="status-detail" maxWidth={900} sx={{ py: { xs: 7, md: 11 } }}>
        {/* Uptime chart */}
        <Box data-testid="status-uptime-chart" sx={{ border: `1px solid ${s.line}`, borderRadius: "16px", p: { xs: 2.5, md: 3.5 }, background: s.surface, mb: { xs: 5, md: 7 } }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: s.ink }}>{t("ninetyDayUptime")}</Typography>
            {uptimePct && (
              <Typography sx={{ fontFamily: FONT_MONO, fontSize: 14, color: uptimePct.enoughData ? (s.dark ? "#4ADE80" : "#15803D") : s.ink3 }}>
                {uptimePct.enoughData ? `${uptimePct.value}%` : t("collectingData", { defaultValue: "Collecting data" })}
              </Typography>
            )}
          </Box>

          {loading ? (
            <Skeleton variant="rounded" width="100%" height={32} sx={{ mt: 1 }} />
          ) : (
            <Bars dailyStatus={uptimeData?.daily_status} />
          )}

          <Box sx={{ mt: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, color: s.ink3 }}>{t("ninetyDaysAgo")}</Typography>
            <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
              {[
                { c: "#22C55E", l: t("operational") },
                { c: "#F59E0B", l: t("degraded", { defaultValue: "Degraded" }) },
                { c: s.dark ? "#3A3A38" : "#E5E7EB", l: t("noData", { defaultValue: "No Data" }) },
              ].map((x) => (
                <Box key={x.l} sx={{ display: "flex", gap: 0.6, alignItems: "center" }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "2px", backgroundColor: x.c }} />
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, color: s.ink3 }}>{x.l}</Typography>
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontFamily: FONT_MONO, fontSize: 11.5, color: s.ink3 }}>{t("today")}</Typography>
          </Box>
        </Box>

        {/* Recent incidents */}
        <Box data-testid="status-recent-incidents" sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 18, color: s.ink }}>{t("recentIncidents")}</Typography>
          {loading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} variant="rounded" width="100%" height={120} sx={{ borderRadius: "16px" }} />)
          ) : incidents.length === 0 ? (
            <Box sx={{ border: `1px solid ${s.line}`, borderRadius: "16px", p: 3.5, textAlign: "center", background: s.surface, display: "flex", flexDirection: "column", alignItems: "center", gap: 1.25 }}>
              <Box sx={{ width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(34,197,94,0.12)" }}>
                <Icon icon="mdi:check" width={18} height={18} color="#22C55E" />
              </Box>
              <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14.5, color: s.ink2 }}>{t("noRecentIncidents")}</Typography>
            </Box>
          ) : (
            incidents.map((incident, index) => (
              <Box key={incident.id || index} sx={{ border: `1px solid ${s.line}`, borderRadius: "16px", p: 3, background: s.surface, display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "baseline" }}>
                  <Typography sx={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: 15.5, color: s.ink }}>{incident.title}</Typography>
                  <Typography sx={{ fontFamily: FONT_MONO, fontSize: 12, color: s.ink3, flexShrink: 0 }}>{incident.formatted_date}</Typography>
                </Box>
                <Typography sx={{ fontFamily: FONT_BODY, fontSize: 14, color: s.ink2, lineHeight: 1.6 }}>{incident.description}</Typography>
                {incident.services_affected && incident.services_affected.length > 0 && (
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
                    {incident.services_affected.map((svc) => (
                      <Box key={svc} sx={{ px: 1, py: 0.3, borderRadius: "999px", border: `1px solid ${s.line}` }}>
                        <Typography sx={{ fontSize: 10.5, fontFamily: FONT_MONO, color: s.ink3, textTransform: "capitalize", letterSpacing: "0.04em" }}>{svc.replace(/_/g, " ")}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, backgroundColor: incident.status === "resolved" ? "#22C55E" : "#F59E0B" }} />
                  <Typography sx={{ fontSize: 12, fontFamily: FONT_DISPLAY, fontWeight: 600, color: incident.status === "resolved" ? (s.dark ? "#4ADE80" : "#15803D") : (s.dark ? "#FBBF24" : "#B45309"), textTransform: "capitalize" }}>
                    {incident.status}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>

        {!loading && (
          <Typography sx={{ mt: 4, textAlign: "center", fontFamily: FONT_MONO, fontSize: 11.5, color: s.ink3 }}>{t("autoRefresh60")}</Typography>
        )}
      </SectionV8>

      <CtaBandV8
        testId="status-final-cta"
        badge={t("statusCtaBadge", { defaultValue: "99.9% uptime SLA" })}
        title={t("statusCtaTitle", { defaultValue: "Payment rails you can trust" })}
        body={t("statusCtaBody", { defaultValue: "Accept crypto on infrastructure built for uptime — non-custodial, monitored around the clock." })}
        primaryLabel={t("statusCtaPrimary", { defaultValue: "Start free" })}
        primaryRef="status_final"
        secondaryLabel={t("documentation", { ns: "landing", defaultValue: "Read the docs" })}
        secondaryHref="/documentation"
      />
    </Box>
  );
};

export default StatusPage;
