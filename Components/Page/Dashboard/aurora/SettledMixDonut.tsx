// SettledMixDonut — coin-mix breakdown of recent settled transactions.
// Coral / violet / volt / sky slices; mono legend under the donut.
import { Box, Skeleton, Typography, useTheme } from "@mui/material";
import React, { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  CORAL,
  Eyebrow,
  MonoLabel,
  SKY,
  SurfaceCard,
  VIOLET,
  VOLT_INK,
} from "./styled";

interface Props {
  loading: boolean;
  recentTransactions: any[];
}

// Palette for the donut — coral, violet, volt-ink, sky, plus a fallback grey.
const SLICE_COLORS = [CORAL, VIOLET, VOLT_INK, SKY, "#71717A"];

const SettledMixDonut: React.FC<Props> = ({ loading, recentTransactions }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";
  const { t } = useTranslation("dashboardLayout");

  // Aggregate recentTransactions by crypto currency, keep top 4 + "Others".
  const data = useMemo(() => {
    const list = Array.isArray(recentTransactions) ? recentTransactions : [];
    const buckets = new Map<string, number>();
    for (const tx of list) {
      const crypto =
        (tx?.crypto_currency || tx?.cryptocurrency || tx?.currency || "").toString().toUpperCase() ||
        "OTHER";
      const amt = Number(tx?.base_amount ?? tx?.amount ?? 0);
      if (!Number.isFinite(amt) || amt <= 0) continue;
      buckets.set(crypto, (buckets.get(crypto) ?? 0) + amt);
    }

    const sorted = Array.from(buckets.entries()).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((s, [, v]) => s + v, 0);
    if (total === 0) return [];

    const top = sorted.slice(0, 4);
    const rest = sorted.slice(4);
    const restSum = rest.reduce((s, [, v]) => s + v, 0);

    const rows = top.map(([name, value], i) => ({
      name,
      value,
      pct: Math.round((value / total) * 100),
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }));
    if (restSum > 0) {
      rows.push({
        name: "OTHER",
        value: restSum,
        pct: Math.round((restSum / total) * 100),
        color: SLICE_COLORS[4],
      });
    }
    // Drop slices that round to 0% — they add legend noise ("ETH 0% / BTC 0%")
    // without being visible on the donut. Keep at least the largest slice.
    const visible = rows.filter((r) => r.pct >= 1);
    return visible.length > 0 ? visible : rows.slice(0, 1);
  }, [recentTransactions]);

  const isEmpty = !loading && data.length === 0;

  return (
    <SurfaceCard
      data-testid="aurora-settled-mix"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minHeight: 280,
      }}
    >
      <Eyebrow>{t("settledIn") || "Settled in"}</Eyebrow>

      {loading ? (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <Skeleton variant="circular" width={140} height={140} />
        </Box>
      ) : isEmpty ? (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            py: 4,
            textAlign: "center",
          }}
        >
          <Box
            sx={{
              width: 88,
              height: 88,
              borderRadius: "50%",
              border: `10px solid ${dark ? "rgba(255,255,255,0.10)" : "rgba(10,10,10,0.08)"}`,
            }}
          />
          <MonoLabel>{t("noPaymentsYet") || "No payments yet"}</MonoLabel>
        </Box>
      ) : (
        <>
          <Box
            sx={{
              width: "100%",
              height: 180,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={54}
                  outerRadius={78}
                  paddingAngle={2}
                  dataKey="value"
                  stroke={dark ? "#15151B" : "#FFFFFF"}
                  strokeWidth={2}
                >
                  {data.map((entry, i) => (
                    <Cell key={`cell-${i}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: dark ? "#0B0B0F" : "#FFFFFF",
                    border: `1px solid ${dark ? "rgba(255,255,255,0.12)" : "rgba(10,10,10,0.10)"}`,
                    borderRadius: 10,
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                  }}
                  formatter={(v: number, _n: any, item: any) => [
                    `${item.payload.pct}%`,
                    item.payload.name,
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <Typography
                sx={{
                  fontFamily: "var(--font-hero)",
                  fontWeight: 700,
                  fontSize: 20,
                  color: dark ? "#F5F5F5" : "#0A0A0A",
                  lineHeight: 1,
                }}
              >
                {data.length}
              </Typography>
              <MonoLabel sx={{ mt: 0.5, fontSize: 10 }}>
                {data.length === 1 ? "COIN" : "COINS"}
              </MonoLabel>
            </Box>
          </Box>

          {/* Legend */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
            {data.map((row) => (
              <Box
                key={row.name}
                sx={{ display: "flex", alignItems: "center", gap: 0.75 }}
              >
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: row.color,
                  }}
                />
                <MonoLabel sx={{ fontSize: 11 }}>
                  {row.name} {row.pct}%
                </MonoLabel>
              </Box>
            ))}
          </Box>
        </>
      )}
    </SurfaceCard>
  );
};

export default memo(SettledMixDonut);
