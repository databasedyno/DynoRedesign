import React from "react";
import { Box, Skeleton, useTheme } from "@mui/material";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { Icon, MONO } from "@/styles/uiKit";
import useEdgeFade from "@/hooks/useEdgeFade";
import { DeltaChip, CB_TOKENS } from "../../coinbase/styled";
import { StatCard } from "../styled";
import { money, relativeTime } from "./format";
import type { DashboardOverview } from "./useDashboardOverview";

interface Props {
  overview: DashboardOverview | null | undefined;
  loading: boolean;
  rangeLabel: string;
  /** Transactions-page preset matching the dashboard range ("today" | "7d" | "30d" | "90d" | "all"). */
  txRange?: string;
}

const ASSET_SHADES = [1, 0.72, 0.5, 0.34, 0.22, 0.14];

interface TileProps {
  testId: string;
  eyebrow: string;
  value: React.ReactNode;
  loading: boolean;
  href: string;
  children?: React.ReactNode;
}

const Tile: React.FC<TileProps> = ({ testId, eyebrow, value, loading, href, children }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const router = useRouter();
  const ink = isDark ? CB_TOKENS.ink.primaryDark : CB_TOKENS.ink.primaryLight;
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  return (
    <StatCard
      data-testid={testId}
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      sx={{
        cursor: "pointer",
        gap: 1.25,
        flex: { xs: "0 0 78%", sm: "unset" },
        minWidth: { xs: 0, sm: "unset" },
        scrollSnapAlign: { xs: "start", sm: "unset" },
        "&:focus-visible": { outline: `2px solid ${isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light}`, outlineOffset: 2 },
        "&:hover .tile-arrow": { opacity: 1, transform: "translateX(0)" },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 700, letterSpacing: 1.1, textTransform: "uppercase", color: muted }}>{eyebrow}</Box>
        <Box className="tile-arrow" aria-hidden sx={{ color: muted, opacity: 0.5, transform: "translateX(-2px)", transition: "opacity 150ms ease, transform 150ms ease", display: "flex" }}>
          <Icon name="arrow-up-right" size={15} />
        </Box>
      </Box>
      <Box
        data-testid={`${testId}-value`}
        sx={{ fontFamily: MONO, fontVariantNumeric: "tabular-nums", fontSize: { xs: 26, md: 30, lg: 32 }, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.05, color: ink, minHeight: 34 }}
      >
        {loading ? <Skeleton width={150} height={34} /> : value}
      </Box>
      {loading ? <Skeleton width="80%" height={18} /> : children}
    </StatCard>
  );
};

