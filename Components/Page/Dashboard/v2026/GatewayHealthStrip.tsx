import React from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import { StatusDot, statusToneColors } from "@/Components/UI/StatusDot";
import { SurfaceCard, CB_TOKENS } from "../coinbase/styled";
import {
  GATEWAY_TONE,
  CHECK_ICON,
  agoLabel,
  checkLabel,
  overallLabel,
  statusLabel,
  useGatewayHealth,
  type GatewayCheck,
} from "./gatewayHealth";

const CheckChip: React.FC<{ check: GatewayCheck }> = ({ check }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const hint =
    check.id === "rates"
      ? agoLabel(t, check.updated_at)
      : check.id === "api" && check.latency_ms
        ? `${check.latency_ms} ms`
        : null;
  return (
    <Box
      data-testid={`gateway-check-${check.id}`}
      data-status={check.status}
      title={hint ? `${checkLabel(t, check.id)} · ${hint}` : undefined}
      sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}
    >
      <Box sx={{ color: muted, display: "flex", flexShrink: 0 }}>
        <Icon name={CHECK_ICON[check.id]} size={15} />
      </Box>
      <Box sx={{ minWidth: 0, lineHeight: 1.2 }}>
        <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 12.5, fontWeight: 600, color: secondary, whiteSpace: "nowrap" }}>
          {checkLabel(t, check.id)}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, whiteSpace: "nowrap" }}>
          <StatusDot tone={GATEWAY_TONE[check.status]} sx={{ fontSize: 12, fontWeight: 600 }}>
            {statusLabel(t, check.status)}
          </StatusDot>
          {hint && (
            <Box component="span" sx={{ fontFamily: MONO, fontSize: 11, color: muted }}>
              · {hint}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/** GatewayHealthStrip — live gateway status (payments · rates · webhooks · api), refreshed every 60 s. */
const GatewayHealthStrip: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");
  const { data, isLoading, error } = useGatewayHealth();

  if (!data && !isLoading) return null;
  if (error && !data) return null;

  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;
  const overall = data?.overall ?? "unknown";
  const tone = statusToneColors(GATEWAY_TONE[overall], isDark);

  return (
    <SurfaceCard
      data-testid="dash2026-gateway-health"
      data-overall={overall}
      sx={{
        px: { xs: 2, md: 2.5 },
        py: { xs: 1.75, md: 1.5 },
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "auto 1fr auto" },
        alignItems: "center",
        gap: { xs: 1.5, lg: 3 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: tone.dot,
            boxShadow: `0 0 0 3px ${tone.dot}33`,
            "@keyframes gatewayPulse": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.4 } },
            animation: overall === "operational" ? "gatewayPulse 2.4s ease-in-out infinite" : "none",
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: muted }}>
            {t("gateway.title", { defaultValue: "Gateway health" })}
          </Box>
          <Box data-testid="gateway-overall" sx={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: ink, whiteSpace: "nowrap" }}>
            {isLoading && !data ? <Skeleton width={140} /> : overallLabel(t, overall)}
          </Box>
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, minmax(0, 1fr))" },
          gap: { xs: 1.25, md: 2 },
          minWidth: 0,
        }}
      >
        {isLoading && !data
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} height={34} sx={{ transform: "none" }} />)
          : data?.checks.map((c) => <CheckChip key={c.id} check={c} />)}
      </Box>

      <Box
        component="a"
        href="/system-status"
        target="_blank"
        rel="noopener noreferrer"
        data-testid="gateway-status-page-link"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 0.5,
          justifySelf: { xs: "start", lg: "end" },
          fontFamily: "var(--font-sans)",
          fontSize: 12.5,
          fontWeight: 600,
          color: indigo,
          textDecoration: "none",
          borderRadius: "8px",
          px: 0.5,
          mx: -0.5,
          whiteSpace: "nowrap",
          transition: "background-color 150ms ease",
          "&:hover": { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,10,15,0.04)" },
          "&:focus-visible": { outline: `2px solid ${indigo}`, outlineOffset: 2 },
        }}
      >
        {t("gateway.statusPage", { defaultValue: "Status page" })}
        <Icon name="arrow-up-right" size={14} />
      </Box>
    </SurfaceCard>
  );
};

export default GatewayHealthStrip;
