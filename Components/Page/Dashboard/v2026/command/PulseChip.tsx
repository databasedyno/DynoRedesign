import React, { useState } from "react";
import { Box, Collapse, Skeleton, useTheme } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Icon } from "@/styles/uiKit";
import { statusToneColors } from "@/Components/UI/StatusDot";
import { CB_TOKENS } from "../../coinbase/styled";
import { GATEWAY_TONE, checkLabel, statusLabel, useGatewayHealth } from "../gatewayHealth";
import { relativeTime } from "./format";
import type { DashboardOverview } from "./useDashboardOverview";

interface Props {
  pulse?: DashboardOverview["pulse"] | null;
  loading?: boolean;
}

/**
 * PulseChip — one quiet line that says whether money is moving right now.
 * Turns amber/red only when Dynopay itself is degraded; then it expands to
 * show which service is affected (replaces the old always-on health strip).
 */
const PulseChip: React.FC<Props> = ({ pulse, loading }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("dashboardLayout");
  const { data: health } = useGatewayHealth();
  const [open, setOpen] = useState(false);

  const overall = health?.overall ?? "operational";
  const degraded = overall === "degraded" || overall === "outage";
  const confirming = Number(pulse?.confirming_count ?? 0);
  const awaiting = Number(pulse?.awaiting_count ?? 0);
  const lastPaid = relativeTime(pulse?.last_paid_at, t, i18n.language);

  const tone = degraded ? statusToneColors(GATEWAY_TONE[overall], isDark) : confirming > 0 ? statusToneColors("pending", isDark) : statusToneColors("settled", isDark);
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;

  let text: string;
  if (degraded) {
    text = overall === "outage"
      ? t("gateway.disruption", { defaultValue: "Service disruption" })
      : t("gateway.someDegraded", { defaultValue: "Some services are slow" });
  } else if (confirming > 0) {
    text = t("command.pulseConfirming", { count: confirming, defaultValue: "{{count}} confirming" });
  } else if (awaiting > 0) {
    text = t("command.pulseOpen", { count: awaiting, defaultValue: "{{count}} checkouts open" });
  } else {
    text = t("command.pulseQuiet", { defaultValue: "Quiet" });
  }
  const tail = !degraded && lastPaid
    ? ` · ${t("command.lastPaid", { when: lastPaid, defaultValue: "last paid {{when}}" })}`
    : !degraded && !loading && !pulse?.last_paid_at
      ? ` · ${t("command.noPaymentsYet", { defaultValue: "no payments yet" })}`
      : "";

  const affected = (health?.checks ?? []).filter((c) => c.status !== "operational");

  return (
    <Box sx={{ minWidth: 0 }}>
      <Box
        component={degraded ? "button" : "div"}
        type={degraded ? "button" : undefined}
        onClick={degraded ? () => setOpen((v) => !v) : undefined}
        data-testid="dashboard-live-pulse-chip"
        data-state={degraded ? overall : confirming > 0 ? "confirming" : "quiet"}
        aria-expanded={degraded ? open : undefined}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          minHeight: 36,
          px: 1.5,
          borderRadius: 999,
          border: "1px solid",
          borderColor: degraded ? `${tone.dot}66` : isDark ? CB_TOKENS.border.dark : CB_TOKENS.border.light,
          backgroundColor: degraded ? `${tone.dot}14` : isDark ? "rgba(255,255,255,0.03)" : "rgba(10,10,15,0.02)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          fontWeight: 600,
          color: ink,
          cursor: degraded ? "pointer" : "default",
          maxWidth: "100%",
          transition: "background-color 150ms ease, border-color 150ms ease",
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            backgroundColor: tone.dot,
            boxShadow: `0 0 0 3px ${tone.dot}33`,
            "@keyframes pulseDot": { "0%, 100%": { opacity: 1 }, "50%": { opacity: 0.35 } },
            animation: confirming > 0 || degraded ? "pulseDot 1.8s ease-in-out infinite" : "none",
            "@media (prefers-reduced-motion: reduce)": { animation: "none" },
          }}
        />
        {loading && !pulse ? (
          <Skeleton width={160} height={16} />
        ) : (
          <Box component="span" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {text}
            <Box component="span" sx={{ color: muted, fontWeight: 500 }}>{tail}</Box>
          </Box>
        )}
        {degraded && <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />}
      </Box>

      {degraded && (
        <Collapse in={open} unmountOnExit>
          <Box data-testid="dashboard-pulse-details" sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1.5, fontFamily: "var(--font-sans)", fontSize: 12.5 }}>
            {affected.map((c) => {
              const ct = statusToneColors(GATEWAY_TONE[c.status], isDark);
              return (
                <Box key={c.id} data-testid={`dashboard-pulse-check-${c.id}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, color: muted }}>
                  <Box aria-hidden sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: ct.dot }} />
                  <Box component="span" sx={{ color: ink, fontWeight: 600 }}>{checkLabel(t, c.id)}</Box>
                  {statusLabel(t, c.status)}
                </Box>
              );
            })}
            <Box
              component="a"
              href="/system-status"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="dashboard-pulse-status-link"
              sx={{ color: isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light, fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 0.5 }}
            >
              {t("gateway.statusPage", { defaultValue: "Status page" })}
              <Icon name="arrow-up-right" size={13} />
            </Box>
          </Box>
        </Collapse>
      )}
    </Box>
  );
};

export default PulseChip;