/** Zone 3 — Settled · In flight · Forwarded to your wallets. Phone: swipeable row. */
const MoneyRow: React.FC<Props> = ({ overview, loading, rangeLabel, txRange }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, i18n } = useTranslation("dashboardLayout");
  const fade = useEdgeFade<HTMLDivElement>();
  const muted = isDark ? CB_TOKENS.ink.mutedDark : CB_TOKENS.ink.mutedLight;
  const secondary = isDark ? CB_TOKENS.ink.secondaryDark : CB_TOKENS.ink.secondaryLight;
  const indigo = isDark ? CB_TOKENS.indigo.dark : CB_TOKENS.indigo.light;

  const sym = overview?.currency_symbol || "$";
  const cur = overview?.currency || "USD";
  const s = overview?.settled;
  const f = overview?.forwarded;
  const inflight = overview?.in_flight;
  const isLoading = loading || !overview;
  const captionSx = { fontFamily: "var(--font-sans)", fontSize: 12.5, lineHeight: 1.45, color: muted } as const;
  const assets = (f?.by_asset ?? []).slice(0, 6);
  const assetTotal = assets.reduce((acc, a) => acc + a.amount, 0);

  return (
    <Box
      data-testid="money-row"
      ref={fade.ref}
      sx={{
        display: { xs: "flex", sm: "grid" },
        gridTemplateColumns: { sm: "repeat(3, minmax(0, 1fr))" },
        gap: { xs: 1.5, md: 2 },
        overflowX: { xs: "auto", sm: "visible" },
        scrollSnapType: { xs: "x mandatory", sm: "none" },
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        "&::-webkit-scrollbar": { display: "none" },
        maskImage: { xs: fade.maskImage, sm: "none" },
        WebkitMaskImage: { xs: fade.WebkitMaskImage, sm: "none" },
        alignItems: "stretch",
      }}
    >
      <Tile
        testId="money-tile-settled"
        eyebrow={`${t("command.settled", { defaultValue: "Settled" })} · ${rangeLabel}`}
        value={money(s?.net ?? 0, sym, cur)}
        loading={isLoading}
        href={`/transactions?status=settled${txRange ? `&range=${txRange}` : ""}`}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          {s && s.previous_net > 0 && (
            <DeltaChip positive={s.delta_pct >= 0} data-testid="money-tile-settled-delta">
              <Icon name={s.delta_pct >= 0 ? "arrow-up" : "arrow-down"} size={12} />
              {Math.abs(s.delta_pct).toFixed(1)}%
            </DeltaChip>
          )}
          <Box component="span" sx={captionSx}>
            {t("command.settledCaption", { count: s?.count ?? 0, defaultValue: "{{count}} payments · vs previous period" })}
          </Box>
        </Box>
        <Box data-testid="money-tile-settled-gross" sx={{ ...captionSx, fontFamily: MONO, fontVariantNumeric: "tabular-nums", color: secondary }}>
          {t("command.grossFees", { gross: money(s?.gross ?? 0, sym, cur), fees: money(s?.fees ?? 0, sym, cur), defaultValue: "gross {{gross}} · fees {{fees}}" })}
        </Box>
      </Tile>

      <Tile
        testId="money-tile-in-flight"
        eyebrow={t("command.inFlight", { defaultValue: "In flight" })}
        value={money(inflight?.amount ?? 0, sym, cur)}
        loading={isLoading}
        href="/transactions?status=pending"
      >
        <Box sx={captionSx} data-testid="money-tile-in-flight-caption">
          {(inflight?.count ?? 0) > 0
            ? t("command.inFlightCaption", { count: inflight!.count, defaultValue: "{{count}} payments seen on-chain, awaiting confirmations" })
            : t("command.inFlightEmpty", { defaultValue: "Nothing confirming right now" })}
        </Box>
        {(overview?.pulse.awaiting_count ?? 0) > 0 && (
          <Box sx={{ ...captionSx, color: secondary }} data-testid="money-tile-in-flight-open">
            {t("command.checkoutsOpen", { count: overview!.pulse.awaiting_count, defaultValue: "{{count}} checkouts open, no funds yet" })}
          </Box>
        )}
      </Tile>

      <Tile
        testId="money-tile-forwarded"
        eyebrow={t("command.forwarded", { defaultValue: "Forwarded to your wallets" })}
        value={money(f?.amount ?? 0, sym, cur)}
        loading={isLoading}
        href="/payouts"
      >
        {assets.length > 0 && assetTotal > 0 ? (
          <>
            <Box aria-hidden data-testid="money-tile-forwarded-bars" sx={{ display: "flex", height: 6, borderRadius: 999, overflow: "hidden", gap: "2px" }}>
              {assets.map((a, i) => (
                <Box key={a.asset} sx={{ width: `${Math.max(2, (a.amount / assetTotal) * 100)}%`, backgroundColor: indigo, opacity: ASSET_SHADES[i] ?? 0.14 }} />
              ))}
            </Box>
            <Box sx={{ ...captionSx, display: "flex", flexWrap: "wrap", gap: "4px 10px" }}>
              {assets.slice(0, 3).map((a, i) => (
                <Box key={a.asset} component="span" data-testid={`money-tile-forwarded-asset-${a.asset}`} sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                  <Box component="span" aria-hidden sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: indigo, opacity: ASSET_SHADES[i] }} />
                  <Box component="span" sx={{ color: secondary, fontWeight: 600 }}>{a.asset}</Box>
                  {Math.round((a.amount / assetTotal) * 100)}%
                </Box>
              ))}
            </Box>
          </>
        ) : (
          <Box sx={captionSx}>{t("command.forwardedEmpty", { defaultValue: "No payouts forwarded in this range" })}</Box>
        )}
        <Box sx={{ ...captionSx, display: "flex", flexWrap: "wrap", gap: "2px 8px" }}>
          {f?.last_at && (
            <Box component="span" data-testid="money-tile-forwarded-last">
              {t("command.lastForward", { when: relativeTime(f.last_at, t, i18n.language), defaultValue: "Last forward {{when}}" })}
            </Box>
          )}
          {f?.auto_convert?.enabled && (
            <Box component="span" data-testid="money-tile-forwarded-autoconvert" sx={{ color: secondary }}>
              {t("command.convertedTo", { target: f.auto_convert.target || "USDT", amount: money(f.auto_convert.converted_amount, sym, cur), defaultValue: "Converted to {{target}}: {{amount}}" })}
            </Box>
          )}
        </Box>
      </Tile>
    </Box>
  );
};

export default MoneyRow;
