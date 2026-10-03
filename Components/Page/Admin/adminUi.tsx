import React from "react";
import { Box, Paper, Typography, useTheme } from "@mui/material";
import { brandFg } from "@/constants/theme";

// ── Formatting helpers (shared across admin monitoring screens) ──────────────
export const formatUSD = (n: unknown): string => {
  const num = Number(n) || 0;
  return num.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
};

export const formatNumber = (n: unknown): string =>
  (Number(n) || 0).toLocaleString();

// Crypto amounts: magnitude-aware rounding so large balances stay tidy while
// tiny amounts keep enough precision (and JS float artifacts are dropped).
// >= 1000 → 2dp · >= 1 → 4dp · < 1 → up to 8dp (trailing zeros trimmed).
export const formatCrypto = (n: unknown): string => {
  const num = Number(n) || 0;
  const abs = Math.abs(num);
  const maxDecimals = abs >= 1000 ? 2 : abs >= 1 ? 4 : 8;
  return num.toLocaleString(undefined, { maximumFractionDigits: maxDecimals });
};

export const formatDate = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "—";

export const formatDateTime = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// ── Status chip (payments + merchant account states) ─────────────────────────
type ChipColor = "default" | "success" | "warning" | "error" | "info";

const STATUS_TONE: Record<string, ChipColor> = {
  successful: "success",
  success: "success",
  completed: "success",
  settled: "success",
  active: "success",
  confirmed: "success",
  pending: "warning",
  processing: "warning",
  confirming: "warning",
  awaiting: "warning",
  suspended: "warning",
  failed: "error",
  banned: "error",
  cancelled: "error",
  expired: "default",
};

const STATUS_DOT: Record<ChipColor, { light: string; dark: string }> = {
  success: { light: "#15803D", dark: "#4ADE80" },
  warning: { light: "#B45309", dark: "#FBBF24" },
  error: { light: "#B91C1C", dark: "#F87171" },
  info: { light: "#1D4ED8", dark: "#60A5FA" },
  default: { light: "#6B7280", dark: "#9CA3AF" },
};

export const AdminStatusChip: React.FC<{ status?: string | null; testid?: string }> = ({
  status,
  testid,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const label = (status || "unknown").toString();
  const tone = STATUS_TONE[label.toLowerCase()] || "default";
  const color = STATUS_DOT[tone][isDark ? "dark" : "light"];
  return (
    <Box
      data-testid={testid}
      data-tone={tone}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, minWidth: 0 }}
    >
      <Box
        component="span"
        sx={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, flexShrink: 0, boxShadow: `0 0 0 3px ${color}1f` }}
      />
      <Typography
        component="span"
        sx={{ fontSize: 12.5, fontWeight: 600, color, textTransform: "capitalize", whiteSpace: "nowrap" }}
      >
        {label}
      </Typography>
    </Box>
  );
};

// ── KPI stat card ─────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: string;
  testid?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  icon,
  accent,
  testid,
}) => {
  const theme = useTheme();
  const color = accent || brandFg(theme.palette.mode === "dark");
  return (
    <Paper
      variant="outlined"
      data-testid={testid}
      sx={{
        p: 2.5,
        borderRadius: "12px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        position: "relative",
        overflow: "hidden",
        transition: "border-color .2s ease",
        "&:hover": { borderColor: color },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.4,
            textTransform: "uppercase",
            color: "text.secondary",
          }}
        >
          {label}
        </Typography>
        {icon && (
          <Box
            sx={{
              width: 34,
              height: 34,
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
              backgroundColor: `${color}1A`,
            }}
          >
            {icon}
          </Box>
        )}
      </Box>
      <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: "text.primary" }}>
        {value}
      </Typography>
      {sub != null && (
        <Typography sx={{ fontSize: 12.5, color: "text.secondary" }}>{sub}</Typography>
      )}
    </Paper>
  );
};

// ── Section card wrapper ──────────────────────────────────────────────────────
export const SectionCard: React.FC<{
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  sx?: object;
  testid?: string;
}> = ({ title, action, children, sx, testid }) => (
  <Paper
    variant="outlined"
    data-testid={testid}
    sx={{ p: 2.5, borderRadius: "12px", height: "100%", ...sx }}
  >
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 2,
        gap: 1,
        flexWrap: "wrap",
      }}
    >
      <Typography sx={{ fontSize: 15, fontWeight: 700, color: "text.primary" }}>{title}</Typography>
      {action}
    </Box>
    {children}
  </Paper>
);
